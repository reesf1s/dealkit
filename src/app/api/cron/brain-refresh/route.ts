/**
 * GET /api/cron/brain-refresh
 * Triggered daily at 3 AM UTC by Vercel Cron (see vercel.json).
 *
 * Background agentic workflow:
 * 1. Find all workspaces with deal activity in the last 24 hours
 * 2. Rebuild their brains (which triggers proactive collateral, embeddings, etc.)
 * 3. Skip inactive workspaces to avoid wasting API costs
 *
 * Secured by CRON_SECRET — same pattern as other cron routes.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — may process many workspaces

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { getWorkspaceBrain, BRAIN_VERSION } from '@/lib/workspace-brain'
import { requestBrainRebuild } from '@/lib/brain-rebuild'

export async function GET(req: NextRequest) {
  // Verify cron secret — always required to prevent public access
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/brain-refresh] CRON_SECRET not set — endpoint disabled')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find workspaces with deal activity in the last 24 hours.
    // A workspace is "active" if ANY deal was created or updated recently.
    // This avoids wasting Claude API costs on orgs that aren't using the product.
    const activeWorkspaces = await db.execute<{
      workspace_id: string
      deal_count: number
      latest_activity: string
    }>(sql`
      SELECT
        dl.workspace_id,
        COUNT(*)::int AS deal_count,
        MAX(dl.updated_at)::text AS latest_activity
      FROM deal_logs dl
      WHERE dl.updated_at > NOW() - INTERVAL '24 hours'
      GROUP BY dl.workspace_id
    `)

    if (activeWorkspaces.length === 0) {
      console.log('[cron/brain-refresh] No active workspaces in last 24h — skipping')
      return NextResponse.json({ ok: true, processed: 0, skipped: 'no_activity' })
    }

    const results: {
      workspaceId: string
      ok: boolean
      reason?: string
      dealsActive?: number
    }[] = []

    for (const ws of activeWorkspaces) {
      try {
        // Check if brain is already fresh (rebuilt recently and same version)
        // Skip if brain was rebuilt in the last 3 hours to avoid redundant work
        const existingBrain = await getWorkspaceBrain(ws.workspace_id)
        if (existingBrain) {
          const brainAge = Date.now() - new Date(existingBrain.updatedAt).getTime()
          const threeHours = 3 * 60 * 60 * 1000
          if (brainAge < threeHours && (existingBrain.brainVersion ?? 0) >= BRAIN_VERSION) {
            results.push({
              workspaceId: ws.workspace_id,
              ok: true,
              reason: 'brain_fresh',
              dealsActive: ws.deal_count,
            })
            continue
          }
        }

        // Rebuild brain — this triggers:
        // - Proactive collateral generation (with 24h cooldown)
        // - Semantic embedding refresh
        // - Global pool contribution
        await requestBrainRebuild(ws.workspace_id, 'cron_refresh')

        results.push({
          workspaceId: ws.workspace_id,
          ok: true,
          reason: 'rebuilt',
          dealsActive: ws.deal_count,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[cron/brain-refresh] workspace=${ws.workspace_id}`, msg)
        results.push({ workspaceId: ws.workspace_id, ok: false, reason: msg })
      }
    }

    const rebuilt = results.filter(r => r.reason === 'rebuilt').length
    const fresh = results.filter(r => r.reason === 'brain_fresh').length
    const failed = results.filter(r => !r.ok).length

    console.log(
      `[cron/brain-refresh] ${rebuilt} rebuilt, ${fresh} already fresh, ${failed} failed — ${activeWorkspaces.length} active workspaces`
    )

    return NextResponse.json({
      ok: true,
      processed: activeWorkspaces.length,
      rebuilt,
      alreadyFresh: fresh,
      failed,
      results,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/brain-refresh] failed:', msg)
    return NextResponse.json({ ok: false, error: msg })
  }
}
