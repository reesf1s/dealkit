/**
 * Slack Proactive Messages — bot-initiated DMs for important events.
 *
 * Each function:
 *   1. Looks up the workspace's slack_connections for the bot token
 *   2. Looks up the user's slack_user_mappings for their Slack user ID
 *   3. Opens a DM channel and sends a Block Kit message
 *   4. Gracefully fails if Slack isn't connected (log + return, never throws)
 *
 * Exported functions:
 *   sendGapAnalysisResults()  — after Linear issue matching finds hits
 *   sendScoreDropAlert()      — when a deal's score drops >10pts
 *   sendLoopStatusChange()    — when a linked Linear issue ships
 *   sendDailyBrief()          — morning summary of pipeline priorities
 */

import { db } from '@/lib/db'
import { dealLogs, slackConnections, slackUserMappings } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'
import { slackOpenDm, slackPostMessage, type SlackBlock } from '@/lib/slack-client'

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const LOG_PREFIX = '[slack-proactive]'

/** Decrypt and return the bot token for a workspace, or null if not connected. */
async function getBotToken(workspaceId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ botTokenEnc: slackConnections.botTokenEnc })
      .from(slackConnections)
      .where(eq(slackConnections.workspaceId, workspaceId))
      .limit(1)
    if (!row) return null
    return decrypt(row.botTokenEnc, getEncryptionKey())
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to get bot token for workspace ${workspaceId}:`, err)
    return null
  }
}

/** Look up the Slack user ID for a Clerk user in a workspace. */
async function getSlackUserId(workspaceId: string, clerkUserId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ slackUserId: slackUserMappings.slackUserId })
      .from(slackUserMappings)
      .where(and(
        eq(slackUserMappings.workspaceId, workspaceId),
        eq(slackUserMappings.clerkUserId, clerkUserId),
      ))
      .limit(1)
    return row?.slackUserId ?? null
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to look up Slack user for ${clerkUserId}:`, err)
    return null
  }
}

/** Open a DM and send blocks. Returns true if sent, false otherwise. */
async function sendDm(
  token: string,
  slackUserId: string,
  blocks: SlackBlock[],
  fallbackText: string,
): Promise<boolean> {
  const channelId = await slackOpenDm(token, slackUserId)
  if (!channelId) {
    console.warn(`${LOG_PREFIX} Could not open DM with Slack user ${slackUserId}`)
    return false
  }
  const res = await slackPostMessage(token, channelId, blocks, fallbackText)
  return res.ok
}

/** Format a currency value as GBP. */
function gbp(value: number | null | undefined): string {
  if (!value) return '£0'
  return `£${value.toLocaleString('en-GB')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Gap Analysis Results
// ─────────────────────────────────────────────────────────────────────────────

export interface GapIssue {
  issueId: string
  title: string
  relevanceScore?: number
}

/**
 * After gap analysis finds matching Linear issues for a deal, DM the
 * assigned rep (or deal creator) with the results.
 */
export async function sendGapAnalysisResults(
  workspaceId: string,
  dealId: string,
  issues: GapIssue[],
): Promise<void> {
  if (!issues.length) return

  const token = await getBotToken(workspaceId)
  if (!token) {
    console.log(`${LOG_PREFIX} Skipping gap analysis DM — Slack not connected for workspace ${workspaceId}`)
    return
  }

  // Load deal info to get company name and the right user to notify
  const [deal] = await db
    .select({
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      assignedRepId: dealLogs.assignedRepId,
      userId: dealLogs.userId,
    })
    .from(dealLogs)
    .where(eq(dealLogs.id, dealId))
    .limit(1)

  if (!deal) {
    console.warn(`${LOG_PREFIX} Deal ${dealId} not found — skipping gap analysis DM`)
    return
  }

  const targetClerkUser = deal.assignedRepId ?? deal.userId
  if (!targetClerkUser) return

  const slackUserId = await getSlackUserId(workspaceId, targetClerkUser)
  if (!slackUserId) {
    console.log(`${LOG_PREFIX} No Slack mapping for user ${targetClerkUser} — skipping gap analysis DM`)
    return
  }

  const company = deal.prospectCompany ?? deal.dealName
  const issueCount = issues.length
  const issueBullets = issues
    .slice(0, 5)
    .map(i => `• *${i.title}*${i.relevanceScore ? ` (${Math.round(i.relevanceScore * 100)}% match)` : ''}`)
    .join('\n')
  const moreNote = issueCount > 5 ? `\n_...and ${issueCount - 5} more_` : ''

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:mag: I just analysed your deal with *${company}*. Found *${issueCount} issue${issueCount > 1 ? 's' : ''}* in Linear that could help close this:`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${issueBullets}${moreNote}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Prioritise These', emoji: true },
          style: 'primary',
          action_id: 'gap_prioritise',
          value: JSON.stringify({ dealId, issueIds: issues.map(i => i.issueId) }),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Dismiss' },
          action_id: 'gap_dismiss',
          value: dealId,
        },
      ],
    },
  ]

  const fallback = `Found ${issueCount} Linear issues for your ${company} deal — want me to prioritise them?`
  const sent = await sendDm(token, slackUserId, blocks, fallback)
  if (sent) {
    console.log(`${LOG_PREFIX} Sent gap analysis DM for deal ${dealId} (${issueCount} issues) to ${slackUserId}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Score Drop Alert
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When a deal's conversion score drops >10 points, DM the rep with
 * the drop details, top risk factor, and a suggested action.
 */
export async function sendScoreDropAlert(
  workspaceId: string,
  dealId: string,
  oldScore: number,
  newScore: number,
): Promise<void> {
  const drop = oldScore - newScore
  if (drop <= 10) return

  const token = await getBotToken(workspaceId)
  if (!token) {
    console.log(`${LOG_PREFIX} Skipping score drop DM — Slack not connected for workspace ${workspaceId}`)
    return
  }

  const [deal] = await db
    .select({
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      dealValue: dealLogs.dealValue,
      assignedRepId: dealLogs.assignedRepId,
      userId: dealLogs.userId,
      dealRisks: dealLogs.dealRisks,
      stage: dealLogs.stage,
    })
    .from(dealLogs)
    .where(eq(dealLogs.id, dealId))
    .limit(1)

  if (!deal) return

  const targetClerkUser = deal.assignedRepId ?? deal.userId
  if (!targetClerkUser) return

  const slackUserId = await getSlackUserId(workspaceId, targetClerkUser)
  if (!slackUserId) {
    console.log(`${LOG_PREFIX} No Slack mapping for user ${targetClerkUser} — skipping score drop DM`)
    return
  }

  const company = deal.prospectCompany ?? deal.dealName

  // Extract top risk from dealRisks JSON (array of strings or objects)
  let topRisk = 'Score signals weakening'
  let suggestedAction = 'Review the deal timeline and re-engage the prospect.'
  try {
    const risks = deal.dealRisks as string[] | { risk: string; action?: string }[] | null
    if (Array.isArray(risks) && risks.length > 0) {
      const first = risks[0]
      if (typeof first === 'string') {
        topRisk = first
      } else if (first && typeof first === 'object' && 'risk' in first) {
        topRisk = first.risk
        if (first.action) suggestedAction = first.action
      }
    }
  } catch { /* use defaults */ }

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:chart_with_downwards_trend: *${company}* score dropped from *${oldScore}%* to *${newScore}%* (${gbp(deal.dealValue as number | null)})`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Top risk:*\n${topRisk}` },
        { type: 'mrkdwn', text: `*Consider:*\n${suggestedAction}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Deal', emoji: true },
          action_id: 'view_deal',
          value: dealId,
        },
      ],
    },
  ]

  const fallback = `${company} score dropped from ${oldScore}% to ${newScore}%. Top risk: ${topRisk}`
  const sent = await sendDm(token, slackUserId, blocks, fallback)
  if (sent) {
    console.log(`${LOG_PREFIX} Sent score drop DM for ${company} (${oldScore} → ${newScore}) to ${slackUserId}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Loop Status Change (Linear issue shipped)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When a linked Linear issue moves to "done", DM the rep that the
 * feature shipped and it's time to follow up with the prospect.
 */
export async function sendLoopStatusChange(
  workspaceId: string,
  dealId: string,
  issueTitle: string,
  newStatus: string,
): Promise<void> {
  const token = await getBotToken(workspaceId)
  if (!token) {
    console.log(`${LOG_PREFIX} Skipping loop status DM — Slack not connected for workspace ${workspaceId}`)
    return
  }

  const [deal] = await db
    .select({
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      prospectName: dealLogs.prospectName,
      dealValue: dealLogs.dealValue,
      assignedRepId: dealLogs.assignedRepId,
      userId: dealLogs.userId,
    })
    .from(dealLogs)
    .where(eq(dealLogs.id, dealId))
    .limit(1)

  if (!deal) return

  const targetClerkUser = deal.assignedRepId ?? deal.userId
  if (!targetClerkUser) return

  const slackUserId = await getSlackUserId(workspaceId, targetClerkUser)
  if (!slackUserId) {
    console.log(`${LOG_PREFIX} No Slack mapping for user ${targetClerkUser} — skipping loop status DM`)
    return
  }

  const company = deal.prospectCompany ?? deal.dealName
  const prospect = deal.prospectName ?? 'the prospect'
  const value = gbp(deal.dealValue as number | null)

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:rocket: *${issueTitle}* shipped! This unblocks *${company}* (${value}).`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Time to follow up with ${prospect} — the feature they were waiting on is live.`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Draft Follow-Up Email', emoji: true },
          style: 'primary',
          action_id: 'draft_followup',
          value: JSON.stringify({ dealId, issueTitle }),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Deal', emoji: true },
          action_id: 'view_deal',
          value: dealId,
        },
      ],
    },
  ]

  const fallback = `${issueTitle} shipped! This unblocks ${company} (${value}). Time to follow up with ${prospect}.`
  const sent = await sendDm(token, slackUserId, blocks, fallback)
  if (sent) {
    console.log(`${LOG_PREFIX} Sent loop status DM for "${issueTitle}" → ${newStatus} to ${slackUserId}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Daily Brief
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a morning summary DM: deals needing attention, issues awaiting PM,
 * and total revenue at risk.
 *
 * @param clerkUserId - the Clerk user ID to send the brief to
 */
export async function sendDailyBrief(
  workspaceId: string,
  clerkUserId: string,
): Promise<void> {
  const token = await getBotToken(workspaceId)
  if (!token) {
    console.log(`${LOG_PREFIX} Skipping daily brief — Slack not connected for workspace ${workspaceId}`)
    return
  }

  const slackUserId = await getSlackUserId(workspaceId, clerkUserId)
  if (!slackUserId) {
    console.log(`${LOG_PREFIX} No Slack mapping for user ${clerkUserId} — skipping daily brief`)
    return
  }

  // Gather pipeline stats for this workspace
  let dealsNeedAttention = 0
  let revenueAtRisk = 0
  let totalOpenDeals = 0

  try {
    const stats = await db
      .select({
        totalOpen: sql<number>`count(*) filter (where ${dealLogs.stage} not in ('closed_won', 'closed_lost'))`,
        needsAttention: sql<number>`count(*) filter (where ${dealLogs.conversionScore} < 40 and ${dealLogs.stage} not in ('closed_won', 'closed_lost'))`,
        atRiskRevenue: sql<number>`coalesce(sum(${dealLogs.dealValue}) filter (where ${dealLogs.conversionScore} < 40 and ${dealLogs.stage} not in ('closed_won', 'closed_lost')), 0)`,
      })
      .from(dealLogs)
      .where(eq(dealLogs.workspaceId, workspaceId))

    if (stats[0]) {
      totalOpenDeals = Number(stats[0].totalOpen) || 0
      dealsNeedAttention = Number(stats[0].needsAttention) || 0
      revenueAtRisk = Number(stats[0].atRiskRevenue) || 0
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to gather daily brief stats:`, err)
  }

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Good morning — here\'s your pipeline brief', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `:bar_chart: *Open deals:* ${totalOpenDeals}` },
        { type: 'mrkdwn', text: `:warning: *Need attention:* ${dealsNeedAttention}` },
      ],
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `:moneybag: *Revenue at risk:* ${gbp(revenueAtRisk)}` },
      ],
    },
  ]

  // Add a nudge if there are deals needing attention
  if (dealsNeedAttention > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `_${dealsNeedAttention} deal${dealsNeedAttention > 1 ? 's' : ''} scored below 40% — consider reviewing these today._`,
      },
    })
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View At-Risk Deals', emoji: true },
          style: 'primary',
          action_id: 'view_at_risk',
          value: workspaceId,
        },
      ],
    })
  }

  const fallback = `Pipeline brief: ${totalOpenDeals} open deals, ${dealsNeedAttention} need attention, ${gbp(revenueAtRisk)} at risk.`
  const sent = await sendDm(token, slackUserId, blocks, fallback)
  if (sent) {
    console.log(`${LOG_PREFIX} Sent daily brief to ${slackUserId}`)
  }
}
