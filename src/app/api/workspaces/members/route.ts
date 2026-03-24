import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaceMemberships, users } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const members = await db
      .select({ id: workspaceMemberships.id, userId: workspaceMemberships.userId, role: workspaceMemberships.role, appRole: workspaceMemberships.appRole, createdAt: workspaceMemberships.createdAt, email: users.email })
      .from(workspaceMemberships)
      .innerJoin(users, eq(workspaceMemberships.userId, users.id))
      .where(eq(workspaceMemberships.workspaceId, workspaceId))
    return NextResponse.json({ data: members })
  } catch (err) {
    console.error('[GET /api/workspaces/members]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, role } = await getWorkspaceContext(userId)
    if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { targetUserId, appRole } = await req.json()
    if (!targetUserId || !appRole || !['sales', 'product', 'admin'].includes(appRole)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    await db
      .update(workspaceMemberships)
      .set({ appRole })
      .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.userId, targetUserId)))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/workspaces/members]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, role } = await getWorkspaceContext(userId)
    if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { targetUserId } = await req.json()
    if (!targetUserId) return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })
    if (targetUserId === userId) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    await db.delete(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.userId, targetUserId)))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/workspaces/members]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 }
    )
  }
}
