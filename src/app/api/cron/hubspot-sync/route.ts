/**
 * GET /api/cron/hubspot-sync
 * Called daily by Vercel Cron (see vercel.json).
 * Syncs every workspace that has an active HubSpot integration.
 *
 * Secured by CRON_SECRET — Vercel passes Authorization: Bearer {CRON_SECRET}.
 * Set CRON_SECRET in Vercel environment variables (any long random string).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — may sync many workspaces
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hubspotIntegrations } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { syncHubspotDeals } from '@/lib/hubspot-sync'

export async function GET(req: NextRequest) {
  // Verify cron secret
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Find all connected integrations — join workspaces to get owner_id as the userId
  const integrations = await db.execute(sql`
    SELECT hi.workspace_id, w.owner_id AS user_id
    FROM hubspot_integrations hi
    JOIN workspaces w ON w.id = hi.workspace_id
  `) as unknown as { workspace_id: string; user_id: string }[]
  const results: { workspaceId: string; ok: boolean; dealsImported?: number; error?: string }[] = []

  for (const { workspace_id, user_id } of integrations) {
    try {
      const result = await syncHubspotDeals(workspace_id, user_id)
      results.push({ workspaceId: workspace_id, ok: true, dealsImported: result.dealsImported })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      console.error(`[cron/hubspot-sync] workspace=${workspace_id}`, msg)
      // Store error on integration record
      try {
        await db.update(hubspotIntegrations)
          .set({ syncError: msg.slice(0, 500), updatedAt: new Date() })
          .where(eq(hubspotIntegrations.workspaceId, workspace_id))
      } catch { /* best effort */ }
      results.push({ workspaceId: workspace_id, ok: false, error: msg })
    }
  }

  const succeeded = results.filter(r => r.ok).length
  const failed    = results.filter(r => !r.ok).length
  console.log(`[cron/hubspot-sync] ${succeeded} ok, ${failed} failed`)

  return NextResponse.json({ data: { synced: succeeded, failed, results } })
}
