export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    // Fetch all deals for this workspace
    const dealsResult = await db.execute(sql`
      SELECT id, deal_name, stage, outcome, close_date, deal_value,
             won_date, lost_date,
             (meeting_notes IS NOT NULL AND length(meeting_notes) > 10) AS has_notes
      FROM deal_logs
      WHERE workspace_id = ${workspaceId}
    `)
    const deals = dealsResult as unknown as {
      id: string
      deal_name: string
      stage: string
      outcome: string | null
      close_date: string | null
      deal_value: number | null
      won_date: string | null
      lost_date: string | null
      has_notes: boolean
    }[]

    const total = deals.length
    const won = deals.filter(d => d.outcome === 'won' || d.stage === 'closed_won').length
    const lost = deals.filter(d => d.outcome === 'lost' || d.stage === 'closed_lost').length
    const open = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage) && !d.outcome).length
    const withNotes = deals.filter(d => d.has_notes).length

    // Detect the specific bug: stage=closed_won but outcome=null
    const stageWonOutcomeNull = deals
      .filter(d => d.stage === 'closed_won' && !d.outcome)
      .map(d => ({ id: d.id, name: d.deal_name, stage: d.stage, outcome: d.outcome }))

    const stageLostOutcomeNull = deals
      .filter(d => d.stage === 'closed_lost' && !d.outcome)
      .map(d => ({ id: d.id, name: d.deal_name, stage: d.stage, outcome: d.outcome }))

    // Read the cached brain
    let brainData: Record<string, unknown> | null = null
    try {
      const brainResult = await db.execute(sql`
        SELECT workspace_brain, updated_at FROM workspaces WHERE id = ${workspaceId} LIMIT 1
      `)
      const row = (brainResult as unknown as { workspace_brain: Record<string, unknown> | null; updated_at: string }[])[0]
      if (row?.workspace_brain) {
        const brain = row.workspace_brain
        const ml = brain.mlModel as Record<string, unknown> | null | undefined
        const wl = brain.winLossIntel as Record<string, unknown> | null | undefined
        brainData = {
          last_rebuild: row.updated_at,
          brain_version: brain.brainVersion,
          ml_active: ml != null,
          training_size: ml?.trainingSize ?? null,
          loa_accuracy: ml?.looAccuracy != null ? Math.round((ml.looAccuracy as number) * 100) : null,
          win_loss_intel: wl
            ? { winCount: wl.winCount, lossCount: wl.lossCount, winRate: wl.winRate }
            : null,
          deal_count_in_brain: (brain.deals as unknown[])?.length ?? 0,
        }
      }
    } catch { /* non-fatal */ }

    // Get last brain rebuild log entry
    let lastLog: Record<string, unknown> | null = null
    try {
      const logResult = await db.execute(sql`
        SELECT * FROM brain_rebuild_log
        WHERE workspace_id = ${workspaceId}
        ORDER BY created_at DESC
        LIMIT 1
      `)
      lastLog = (logResult as unknown as Record<string, unknown>[])[0] ?? null
    } catch { /* table may not exist yet */ }

    // Signal extraction stats — count objections with theme field
    let objectionsWithThemes = 0
    let totalObjections = 0
    try {
      const signalsResult = await db.execute(sql`
        SELECT note_signals_json
        FROM deal_logs
        WHERE workspace_id = ${workspaceId}
          AND note_signals_json IS NOT NULL
      `)
      const rows = signalsResult as unknown as { note_signals_json: string }[]
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.note_signals_json)
          const objections = parsed.objections ?? []
          totalObjections += objections.length
          objectionsWithThemes += objections.filter((o: Record<string, unknown>) => o.theme && typeof o.theme === 'string').length
        } catch { /* skip malformed */ }
      }
    } catch { /* non-fatal */ }

    const bugCount = stageWonOutcomeNull.length + stageLostOutcomeNull.length

    let diagnosis: string
    if (bugCount > 0) {
      diagnosis = `BUG FOUND: ${bugCount} deal(s) have stage set but outcome=null. Run a brain rebuild (POST /api/brain) to backfill outcome field.`
    } else if (won + lost === 0) {
      diagnosis = 'No closed deals found — move a deal to closed_won or closed_lost to begin ML training.'
    } else if ((brainData?.win_loss_intel as Record<string, unknown> | null) == null) {
      diagnosis = `${won + lost} closed deal(s) found in DB but winLossIntel is missing from brain — brain may be stale. POST /api/brain to force rebuild.`
    } else {
      diagnosis = `OK: ${won} won deal(s) and ${lost} lost deal(s). Brain is current.`
    }

    // Model status per model (based on training size)
    const trainingSize = (brainData?.training_size as number | null) ?? 0
    const modelStatuses = [
      { name: 'Win Probability', activatesAt: 10, status: trainingSize >= 10 ? 'active' : trainingSize >= 6 ? 'warming' : 'locked' },
      { name: 'Deal Archetypes', activatesAt: 10, status: trainingSize >= 10 ? 'active' : trainingSize >= 6 ? 'warming' : 'locked' },
      { name: 'Objection Playbook', activatesAt: 10, status: trainingSize >= 10 ? 'active' : trainingSize >= 6 ? 'warming' : 'locked' },
      { name: 'Close Date Prediction', activatesAt: 15, status: trainingSize >= 15 ? 'active' : trainingSize >= 9 ? 'warming' : 'locked' },
      { name: 'Rep Benchmarks', activatesAt: 20, status: trainingSize >= 20 ? 'active' : trainingSize >= 12 ? 'warming' : 'locked' },
      { name: 'Competitive Intel', activatesAt: 20, status: trainingSize >= 20 ? 'active' : trainingSize >= 12 ? 'warming' : 'locked' },
    ]

    return NextResponse.json({
      workspace_id: workspaceId,
      timestamp: new Date().toISOString(),
      deals: {
        total,
        open,
        won,
        lost,
        with_notes: withNotes,
        bug_stage_won_outcome_null: stageWonOutcomeNull,
        bug_stage_lost_outcome_null: stageLostOutcomeNull,
        bug_count: bugCount,
      },
      brain: brainData,
      last_rebuild_log: lastLog,
      signal_extraction: {
        total_objections: totalObjections,
        objections_with_themes: objectionsWithThemes,
        theme_coverage_pct: totalObjections > 0 ? Math.round((objectionsWithThemes / totalObjections) * 100) : null,
      },
      model_status: modelStatuses,
      diagnosis,
      fix: bugCount > 0
        ? 'POST /api/brain to trigger a rebuild — the backfill in _doRebuildWorkspaceBrain will set outcome for all affected deals.'
        : undefined,
    })
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}
