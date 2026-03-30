/**
 * GET  /api/deals/[id]/linear-links   — list all links for a deal
 * POST /api/deals/[id]/linear-links   — manually create a link
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { eq, and, inArray } from 'drizzle-orm'
import { dealLinearLinks, dealLogs, linearIssuesCache, mcpActionLog } from '@/lib/db/schema'
import { buildClaudeIssueReviewPrompt, ISSUE_LINKING_MODE } from '@/lib/issue-linking'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { workspaceId } = await getWorkspaceContext(userId)

    // Verify deal belongs to workspace
    const [deal] = await db
      .select({
        id: dealLogs.id,
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
      })
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

    // Enrich deployed links with hasReleaseEmail flag
    const deployedIssueIds = links
      .filter(l => l.status === 'deployed')
      .map(l => l.linearIssueId)

    const emailedIssueIds = new Set<string>()
    if (deployedIssueIds.length > 0) {
      const emailLogs = await db
        .select({ linearIssueId: mcpActionLog.linearIssueId })
        .from(mcpActionLog)
        .where(
          and(
            eq(mcpActionLog.workspaceId, workspaceId),
            eq(mcpActionLog.dealId, id),
            eq(mcpActionLog.actionType, 'release_email_generated'),
            eq(mcpActionLog.status, 'complete'),
            inArray(mcpActionLog.linearIssueId, deployedIssueIds),
          ),
        )
      for (const row of emailLogs) {
        if (row.linearIssueId) emailedIssueIds.add(row.linearIssueId)
      }
    }

    const enriched = links.map(l => ({
      ...l,
      hasReleaseEmail: emailedIssueIds.has(l.linearIssueId),
    }))

    return NextResponse.json({
      data: enriched,
      meta: {
        mode: ISSUE_LINKING_MODE,
        reviewPrompt: buildClaudeIssueReviewPrompt({
          dealId: id,
          dealName: deal.dealName,
          company: deal.prospectCompany ?? deal.dealName ?? 'this deal',
        }),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
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

    const body = await req.json()
    const linearIssueId = typeof body?.linearIssueId === 'string' ? body.linearIssueId.trim() : ''
    if (!linearIssueId) {
      return NextResponse.json({ error: 'linearIssueId is required' }, { status: 400 })
    }

    // Fetch issue metadata from cache (if available)
    const [cached] = await db
      .select()
      .from(linearIssuesCache)
      .where(
        and(
          eq(linearIssuesCache.workspaceId, workspaceId),
          eq(linearIssuesCache.linearIssueId, linearIssueId),
        ),
      )
      .limit(1)

    const [link] = await db
      .insert(dealLinearLinks)
      .values({
        workspaceId,
        dealId: id,
        linearIssueId,
        linearIssueUrl: cached?.linearIssueUrl ?? null,
        linearTitle: cached?.title ?? null,
        relevanceScore: 100,
        linkType: 'manual',
        status: 'confirmed',
      })
      .onConflictDoUpdate({
        target: [dealLinearLinks.dealId, dealLinearLinks.linearIssueId],
        set: {
          linkType: 'manual',
          status: 'confirmed',
          relevanceScore: 100,
          updatedAt: new Date(),
        },
      })
      .returning()

    return NextResponse.json({ data: link })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
