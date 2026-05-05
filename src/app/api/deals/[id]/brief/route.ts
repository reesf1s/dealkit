/**
 * GET /api/deals/[id]/brief
 *
 * Returns a concise deterministic brief for a deal.
 * - Prioritises latest activity over older narrative text.
 * - Designed for predictable "where / next / blocker" snapshots.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { buildDealSnapshot, clipAtWord } from '@/lib/deal-snapshot'


type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { workspaceId } = await getWorkspaceContext(userId)

    const [deal] = await db
      .select()
      .from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const snapshot = buildDealSnapshot({
      stage: deal.stage,
      nextSteps: deal.nextSteps,
      notes: deal.notes,
      meetingNotes: deal.meetingNotes,
      aiSummary: deal.aiSummary,
      dealRisks: deal.dealRisks,
    })
    const stageLabel = (deal.stage ?? 'active').replace(/_/g, ' ')
    const scoreLabel = typeof deal.conversionScore === 'number' ? `${Math.round(deal.conversionScore)}% confidence` : 'confidence unknown'
    const valueLabel = deal.dealValue ? `£${Number(deal.dealValue).toLocaleString()}` : null

    const status = clipAtWord(
      `${deal.prospectCompany ?? 'This deal'} is in ${stageLabel}${valueLabel ? ` (${valueLabel})` : ''}. ${snapshot.whereWeAre}`,
      190,
    )
    const next = clipAtWord(snapshot.nextAction ?? 'No explicit next action captured from the latest update.', 170)
    const blocker = clipAtWord(snapshot.blocker ?? 'No blocker currently flagged.', 150)
    const brief = `Status: ${status} (${scoreLabel}). Next action: ${next}. Blocker: ${blocker}.`

    return NextResponse.json({
      data: { brief, generatedAt: new Date().toISOString() },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
