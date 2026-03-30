/**
 * POST /api/deals/[id]/discover-issues
 *
 * Returns the current issue links for a deal and guidance for the
 * Claude-assisted review flow.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, dealLinearLinks } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { buildClaudeIssueReviewPrompt, ISSUE_LINKING_MODE } from '@/lib/issue-linking'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { workspaceId } = await getWorkspaceContext(userId)

    // Verify deal belongs to workspace
    const [deal] = await db
      .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const links = await db
      .select()
      .from(dealLinearLinks)
      .where(
        and(
          eq(dealLinearLinks.dealId, id),
          eq(dealLinearLinks.workspaceId, workspaceId),
        ),
      )

    return NextResponse.json({
      data: {
        mode: ISSUE_LINKING_MODE,
        linked: links.filter(link => link.status !== 'dismissed').length,
        suggested: links.filter(link => link.status === 'suggested').length,
        total: links.filter(link => link.status !== 'dismissed').length,
        links,
        message: 'Issue review now happens through your Claude + Halvex MCP connection rather than Halvex-owned rematching.',
        reviewPrompt: buildClaudeIssueReviewPrompt({
          dealId: id,
          dealName: deal.dealName,
          company: deal.prospectCompany ?? deal.dealName ?? 'this deal',
        }),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
