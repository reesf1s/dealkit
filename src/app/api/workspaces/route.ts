import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getWorkspaceContext(userId)
    return NextResponse.json({ data: ctx.workspace, role: ctx.role })
  } catch (err) {
    console.error('[GET /api/workspaces]', err)
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
    const { name } = await req.json()
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const [updated] = await db.update(workspaces).set({ name, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId)).returning()
    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('[PATCH /api/workspaces]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 }
    )
  }
}
