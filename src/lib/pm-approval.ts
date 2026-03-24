/**
 * PM approval flow for the Halvex Slack loop.
 *
 * When a sales rep confirms issue prioritisation, this module:
 *   1. Creates slack_pending_actions rows for each product/admin user
 *   2. Sends a Slack DM to each PM with [Approve] [Decline] buttons
 *   3. Notifies the sales rep that the request was sent
 *
 * When a PM approves (button click in /api/webhooks/slack/actions):
 *   1. Generates user story + ACs for each issue (Claude Haiku)
 *   2. Updates the Linear issue descriptions
 *   3. Moves issues to the next cycle
 *   4. Updates deal_linear_links to in_cycle
 *   5. DMs the PM confirmation + the rep notification
 *
 * Used by both the Slack agent (halvex_bulk_scope_to_cycle) and the
 * interactive actions handler (pm_approve_* button clicks).
 */

import { db } from '@/lib/db'
import {
  dealLogs, dealLinearLinks, linearIssuesCache, linearIntegrations,
  slackUserMappings, slackPendingActions, mcpActionLog,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'
import { getSlackBotToken, slackOpenDm, slackPostMessage } from '@/lib/slack-client'
import { markdownToBlocks } from '@/lib/slack-blocks'
import type { SlackBlock } from '@/lib/slack-client'
import { getMembersWithRole } from '@/lib/roles'
import { generateScopedIssue } from '@/lib/scope-generator'
import { getUpcomingCycle, scopeIssueToCycle, updateIssueDescription } from '@/lib/linear-cycle'

// ─────────────────────────────────────────────────────────────────────────────
// Block Kit helper (PM approval DM)
// ─────────────────────────────────────────────────────────────────────────────

function buildPmApprovalBlocks(params: {
  repName: string
  dealName: string
  company: string
  dealValue: number | null
  issueCount: number
  issueList: { id: string; title: string }[]
  pendingActionId: string
}): SlackBlock[] {
  const valueStr = params.dealValue
    ? `£${params.dealValue >= 1000 ? `${Math.round(params.dealValue / 1000)}k` : params.dealValue}`
    : 'undisclosed value'

  const issueLines = params.issueList
    .slice(0, 5)
    .map(i => `• *${i.id}* — ${i.title}`)
    .join('\n')

  return ([
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔗 *Prioritisation request from ${params.repName}*\n\n*Deal:* ${params.dealName} (${params.company}) — ${valueStr}\n\n*${params.issueCount} issue${params.issueCount !== 1 ? 's' : ''} requested for next cycle:*\n${issueLines}`,
      },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `These issues were matched from meeting notes for the ${params.company} deal.` }],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ Approve & write specs', emoji: true },
          style: 'primary',
          action_id: `pm_approve_${params.pendingActionId}`,
          value: params.pendingActionId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '✗ Decline', emoji: true },
          style: 'danger',
          action_id: `pm_decline_${params.pendingActionId}`,
          value: params.pendingActionId,
        },
      ],
    },
  ] as SlackBlock[])
}

// ─────────────────────────────────────────────────────────────────────────────
// Look up Clerk user ID from Slack user ID
// ─────────────────────────────────────────────────────────────────────────────

export async function getClerkUserIdFromSlack(
  slackUserId: string,
  workspaceId: string,
): Promise<string | null> {
  const [mapping] = await db
    .select({ clerkUserId: slackUserMappings.clerkUserId })
    .from(slackUserMappings)
    .where(and(
      eq(slackUserMappings.workspaceId, workspaceId),
      eq(slackUserMappings.slackUserId, slackUserId),
    ))
    .limit(1)
  return mapping?.clerkUserId ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Request PM approval (called when sales rep says "yes")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called by halvex_bulk_scope_to_cycle when the user's appRole is 'sales'.
 * Saves pending actions for PMs and sends DMs requesting approval.
 *
 * Returns a message to show the rep.
 */
export async function requestPmApproval(params: {
  workspaceId: string
  repSlackUserId: string
  repChannelId: string
  dealId: string
  dealName: string
  company: string
  dealValue: number | null
  issueIds: string[]
}): Promise<string> {
  const { workspaceId, repSlackUserId, repChannelId, dealId, dealName, company, dealValue, issueIds } = params

  // 1. Get PM/admin users with Slack IDs
  const pms = await getMembersWithRole(workspaceId, 'product')
  const pmsWithSlack = pms.filter(pm => pm.slackUserId !== null)

  if (pmsWithSlack.length === 0) {
    return `⚠️ No product team members with Slack connected found. Ask an admin to set up product roles in Settings.`
  }

  // 2. Get issue titles from cache
  const issueDetails: { id: string; title: string }[] = []
  for (const issueId of issueIds.slice(0, 10)) {
    const [cached] = await db
      .select({ title: linearIssuesCache.title })
      .from(linearIssuesCache)
      .where(and(
        eq(linearIssuesCache.workspaceId, workspaceId),
        eq(linearIssuesCache.linearIssueId, issueId),
      ))
      .limit(1)
    issueDetails.push({ id: issueId, title: cached?.title ?? issueId })
  }

  // 3. Get rep's display name from Slack (best effort)
  let repName = 'A sales rep'
  const [repMapping] = await db
    .select({ clerkUserId: slackUserMappings.clerkUserId })
    .from(slackUserMappings)
    .where(and(
      eq(slackUserMappings.workspaceId, workspaceId),
      eq(slackUserMappings.slackUserId, repSlackUserId),
    ))
    .limit(1)
  if (repMapping) {
    repName = `<@${repSlackUserId}>`  // Slack will render as the user's name
  }

  // 4. Get bot token
  const botToken = await getSlackBotToken(workspaceId)
  if (!botToken) {
    return `⚠️ Slack bot token not found — cannot send approval request.`
  }

  let sentCount = 0

  for (const pm of pmsWithSlack) {
    try {
      // Insert pending action
      const [inserted] = await db
        .insert(slackPendingActions)
        .values({
          workspaceId,
          slackUserId: pm.slackUserId!,
          slackChannelId: '',  // will be set to DM channel after open
          actionType: 'pm_approve_prioritisation',
          dealId,
          payload: {
            issueIds,
            issueDetails,
            repSlackUserId,
            repChannelId,
            dealName,
            company,
            dealValue,
          },
        })
        .returning({ id: slackPendingActions.id })

      if (!inserted) continue

      const pendingActionId = inserted.id

      // Open DM channel with PM
      const dmChannel = await slackOpenDm(botToken, pm.slackUserId!)
      if (!dmChannel) continue

      // Update the pending action with the actual channel ID
      await db
        .update(slackPendingActions)
        .set({ slackChannelId: dmChannel })
        .where(eq(slackPendingActions.id, pendingActionId))

      // Send approval request DM
      const blocks = buildPmApprovalBlocks({
        repName,
        dealName,
        company,
        dealValue,
        issueCount: issueIds.length,
        issueList: issueDetails,
        pendingActionId,
      })

      await slackPostMessage(botToken, dmChannel, blocks, `${repName} wants to prioritise ${issueIds.length} issues for ${dealName}`)
      sentCount++
    } catch (e) {
      console.error('[pm-approval] Failed to notify PM:', pm.userId, e)
    }
  }

  if (sentCount === 0) {
    return `⚠️ Could not reach your product team on Slack. Ask them to connect Slack in Settings.`
  }

  // 5. Log to mcp_action_log
  await db.insert(mcpActionLog).values({
    workspaceId,
    actionType: 'pm_approval_requested',
    dealId,
    triggeredBy: 'slack',
    status: 'awaiting_confirmation',
    payload: { issueIds, repSlackUserId, pmsNotified: sentCount },
  })

  return `✅ Got it — I've sent a prioritisation request to ${sentCount} product team member${sentCount !== 1 ? 's' : ''}. I'll let you know when they approve.`
}

// ─────────────────────────────────────────────────────────────────────────────
// Execute PM approval (called when PM clicks [Approve])
// ─────────────────────────────────────────────────────────────────────────────

export interface PmApprovalResult {
  succeeded: { issueId: string; title: string; userStory: string }[]
  failed: { issueId: string; error: string }[]
  cycleName: string
}

/**
 * Called by the Slack actions handler when a PM clicks [Approve].
 * Runs full scoping: generates specs, updates Linear, moves to cycle.
 */
export async function executePmApproval(
  pendingActionId: string,
  workspaceId: string,
): Promise<PmApprovalResult> {
  // 1. Load pending action
  const [pending] = await db
    .select()
    .from(slackPendingActions)
    .where(and(
      eq(slackPendingActions.id, pendingActionId),
      eq(slackPendingActions.workspaceId, workspaceId),
    ))
    .limit(1)

  if (!pending) throw new Error('Pending action not found or expired')

  const payload = pending.payload as {
    issueIds: string[]
    issueDetails: { id: string; title: string }[]
    repSlackUserId: string
    repChannelId: string
    dealName: string
    company: string
    dealValue: number | null
  }

  const dealId = pending.dealId
  if (!dealId) throw new Error('No deal ID on pending action')

  // 2. Load deal
  const [deal] = await db
    .select({
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      notes: dealLogs.notes,
      dealRisks: dealLogs.dealRisks,
    })
    .from(dealLogs)
    .where(eq(dealLogs.id, dealId))
    .limit(1)

  if (!deal) throw new Error('Deal not found')

  // 3. Linear integration
  const [integration] = await db
    .select({ apiKeyEnc: linearIntegrations.apiKeyEnc, teamId: linearIntegrations.teamId, teamName: linearIntegrations.teamName })
    .from(linearIntegrations)
    .where(eq(linearIntegrations.workspaceId, workspaceId))
    .limit(1)

  if (!integration) throw new Error('Linear not connected')

  const apiKey = decrypt(integration.apiKeyEnc, getEncryptionKey())
  const cycle = await getUpcomingCycle(integration.teamId, apiKey)
  if (!cycle) throw new Error(`No upcoming cycle in ${integration.teamName ?? 'your Linear team'}`)

  const cycleName = cycle.name ?? `Cycle #${cycle.number}`
  const dealRisks = Array.isArray(deal.dealRisks) ? (deal.dealRisks as string[]) : []

  // 4. Scope each issue
  const succeeded: { issueId: string; title: string; userStory: string }[] = []
  const failed: { issueId: string; error: string }[] = []

  for (const issueId of payload.issueIds.slice(0, 10)) {
    try {
      const [cached] = await db
        .select({ title: linearIssuesCache.title, description: linearIssuesCache.description })
        .from(linearIssuesCache)
        .where(and(
          eq(linearIssuesCache.workspaceId, workspaceId),
          eq(linearIssuesCache.linearIssueId, issueId),
        ))
        .limit(1)

      const issueTitle = cached?.title ?? issueId
      const issueDescription = cached?.description ?? null

      // Check for existing scoped content
      const [existingLink] = await db
        .select({ scopedUserStory: dealLinearLinks.scopedUserStory, scopedAcceptanceCriteria: dealLinearLinks.scopedAcceptanceCriteria, scopedDescription: dealLinearLinks.scopedDescription, addressesRisk: dealLinearLinks.addressesRisk, linearIssueUrl: dealLinearLinks.linearIssueUrl })
        .from(dealLinearLinks)
        .where(and(
          eq(dealLinearLinks.workspaceId, workspaceId),
          eq(dealLinearLinks.dealId, dealId),
          eq(dealLinearLinks.linearIssueId, issueId),
        ))
        .limit(1)

      let userStory: string
      let acceptanceCriteria: string[]
      let scopedDescription: string

      if (existingLink?.scopedUserStory) {
        userStory = existingLink.scopedUserStory
        acceptanceCriteria = existingLink.scopedAcceptanceCriteria?.split('\n').filter(Boolean) ?? []
        scopedDescription = existingLink.scopedDescription ?? ''
      } else {
        const scoped = await generateScopedIssue({
          dealName: deal.dealName,
          prospectCompany: deal.prospectCompany,
          dealNotes: deal.notes ?? null,
          dealRisks,
          issueTitle,
          issueDescription,
        })
        userStory = scoped.userStory
        acceptanceCriteria = scoped.acceptanceCriteria
        scopedDescription = scoped.description
      }

      // Update Linear description
      const halvexContent = [
        `**Deal:** ${deal.dealName} (${deal.prospectCompany})`,
        '',
        `**User Story:** ${userStory}`,
        '',
        '**Acceptance Criteria:**',
        ...acceptanceCriteria.map(ac => `- [ ] ${ac}`),
      ].join('\n')
      try { await updateIssueDescription(issueId, halvexContent, issueDescription, apiKey) } catch { /* non-fatal */ }

      // Add to cycle
      await scopeIssueToCycle(issueId, cycle.id, apiKey)

      // Upsert link
      await db
        .insert(dealLinearLinks)
        .values({
          workspaceId,
          dealId,
          linearIssueId: issueId,
          linearTitle: issueTitle,
          linearIssueUrl: existingLink?.linearIssueUrl ?? null,
          relevanceScore: 80,
          linkType: 'feature_gap',
          status: 'in_cycle',
          scopedAt: new Date(),
          scopedDescription,
          scopedUserStory: userStory,
          scopedAcceptanceCriteria: acceptanceCriteria.join('\n'),
          cycleId: cycle.id,
        })
        .onConflictDoUpdate({
          target: [dealLinearLinks.dealId, dealLinearLinks.linearIssueId],
          set: {
            status: 'in_cycle',
            scopedAt: new Date(),
            updatedAt: new Date(),
            scopedDescription,
            scopedUserStory: userStory,
            scopedAcceptanceCriteria: acceptanceCriteria.join('\n'),
            cycleId: cycle.id,
          },
        })

      await db.insert(mcpActionLog).values({
        workspaceId,
        actionType: 'issue_scoped_to_cycle',
        dealId,
        linearIssueId: issueId,
        triggeredBy: 'slack',
        status: 'complete',
        result: { cycleName, cycleId: cycle.id, pmApproved: true },
      })

      succeeded.push({ issueId, title: issueTitle, userStory })
    } catch (e) {
      failed.push({ issueId, error: e instanceof Error ? e.message.slice(0, 100) : String(e) })
    }
  }

  // 5. Delete pending action (and any other pending actions for the same deal)
  await db
    .delete(slackPendingActions)
    .where(and(
      eq(slackPendingActions.workspaceId, workspaceId),
      eq(slackPendingActions.dealId, dealId),
    ))

  // 6. Notify rep if they have Slack
  if (payload.repSlackUserId && succeeded.length > 0) {
    try {
      const botToken = await getSlackBotToken(workspaceId)
      if (botToken) {
        const repMsg = [
          `✅ *Your product team approved the prioritisation for ${deal.prospectCompany}*`,
          '',
          `${succeeded.length} issue${succeeded.length !== 1 ? 's' : ''} moved to *${cycleName}* with specs written:`,
          ...succeeded.map(r => `• *${r.issueId}* — ${r.title}`),
          '',
          `I'll message you when they ship so you can follow up with ${deal.prospectCompany}.`,
        ].join('\n')
        const dmChannel = await slackOpenDm(botToken, payload.repSlackUserId)
        if (dmChannel) {
          await slackPostMessage(botToken, dmChannel, markdownToBlocks(repMsg), repMsg)
        }
      }
    } catch { /* non-fatal */ }
  }

  return { succeeded, failed, cycleName }
}

// ─────────────────────────────────────────────────────────────────────────────
// Decline PM approval
// ─────────────────────────────────────────────────────────────────────────────

export async function declinePmApproval(
  pendingActionId: string,
  workspaceId: string,
): Promise<void> {
  const [pending] = await db
    .select()
    .from(slackPendingActions)
    .where(and(
      eq(slackPendingActions.id, pendingActionId),
      eq(slackPendingActions.workspaceId, workspaceId),
    ))
    .limit(1)

  if (!pending) return

  const payload = pending.payload as { repSlackUserId?: string; dealName?: string; company?: string }

  // Delete the pending action
  await db
    .delete(slackPendingActions)
    .where(eq(slackPendingActions.id, pendingActionId))

  // Notify rep
  if (payload.repSlackUserId) {
    try {
      const botToken = await getSlackBotToken(workspaceId)
      if (botToken) {
        const msg = `ℹ️ Your product team declined the prioritisation request for ${payload.dealName ?? 'the deal'}. You can ask them directly or try again with a more specific feature request.`
        const dmChannel = await slackOpenDm(botToken, payload.repSlackUserId)
        if (dmChannel) {
          await slackPostMessage(botToken, dmChannel, markdownToBlocks(msg), msg)
        }
      }
    } catch { /* non-fatal */ }
  }
}
