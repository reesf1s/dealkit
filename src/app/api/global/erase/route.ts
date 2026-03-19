/**
 * POST /api/global/erase
 * GDPR Article 17 — full erasure of this workspace's data from the global pool.
 * Requires owner role only.
 * Marks all contributions as erased and sets consent.erased_at.
 *
 * Body: { workspaceId: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { eraseFromGlobalPool } from '@/lib/global-pool'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { workspaceId } = body as { workspaceId: string }

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
    }

    // Verify user is the owner (erasure is owner-only)
    const memberRows = await db.execute(sql`
      SELECT role FROM workspace_memberships
      WHERE workspace_id = ${workspaceId}::uuid AND user_id = ${userId}
      LIMIT 1
    `) as unknown as { role: string }[]

    if (memberRows[0]?.role !== 'owner') {
      return NextResponse.json({ error: 'Workspace owner required for erasure' }, { status: 403 })
    }

    const erasedCount = await eraseFromGlobalPool(workspaceId, userId)

    return NextResponse.json({
      ok:           true,
      erasedRecords: erasedCount,
      message:      `${erasedCount} contribution records erased. Your data will be excluded from the next model retrain.`,
    })
  } catch (err) {
    console.error('[POST /api/global/erase]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 }
    )
  }
}
