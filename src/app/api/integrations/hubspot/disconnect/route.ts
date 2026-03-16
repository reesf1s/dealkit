/**
 * DELETE /api/integrations/hubspot/disconnect
 * Removes HubSpot credentials for the workspace.
 * Does NOT delete imported deals — those stay in deal_logs.
 */
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hubspotIntegrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getWorkspaceContext } from '@/lib/workspace'
import { ensureHubspotSchema } from '@/lib/hubspot'

export async function DELETE(_req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    await ensureHubspotSchema()
    await db.delete(hubspotIntegrations).where(eq(hubspotIntegrations.workspaceId, workspaceId))
    return NextResponse.json({ data: { disconnected: true } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
