/**
 * GET /api/integrations/linear/status
 * Returns current Linear connection state for the workspace.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'
import { linearIntegrations, linearIssuesCache } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'

const ISSUE_LINKING_MODE = 'mcp'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    const [integration] = await db
      .select({
        teamName: linearIntegrations.teamName,
        workspaceName: linearIntegrations.workspaceName,
        lastSyncAt: linearIntegrations.lastSyncAt,
        syncError: linearIntegrations.syncError,
      })
      .from(linearIntegrations)
      .where(eq(linearIntegrations.workspaceId, workspaceId))
      .limit(1)

    if (!integration) {
      return NextResponse.json({
        data: {
          connected: false,
          degraded: false,
          issueCount: 0,
          matchingMode: ISSUE_LINKING_MODE,
        },
      })
    }

    const [{ count: issueCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(linearIssuesCache)
      .where(eq(linearIssuesCache.workspaceId, workspaceId))

    return NextResponse.json({
      data: {
        connected: true,
        degraded: Boolean(integration.syncError),
        matchingMode: ISSUE_LINKING_MODE,
        teamName: integration.teamName,
        workspaceName: integration.workspaceName,
        lastSyncAt: integration.lastSyncAt,
        syncError: integration.syncError,
        issueCount: Number(issueCount ?? 0),
        matchingSummary: 'Linear stays synced in Halvex, while Claude + Halvex MCP handles issue review and saves the chosen links back.',
      },
    })
  } catch (e: unknown) {
    return dbErrResponse(e)
  }
}
