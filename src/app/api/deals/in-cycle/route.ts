/**
 * GET /api/deals/in-cycle
 * Returns all deal_linear_links with status='in_cycle' for the workspace,
 * joined with deal names and issue titles. Used in the dashboard
 * "In-cycle issues linked to your deals" section.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { dealLinearLinks, dealLogs, linearIssuesCache } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    const links = await db
      .select({
        id: dealLinearLinks.id,
        dealId: dealLinearLinks.dealId,
        linearIssueId: dealLinearLinks.linearIssueId,
        linearTitle: dealLinearLinks.linearTitle,
        linearIssueUrl: dealLinearLinks.linearIssueUrl,
        relevanceScore: dealLinearLinks.relevanceScore,
        addressesRisk: dealLinearLinks.addressesRisk,
        scopedAt: dealLinearLinks.scopedAt,
        assigneeName: dealLinearLinks.assigneeName,
      })
      .from(dealLinearLinks)
      .where(and(
        eq(dealLinearLinks.workspaceId, workspaceId),
        eq(dealLinearLinks.status, 'in_cycle'),
      ))

    if (links.length === 0) return NextResponse.json({ data: [] })

    // Hydrate deal names
    const dealIds = [...new Set(links.map(l => l.dealId))]
    const deals = await db
      .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany })
      .from(dealLogs)
      .where(eq(dealLogs.workspaceId, workspaceId))

    const dealMap = new Map(deals.map(d => [d.id, d]))

    // Compute days in cycle
    const now = Date.now()

    const enriched = links.map(l => {
      const deal = dealMap.get(l.dealId)
      const daysInCycle = l.scopedAt
        ? Math.floor((now - new Date(l.scopedAt).getTime()) / 86400000)
        : null

      return {
        id: l.id,
        dealId: l.dealId,
        dealName: deal?.dealName ?? null,
        prospectCompany: deal?.prospectCompany ?? null,
        linearIssueId: l.linearIssueId,
        linearTitle: l.linearTitle,
        linearIssueUrl: l.linearIssueUrl,
        addressesRisk: l.addressesRisk,
        assigneeName: l.assigneeName,
        daysInCycle,
      }
    })

    return NextResponse.json({ data: enriched })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
