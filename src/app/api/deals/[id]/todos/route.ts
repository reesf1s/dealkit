export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealTodos } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const todos = await db
      .select()
      .from(dealTodos)
      .where(and(eq(dealTodos.dealId, dealId), eq(dealTodos.workspaceId, workspaceId)))
      .orderBy(dealTodos.createdAt)
    return NextResponse.json({ data: todos })
  } catch (err) { return dbErrResponse(err) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const body = await req.json()
    const { text, priority, dueDate } = body
    if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })
    const now = new Date()
    const [todo] = await db.insert(dealTodos).values({
      workspaceId, dealId,
      text: text.trim(),
      priority: priority ?? 'normal',
      dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: userId,
      createdAt: now, updatedAt: now,
    }).returning()
    return NextResponse.json({ data: todo })
  } catch (err) { return dbErrResponse(err) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const body = await req.json()
    const { todoId, done, text, priority } = body
    if (!todoId) return NextResponse.json({ error: 'todoId required' }, { status: 400 })
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (done !== undefined) updates.done = done
    if (text !== undefined) updates.text = text
    if (priority !== undefined) updates.priority = priority
    const [updated] = await db
      .update(dealTodos)
      .set(updates)
      .where(and(eq(dealTodos.id, todoId), eq(dealTodos.dealId, dealId), eq(dealTodos.workspaceId, workspaceId)))
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
    const { searchParams } = new URL(req.url)
    const todoId = searchParams.get('todoId')
    if (!todoId) return NextResponse.json({ error: 'todoId required' }, { status: 400 })
    await db.delete(dealTodos).where(
      and(eq(dealTodos.id, todoId), eq(dealTodos.dealId, dealId), eq(dealTodos.workspaceId, workspaceId))
    )
    return NextResponse.json({ ok: true })
  } catch (err) { return dbErrResponse(err) }
}
