/**
 * GET /api/cron/win-loss-digest
 * Weekly on Mondays at 8 AM UTC — sends a win/loss intelligence digest to
 * opted-in team members via Slack DM.
 *
 * Reads winLossIntel + dealVelocity from the workspace brain.
 * Only sends if the workspace has at least 1 closed deal (win or loss).
 *
 * Secured by CRON_SECRET.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { notifyWinLossDigest } from '@/lib/slack-notify'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const allWorkspaces = await db.select({ id: workspaces.id }).from(workspaces)

    let sent = 0
    let skipped = 0

    for (const ws of allWorkspaces) {
      try {
        const brain = await getWorkspaceBrain(ws.id)
        const intel = brain?.winLossIntel
        if (!intel || (intel.winCount + intel.lossCount) === 0) { skipped++; continue }

        await notifyWinLossDigest(ws.id, {
          winCount: intel.winCount,
          lossCount: intel.lossCount,
          winRate: intel.winRate,
          topLossReasons: intel.topLossReasons,
          competitorRecord: intel.competitorRecord,
          weightedForecast: brain.dealVelocity?.weightedForecast,
          forecastDealCount: brain.dealVelocity?.forecastDealCount,
        })
        sent++
      } catch (err) {
        console.error(`[cron/win-loss-digest] workspace=${ws.id}`, err)
      }
    }

    console.log(`[cron/win-loss-digest] sent=${sent} skipped=${skipped} total=${allWorkspaces.length}`)
    return NextResponse.json({ ok: true, sent, skipped })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/win-loss-digest] failed:', msg)
    return NextResponse.json({ ok: false, error: msg })
  }
}
