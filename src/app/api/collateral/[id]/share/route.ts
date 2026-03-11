import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral } from '@/lib/db/schema'

// POST /api/collateral/[id]/share — toggle sharing, return { shareToken, isShared }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { enable: boolean }
  const { enable } = body

  // Verify ownership
  const [item] = await db
    .select({ id: collateral.id, isShared: collateral.isShared, shareToken: collateral.shareToken })
    .from(collateral)
    .where(and(eq(collateral.id, id), eq(collateral.userId, userId)))
    .limit(1)

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (enable) {
    const token = item.shareToken ?? crypto.randomUUID()
    const [updated] = await db
      .update(collateral)
      .set({ shareToken: token, isShared: true, updatedAt: new Date() })
      .where(eq(collateral.id, id))
      .returning({ shareToken: collateral.shareToken, isShared: collateral.isShared })

    return NextResponse.json({ shareToken: updated.shareToken, isShared: updated.isShared })
  } else {
    await db
      .update(collateral)
      .set({ shareToken: null, isShared: false, updatedAt: new Date() })
      .where(eq(collateral.id, id))

    return NextResponse.json({ isShared: false })
  }
}
