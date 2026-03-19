/**
 * GET  /api/global/consent  — fetch current consent status for the workspace
 * POST /api/global/consent  — grant or revoke consent (owner/admin only)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { setGlobalConsent, getGlobalConsent } from '@/lib/global-pool'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get workspace for this user
    const rows = await db.execute(sql`
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = ${userId}
      ORDER BY created_at ASC LIMIT 1
    `) as unknown as { workspace_id: string }[]

    const workspaceId = rows[0]?.workspace_id
    if (!workspaceId) return NextResponse.json({ consented: false })

    const consented = await getGlobalConsent(workspaceId)
    return NextResponse.json({ consented })
  } catch (err) {
    console.error('[GET /api/global/consent]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { consented, workspaceId } = body as { consented: boolean; workspaceId: string }

    if (typeof consented !== 'boolean' || !workspaceId) {
      return NextResponse.json({ error: 'consented (boolean) and workspaceId required' }, { status: 400 })
    }

    // Verify user is owner or admin of this workspace
    const memberRows = await db.execute(sql`
      SELECT role FROM workspace_memberships
      WHERE workspace_id = ${workspaceId}::uuid AND user_id = ${userId}
      LIMIT 1
    `) as unknown as { role: string }[]

    const role = memberRows[0]?.role
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Owner or admin required' }, { status: 403 })
    }

    await setGlobalConsent(workspaceId, consented, userId)

    return NextResponse.json({ ok: true, consented })
  } catch (err) {
    console.error('[POST /api/global/consent]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 }
    )
  }
}
