/**
 * POST /api/deals/[id]/linear-links/[linkId]/dismiss
 * Dismiss a suggested link — will not be re-suggested by ML.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { dealLinearLinks, dealLogs } from '@/lib/db/schema'

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

    const [updated] = await db
      .update(dealLinearLinks)
      .set({ status: 'dismissed', updatedAt: new Date() })
      .where(
        and(
          eq(dealLinearLinks.id, linkId),
          eq(dealLinearLinks.dealId, dealId),
          eq(dealLinearLinks.workspaceId, workspaceId),
        ),
      )
      .returning()

    if (!updated) return NextResponse.json({ error: 'Link not found' }, { status: 404 })

    return NextResponse.json({ data: updated })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
