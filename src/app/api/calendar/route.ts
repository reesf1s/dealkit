import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'

export interface CalendarEvent {
  id: string
  dealId: string
  dealName: string
  prospectCompany: string
  source: 'extracted' | 'close_date' | 'todo' | 'deal_events'
  type: 'meeting' | 'follow_up' | 'deadline' | 'demo' | 'decision' | 'predicted_close' | 'todo' | 'action_due'
  description: string
  date: string          // ISO YYYY-MM-DD
  time?: string | null  // HH:MM or null
  participants?: string[]
}

/**
 * Backfill deal_events from existing deal data (close dates + scheduled events).
 * Runs once per API call with ON CONFLICT DO NOTHING for dedup.
 */
async function backfillDealEvents(workspaceId: string, deals: any[]): Promise<void> {
  try {
    // Check if table exists first
    const tableCheck = await db.execute(sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'deal_events' LIMIT 1
    `)
    const rows: any[] = Array.isArray(tableCheck) ? tableCheck : (tableCheck as any).rows ?? []
    if (rows.length === 0) return

    for (const deal of deals) {
      // Backfill predicted_close from close dates
      if (deal.closeDate && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost') {
        const closeDateStr = new Date(deal.closeDate).toISOString().split('T')[0]
        const title = `Predicted close: ${deal.dealName}`
        await db.execute(sql`
          INSERT INTO deal_events (deal_id, workspace_id, event_type, title, description, event_date, source)
          VALUES (${deal.id}, ${workspaceId}, 'predicted_close', ${title}, ${title}, ${closeDateStr}::date, 'close_date')
          ON CONFLICT (deal_id, event_date, title) DO NOTHING
        `)
      }

      // Backfill from scheduled_events jsonb
      const events = (deal.scheduledEvents as any[]) ?? []
      for (const ev of events) {
        if (!ev.date || !ev.description) continue
        const eventType = ev.type ?? 'meeting'
        await db.execute(sql`
          INSERT INTO deal_events (deal_id, workspace_id, event_type, title, description, event_date, event_time, source)
          VALUES (${deal.id}, ${workspaceId}, ${eventType}, ${ev.description}, ${ev.description}, ${ev.date}::date, ${ev.time ?? null}, 'note_extraction')
          ON CONFLICT (deal_id, event_date, title) DO NOTHING
        `)
      }
    }
  } catch (err) {
    // Non-fatal — deal_events table may not exist yet
    console.warn('[calendar] backfill error:', (err as Error)?.message)
  }
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

    // Also query from deal_events table if it exists
    try {
      const dealEventRows = await db.execute(sql`
        SELECT de.id, de.deal_id, de.event_type, de.title, de.description,
               de.event_date::text, de.event_time,
               dl.deal_name, dl.prospect_company
        FROM deal_events de
        JOIN deal_logs dl ON dl.id = de.deal_id
        WHERE de.workspace_id = ${workspaceId}
      `)
      const deRows: any[] = Array.isArray(dealEventRows) ? dealEventRows : (dealEventRows as any).rows ?? []
      for (const row of deRows) {
        addEvent({
          id: row.id,
          dealId: row.deal_id,
          dealName: row.deal_name,
          prospectCompany: row.prospect_company,
          source: 'deal_events',
          type: row.event_type,
          description: row.description ?? row.title,
          date: row.event_date,
          time: row.event_time ?? null,
        })
      }
    } catch {
      // deal_events table may not exist yet — non-fatal
    }

    // Backfill deal_events in the background (fire-and-forget)
    backfillDealEvents(workspaceId, deals).catch(() => {})

    // Sort by date ascending
    events.sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ data: events })
  } catch (err) {
    return dbErrResponse(err)
  }
}
