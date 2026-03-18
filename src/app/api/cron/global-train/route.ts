/**
 * GET /api/cron/global-train
 * Triggered nightly by Vercel Cron (see vercel.json — "0 2 * * *").
 * Retrains the global prior ML model on all non-erased pool contributions.
 *
 * Secured by CRON_SECRET — same pattern as /api/cron/hubspot-sync.
 * Also callable manually by passing the CRON_SECRET for on-demand retrains.
 */
export const dynamic    = 'force-dynamic'
export const maxDuration = 60   // global training at current scale < 5s; 60s gives future headroom

import { NextRequest, NextResponse } from 'next/server'
import { trainGlobalModel } from '@/lib/global-model'
import { ensureGlobalTables } from '@/lib/global-pool'

export async function GET(req: NextRequest) {
  // Verify cron secret — always required to prevent public access
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/global-train] CRON_SECRET not set — endpoint disabled')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureGlobalTables()

  try {
    const result = await trainGlobalModel()

    console.log(`[global-train] v${result.version} trained on ${result.trainingSize} records — accuracy ${Math.round(result.looAccuracy * 100)}% — ${result.durationMs}ms`)

    return NextResponse.json({
      ok:           true,
      version:      result.version,
      trainingSize: result.trainingSize,
      looAccuracy:  Math.round(result.looAccuracy * 100),
      globalWinRate: Math.round(result.globalWinRate * 100),
      durationMs:   result.durationMs,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[global-train] failed:', msg)
    // Don't throw — return 200 with error so Vercel doesn't spam retries
    return NextResponse.json({ ok: false, error: msg })
  }
}
