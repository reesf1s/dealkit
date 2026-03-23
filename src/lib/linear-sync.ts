/**
 * Linear issue sync — fetches all team issues from Linear and caches them in
 * linear_issues_cache, then re-embeds them for signal matching.
 *
 * Called by:
 *  - POST /api/integrations/linear/sync (manual trigger)
 *  - GET /api/cron/linear-match (nightly, after match run)
 *  - POST /api/webhooks/linear (on issue create/update)
 */

import { db } from '@/lib/db'
import { eq, and, sql } from 'drizzle-orm'
import { linearIntegrations, linearIssuesCache } from '@/lib/db/schema'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'
import { fetchTeamIssues, type LinearIssue } from '@/lib/linear-client'
import { embedLinearIssues } from '@/lib/semantic-search'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number
  embedded: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert a batch of Linear issues into linear_issues_cache.
 */
async function upsertIssues(workspaceId: string, issues: LinearIssue[]): Promise<void> {
  if (issues.length === 0) return

  for (const issue of issues) {
    await db
      .insert(linearIssuesCache)
      .values({
        workspaceId,
        linearIssueId: issue.identifier,
        linearIssueUrl: issue.url,
        title: issue.title,
        description: issue.description,
        status: issue.state.name,
        cycleId: issue.cycle?.id ?? null,
        assigneeId: issue.assignee?.id ?? null,
        assigneeName: issue.assignee?.name ?? null,
        priority: issue.priority,
        cachedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [linearIssuesCache.workspaceId, linearIssuesCache.linearIssueId],
        set: {
          linearIssueUrl: issue.url,
          title: issue.title,
          description: issue.description,
          status: issue.state.name,
          cycleId: issue.cycle?.id ?? null,
          assigneeId: issue.assignee?.id ?? null,
          assigneeName: issue.assignee?.name ?? null,
          priority: issue.priority,
          cachedAt: new Date(),
        },
      })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sync all Linear issues for a workspace and re-embed them.
 * Returns the number of issues synced and embedded.
 */
export async function syncLinearIssues(workspaceId: string): Promise<SyncResult> {
  const [integration] = await db
    .select()
    .from(linearIntegrations)
    .where(eq(linearIntegrations.workspaceId, workspaceId))
    .limit(1)

  if (!integration) {
    return { synced: 0, embedded: 0 }
  }

  let apiKey: string
  try {
    apiKey = decrypt(integration.apiKeyEnc, getEncryptionKey())
  } catch (err) {
    await db
      .update(linearIntegrations)
      .set({ syncError: 'Failed to decrypt API key', updatedAt: new Date() })
      .where(eq(linearIntegrations.workspaceId, workspaceId))
    console.error('[linear-sync] Decrypt error for workspace', workspaceId.slice(0, 8), err)
    return { synced: 0, embedded: 0 }
  }

  let cursor: string | null = null
  let synced = 0

  try {
    do {
      const { issues, nextCursor } = await fetchTeamIssues(
        apiKey,
        integration.teamId,
        cursor ?? undefined,
      )

      await upsertIssues(workspaceId, issues)
      synced += issues.length
      cursor = nextCursor
    } while (cursor !== null)

    // Update last sync timestamp and clear any previous error
    await db
      .update(linearIntegrations)
      .set({ lastSyncAt: new Date(), syncError: null, updatedAt: new Date() })
      .where(eq(linearIntegrations.workspaceId, workspaceId))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db
      .update(linearIntegrations)
      .set({ syncError: msg, updatedAt: new Date() })
      .where(eq(linearIntegrations.workspaceId, workspaceId))
    console.error('[linear-sync] Sync error for workspace', workspaceId.slice(0, 8), err)
    return { synced, embedded: 0 }
  }

  // Re-embed all issues now that the cache is up to date
  const { embedded } = await embedLinearIssues(workspaceId)

  console.log(
    `[linear-sync] workspace=${workspaceId.slice(0, 8)} synced=${synced} embedded=${embedded}`,
  )
  return { synced, embedded }
}

/**
 * Upsert a single Linear issue (called from webhook handler).
 * Re-embeds the full workspace issue set after upsert.
 */
export async function syncSingleIssue(
  workspaceId: string,
  issue: LinearIssue,
): Promise<void> {
  await upsertIssues(workspaceId, [issue])
  await embedLinearIssues(workspaceId)
}
