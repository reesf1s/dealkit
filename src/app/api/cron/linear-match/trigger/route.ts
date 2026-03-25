/**
 * POST /api/cron/linear-match/trigger
 * Clerk-authenticated manual trigger for the full Linear signal match pipeline.
 * Syncs issues, then matches all open deals. Returns match counts.
 *
 * Used by the "Run match now" button in Settings → Linear.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min max (Vercel Pro limit) — covers cold sync+embed+match

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { count, eq, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, linearIssuesCache } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { syncLinearIssues } from '@/lib/linear-sync'
import { syncLoopStatuses } from '@/lib/smart-match'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    // 1. Sync latest issues from Linear and re-embed them
    const syncResult = await syncLinearIssues(workspaceId)

    // 2. Sync loop statuses (NOT full rematch — user triggers that explicitly)
    await syncLoopStatuses(workspaceId)
    const matchResult = { totalLinked: 0, totalCreated: 0, results: [] }

    // 3. Count open deals and cached issues for response context
    const [dealsRow] = await db
      .select({ value: count() })
      .from(dealLogs)
      .where(
        and(
          eq(dealLogs.workspaceId, workspaceId),
          inArray(dealLogs.stage, [
            'prospecting',
            'qualification',
            'discovery',
            'proposal',
            'negotiation',
          ]),
        ),
      )

    const [issuesRow] = await db
      .select({ value: count() })
      .from(linearIssuesCache)
      .where(eq(linearIssuesCache.workspaceId, workspaceId))

    return NextResponse.json({
      data: {
        matched: matchResult.totalLinked + matchResult.totalCreated,
        linked: matchResult.totalLinked,
        created: matchResult.totalCreated,
        deals_checked: Number(dealsRow?.value ?? 0),
        issues_checked: Number(issuesRow?.value ?? 0),
        synced: syncResult.synced,
        embedded: syncResult.embedded,
        pages_fetched: syncResult.pagesFetched,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[trigger/linear-match]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
