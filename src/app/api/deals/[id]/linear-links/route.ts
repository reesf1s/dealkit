/**
 * GET  /api/deals/[id]/linear-links   — list all links for a deal
 * POST /api/deals/[id]/linear-links   — manually create a link
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { dealLinearLinks, dealLogs, linearIssuesCache } from '@/lib/db/schema'
import { matchDealToIssues } from '@/lib/linear-signal-match'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
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
