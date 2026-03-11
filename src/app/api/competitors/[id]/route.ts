import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { competitors, collateral, events } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'

async function logEvent(userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ userId, type, metadata, createdAt: new Date() })
}

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/competitors/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const [competitor] = await db
      .select()
      .from(competitors)
      .where(and(eq(competitors.id, id), eq(competitors.userId, userId)))
      .limit(1)

    if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ data: competitor })
  } catch (err) {
    return dbErrResponse(err)
  }
}

// PATCH /api/competitors/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const [existing] = await db
      .select({ id: competitors.id })
      .from(competitors)
      .where(and(eq(competitors.id, id), eq(competitors.userId, userId)))
      .limit(1)

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const {
      name,
      website,
      description,
      strengths,
      weaknesses,
      pricing,
      targetMarket,
      keyFeatures,
      differentiators,
      notes,
    } = body

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (name !== undefined) updateData.name = name
    if (website !== undefined) updateData.website = website
    if (description !== undefined) updateData.description = description
    if (strengths !== undefined) updateData.strengths = strengths
    if (weaknesses !== undefined) updateData.weaknesses = weaknesses
    if (pricing !== undefined) updateData.pricing = pricing
    if (targetMarket !== undefined) updateData.targetMarket = targetMarket
    if (keyFeatures !== undefined) updateData.keyFeatures = keyFeatures
    if (differentiators !== undefined) updateData.differentiators = differentiators
    if (notes !== undefined) updateData.notes = notes

    const [updated] = await db
      .update(competitors)
      .set(updateData)
      .where(and(eq(competitors.id, id), eq(competitors.userId, userId)))
      .returning()

    await logEvent(userId, 'competitor.updated', { competitorId: id, name: updated.name })

    return NextResponse.json({ data: updated })
  } catch (err) {
    return dbErrResponse(err)
  }
}

// DELETE /api/competitors/[id] — also removes associated collateral
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const [existing] = await db
      .select({ id: competitors.id, name: competitors.name })
      .from(competitors)
      .where(and(eq(competitors.id, id), eq(competitors.userId, userId)))
      .limit(1)

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Delete associated collateral first (FK onDelete: set null handles the reference,
    // but we explicitly delete collateral that is solely sourced from this competitor)
    await db
      .delete(collateral)
      .where(
        and(eq(collateral.userId, userId), eq(collateral.sourceCompetitorId, id)),
      )

    await db
      .delete(competitors)
      .where(and(eq(competitors.id, id), eq(competitors.userId, userId)))

    await logEvent(userId, 'competitor.deleted', { competitorId: id, name: existing.name })

    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
