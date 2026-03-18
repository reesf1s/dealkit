export const dynamic = 'force-dynamic'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { rebuildWorkspaceBrain } from '@/lib/workspace-brain'

// ── Ensure prediction log table (idempotent, cached per cold-start) ───────────
let _predLogEnsured = false
async function ensurePredictionLogTable() {
  if (_predLogEnsured) return
  _predLogEnsured = true
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deal_prediction_log (
        id SERIAL PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        deal_id TEXT NOT NULL,
        predicted_score INTEGER NOT NULL,
        predicted_outcome TEXT,
        actual_outcome TEXT,
        predicted_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        deal_value NUMERIC
      )
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_deal_prediction_log_workspace
      ON deal_prediction_log (workspace_id, resolved_at DESC)
    `)
  } catch { /* already exists */ }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const body = await req.json()
    const { stage, kanbanOrder, winLossData } = body
    const validStages = ['prospecting','qualification','discovery','proposal','negotiation','closed_won','closed_lost']
    // Also accept custom stage IDs (format: custom_slug_timestamp)
    if (!validStages.includes(stage) && !stage?.startsWith('custom_')) return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    const update: Record<string, unknown> = { stage, updatedAt: new Date() }
    if (kanbanOrder !== undefined) update.kanbanOrder = kanbanOrder
    if (stage === 'closed_won') update.wonDate = new Date()
    if (stage === 'closed_lost') update.lostDate = new Date()

    // Append win/loss interview data to meetingNotes if provided
    if (winLossData && (stage === 'closed_won' || stage === 'closed_lost')) {
      const [existing] = await db.select({ meetingNotes: dealLogs.meetingNotes }).from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
      const existingNotes = (existing?.meetingNotes as string) ?? ''
      const interviewBlock = `\n\n---\n[Win/Loss Interview]\nOutcome: ${stage}\nPrimary reason: ${winLossData.primaryReason || 'Not specified'}\nCompetitor: ${winLossData.competitor || 'Not specified'}\nHardest objection: ${winLossData.hardestObjection || 'Not specified'}\nChampion present: ${winLossData.championPresent || 'unknown'}\nNotes: ${winLossData.notes || ''}`
      update.meetingNotes = existingNotes + interviewBlock
    }

    const [deal] = await db.update(dealLogs).set(update).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).returning()
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ── Log prediction vs actual when a deal closes ───────────────────────────
    if (stage === 'closed_won' || stage === 'closed_lost') {
      after(async () => {
        try {
          await ensurePredictionLogTable()
          const score = deal.conversionScore ?? 50
          const predictedOutcome = score >= 60 ? 'won' : 'lost'
          const actualOutcome = stage === 'closed_won' ? 'won' : 'lost'
          await db.execute(sql`
            INSERT INTO deal_prediction_log
              (workspace_id, deal_id, predicted_score, predicted_outcome, actual_outcome, resolved_at, deal_value)
            VALUES
              (${workspaceId}, ${id}, ${score}, ${predictedOutcome}, ${actualOutcome}, NOW(), ${deal.dealValue ?? null})
          `)
        } catch { /* non-fatal — never block deal close */ }
      })
    }

    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })
    return NextResponse.json({ data: deal })
  } catch (e: unknown) {
    console.error('[deals/stage] failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Stage update failed' }, { status: 500 })
  }
}
