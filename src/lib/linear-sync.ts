/**
 * Linear issue sync — fetches all team issues from Linear and caches them in
 * linear_issues_cache, then re-embeds them for signal matching.
 *
 * Called by:
 *  - POST /api/integrations/linear/sync (manual trigger)
 *  - GET /api/cron/linear-match (nightly, after match run)
 *  - POST /api/webhooks/linear (on issue create/update)
 */

import { after } from 'next/server'
import { db } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'
import { linearIntegrations, linearIssuesCache } from '@/lib/db/schema'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'
import { fetchTeamIssues, type LinearIssue } from '@/lib/linear-client'
import { embedLinearIssues } from '@/lib/semantic-search'
import { embedNullLinearIssues } from '@/lib/deal-embeddings'
import { matchAllOpenDeals } from '@/lib/linear-signal-match'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number
  embedded: number
  pagesFetched: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const UPSERT_BATCH_SIZE = 50

/**
 * Upsert a batch of Linear issues into linear_issues_cache.
 * Processes in batches of 50 to stay within Postgres parameter limits.
 */
async function upsertIssues(workspaceId: string, issues: LinearIssue[]): Promise<void> {
  if (issues.length === 0) return

  for (let i = 0; i < issues.length; i += UPSERT_BATCH_SIZE) {
    const batch = issues.slice(i, i + UPSERT_BATCH_SIZE)
    await db
      .insert(linearIssuesCache)
      .values(
        batch.map(issue => ({
          workspaceId,
          linearIssueId:  issue.identifier,
          linearIssueUrl: issue.url,
          title:          issue.title,
          description:    issue.description,
          status:         issue.state.name,
          cycleId:        issue.cycle?.id ?? null,
          assigneeId:     issue.assignee?.id ?? null,
          assigneeName:   issue.assignee?.name ?? null,
          priority:       issue.priority,
          cachedAt:       new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [linearIssuesCache.workspaceId, linearIssuesCache.linearIssueId],
        set: {
          linearIssueUrl: sql`excluded.linear_issue_url`,
          title:          sql`excluded.title`,
          description:    sql`excluded.description`,
          status:         sql`excluded.status`,
          cycleId:        sql`excluded.cycle_id`,
          assigneeId:     sql`excluded.assignee_id`,
          assigneeName:   sql`excluded.assignee_name`,
          priority:       sql`excluded.priority`,
          cachedAt:       sql`excluded.cached_at`,
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
export async function syncLinearIssues(workspaceId: string, forceFullSync = false): Promise<SyncResult> {
  const [integration] = await db
    .select()
    .from(linearIntegrations)
    .where(eq(linearIntegrations.workspaceId, workspaceId))
    .limit(1)

  if (!integration) {
    return { synced: 0, embedded: 0, pagesFetched: 0 }
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
    return { synced: 0, embedded: 0, pagesFetched: 0 }
  }

  // Incremental sync: only fetch issues updated since the last successful sync.
  // Force full sync if requested, or if the last sync had an error, or if we have
  // 0 cached issues (previous sync was partial / broken).
  let since: string | undefined
  if (!forceFullSync && !integration.syncError && integration.lastSyncAt) {
    // Check if we actually have cached issues — if not, do a full sync anyway
    const [{ count: cachedCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(linearIssuesCache)
      .where(eq(linearIssuesCache.workspaceId, workspaceId))
    if (Number(cachedCount) > 0) {
      since = integration.lastSyncAt.toISOString()
    } else {
      console.log('[linear-sync] 0 cached issues — forcing full sync')
    }
  } else if (forceFullSync) {
    console.log('[linear-sync] Full sync forced')
  } else if (integration.syncError) {
    console.log('[linear-sync] Previous sync had error — forcing full sync')
  }

  let cursor: string | null = null
  let synced = 0
  let pagesFetched = 0

  try {
    do {
      const { issues, nextCursor } = await fetchTeamIssues(
        apiKey,
        integration.teamId,
        cursor ?? undefined,
        since,
      )

      await upsertIssues(workspaceId, issues)
      synced += issues.length
      pagesFetched += 1
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
    return { synced, embedded: 0, pagesFetched }
  }

  // Re-embed all issues now that the cache is up to date
  const { embedded } = await embedLinearIssues(workspaceId)

  // Generate pgvector embeddings for any issues that don't have them yet
  // (fire-and-forget — don't block the sync response)
  embedNullLinearIssues(workspaceId).catch(err =>
    console.warn('[linear-sync] pgvector embed failed:', err)
  )

  console.log(
    `[linear-sync] workspace=${workspaceId.slice(0, 8)} synced=${synced} pages=${pagesFetched} embedded=${embedded} incremental=${!!since}`,
  )

  // After every sync, re-run signal matching for all open deals in the background.
  // This ensures all deals (not just the one in the current Slack conversation) get
  // their links updated when new issues are pulled from Linear.
  after(async () => {
    try {
      await matchAllOpenDeals(workspaceId, 'cron')
    } catch (err) {
      console.error('[linear-sync] matchAllOpenDeals failed:', err)
    }
  })

  return { synced, embedded, pagesFetched }
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
  // Generate pgvector embedding for the single new/updated issue
  embedNullLinearIssues(workspaceId).catch(err =>
    console.warn('[linear-sync] pgvector embed failed:', err)
  )
}
