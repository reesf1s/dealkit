import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral, events } from '@/lib/db/schema'

async function logEvent(userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ userId, type, metadata, createdAt: new Date() })
}

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/collateral/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [item] = await db
    .select()
    .from(collateral)
    .where(and(eq(collateral.id, id), eq(collateral.userId, userId)))
    .limit(1)

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: item })
}

// DELETE /api/collateral/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [existing] = await db
    .select({ id: collateral.id, type: collateral.type, title: collateral.title })
    .from(collateral)
    .where(and(eq(collateral.id, id), eq(collateral.userId, userId)))
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db
    .delete(collateral)
    .where(and(eq(collateral.id, id), eq(collateral.userId, userId)))

  await logEvent(userId, 'collateral.archived', {
    collateralId: id,
    collateralType: existing.type,
    title: existing.title,
  })

  return NextResponse.json({ data: { deleted: true } })
}
