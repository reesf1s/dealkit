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
  buildBriefingNoteFocus,
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

    const noteFocus = buildBriefingNoteFocus({
      meetingNotes: deal.meetingNotes,
      hubspotNotes: deal.hubspotNotes,
      notes: typeof deal.notes === 'string' ? deal.notes : null,
    })
    const latestMeetingNote = noteFocus.latestEntries[0] ? formatDatedNote(noteFocus.latestEntries[0]) : null
    const recentEvidence = noteFocus.latestEntries.map(entry => `- ${formatDatedNote(entry)}`).join('\n')
    const outstandingOlderContext = noteFocus.outstandingEntries.map(entry => `- ${formatDatedNote(entry)}`).join('\n')
    const legacyContext = noteFocus.legacyContext
    const hasSourceNotes = Boolean(latestMeetingNote || outstandingOlderContext || legacyContext)

    // Fall back to the stored summary only when there is no note context to ground a fresh brief.
    if (!hasSourceNotes && deal.aiSummary) {
      return NextResponse.json({
        data: { brief: deal.aiSummary, generatedAt: deal.updatedAt },
      })
    }

    const contacts = (deal.contacts as DealContact[] | null) ?? []
    const scheduledEvents = Array.isArray(deal.scheduledEvents) ? deal.scheduledEvents : []
    const upcomingEvents = scheduledEvents
      .filter((event): event is { description?: string | null; date?: string | null; time?: string | null } => !!event && typeof event === 'object')
      .filter(event => {
        if (!event.date) return false
        const eventDate = new Date(event.date)
        return !Number.isNaN(eventDate.getTime()) && eventDate.getTime() >= Date.now() - 86_400_000
      })
      .slice(0, 2)
      .map(event => `${event.description ?? 'Upcoming event'}${event.date ? ` on ${event.date}` : ''}${event.time ? ` at ${event.time}` : ''}`)

    const lines = [
      `Company: ${deal.prospectCompany ?? 'Unknown'}`,
      `Stage: ${(deal.stage ?? 'unknown').replace(/_/g, ' ')}`,
      deal.dealValue ? `Value: £${Number(deal.dealValue).toLocaleString()}` : null,
      deal.conversionScore != null ? `Win probability: ${deal.conversionScore}%` : null,
      contacts.length > 0
        ? `Contacts: ${contacts.slice(0, 3).map(contact => contact.title ? `${contact.name} (${contact.title})` : contact.name).join(', ')}`
        : null,
      upcomingEvents.length > 0 ? `Upcoming scheduled events:\n${upcomingEvents.map(item => `- ${item}`).join('\n')}` : null,
      latestMeetingNote ? `Latest note:\n${latestMeetingNote}` : null,
      recentEvidence ? `Primary note evidence — use these last two dated notes as the current source of truth:\n${recentEvidence}` : null,
      outstandingOlderContext
        ? `Older outstanding context — mention only if still unresolved and higher-impact than the latest two notes:\n${outstandingOlderContext}`
        : null,
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
          content: `You are a sales intelligence assistant. Write a concise 2–3 sentence briefing for a sales rep.

Hard rules:
- Use the last two dated notes as the current source of truth.
- Only mention older note context if it is explicitly provided as older outstanding context and is still unresolved.
- Never surface older delivered, implemented, scheduled, confirmed, or "on track" work as current momentum or a current blocker.
- Do not mention task lists, success criteria, checklist state, or stale AI summaries unless the notes themselves say it.
- If a note says "tomorrow" or "next week", interpret that relative to the note date, not today.

Focus on current status, the main blocker or opportunity, and the single best next move. Name specific people. Be direct — no filler.\n\n${lines}`,
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
