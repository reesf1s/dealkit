import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

// POST — toggle sharing for success criteria, return { shareToken, isShared }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId } = await getWorkspaceContext(userId)
  const { id } = await params
  const { enable } = await req.json() as { enable: boolean }

  const [item] = await db
    .select({ id: dealLogs.id, successCriteriaIsShared: dealLogs.successCriteriaIsShared, successCriteriaShareToken: dealLogs.successCriteriaShareToken })
    .from(dealLogs)
    .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
    .limit(1)

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (enable) {
    const token = item.successCriteriaShareToken ?? crypto.randomUUID()
    const [updated] = await db
      .update(dealLogs)
      .set({ successCriteriaShareToken: token, successCriteriaIsShared: true, updatedAt: new Date() })
      .where(eq(dealLogs.id, id))
      .returning({ successCriteriaShareToken: dealLogs.successCriteriaShareToken, successCriteriaIsShared: dealLogs.successCriteriaIsShared })

    return NextResponse.json({ shareToken: updated.successCriteriaShareToken, isShared: updated.successCriteriaIsShared })
  } else {
    await db
      .update(dealLogs)
      .set({ successCriteriaShareToken: null, successCriteriaIsShared: false, updatedAt: new Date() })
      .where(eq(dealLogs.id, id))

    return NextResponse.json({ isShared: false })
  }
}
