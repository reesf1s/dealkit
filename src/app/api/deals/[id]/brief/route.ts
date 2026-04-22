/**
 * GET /api/deals/[id]/brief
 *
 * Returns an AI-generated briefing paragraph for a deal.
 * - Meeting notes and uploaded notes are treated as the source of truth.
 * - If notes are available, generate a fresh brief from that context.
 * - Otherwise, fall back to an existing aiSummary when present.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { anthropic } from '@/lib/ai/client'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import {
  buildPreferredNoteCorpus,
  buildStructuredNoteCorpus,
  extractDatedEntries,
  formatDatedNote,
} from '@/lib/note-intelligence'
import { getWorkspaceContext } from '@/lib/workspace'

type DealContact = {
  name: string
  title?: string | null
}

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

    const structuredNotes = buildStructuredNoteCorpus({
      meetingNotes: deal.meetingNotes,
      hubspotNotes: deal.hubspotNotes,
      notes: typeof deal.notes === 'string' ? deal.notes : null,
    })
    const preferredNotes = structuredNotes || buildPreferredNoteCorpus({
      meetingNotes: deal.meetingNotes,
      hubspotNotes: deal.hubspotNotes,
      notes: typeof deal.notes === 'string' ? deal.notes : null,
    })
    const datedEntries = extractDatedEntries(preferredNotes)
    const latestMeetingNote = datedEntries[0] ? formatDatedNote(datedEntries[0]) : null
    const recentEvidence = datedEntries.slice(0, 4).map(entry => `- ${formatDatedNote(entry)}`).join('\n')
    const legacyContext = preferredNotes && datedEntries.length === 0
      ? preferredNotes.slice(-700)
      : null
    const hasSourceNotes = Boolean(latestMeetingNote || legacyContext)

    // Fall back to the stored summary only when there is no note context to ground a fresh brief.
    if (!hasSourceNotes && deal.aiSummary) {
      return NextResponse.json({
        data: { brief: deal.aiSummary, generatedAt: deal.updatedAt },
      })
    }

    const dealRisks = (deal.dealRisks as string[] | null) ?? []
    const contacts = (deal.contacts as DealContact[] | null) ?? []

    const lines = [
      `Company: ${deal.prospectCompany ?? 'Unknown'}`,
      `Stage: ${(deal.stage ?? 'unknown').replace(/_/g, ' ')}`,
      deal.dealValue ? `Value: £${Number(deal.dealValue).toLocaleString()}` : null,
      deal.conversionScore != null ? `Win probability: ${deal.conversionScore}%` : null,
      contacts.length > 0
        ? `Contacts: ${contacts.slice(0, 3).map(contact => contact.title ? `${contact.name} (${contact.title})` : contact.name).join(', ')}`
        : null,
      dealRisks.length > 0 ? `Known risks: ${dealRisks.slice(0, 3).join('; ')}` : null,
      latestMeetingNote ? `Latest dated note:\n${latestMeetingNote}` : null,
      recentEvidence ? `Recent dated evidence (relative words refer to the note date, not today):\n${recentEvidence}` : null,
      legacyContext ? `Legacy undated context (use cautiously, never as current momentum):\n${legacyContext}` : null,
    ].filter(Boolean).join('\n')

    if (!lines.trim()) {
      return NextResponse.json({
        data: { brief: deal.aiSummary ?? null, generatedAt: deal.updatedAt ?? null },
      })
    }

    const response = await anthropic.messages.create({
      model: 'gpt-5.4-mini',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `You are a sales intelligence assistant. Write a concise 2–3 sentence briefing for a sales rep. Treat dated meeting notes as the source of truth; only use undated context as background. Focus on: current status, the main blocker or opportunity, and the single most important next action. Name specific people. Do not mention task lists, success criteria, checklist state, or stale AI summaries unless the notes themselves say it. If a note says "tomorrow" or "next week", interpret that relative to the note date, not today. Be direct — no filler.\n\n${lines}`,
        },
      ],
    })

    const brief =
      response.content[0].type === 'text' ? response.content[0].text.trim() : null

    return NextResponse.json({
      data: { brief, generatedAt: new Date().toISOString() },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
