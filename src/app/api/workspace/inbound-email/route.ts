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

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    await ensureInboundEmailTokenColumn()

    // Fetch current token
    const [ws] = await db
      .select({ inboundEmailToken: workspaces.inboundEmailToken })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)

    let token = ws?.inboundEmailToken

    // Auto-generate if not set
    if (!token) {
      token = crypto.randomBytes(4).toString('hex')
      await db
        .update(workspaces)
        .set({ inboundEmailToken: token, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId))
    }

    const email = `ws-${token}@inbound.sellsight.ai`
    return NextResponse.json({ data: { email, token } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
