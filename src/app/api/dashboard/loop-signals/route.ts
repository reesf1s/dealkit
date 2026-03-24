/**
 * GET /api/dashboard/loop-signals
 * Returns Signal / In-Flight / Closed Loop data for the Today tab.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { and, eq, count, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, dealLinearLinks, slackPendingActions } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    // ── Signal: deals with suggested links but no active pending actions ──
    const signalDeals = await db
      .select({
        id: dealLogs.id,
        company: dealLogs.prospectCompany,
        dealValue: dealLogs.dealValue,
        stage: dealLogs.stage,
        suggestedCount: count(dealLinearLinks.id),
      })
      .from(dealLogs)
      .innerJoin(dealLinearLinks, and(
        eq(dealLinearLinks.dealId, dealLogs.id),
        eq(dealLinearLinks.status, 'suggested'),
      ))
      .where(and(
        eq(dealLogs.workspaceId, workspaceId),
        sql`${dealLogs.stage} NOT IN ('closed_won', 'closed_lost')`,
        sql`NOT EXISTS (
          SELECT 1 FROM slack_pending_actions spa
          WHERE spa.deal_id = ${dealLogs.id}
          AND spa.expires_at > now()
        )`,
      ))
      .groupBy(dealLogs.id, dealLogs.prospectCompany, dealLogs.dealValue, dealLogs.stage)
      .limit(10)

    // ── In-Flight: deals with pending approvals OR in_cycle issues ──
    const inFlightBase = await db
      .selectDistinct({
        id: dealLogs.id,
        company: dealLogs.prospectCompany,
        dealValue: dealLogs.dealValue,
        stage: dealLogs.stage,
      })
      .from(dealLogs)
      .where(and(
        eq(dealLogs.workspaceId, workspaceId),
        sql`(
          EXISTS (
            SELECT 1 FROM slack_pending_actions spa
            WHERE spa.deal_id = ${dealLogs.id} AND spa.expires_at > now()
          ) OR EXISTS (
            SELECT 1 FROM deal_linear_links dll
            WHERE dll.deal_id = ${dealLogs.id} AND dll.status = 'in_cycle'
          )
        )`,
      ))
      .limit(10)

    const inFlight = await Promise.all(
      inFlightBase.map(async (deal) => {
        const [pending] = await db
          .select({ id: slackPendingActions.id, createdAt: slackPendingActions.createdAt })
          .from(slackPendingActions)
          .where(and(eq(slackPendingActions.dealId, deal.id), sql`expires_at > now()`))
          .limit(1)

        const inCycleIssues = await db
          .select({ linearIssueId: dealLinearLinks.linearIssueId, linearTitle: dealLinearLinks.linearTitle })
          .from(dealLinearLinks)
          .where(and(eq(dealLinearLinks.dealId, deal.id), eq(dealLinearLinks.status, 'in_cycle')))
          .limit(3)

        return {
          ...deal,
          loopStage: pending ? 'awaiting_approval' : 'in_cycle',
          pendingActionCreatedAt: pending?.createdAt ?? null,
          inCycleIssues,
        }
      }),
    )

    // ── Closed Loops this week: all issues deployed within 7 days ──
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const closedLoops = await db
      .select({
        id: dealLogs.id,
        company: dealLogs.prospectCompany,
        dealValue: dealLogs.dealValue,
        deployedAt: sql<Date>`max(${dealLinearLinks.deployedAt})`.as('deployed_at'),
        issueCount: count(dealLinearLinks.id),
      })
      .from(dealLogs)
      .innerJoin(dealLinearLinks, and(
        eq(dealLinearLinks.dealId, dealLogs.id),
        eq(dealLinearLinks.status, 'deployed'),
      ))
      .where(and(
        eq(dealLogs.workspaceId, workspaceId),
        sql`${dealLinearLinks.deployedAt} > ${weekAgo}`,
        sql`NOT EXISTS (
          SELECT 1 FROM deal_linear_links dll2
          WHERE dll2.deal_id = ${dealLogs.id} AND dll2.status != 'deployed'
        )`,
      ))
      .groupBy(dealLogs.id, dealLogs.prospectCompany, dealLogs.dealValue)
      .limit(5)

    return NextResponse.json({
      data: { signals: signalDeals, inFlight, closedLoops, closedCount: closedLoops.length },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
