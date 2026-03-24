/**
 * POST /api/integrations/slack/disconnect
 * Removes the Slack connection for the workspace.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { slackConnections } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getWorkspaceContext } from '@/lib/workspace'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const wsCtx = await getWorkspaceContext(userId)
    if (!wsCtx) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    await db
      .delete(slackConnections)
      .where(eq(slackConnections.workspaceId, wsCtx.workspaceId))

    return NextResponse.json({ data: { disconnected: true } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
