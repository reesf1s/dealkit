export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { dealLinearLinks, dealLogs } from '@/lib/db/schema'
import { eq, and, desc, inArray, gte, ne, isNotNull } from 'drizzle-orm'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    // Active loops: deals with links in suggested/confirmed/in_cycle
    const activeLinks = await db
      .select({
        id: dealLinearLinks.id,
        dealId: dealLinearLinks.dealId,
        linearIssueId: dealLinearLinks.linearIssueId,
        linearTitle: dealLinearLinks.linearTitle,
        linearIssueUrl: dealLinearLinks.linearIssueUrl,
        status: dealLinearLinks.status,
        addressesRisk: dealLinearLinks.addressesRisk,
        createdAt: dealLinearLinks.createdAt,
        dealName: dealLogs.dealName,
        dealCompany: dealLogs.prospectCompany,
      })
      .from(dealLinearLinks)
      .leftJoin(dealLogs, eq(dealLinearLinks.dealId, dealLogs.id))
      .where(
        and(
          eq(dealLinearLinks.workspaceId, workspaceId),
          inArray(dealLinearLinks.status, ['suggested', 'confirmed', 'in_cycle']),
        )
      )
      .orderBy(desc(dealLinearLinks.createdAt))
      .limit(30)

    // Group by dealId for active loops display
    const activeDealMap = new Map<string, {
      dealId: string;
      dealName: string;
      dealCompany: string;
      issues: typeof activeLinks;
      highestStatus: string;
    }>()
    for (const link of activeLinks) {
      if (!link.dealId) continue
      if (!activeDealMap.has(link.dealId)) {
        activeDealMap.set(link.dealId, {
          dealId: link.dealId,
          dealName: link.dealName ?? 'Deal',
          dealCompany: link.dealCompany ?? '',
          issues: [],
          highestStatus: 'suggested',
        })
      }
      const entry = activeDealMap.get(link.dealId)!
      entry.issues.push(link)
      const priority = { in_cycle: 3, confirmed: 2, suggested: 1 }
      if ((priority[link.status as keyof typeof priority] ?? 0) > (priority[entry.highestStatus as keyof typeof priority] ?? 0)) {
        entry.highestStatus = link.status
      }
    }

    const activeLoops = Array.from(activeDealMap.values()).map(d => ({
      dealId: d.dealId,
      dealName: d.dealName,
      dealCompany: d.dealCompany,
      issueCount: d.issues.length,
      highestStatus: d.highestStatus,
      summary: buildLoopSummary(d.issues, d.highestStatus),
      issues: d.issues.slice(0, 3).map(i => ({ id: i.linearIssueId, title: i.linearTitle, status: i.status })),
      updatedAt: d.issues[0]?.createdAt?.toISOString() ?? new Date().toISOString(),
    }))

    // Completed loops this week: deployed + slackNotifiedAt set
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const completedLinks = await db
      .select({
        dealId: dealLinearLinks.dealId,
        linearIssueId: dealLinearLinks.linearIssueId,
        linearTitle: dealLinearLinks.linearTitle,
        slackNotifiedAt: dealLinearLinks.slackNotifiedAt,
        deployedAt: dealLinearLinks.deployedAt,
        dealName: dealLogs.dealName,
        dealCompany: dealLogs.prospectCompany,
      })
      .from(dealLinearLinks)
      .leftJoin(dealLogs, eq(dealLinearLinks.dealId, dealLogs.id))
      .where(
        and(
          eq(dealLinearLinks.workspaceId, workspaceId),
          eq(dealLinearLinks.status, 'deployed'),
          isNotNull(dealLinearLinks.slackNotifiedAt),
          gte(dealLinearLinks.deployedAt, oneWeekAgo),
        )
      )
      .orderBy(desc(dealLinearLinks.deployedAt))
      .limit(20)

    const completedDealMap = new Map<string, { dealId: string; dealName: string; dealCompany: string; issueCount: number; slackNotifiedAt: Date | null; deployedAt: Date | null }>()
    for (const link of completedLinks) {
      if (!link.dealId) continue
      if (!completedDealMap.has(link.dealId)) {
        completedDealMap.set(link.dealId, { dealId: link.dealId, dealName: link.dealName ?? 'Deal', dealCompany: link.dealCompany ?? '', issueCount: 0, slackNotifiedAt: link.slackNotifiedAt, deployedAt: link.deployedAt })
      }
      completedDealMap.get(link.dealId)!.issueCount++
    }

    const completedLoops = Array.from(completedDealMap.values()).map(d => ({
      dealId: d.dealId,
      dealName: d.dealName,
      dealCompany: d.dealCompany,
      issueCount: d.issueCount,
      emailSent: !!d.slackNotifiedAt,
      deployedAt: d.deployedAt?.toISOString() ?? null,
    }))

    // Deals ready for loop: deals with no active/deployed links
    const dealsWithLinks = new Set([
      ...activeLinks.map(l => l.dealId).filter(Boolean),
      ...completedLinks.map(l => l.dealId).filter(Boolean),
    ])

    // Fetch all open deals, return those not in dealsWithLinks (max 5)
    const openDeals = await db
      .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany, stage: dealLogs.stage, dealValue: dealLogs.dealValue })
      .from(dealLogs)
      .where(
        and(
          eq(dealLogs.workspaceId, workspaceId),
          ne(dealLogs.stage, 'closed_lost'),
          ne(dealLogs.stage, 'closed_won'),
        )
      )
      .orderBy(desc(dealLogs.dealValue))
      .limit(20)

    const readyForLoop = openDeals
      .filter(d => !dealsWithLinks.has(d.id))
      .slice(0, 5)
      .map(d => ({
        dealId: d.id,
        dealName: d.dealName ?? 'Deal',
        dealCompany: d.prospectCompany ?? '',
        stage: d.stage ?? '',
        dealValue: d.dealValue ?? 0,
      }))

    return NextResponse.json({ data: { activeLoops, completedLoops, readyForLoop } })
  } catch (err) {
    console.error('[dashboard/loops] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildLoopSummary(issues: any[], highestStatus: string): string {
  const count = issues.length
  if (highestStatus === 'in_cycle') return `${count} issue${count !== 1 ? 's' : ''} added to cycle`
  if (highestStatus === 'confirmed') return `${count} issue${count !== 1 ? 's' : ''} confirmed — scoping`
  return `${count} issue${count !== 1 ? 's' : ''} proposed — awaiting confirmation`
}
