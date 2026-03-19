import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaceMemberships } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, role } = await getWorkspaceContext(userId)
    if (role === 'owner') return NextResponse.json({ error: 'Owners cannot leave. Transfer ownership or delete the workspace.' }, { status: 400 })
    await db.delete(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.userId, userId)))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/workspaces/leave]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 }
    )
  }
}
