import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { workflows } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { dbErrResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const body = await req.json()

    const [row] = await db
      .update(workflows)
      .set({ enabled: body.enabled, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.workspaceId, workspaceId)))
      .returning()

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: row })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params

    await db.delete(workflows).where(and(eq(workflows.id, id), eq(workflows.workspaceId, workspaceId)))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return dbErrResponse(err)
  }
}
