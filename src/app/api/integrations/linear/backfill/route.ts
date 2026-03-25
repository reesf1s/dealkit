/**
 * POST /api/integrations/linear/backfill
 *
 * Retroactively processes existing deals that have meeting notes but no extracted
 * product gaps or Linear links. Idempotent — safe to run multiple times.
 *
 * Two cases handled:
 *   Case 1 — no product gaps + has meeting notes: extract features → smart match
 *   Case 2 — has product gaps but no Linear links: smart match only
 *
 * Processes in batches of 5 to stay within timeout budgets.
 * Returns: { processed, linked, created, skipped, errors[] }
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dealLinearLinks } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { smartMatchDeal } from '@/lib/smart-match'
import { and, eq, sql } from 'drizzle-orm'

interface DealRow extends Record<string, unknown> {
  id: string
  meeting_notes: string | null
  note_signals_json: string | null
}

function hasProductGaps(signalsJson: string | null): boolean {
  if (!signalsJson) return false
  try {
    const s = typeof signalsJson === 'string' ? JSON.parse(signalsJson) : signalsJson
    return Array.isArray(s?.product_gaps) && s.product_gaps.length > 0
  } catch { return false }
}

async function hasLinearLinks(dealId: string, workspaceId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: dealLinearLinks.id })
    .from(dealLinearLinks)
    .where(and(eq(dealLinearLinks.dealId, dealId), eq(dealLinearLinks.workspaceId, workspaceId)))
    .limit(1)
  return !!row
}

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    // Find all open deals with enough meeting notes to process
    const candidates = await db.execute<DealRow>(sql`
      SELECT id, meeting_notes, note_signals_json
      FROM deal_logs
      WHERE workspace_id = ${workspaceId}
        AND stage NOT IN ('closed_won', 'closed_lost')
        AND meeting_notes IS NOT NULL
        AND LENGTH(meeting_notes) > 100
    `)

    // Classify each deal
    const needsExtraction: DealRow[] = []
    const needsMatchOnly: DealRow[] = []
    const skippedDeals: DealRow[] = []

    for (const deal of candidates) {
      const hasGaps = hasProductGaps(deal.note_signals_json)
      const hasLinks = await hasLinearLinks(deal.id, workspaceId)

      if (!hasGaps) {
        needsExtraction.push(deal) // Case 1: extract + match
      } else if (!hasLinks) {
        needsMatchOnly.push(deal) // Case 2: match only (gaps exist)
      } else {
        skippedDeals.push(deal) // Already processed
      }
    }

    console.log(`[backfill] ${workspaceId}: ${needsExtraction.length} need extraction, ${needsMatchOnly.length} need match only, ${skippedDeals.length} already done`)

    let processed = 0
    let linked = 0
    let created = 0
    const errors: string[] = []

    // Case 1: Extract features then match — skipHaiku: false triggers Haiku extraction if no gaps exist.
    // smartMatchDeal stores extracted gaps in note_signals_json then matches — returns linked/created counts.
    for (let i = 0; i < needsExtraction.length; i += 5) {
      const batch = needsExtraction.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(deal => smartMatchDeal(workspaceId, deal.id, { skipHaiku: false }))
      )
      for (let j = 0; j < results.length; j++) {
        const r = results[j]
        processed++
        if (r.status === 'fulfilled') {
          linked += r.value.linked
          created += r.value.created
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
          errors.push(`${batch[j].id}: ${msg}`)
          console.warn(`[backfill] Deal ${batch[j].id} extraction failed:`, msg)
        }
      }
    }

    // Case 2: Match only — batches of 5 in parallel
    for (let i = 0; i < needsMatchOnly.length; i += 5) {
      const batch = needsMatchOnly.slice(i, i + 5)
      const results = await Promise.allSettled(
        batch.map(deal => smartMatchDeal(workspaceId, deal.id))
      )
      for (let j = 0; j < results.length; j++) {
        const r = results[j]
        processed++
        if (r.status === 'fulfilled') {
          linked += r.value.linked
          created += r.value.created
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
          errors.push(`${batch[j].id}: ${msg}`)
          console.warn(`[backfill] Deal ${batch[j].id} match failed:`, msg)
        }
      }
    }

    console.log(`[backfill] Complete: processed=${processed}, linked=${linked}, created=${created}, skipped=${skippedDeals.length}, errors=${errors.length}`)

    return NextResponse.json({
      data: {
        processed,
        linked,
        created,
        skipped: skippedDeals.length,
        errors,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[backfill] Failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
