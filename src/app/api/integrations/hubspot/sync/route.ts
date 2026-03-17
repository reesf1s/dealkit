/**
 * POST /api/integrations/hubspot/sync
 * Imports (or updates) deals from HubSpot into SellSight deal_logs.
 * Core sync logic lives in src/lib/hubspot-sync.ts (shared with the cron job).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hubspotIntegrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { syncHubspotDeals } from '@/lib/hubspot-sync'

export async function POST(_req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkRateLimit(userId, 'hubspot-sync', 5) // max 5 syncs / 15 min
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    const { workspaceId } = await getWorkspaceContext(userId)
    const result = await syncHubspotDeals(workspaceId, userId)

    return NextResponse.json({ data: { dealsImported: result.dealsImported, syncedAt: result.syncedAt } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[hubspot/sync]', msg)

    // Store error on integration record so the UI can surface it
    try {
      const { userId } = await auth()
      if (userId) {
        const { workspaceId } = await getWorkspaceContext(userId)
        await db.update(hubspotIntegrations)
          .set({ syncError: msg.slice(0, 500), updatedAt: new Date() })
          .where(eq(hubspotIntegrations.workspaceId, workspaceId))
      }
    } catch { /* best effort */ }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
