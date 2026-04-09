export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealMilestones } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const milestones = await db
      .select().from(dealMilestones)
      .where(and(eq(dealMilestones.dealId, dealId), eq(dealMilestones.workspaceId, workspaceId)))
      .orderBy(dealMilestones.sortOrder)
    return NextResponse.json({ data: milestones })
  } catch (err) { return dbErrResponse(err) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const { title, description, dueDate, sortOrder } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
    const now = new Date()
    const [ms] = await db.insert(dealMilestones).values({
      workspaceId, dealId,
      title: title.trim(),
      description: description ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
      sortOrder: sortOrder ?? 0,
      createdAt: now, updatedAt: now,
    }).returning()
    return NextResponse.json({ data: ms })
  } catch (err) { return dbErrResponse(err) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const { milestoneId, status, title, description } = await req.json()
    if (!milestoneId) return NextResponse.json({ error: 'milestoneId required' }, { status: 400 })
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (status !== undefined) {
      updates.status = status
      if (status === 'done') updates.completedAt = new Date()
    }
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    const [updated] = await db
      .update(dealMilestones).set(updates)
      .where(and(eq(dealMilestones.id, milestoneId), eq(dealMilestones.dealId, dealId), eq(dealMilestones.workspaceId, workspaceId)))
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
    const milestoneId = new URL(req.url).searchParams.get('milestoneId')
    if (!milestoneId) return NextResponse.json({ error: 'milestoneId required' }, { status: 400 })
    await db.delete(dealMilestones).where(
      and(eq(dealMilestones.id, milestoneId), eq(dealMilestones.dealId, dealId), eq(dealMilestones.workspaceId, workspaceId))
    )
    return NextResponse.json({ ok: true })
  } catch (err) { return dbErrResponse(err) }
}
