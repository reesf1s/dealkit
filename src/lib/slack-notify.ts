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
import { slackConnections, slackUserMappings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'
import { slackPostMessage, slackOpenDm } from '@/lib/slack-client'
import { healthDropBlocks, newIssueLinkBlocks } from '@/lib/slack-blocks'
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
