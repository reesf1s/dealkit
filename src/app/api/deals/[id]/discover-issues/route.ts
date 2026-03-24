/**
 * POST /api/deals/[id]/discover-issues
 *
 * Runs the halvex issue-discovery pipeline for a specific deal:
 * calls matchDealToIssues() which scores all cached Linear issues against
 * the deal's signals and upserts deal_linear_links rows.
 *
 * Returns the refreshed list of links for the deal.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, dealLinearLinks } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { matchDealToIssues } from '@/lib/linear-signal-match'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { workspaceId } = await getWorkspaceContext(userId)

    // Verify deal belongs to workspace
    const [deal] = await db
      .select({ id: dealLogs.id })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Run discovery
    await matchDealToIssues(workspaceId, id)

    // Return refreshed links
    const links = await db
      .select()
      .from(dealLinearLinks)
      .where(
        and(
          eq(dealLinearLinks.dealId, id),
          eq(dealLinearLinks.workspaceId, workspaceId),
        ),
      )

    return NextResponse.json({ data: links })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
