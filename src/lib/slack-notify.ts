/**
 * Slack proactive notifications.
 *
 * Functions called from:
 *   - workspace-brain.ts (after rebuild) → notifyHealthDrop for each scoreAlert
 *   - linear-signal-match.ts (after upsert) → notifyNewIssueLink for relevanceScore ≥ 80
 *
 * Each function is fire-and-forget safe: catches all errors, never throws.
 * They no-op gracefully if Slack is not connected for the workspace.
 */

import { db } from '@/lib/db'
import { slackConnections, slackUserMappings, mcpActionLog, dealLogs, dealLinearLinks, linearIssuesCache } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'
import { slackPostMessage, slackOpenDm } from '@/lib/slack-client'
import { healthDropBlocks, newIssueLinkBlocks, issueDeployedBlocks, allIssuesDeployedBlocks } from '@/lib/slack-blocks'
import { generateBatchReleaseEmail } from '@/lib/release-email-generator'
import type { WorkspaceBrain } from '@/lib/workspace-brain'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getConnection(workspaceId: string): Promise<{ botToken: string } | null> {
  const [conn] = await db
    .select({ botTokenEnc: slackConnections.botTokenEnc })
    .from(slackConnections)
    .where(eq(slackConnections.workspaceId, workspaceId))
    .limit(1)
  if (!conn) return null
  const botToken = decrypt(conn.botTokenEnc, getEncryptionKey())
  return { botToken }
}

async function getMappedUsers(workspaceId: string, notifyPref: 'notifyHealthDrops' | 'notifyIssueLinks'): Promise<string[]> {
  const mappings = await db
    .select({
      slackUserId: slackUserMappings.slackUserId,
      notifyHealthDrops: slackUserMappings.notifyHealthDrops,
      notifyIssueLinks: slackUserMappings.notifyIssueLinks,
    })
    .from(slackUserMappings)
    .where(eq(slackUserMappings.workspaceId, workspaceId))

  return mappings
    .filter(m => m[notifyPref] === true)
    .map(m => m.slackUserId)
}

// ─────────────────────────────────────────────────────────────────────────────
// notifyHealthDrop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a DM to all opted-in workspace members when a deal's health drops ≥ 10 pts.
 * Called from workspace-brain.ts after each scoreAlert is computed.
 *
 * Fires only when score delta ≥ 10 (scoreAlerts already have this threshold).
 * No-ops if Slack is not connected or no users have opted in.
 */
export async function notifyHealthDrop(
  workspaceId: string,
  alert: WorkspaceBrain['scoreAlerts'][number],
): Promise<void> {
  try {
    const conn = await getConnection(workspaceId)
    if (!conn) return  // Slack not connected — no-op

    const users = await getMappedUsers(workspaceId, 'notifyHealthDrops')
    if (users.length === 0) return

    const blocks = healthDropBlocks({
      dealName: alert.dealName,
      company: alert.company,
      dealId: alert.dealId,
      previousScore: alert.previousScore,
      currentScore: alert.currentScore,
      possibleCause: alert.possibleCause,
    })
    const fallbackText = `⚠️ ${alert.dealName} health dropped ${alert.previousScore} → ${alert.currentScore}`

    for (const slackUserId of users) {
      try {
        const dmChannel = await slackOpenDm(conn.botToken, slackUserId)
        if (dmChannel) {
          await slackPostMessage(conn.botToken, dmChannel, blocks, fallbackText)
        }
      } catch (e) {
        console.error(`[slack-notify] Failed to DM user ${slackUserId}:`, e)
      }
    }
  } catch (e) {
    // Never throw from proactive notifications — they must not block brain rebuild
    console.error('[slack-notify] notifyHealthDrop failed:', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// notifyNewIssueLink
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a DM when a new high-relevance Linear issue link is created (score ≥ 80).
 * Called from linear-signal-match.ts after a new link is inserted.
 */
// ─────────────────────────────────────────────────────────────────────────────
// notifyIssueDeployed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a proactive DM when a Linear issue linked to a deal is deployed.
 * Includes Block Kit buttons: "✉️ Write release email" / "Skip".
 * Records a pending action in mcp_action_log so the button click can resolve it.
 *
 * Guards: no-ops if Slack is not connected, or no users have opted in.
 */
export async function notifyIssueDeployed(
  workspaceId: string,
  info: {
    dealId: string
    dealName: string
    company: string
    linearIssueId: string
    linearTitle: string
  },
): Promise<void> {
  try {
    const conn = await getConnection(workspaceId)
    if (!conn) return  // Slack not connected

    const users = await getMappedUsers(workspaceId, 'notifyIssueLinks')
    if (users.length === 0) return

    const blocks = issueDeployedBlocks(info)
    const fallbackText = `🚀 ${info.linearIssueId} is live — linked to ${info.dealName} (${info.company}). Shall I write a release email?`

    for (const slackUserId of users) {
      try {
        const dmChannel = await slackOpenDm(conn.botToken, slackUserId)
        if (!dmChannel) continue

        const msgResult = await slackPostMessage(conn.botToken, dmChannel, blocks, fallbackText)

        // Store pending action so button clicks and text replies can resolve it
        await db.insert(mcpActionLog).values({
          workspaceId,
          actionType: 'issue_deployed_notification',
          dealId: info.dealId,
          linearIssueId: info.linearIssueId,
          triggeredBy: 'webhook',
          status: 'awaiting_confirmation',
          slackChannelId: dmChannel,
          slackMessageTs: (msgResult as { ts?: string })?.ts ?? null,
          payload: {
            slackUserId,
            channelId: dmChannel,
            prompt: `Issue ${info.linearIssueId} (${info.linearTitle}) deployed for ${info.dealName}`,
            action: 'generate_release_email',
            params: { dealId: info.dealId, linearIssueId: info.linearIssueId },
          },
        })
      } catch (e) {
        console.error(`[slack-notify] Failed to DM user ${slackUserId}:`, e)
      }
    }
  } catch (e) {
    console.error('[slack-notify] notifyIssueDeployed failed:', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// notifyAllIssuesDeployed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a rich Slack DM when ALL in_cycle Linear issues linked to a deal are deployed.
 * Includes: what shipped + how it maps to objections, a draft email to the prospect,
 * and a suggested Slack message the rep can use to schedule a call.
 *
 * Called from the Linear webhook after detecting complete deployment of all deal issues.
 */
export async function notifyAllIssuesDeployed(
  workspaceId: string,
  dealId: string,
): Promise<void> {
  try {
    const conn = await getConnection(workspaceId)
    if (!conn) return

    const users = await getMappedUsers(workspaceId, 'notifyIssueLinks')
    if (users.length === 0) return

    // Fetch deal context
    const [deal] = await db
      .select({
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        prospectName: dealLogs.prospectName,
        contacts: dealLogs.contacts,
        notes: dealLogs.notes,
        successCriteria: dealLogs.successCriteria,
        dealRisks: dealLogs.dealRisks,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return

    // Fetch deployed links
    const deployedLinks = await db
      .select({
        linearIssueId: dealLinearLinks.linearIssueId,
        linearTitle: dealLinearLinks.linearTitle,
        scopedUserStory: dealLinearLinks.scopedUserStory,
      })
      .from(dealLinearLinks)
      .where(and(
        eq(dealLinearLinks.workspaceId, workspaceId),
        eq(dealLinearLinks.dealId, dealId),
        eq(dealLinearLinks.status, 'deployed'),
      ))

    if (deployedLinks.length === 0) return

    // Hydrate with issue descriptions from cache
    const issueContexts = await Promise.all(
      deployedLinks.map(async (link) => {
        const [cached] = await db
          .select({ description: linearIssuesCache.description })
          .from(linearIssuesCache)
          .where(and(
            eq(linearIssuesCache.workspaceId, workspaceId),
            eq(linearIssuesCache.linearIssueId, link.linearIssueId),
          ))
          .limit(1)

        return {
          linearIssueId: link.linearIssueId,
          title: link.linearTitle ?? link.linearIssueId,
          description: cached?.description ?? null,
          scopedUserStory: link.scopedUserStory ?? null,
        }
      })
    )

    const dealContext = {
      dealId,
      dealName: deal.dealName,
      prospectCompany: deal.prospectCompany,
      contactName: deal.prospectName ?? null,
      contacts: (deal.contacts as { name?: string; email?: string; title?: string }[]) ?? [],
      notes: deal.notes ?? null,
      successCriteria: deal.successCriteria ?? null,
      dealRisks: (deal.dealRisks as string[]) ?? [],
    }

    // Generate batch release email
    const batchEmail = await generateBatchReleaseEmail(workspaceId, dealContext, issueContexts)
    if (!batchEmail) return

    const blocks = allIssuesDeployedBlocks({
      dealName: deal.dealName,
      company: deal.prospectCompany,
      dealId,
      contactName: deal.prospectName ?? null,
      shippedIssues: batchEmail.shippedSummary,
      emailSubject: batchEmail.subject,
      emailBody: batchEmail.body,
      callSchedulingMessage: batchEmail.callSchedulingMessage,
    })

    const fallbackText = `🚀 All issues shipped for ${deal.dealName} (${deal.prospectCompany})! Here's a draft email to re-engage them.`

    for (const slackUserId of users) {
      try {
        const dmChannel = await slackOpenDm(conn.botToken, slackUserId)
        if (!dmChannel) continue

        await slackPostMessage(conn.botToken, dmChannel, blocks, fallbackText)

        // Log the notification
        await db.insert(mcpActionLog).values({
          workspaceId,
          actionType: 'all_issues_deployed_notification',
          dealId,
          triggeredBy: 'webhook',
          status: 'complete',
          slackChannelId: dmChannel,
          payload: {
            slackUserId,
            issueCount: deployedLinks.length,
            company: deal.prospectCompany,
          },
          result: {
            emailSubject: batchEmail.subject,
            callSchedulingMessage: batchEmail.callSchedulingMessage,
          },
        })
      } catch (e) {
        console.error(`[slack-notify] notifyAllIssuesDeployed failed for user ${slackUserId}:`, e)
      }
    }
  } catch (e) {
    console.error('[slack-notify] notifyAllIssuesDeployed failed:', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// notifyNewIssueLink
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyNewIssueLink(
  workspaceId: string,
  link: {
    dealId: string
    dealName: string
    company: string
    linearIssueId: string
    linearTitle: string
    linearIssueUrl?: string | null
    relevanceScore: number
  },
): Promise<void> {
  try {
    const conn = await getConnection(workspaceId)
    if (!conn) return

    const users = await getMappedUsers(workspaceId, 'notifyIssueLinks')
    if (users.length === 0) return

    const blocks = newIssueLinkBlocks(link)
    const fallbackText = `🔗 New issue match for ${link.dealName}: ${link.linearIssueId} (${link.relevanceScore}%)`

    for (const slackUserId of users) {
      try {
        const dmChannel = await slackOpenDm(conn.botToken, slackUserId)
        if (dmChannel) {
          await slackPostMessage(conn.botToken, dmChannel, blocks, fallbackText)
        }
      } catch (e) {
        console.error(`[slack-notify] Failed to DM user ${slackUserId}:`, e)
      }
    }
  } catch (e) {
    console.error('[slack-notify] notifyNewIssueLink failed:', e)
  }
}
