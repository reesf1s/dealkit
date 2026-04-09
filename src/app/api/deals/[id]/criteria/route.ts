export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealCriteria } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const criteria = await db
      .select().from(dealCriteria)
      .where(and(eq(dealCriteria.dealId, dealId), eq(dealCriteria.workspaceId, workspaceId)))
      .orderBy(dealCriteria.createdAt)
    return NextResponse.json({ data: criteria })
  } catch (err) { return dbErrResponse(err) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const { text, category } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })
    const now = new Date()
    const [item] = await db.insert(dealCriteria).values({
      workspaceId, dealId, text: text.trim(),
      category: category ?? 'success',
      createdAt: now, updatedAt: now,
    }).returning()
    return NextResponse.json({ data: item })
  } catch (err) { return dbErrResponse(err) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const { criteriaId, met, text } = await req.json()
    if (!criteriaId) return NextResponse.json({ error: 'criteriaId required' }, { status: 400 })
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (met !== undefined) updates.met = met
    if (text !== undefined) updates.text = text
    const [updated] = await db
      .update(dealCriteria).set(updates)
      .where(and(eq(dealCriteria.id, criteriaId), eq(dealCriteria.dealId, dealId), eq(dealCriteria.workspaceId, workspaceId)))
      .returning()
    return NextResponse.json({ data: updated })
  } catch (err) { return dbErrResponse(err) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const criteriaId = new URL(req.url).searchParams.get('criteriaId')
    if (!criteriaId) return NextResponse.json({ error: 'criteriaId required' }, { status: 400 })
    await db.delete(dealCriteria).where(
      and(eq(dealCriteria.id, criteriaId), eq(dealCriteria.dealId, dealId), eq(dealCriteria.workspaceId, workspaceId))
    )
    return NextResponse.json({ ok: true })
  } catch (err) { return dbErrResponse(err) }
}
