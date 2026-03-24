/**
 * GET /api/deals/[id]/loop-status
 * Returns the current loop state for a deal:
 *   none | awaiting_approval | in_cycle | shipped
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, dealLinearLinks, slackPendingActions } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params

    const [deal] = await db
      .select({ id: dealLogs.id })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Check for awaiting PM approval
    const [pending] = await db
      .select({ id: slackPendingActions.id, createdAt: slackPendingActions.createdAt })
      .from(slackPendingActions)
      .where(and(eq(slackPendingActions.dealId, dealId), sql`expires_at > now()`))
      .limit(1)

    if (pending) {
      return NextResponse.json({ data: { state: 'awaiting_approval', requestedAt: pending.createdAt } })
    }

    // Get all linked issues
    const links = await db
      .select({
        linearIssueId: dealLinearLinks.linearIssueId,
        linearTitle: dealLinearLinks.linearTitle,
        linearIssueUrl: dealLinearLinks.linearIssueUrl,
        status: dealLinearLinks.status,
        deployedAt: dealLinearLinks.deployedAt,
        assigneeName: dealLinearLinks.assigneeName,
      })
      .from(dealLinearLinks)
      .where(eq(dealLinearLinks.dealId, dealId))

    if (links.length === 0) return NextResponse.json({ data: { state: 'none' } })

    const inCycle = links.filter(l => l.status === 'in_cycle')
    const deployed = links.filter(l => l.status === 'deployed')
    const allDeployed = links.every(l => l.status === 'deployed')

    if (allDeployed && deployed.length > 0) {
      const deployedAt = deployed.reduce((max, l) =>
        l.deployedAt && (!max || l.deployedAt > max) ? l.deployedAt : max,
        null as Date | null,
      )
      return NextResponse.json({ data: { state: 'shipped', deployedCount: deployed.length, deployedAt, issues: deployed } })
    }

    if (inCycle.length > 0) {
      return NextResponse.json({ data: { state: 'in_cycle', issueCount: inCycle.length, issues: inCycle } })
    }

    return NextResponse.json({ data: { state: 'none' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
