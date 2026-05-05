import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = await getWorkspaceContext(userId)
    return NextResponse.json({ data: ctx.workspace, role: ctx.role })
  } catch (err) {
    console.error('[GET /api/workspaces]', err)
    return dbErrResponse(err)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, role } = await getWorkspaceContext(userId)
    if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const { name, emailDigestEnabled } = body
    if (name === undefined && emailDigestEnabled === undefined) return NextResponse.json({ error: 'name or emailDigestEnabled required' }, { status: 400 })
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (name !== undefined) updates.name = name
    if (emailDigestEnabled !== undefined) updates.emailDigestEnabled = emailDigestEnabled
    const [updated] = await db.update(workspaces).set(updates).where(eq(workspaces.id, workspaceId)).returning()
    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('[PATCH /api/workspaces]', err)
    return dbErrResponse(err)
  }
}
