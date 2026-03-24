/**
 * GET /api/dashboard/product-signals
 * Returns the "Product Signal" right-column data for the Today tab:
 *   - gaps: product gaps ranked by revenue at risk, with Linear status
 *   - recentLoops: recent "loop closure" events (Linear shipped → reps notified)
 *   - recentActions: last 5 MCP AI actions for the workspace
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { db } from '@/lib/db'
import { mcpActionLog, dealLogs } from '@/lib/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { dbErrResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const brain = await getWorkspaceBrain(workspaceId)

    // ── Product Gaps ─────────────────────────────────────────────────────────
    const gaps = (brain?.productGapPriority ?? []).slice(0, 5).map(g => ({
      title: g.title,
      revenueAtRisk: Math.round(g.revenueAtRisk ?? 0),
      dealsBlocked: g.dealsBlocked ?? 0,
      status: g.status ?? 'open',
      linkedLinearIssueId: null as string | null,
      linkedLinearIssueStatus: null as string | null,
    }))

    // ── Recent Loop Activity (deployed issues with deal notifications) ────────
    const loopActions = await db
      .select({
        id: mcpActionLog.id,
        actionType: mcpActionLog.actionType,
        dealId: mcpActionLog.dealId,
        linearIssueId: mcpActionLog.linearIssueId,
        result: mcpActionLog.result,
        createdAt: mcpActionLog.createdAt,
      })
      .from(mcpActionLog)
      .where(
        and(
          eq(mcpActionLog.workspaceId, workspaceId),
          eq(mcpActionLog.status, 'complete'),
          inArray(mcpActionLog.actionType, [
            'release_email_generated',
            'all_issues_deployed_notification',
            'issue_deployed_notification',
            'issue_scoped_to_cycle',
          ]),
        ),
      )
      .orderBy(desc(mcpActionLog.createdAt))
      .limit(5)

    // Hydrate deal names for loop actions
    const loopDealIds = [...new Set(loopActions.map(a => a.dealId).filter(Boolean) as string[])]
    const dealNameMap: Record<string, string> = {}
    if (loopDealIds.length > 0) {
      const dealRows = await db
        .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany })
        .from(dealLogs)
        .where(eq(dealLogs.workspaceId, workspaceId))
      for (const d of dealRows) {
        dealNameMap[d.id] = d.prospectCompany ?? d.dealName
      }
    }

    const recentLoops = loopActions.map(a => {
      const result = a.result as Record<string, unknown> | null
      const issueId = (result?.linear_issue_identifier as string | undefined) ?? a.linearIssueId ?? null
      const label =
        a.actionType === 'release_email_generated' ? 'Release email sent'
        : a.actionType === 'issue_scoped_to_cycle' ? 'Scoped to cycle'
        : a.actionType === 'issue_deployed_notification' ? 'Issue shipped'
        : 'Deployed notification'
      return {
        id: a.id,
        label,
        issueId,
        dealName: a.dealId ? dealNameMap[a.dealId] : null,
        createdAt: a.createdAt,
      }
    })

    // ── Recent AI Actions (last 5 of any type) ──────────────────────────────
    const recentActionRows = await db
      .select({
        id: mcpActionLog.id,
        actionType: mcpActionLog.actionType,
        dealId: mcpActionLog.dealId,
        linearIssueId: mcpActionLog.linearIssueId,
        result: mcpActionLog.result,
        createdAt: mcpActionLog.createdAt,
      })
      .from(mcpActionLog)
      .where(
        and(
          eq(mcpActionLog.workspaceId, workspaceId),
          eq(mcpActionLog.status, 'complete'),
        ),
      )
      .orderBy(desc(mcpActionLog.createdAt))
      .limit(5)

    const ACTION_LABELS: Record<string, string> = {
      link_created: 'Linked issue',
      link_confirmed: 'Confirmed link',
      issue_scoped_to_cycle: 'Scoped to cycle',
      release_email_generated: 'Release email sent',
      all_issues_deployed_notification: 'All issues deployed',
      issue_deployed_notification: 'Issue shipped',
      link_dismissed: 'Dismissed link',
    }

    const recentActions = recentActionRows.map(a => {
      const result = a.result as Record<string, unknown> | null
      const issueId = (result?.linear_issue_identifier as string | undefined) ?? a.linearIssueId ?? null
      const label = ACTION_LABELS[a.actionType] ?? a.actionType
      const displayLabel = issueId && (a.actionType === 'link_created' || a.actionType === 'link_confirmed')
        ? `Linked ${issueId}`
        : label
      return {
        id: a.id,
        label: displayLabel,
        dealId: a.dealId,
        dealName: a.dealId ? dealNameMap[a.dealId] : null,
        issueId,
        createdAt: a.createdAt,
      }
    })

    return NextResponse.json({
      data: { gaps, recentLoops, recentActions },
    })
  } catch (err) {
    return dbErrResponse(err)
  }
}
