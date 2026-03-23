/**
 * GET /api/integrations/linear/status
 * Returns current Linear connection state for the workspace.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { linearIntegrations } from '@/lib/db/schema'

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
      return NextResponse.json({ data: { connected: false } })
    }

    return NextResponse.json({
      data: {
        connected: true,
        teamName: integration.teamName,
        workspaceName: integration.workspaceName,
        lastSyncAt: integration.lastSyncAt,
        syncError: integration.syncError,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
