import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'
import crypto from 'crypto'

// Ensure the inbound_email_token column exists (safe ADD COLUMN IF NOT EXISTS)
let _columnEnsured = false
async function ensureInboundEmailTokenColumn() {
  if (_columnEnsured) return
  _columnEnsured = true
  try {
    await db.execute(sql`
      ALTER TABLE workspaces
      ADD COLUMN IF NOT EXISTS inbound_email_token text
    `)
  } catch { /* already exists */ }
}

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId, role } = await getWorkspaceContext(userId)
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — owner or admin required' }, { status: 403 })
    }

    await ensureInboundEmailTokenColumn()

    const newToken = crypto.randomBytes(4).toString('hex')
    const [updated] = await db
      .update(workspaces)
      .set({ inboundEmailToken: newToken, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))
      .returning({ inboundEmailToken: workspaces.inboundEmailToken })

    const email = `ws-${updated.inboundEmailToken}@inbound.sellsight.ai`
    return NextResponse.json({ data: { email, token: updated.inboundEmailToken } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
