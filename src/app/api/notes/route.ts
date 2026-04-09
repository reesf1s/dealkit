import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNotNull } from 'drizzle-orm'
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
}

function parseNotes(raw: string, deal: { id: string; dealName: string; prospectCompany: string; stage: string; noteSource: string | null }): ParsedNote[] {
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
      })
    }
  }
  return notes
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
      .orderBy(dealLogs.updatedAt)

    const allNotes: ParsedNote[] = []
    for (const row of rows) {
      if (!row.meetingNotes) continue
      const parsed = parseNotes(row.meetingNotes, {
        id: row.id,
        dealName: row.dealName,
        prospectCompany: row.prospectCompany,
        stage: row.stage,
        noteSource: row.noteSource ?? null,
      })
      allNotes.push(...parsed)
    }

    // Sort newest first
    allNotes.sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return b.date.localeCompare(a.date)
    })

    return NextResponse.json({ data: allNotes })
  } catch (err) { return dbErrResponse(err) }
}
