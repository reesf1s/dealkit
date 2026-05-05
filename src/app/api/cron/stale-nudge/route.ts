/**
 * GET /api/cron/stale-nudge
 * Daily at 9 AM UTC — logs stale deals (14+ days no activity).
 *
 * Reads `staleDeals` from each workspace brain (populated by brain-refresh at 3 AM)
 * so this cron is cheap: no DB scans, no AI calls — just brain reads.
 *
 * Secured by CRON_SECRET.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { isAutomationEnabled } from '@/lib/automation-policy'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Load all workspaces — cheap: we only read the brain JSONB field
    const allWorkspaces = await db
      .select({ id: workspaces.id, pipelineConfig: workspaces.pipelineConfig })
      .from(workspaces)

    let notified = 0
    let skipped = 0

    for (const ws of allWorkspaces) {
      try {
        if (!isAutomationEnabled(ws.pipelineConfig, 'stale_alerts')) {
          skipped++
          continue
        }
        const brain = await getWorkspaceBrain(ws.id)
        if (!brain?.staleDeals?.length) { skipped++; continue }

        const staleList = brain.staleDeals.map(d => ({
          dealName: d.dealName,
          company: d.company,
          dealId: d.dealId,
          stage: d.stage,
          daysSinceUpdate: d.daysSinceUpdate,
          score: d.score ?? null,
        }))

        console.log(`[cron/stale-nudge] workspace=${ws.id} stale_deals=${staleList.length}`)
        notified++
      } catch (err) {
        console.error(`[cron/stale-nudge] workspace=${ws.id}`, err)
      }
    }

    console.log(`[cron/stale-nudge] notified=${notified} skipped=${skipped} total=${allWorkspaces.length}`)
    return NextResponse.json({ ok: true, notified, skipped })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/stale-nudge] failed:', msg)
    return NextResponse.json({ ok: false, error: msg })
  }
}
