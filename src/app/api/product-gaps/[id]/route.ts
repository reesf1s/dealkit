export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productGaps } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const body = await req.json()
    const { userId: _uid, workspaceId: _wid, ...rest } = body
    const [gap] = await db.update(productGaps).set({ ...rest, updatedAt: new Date() }).where(and(eq(productGaps.id, id), eq(productGaps.workspaceId, workspaceId))).returning()
    if (!gap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: gap })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    await db.delete(productGaps).where(and(eq(productGaps.id, id), eq(productGaps.workspaceId, workspaceId)))
    return NextResponse.json({ success: true })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
