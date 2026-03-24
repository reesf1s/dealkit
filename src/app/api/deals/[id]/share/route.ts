/**
 * POST /api/deals/[id]/share
 * Toggle the public share link for a deal.
 * Body: { enable: boolean }
 * - enable=true  → generate a token (if none), set isShared=true, return shareToken
 * - enable=false → set isShared=false, clear token
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getWorkspaceContext } from '@/lib/workspace'
import { randomBytes } from 'crypto'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const { enable } = await req.json()

    const [deal] = await db
      .select({ id: dealLogs.id, dealShareToken: dealLogs.dealShareToken })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    if (!enable) {
      await db
        .update(dealLogs)
        .set({ dealIsShared: false, dealShareToken: null })
        .where(eq(dealLogs.id, id))
      return NextResponse.json({ data: { shared: false, shareToken: null } })
    }

    // Generate token if not present
    const token = deal.dealShareToken ?? randomBytes(16).toString('hex')
    await db
      .update(dealLogs)
      .set({ dealIsShared: true, dealShareToken: token })
      .where(eq(dealLogs.id, id))

    return NextResponse.json({ data: { shared: true, shareToken: token } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
