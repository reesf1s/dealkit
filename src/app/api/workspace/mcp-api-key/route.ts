import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'
import crypto from 'crypto'

/** GET — return the workspace MCP API key, generating one on first call */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    const [ws] = await db
      .select({ mcpApiKey: workspaces.mcpApiKey })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)

    let key = ws?.mcpApiKey

    if (!key) {
      key = crypto.randomUUID()
      await db
        .update(workspaces)
        .set({ mcpApiKey: key, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId))
    }

    return NextResponse.json({ data: { mcpApiKey: key } })
  } catch (err) {
    return dbErrResponse(err)
  }
}

/** POST — regenerate the MCP API key (invalidates the old one) */
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId, role } = await getWorkspaceContext(userId)

    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Owner or admin required' }, { status: 403 })
    }

    const key = crypto.randomUUID()
    await db
      .update(workspaces)
      .set({ mcpApiKey: key, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))

    return NextResponse.json({ data: { mcpApiKey: key } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
