/**
 * POST /api/deals/[id]/meeting-notes
 *
 * Accepts raw meeting notes, appends them to the deal's meetingNotes field,
 * extracts intelligence via Claude Haiku (objections, competitors, product gaps,
 * next steps, sentiment), updates the deal record, and triggers a brain rebuild.
 *
 * Returns a structured extraction summary for the UI toast.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { requestBrainRebuild } from '@/lib/brain-rebuild'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface MeetingNotesExtraction {
  objections: string[]
  competitors: string[]
  productGaps: string[]
  nextSteps: string | null
  sentiment: 'positive' | 'neutral' | 'negative'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const { notes } = await req.json()

    if (!notes?.trim()) {
      return NextResponse.json({ error: 'notes is required' }, { status: 400 })
    }

    // Verify deal belongs to this workspace
    const [deal] = await db
      .select({
        id: dealLogs.id,
        dealName: dealLogs.dealName,
        meetingNotes: dealLogs.meetingNotes,
        competitors: dealLogs.competitors,
        dealRisks: dealLogs.dealRisks,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ── Extract intelligence via Claude Haiku ─────────────────────────────────
    const extraction = await extractMeetingIntelligence(notes, deal.dealName)

    // ── Append notes with date header ──────────────────────────────────────────
    const dateHeader = `[${new Date().toISOString().split('T')[0]}]`
    const appendedNotes = deal.meetingNotes
      ? `${deal.meetingNotes}\n\n${dateHeader}\n${notes.trim()}`
      : `${dateHeader}\n${notes.trim()}`

    // ── Merge extracted competitors with existing ──────────────────────────────
    const existingCompetitors = (deal.competitors as string[] | null) ?? []
    const mergedCompetitors = [...new Set([...existingCompetitors, ...extraction.competitors])]

    // ── Merge extracted risks/objections with existing ───────────────────────
    const existingRisks = (deal.dealRisks as string[] | null) ?? []
    const newRisks = extraction.objections.filter(o => !existingRisks.includes(o))
    const mergedRisks = [...existingRisks, ...newRisks].slice(0, 10)

    // ── Update deal record ────────────────────────────────────────────────────
    const patch: Record<string, unknown> = {
      meetingNotes: appendedNotes,
      updatedAt: new Date(),
    }
    if (mergedCompetitors.length > 0) patch.competitors = mergedCompetitors
    if (mergedRisks.length > 0) patch.dealRisks = mergedRisks
    if (extraction.nextSteps) patch.nextSteps = extraction.nextSteps

    await db
      .update(dealLogs)
      .set(patch)
      .where(eq(dealLogs.id, dealId))

    // ── Trigger brain rebuild in background ───────────────────────────────────
    after(async () => {
      try { await requestBrainRebuild(workspaceId, 'meeting_notes_logged') } catch { /* non-fatal */ }
    })

    return NextResponse.json({
      data: extraction,
      message: `Logged. Extracted ${extraction.objections.length} objection${extraction.objections.length !== 1 ? 's' : ''}, ${extraction.competitors.length} competitor${extraction.competitors.length !== 1 ? 's' : ''}, ${extraction.productGaps.length} gap${extraction.productGaps.length !== 1 ? 's' : ''}.`,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

async function extractMeetingIntelligence(
  notes: string,
  dealName: string,
): Promise<MeetingNotesExtraction> {
  const prompt = `You are an expert sales intelligence extractor. Analyse these meeting notes from a sales call about "${dealName}" and extract structured data.

Return ONLY valid JSON, no other text:
{
  "objections": ["list of specific objections or concerns raised by the prospect"],
  "competitors": ["competitor or alternative vendor names mentioned"],
  "productGaps": ["specific features, integrations, or capabilities requested that we lack"],
  "nextSteps": "single string summarising agreed next steps, or null",
  "sentiment": "positive" | "neutral" | "negative"
}

Rules:
- objections: actual objections raised (budget, timing, feature gaps, competitor preference, etc.)
- competitors: company/product names only, not generic terms
- productGaps: specific product asks only, not vague requests
- nextSteps: concrete commitments (demo, proposal, follow-up date), or null if unclear
- sentiment: overall call tone (positive = interested/moving forward, negative = pushback/loss risk)

Meeting notes:
${notes.slice(0, 4000)}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      objections: Array.isArray(parsed.objections) ? parsed.objections.slice(0, 6) : [],
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors.slice(0, 5) : [],
      productGaps: Array.isArray(parsed.productGaps) ? parsed.productGaps.slice(0, 5) : [],
      nextSteps: typeof parsed.nextSteps === 'string' ? parsed.nextSteps : null,
      sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment)
        ? parsed.sentiment
        : 'neutral',
    }
  } catch {
    // Fallback: return empty extraction rather than failing the whole request
    return { objections: [], competitors: [], productGaps: [], nextSteps: null, sentiment: 'neutral' }
  }
}
