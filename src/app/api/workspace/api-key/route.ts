import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'
import crypto from 'crypto'

// Ensure the zapier_api_key column exists
let _columnEnsured = false
async function ensureApiKeyColumn() {
  if (_columnEnsured) return
  _columnEnsured = true
  try {
    await db.execute(sql`
      ALTER TABLE workspaces
      ADD COLUMN IF NOT EXISTS zapier_api_key text
    `)
  } catch { /* already exists */ }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    await ensureApiKeyColumn()

    const [ws] = await db
      .select({ zapierApiKey: sql<string | null>`zapier_api_key` })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)

    let apiKey = ws?.zapierApiKey

    if (!apiKey) {
      apiKey = crypto.randomBytes(16).toString('hex')
      await db.execute(
        sql`UPDATE workspaces SET zapier_api_key = ${apiKey}, updated_at = NOW() WHERE id = ${workspaceId}`
      )
    }

    return NextResponse.json({ data: { apiKey } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
