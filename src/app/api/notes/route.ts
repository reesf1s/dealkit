import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

interface ParsedNote {
  id: string
  dealId: string
  dealName: string
  prospectCompany: string
  stage: string
  date: string
  content: string
  source: string
  updatedAt: string
}

function parseNotes(raw: string, deal: { id: string; dealName: string; prospectCompany: string; stage: string; noteSource: string | null; updatedAt: string }): ParsedNote[] {
  const notes: ParsedNote[] = []
  // Split on [YYYY-MM-DD] headers
  const parts = raw.split(/(?=\[\d{4}-\d{2}-\d{2}\])/)
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*\n?([\s\S]*)$/)
    if (match) {
      const content = match[2].trim()
      if (!content) continue
      notes.push({
        id: `${deal.id}-${match[1]}`,
        dealId: deal.id,
        dealName: deal.dealName,
        prospectCompany: deal.prospectCompany,
        stage: deal.stage,
        date: match[1],
        content,
        source: deal.noteSource ?? 'manual',
        updatedAt: deal.updatedAt,
      })
    } else if (trimmed.length > 0) {
      // No date header — treat as legacy note
      notes.push({
        id: `${deal.id}-legacy`,
        dealId: deal.id,
        dealName: deal.dealName,
        prospectCompany: deal.prospectCompany,
        stage: deal.stage,
        date: '',
        content: trimmed,
        source: deal.noteSource ?? 'manual',
        updatedAt: deal.updatedAt,
      })
    }
  }
  return notes
}

function noteSortKey(note: ParsedNote): number {
  const datedKey = note.date ? Date.parse(`${note.date}T23:59:59.999Z`) : Number.NaN
  if (!Number.isNaN(datedKey)) return datedKey
  const updatedKey = Date.parse(note.updatedAt)
  return Number.isNaN(updatedKey) ? 0 : updatedKey
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { searchParams } = new URL(req.url)
    const dealId = searchParams.get('dealId')

    const conditions = [
      eq(dealLogs.workspaceId, workspaceId),
      isNotNull(dealLogs.meetingNotes),
    ]
    if (dealId) conditions.push(eq(dealLogs.id, dealId))

    const rows = await db
      .select({
        id: dealLogs.id,
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        stage: dealLogs.stage,
        meetingNotes: dealLogs.meetingNotes,
        noteSource: dealLogs.noteSource,
        updatedAt: dealLogs.updatedAt,
      })
      .from(dealLogs)
      .where(and(...conditions))
      .orderBy(desc(dealLogs.updatedAt))

    const allNotes: ParsedNote[] = []
    for (const row of rows) {
      if (!row.meetingNotes) continue
      const parsed = parseNotes(row.meetingNotes, {
        id: row.id,
        dealName: row.dealName,
        prospectCompany: row.prospectCompany,
        stage: row.stage,
        noteSource: row.noteSource ?? null,
        updatedAt: row.updatedAt.toISOString(),
      })
      allNotes.push(...parsed)
    }

    // Sort newest first
    allNotes.sort((a, b) => noteSortKey(b) - noteSortKey(a))

    return NextResponse.json({ data: allNotes })
  } catch (err) { return dbErrResponse(err) }
}
