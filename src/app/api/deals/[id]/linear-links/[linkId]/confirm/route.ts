/**
 * POST /api/deals/[id]/linear-links/[linkId]/confirm
 * Confirm a suggested link and write deal context to Linear.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { dealLinearLinks, dealLogs, mcpActionLog } from '@/lib/db/schema'
import { writeHalvexSectionToLinear } from '@/lib/linear-signal-match'

type Params = { params: Promise<{ id: string; linkId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: dealId, linkId } = await params
    const { workspaceId } = await getWorkspaceContext(userId)

    // Verify deal belongs to workspace
    const [deal] = await db
      .select({ id: dealLogs.id })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Update link status
    const [updated] = await db
      .update(dealLinearLinks)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(
        and(
          eq(dealLinearLinks.id, linkId),
          eq(dealLinearLinks.dealId, dealId),
          eq(dealLinearLinks.workspaceId, workspaceId),
        ),
      )
      .returning()

    if (!updated) return NextResponse.json({ error: 'Link not found' }, { status: 404 })

    // Write deal context to Linear issue (fire-and-forget — don't block response)
    writeHalvexSectionToLinear(workspaceId, updated.linearIssueId).catch(err =>
      console.error('[confirm-link] writeHalvexSectionToLinear failed:', err),
    )

    // Log the action
    await db.insert(mcpActionLog).values({
      workspaceId,
      actionType: 'link_confirmed',
      dealId,
      linearIssueId: updated.linearIssueId,
      triggeredBy: 'user',
      status: 'complete',
    })

    return NextResponse.json({ data: updated })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
