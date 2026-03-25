/**
 * GET /api/loops
 * Returns all active loops (deal_linear_links that are not suggested/dismissed)
 * joined with deal data. Used by the Loops page and Today page for
 * intelligence-ranked operational views.
 */
export const dynamic = 'force-dynamic'

import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dealLinearLinks, dealLogs, slackPendingActions } from '@/lib/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'

export type LoopStatus = 'suggested' | 'confirmed' | 'awaiting_approval' | 'in_cycle' | 'shipped'

export interface LoopEntry {
  dealId: string
  dealName: string
  company: string
  dealValue: number | null
  stage: string
  loopStatus: LoopStatus
  featureRequest: string | null
  addressesRisk: string | null
  linearIssueId: string
  linearTitle: string | null
  linearIssueUrl: string | null
  daysInStatus: number | null
  issueCount: number
  createdAt: Date
  updatedAt: Date
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    // Get all links that are active (not suggested or dismissed)
    const links = await db
      .select({
        id: dealLinearLinks.id,
        dealId: dealLinearLinks.dealId,
        linearIssueId: dealLinearLinks.linearIssueId,
        linearTitle: dealLinearLinks.linearTitle,
        linearIssueUrl: dealLinearLinks.linearIssueUrl,
        status: dealLinearLinks.status,
        addressesRisk: dealLinearLinks.addressesRisk,
        scopedAt: dealLinearLinks.scopedAt,
        deployedAt: dealLinearLinks.deployedAt,
        createdAt: dealLinearLinks.createdAt,
        updatedAt: dealLinearLinks.updatedAt,
      })
      .from(dealLinearLinks)
      .where(
        and(
          eq(dealLinearLinks.workspaceId, workspaceId),
          sql`${dealLinearLinks.status} NOT IN ('dismissed')`,
        ),
      )

    if (links.length === 0) return NextResponse.json({ data: [] })

    // Fetch all workspace deals in one query
    const deals = await db
      .select({
        id: dealLogs.id,
        company: dealLogs.prospectCompany,
        dealName: dealLogs.dealName,
        dealValue: dealLogs.dealValue,
        stage: dealLogs.stage,
      })
      .from(dealLogs)
      .where(eq(dealLogs.workspaceId, workspaceId))

    const dealMap = new Map(deals.map(d => [d.id, d]))

    // Fetch pending Slack approvals for these deals
    const dealIds = [...new Set(links.map(l => l.dealId))]
    const pendingActions =
      dealIds.length > 0
        ? await db
            .select({ dealId: slackPendingActions.dealId, createdAt: slackPendingActions.createdAt })
            .from(slackPendingActions)
            .where(and(inArray(slackPendingActions.dealId, dealIds), sql`expires_at > now()`))
        : []

    const pendingMap = new Map(pendingActions.map(p => [p.dealId, p.createdAt]))

    // Group links by deal
    const dealToLinks = new Map<string, typeof links>()
    for (const link of links) {
      const arr = dealToLinks.get(link.dealId) ?? []
      arr.push(link)
      dealToLinks.set(link.dealId, arr)
    }

    const now = Date.now()
    const loops: LoopEntry[] = []

    for (const [dealId, dealLinks] of dealToLinks) {
      const deal = dealMap.get(dealId)
      if (!deal) continue

      // Emit one LoopEntry per link (not per deal) so every issue shows
      for (const link of dealLinks) {
        // Map link status to loop status
        let loopStatus: LoopStatus = link.status as LoopStatus
        if (!['suggested', 'confirmed', 'awaiting_approval', 'in_cycle', 'shipped'].includes(loopStatus)) {
          if (link.status === 'deployed') loopStatus = 'shipped'
          else loopStatus = 'suggested'
        }

        // Days in current status
        const statusSince = link.scopedAt ? new Date(link.scopedAt) : new Date(link.createdAt)
        const daysInStatus = Math.floor((now - statusSince.getTime()) / 86400000)

        loops.push({
          dealId,
          dealName: deal.dealName ?? deal.company ?? 'Untitled',
          company: deal.company ?? 'Unknown',
          dealValue: deal.dealValue ? Number(deal.dealValue) : null,
          stage: deal.stage ?? '',
          loopStatus,
          featureRequest: link.linearTitle,
          addressesRisk: link.addressesRisk,
          linearIssueId: link.linearIssueId,
          linearTitle: link.linearTitle,
          linearIssueUrl: link.linearIssueUrl,
          daysInStatus,
          issueCount: dealLinks.length,
          createdAt: new Date(link.createdAt),
          updatedAt: new Date(link.updatedAt),
      })
      }  // end for link
    }  // end for dealId

    // Fire-and-forget: sync Linear statuses for active loops in the background
    after(async () => {
      try {
        const { syncLinearIssues } = await import('@/lib/linear-sync')
        if (syncLinearIssues) await syncLinearIssues(workspaceId)
      } catch (e) {
        // Non-fatal background task failure
        console.error('[loops] background sync error:', e)
      }
    })

    return NextResponse.json({ data: loops })
  } catch (err) {
    return dbErrResponse(err)
  }
}
