import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'

export interface CalendarEvent {
  id: string
  dealId: string
  dealName: string
  prospectCompany: string
  source: 'extracted' | 'close_date' | 'todo'
  type: 'meeting' | 'follow_up' | 'deadline' | 'demo' | 'decision' | 'predicted_close' | 'todo' | 'action_due'
  description: string
  date: string          // ISO YYYY-MM-DD
  time?: string | null  // HH:MM or null
  participants?: string[]
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    const deals = await db
      .select()
      .from(dealLogs)
      .where(eq(dealLogs.workspaceId, workspaceId))

    const events: CalendarEvent[] = []
    const seenKeys = new Set<string>()

    function addEvent(ev: CalendarEvent) {
      const key = `${ev.dealId}|${ev.date}|${ev.type}|${ev.description.slice(0, 40).toLowerCase()}`
      if (seenKeys.has(key)) return
      seenKeys.add(key)
      events.push(ev)
    }

    for (const deal of deals) {
      const dealName = deal.dealName
      const prospectCompany = deal.prospectCompany
      const dealId = deal.id

      // Source 1: Extracted scheduled events from meeting notes
      const extracted = (deal.scheduledEvents as any[]) ?? []
      for (const ev of extracted) {
        if (!ev.date) continue
        addEvent({
          id: ev.id ?? `extracted-${dealId}-${ev.date}-${ev.description?.slice(0, 20)}`,
          dealId,
          dealName,
          prospectCompany,
          source: 'extracted',
          type: ev.type ?? 'meeting',
          description: ev.description ?? '',
          date: ev.date,
          time: ev.time ?? null,
          participants: ev.participants ?? [],
        })
      }

      // Source 2: Deal close date as "predicted close"
      if (deal.closeDate && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost') {
        const closeDateStr = new Date(deal.closeDate).toISOString().split('T')[0]
        addEvent({
          id: `close-${dealId}`,
          dealId,
          dealName,
          prospectCompany,
          source: 'close_date',
          type: 'predicted_close',
          description: `Predicted close: ${dealName}`,
          date: closeDateStr,
          time: null,
        })
      }

      // Source 3: Todos with due dates (look for ISO dates or common date patterns)
      const todos = (deal.todos as any[]) ?? []
      for (const todo of todos) {
        if (todo.done) continue
        // Try to extract a date from the todo text
        const dateMatch = (todo.text ?? '').match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/)
        if (!dateMatch) continue
        let parsedDate: Date | null = null
        try {
          parsedDate = new Date(dateMatch[0])
          if (isNaN(parsedDate.getTime())) continue
        } catch {
          continue
        }
        const todoDateStr = parsedDate.toISOString().split('T')[0]
        addEvent({
          id: `todo-${todo.id ?? dealId + todoDateStr}`,
          dealId,
          dealName,
          prospectCompany,
          source: 'todo',
          type: 'todo',
          description: todo.text ?? 'Action item',
          date: todoDateStr,
          time: null,
        })
      }

      // Source 4: Events from note_signals_json extraction (scheduled_events field)
      // These may not have been written to scheduledEvents column for older notes
      try {
        const signalsRaw = (deal as any).note_signals_json
        if (signalsRaw) {
          const signals = typeof signalsRaw === 'string' ? JSON.parse(signalsRaw) : signalsRaw
          const extractedEvents = signals?.scheduled_events ?? []
          for (const ev of extractedEvents) {
            if (!ev.date || !ev.description) continue
            addEvent({
              id: `signal-${dealId}-${ev.date}-${ev.description?.slice(0, 20)}`,
              dealId,
              dealName,
              prospectCompany,
              source: 'extracted',
              type: ev.type === 'other' ? 'meeting' : (ev.type ?? 'meeting'),
              description: ev.description,
              date: ev.date,
              time: ev.time ?? null,
              participants: [],
            })
          }
        }
      } catch { /* non-fatal — skip malformed signals */ }
    }

    // Sort by date ascending
    events.sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ data: events })
  } catch (err) {
    return dbErrResponse(err)
  }
}
