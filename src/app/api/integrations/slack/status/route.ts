/**
 * GET /api/integrations/slack/status
 * Returns the current Slack connection state for the workspace.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { slackConnections } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'

function isSlackConfigured() {
  return Boolean(
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET &&
    process.env.SLACK_SIGNING_SECRET
  )
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const wsCtx = await getWorkspaceContext(userId)
    if (!wsCtx) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const [conn] = await db
      .select({
        slackTeamId: slackConnections.slackTeamId,
        slackTeamName: slackConnections.slackTeamName,
        installedBy: slackConnections.installedBy,
        createdAt: slackConnections.createdAt,
      })
      .from(slackConnections)
      .where(eq(slackConnections.workspaceId, wsCtx.workspaceId))
      .limit(1)

    if (!conn) {
      return NextResponse.json({ data: { connected: false, configured: isSlackConfigured() } })
    }

    return NextResponse.json({
      data: {
        connected: true,
        configured: isSlackConfigured(),
        slackTeamId: conn.slackTeamId,
        slackTeamName: conn.slackTeamName,
        installedBy: conn.installedBy,
        connectedAt: conn.createdAt,
      },
    })
  } catch (e: unknown) {
    return dbErrResponse(e)
  }
}
