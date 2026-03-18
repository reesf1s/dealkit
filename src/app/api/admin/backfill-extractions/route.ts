export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { NoteExtractionSchema } from '@/lib/extraction-schema'

const anthropic = new Anthropic()

/**
 * POST /api/admin/backfill-extractions
 *
 * One-time backfill: processes all deals that have meeting notes but no
 * note_signals_json extraction yet. Runs structured Zod-validated extraction
 * on each deal's full meeting notes history.
 *
 * This is also triggered automatically on the first brain rebuild for each
 * workspace via workspace-brain.ts _runExtractionBackfill().
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    // Ensure columns exist
    try { await db.execute(sql`ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS note_signals_json text`) } catch { /* exists */ }
    try { await db.execute(sql`ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS intent_signals jsonb`) } catch { /* exists */ }

    // Find deals with notes but no extraction
    const rows = await db.execute<{ id: string; deal_name: string; meeting_notes: string | null; note_signals_json: string | null }>(sql`
      SELECT id, deal_name, meeting_notes, note_signals_json
      FROM deal_logs
      WHERE workspace_id = ${workspaceId}
        AND meeting_notes IS NOT NULL
        AND meeting_notes != ''
        AND (note_signals_json IS NULL OR note_signals_json = '')
      ORDER BY updated_at DESC
      LIMIT 100
    `)

    const dealsToProcess: { id: string; deal_name: string; meeting_notes: string | null; note_signals_json: string | null }[] =
      Array.isArray(rows) ? rows : (rows as any).rows ?? []

    const results = {
      total_found: dealsToProcess.length,
      processed: 0,
      skipped: 0,
      errors: 0,
      objections_found: 0,
      champions_found: 0,
    }

    for (const deal of dealsToProcess) {
      try {
        const notes = deal.meeting_notes ?? ''
        if (!notes.trim()) { results.skipped++; continue }

        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Extract structured signals from these B2B sales meeting notes. Return ONLY a JSON object — no markdown, no explanation.

MEETING NOTES:
${notes.slice(0, 6000)}

Return this exact JSON schema:
{
  "champion_signal": boolean,
  "budget_signal": "confirmed" | "discussed" | "concern" | "not_mentioned",
  "decision_timeline": string | null,
  "next_step": string | null,
  "competitors_mentioned": string[],
  "objections": [{"theme": "budget"|"timing"|"authority"|"competitor"|"value"|"technical"|"integration"|"other", "text": string, "severity": "high"|"medium"|"low"}],
  "positive_signals": string[],
  "negative_signals": string[],
  "stakeholders_mentioned": [{"name": string, "role": string, "functional_area": string}],
  "product_gaps": [{"gap": string, "severity": "high"|"medium"|"low", "quote": string}],
  "sentiment_score": number (0.0-1.0),
  "urgency_signals": string[],
  "user_verified": false
}

Objection themes: budget=price/cost/ROI, timing=not now/too early, authority=decision maker absent, competitor=named competing product, value=unclear benefit/ROI, technical=IT/security/compliance, integration=specific integration needed, other=anything else.`
          }],
        })

        const rawText = (msg.content[0] as any)?.text?.trim() ?? ''
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) { results.errors++; continue }

        let parsed
        try {
          parsed = NoteExtractionSchema.safeParse(JSON.parse(jsonMatch[0]))
        } catch { results.errors++; continue }

        if (!parsed.success) {
          // Retry with correction
          const correctionMsg = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            messages: [{
              role: 'user',
              content: `Fix this JSON to match the schema. Return ONLY the corrected JSON:\n\n${jsonMatch[0]}\n\nErrors: ${JSON.stringify(parsed.error.issues)}`
            }],
          })
          const retryText = (correctionMsg.content[0] as any)?.text?.trim() ?? ''
          const retryMatch = retryText.match(/\{[\s\S]*\}/)
          if (!retryMatch) { results.errors++; continue }
          try {
            parsed = NoteExtractionSchema.safeParse(JSON.parse(retryMatch[0]))
          } catch { results.errors++; continue }
          if (!parsed.success) { results.errors++; continue }
        }

        const extraction = { ...parsed.data, user_verified: false }

        // Build intent signals from extraction
        const intentSignals = {
          championStatus: extraction.champion_signal ? 'confirmed' : 'none',
          budgetStatus: extraction.budget_signal === 'confirmed' ? 'approved'
            : extraction.budget_signal === 'discussed' ? 'awaiting'
            : extraction.budget_signal === 'concern' ? 'blocked'
            : 'not_discussed',
          decisionTimeline: extraction.decision_timeline ?? null,
          nextMeetingBooked: false,
        }

        // Only update if note_signals_json is still null (avoid race with user-triggered extraction)
        await db.execute(sql`
          UPDATE deal_logs
          SET note_signals_json = ${JSON.stringify(extraction)},
              intent_signals = ${JSON.stringify(intentSignals)}::jsonb
          WHERE id = ${deal.id}
            AND workspace_id = ${workspaceId}
            AND (note_signals_json IS NULL OR note_signals_json = '')
        `)

        results.processed++
        results.objections_found += extraction.objections.length
        if (extraction.champion_signal) results.champions_found++

      } catch (e) {
        console.error(`[backfill-extractions] deal ${deal.id} error:`, (e as Error)?.message)
        results.errors++
      }
    }

    return NextResponse.json({
      ...results,
      message: `Backfill complete. ${results.processed} deals extracted, ${results.objections_found} objections found, ${results.champions_found} champions identified.`,
    })
  } catch (e: any) {
    console.error('[backfill-extractions] 500:', e?.message)
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
