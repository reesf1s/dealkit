/**
 * GET /api/mcp-actions/recent
 * Returns the last N MCP actions for the workspace — used in the dashboard
 * "Recent AI Actions" feed.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { mcpActionLog, dealLogs } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

const ACTION_LABELS: Record<string, string> = {
  link_created: 'Linked issue',
  link_confirmed: 'Confirmed issue link',
  issue_scoped_to_cycle: 'Scoped issue to sprint',
  bulk_scope_confirmation: 'Bulk scope confirmation',
  release_email_generated: 'Release email generated',
  all_issues_deployed_notification: 'All issues deployed',
  issue_deployed_notification: 'Issue deployed',
  link_dismissed: 'Dismissed issue link',
  scope_issue: 'Scoped issue',
  issue_scoped: 'Issue scoped',
  hubspot_email_logged: 'Sent email via HubSpot',
  follow_up_reminder: 'Follow-up reminder set',
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 50)

    const actions = await db
      .select({
        id: mcpActionLog.id,
        actionType: mcpActionLog.actionType,
        dealId: mcpActionLog.dealId,
        linearIssueId: mcpActionLog.linearIssueId,
        triggeredBy: mcpActionLog.triggeredBy,
        status: mcpActionLog.status,
        payload: mcpActionLog.payload,
        result: mcpActionLog.result,
        createdAt: mcpActionLog.createdAt,
      })
      .from(mcpActionLog)
      .where(and(
        eq(mcpActionLog.workspaceId, workspaceId),
        eq(mcpActionLog.status, 'complete'),
      ))
      .orderBy(desc(mcpActionLog.createdAt))
      .limit(limit)

    // Hydrate with deal names
    const dealIds = [...new Set(actions.map(a => a.dealId).filter(Boolean) as string[])]
    const dealNames: Record<string, { dealName: string; prospectCompany: string }> = {}

    if (dealIds.length > 0) {
      const deals = await db
        .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany })
        .from(dealLogs)
        .where(eq(dealLogs.workspaceId, workspaceId))

      for (const d of deals) {
        dealNames[d.id] = { dealName: d.dealName, prospectCompany: d.prospectCompany }
      }
    }

    const enriched = actions.map(a => {
      const result = a.result as Record<string, unknown> | null
      // Prefer identifier from result payload (populated by new logging), fall back to linearIssueId
      const issueIdentifier = (result?.linear_issue_identifier as string | undefined)
        ?? (result?.linear_issue_id as string | undefined)
        ?? a.linearIssueId
        ?? null
      const issueTitle = (result?.linear_issue_title as string | undefined)
        ?? (result?.issueTitle as string | undefined)
        ?? null

      // Build a human-friendly label
      let label = ACTION_LABELS[a.actionType] ?? a.actionType
      if ((a.actionType === 'link_created' || a.actionType === 'link_confirmed') && issueIdentifier) {
        label = `Linked ${issueIdentifier}`
      }

      return {
        id: a.id,
        actionType: a.actionType,
        label,
        dealId: a.dealId,
        dealName: a.dealId ? dealNames[a.dealId]?.dealName : null,
        company: a.dealId ? dealNames[a.dealId]?.prospectCompany : null,
        linearIssueId: a.linearIssueId,
        linearIssueIdentifier: issueIdentifier,
        linearIssueTitle: issueTitle,
        triggeredBy: a.triggeredBy,
        createdAt: a.createdAt,
      }
    })

    return NextResponse.json({ data: enriched })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
