/**
 * GET /api/integrations/hubspot/status
 * Returns current HubSpot connection state for the authenticated workspace.
 */
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getHubspotIntegration, ensureHubspotSchema } from '@/lib/hubspot'

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    await ensureHubspotSchema()
    const integration = await getHubspotIntegration(workspaceId)
    if (!integration) {
      return NextResponse.json({ data: { connected: false } })
    }
    return NextResponse.json({
      data: {
        connected: true,
        portalId:       integration.portalId,
        lastSyncAt:     integration.lastSyncAt ?? null,
        dealsImported:  integration.dealsImported,
        syncError:      integration.syncError ?? null,
        configured:     !!(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
