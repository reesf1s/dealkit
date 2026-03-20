'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Calendar,
  Users, Clock, Target, Zap, AlertCircle, CheckSquare, X,
  Sparkles, FileText, RefreshCw, Flag,
} from 'lucide-react'
import { getCalendarEvents, type CalendarEvent } from '@/lib/calendar-events'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── CalEvent type (matches pipeline CalendarView) ────────────────────────────

type CalEventType =
  | 'close' | 'contract_start' | 'contract_end'
  | 'follow_up' | 'urgent' | 'task' | 'phase'
  | 'meeting' | 'demo' | 'deadline' | 'decision' | 'predicted_close'
  | 'stale_followup'

type CalEvent = {
  id: string
  title: string      // deal / company name
  subtitle: string   // event description
  date: Date
  dealId: string
  type: CalEventType
  description?: string
  snippet?: string
  source?: string
  time?: string | null
  isPast?: boolean
}

// ── Event type visual config ─────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, {
  label: string; color: string; borderStyle?: string; icon: React.ElementType
}> = {
  meeting:         { label: 'Meeting',          color: '#6366F1', icon: Users },
  follow_up:       { label: 'Follow-up',        color: '#FBBF24', icon: Clock },
  demo:            { label: 'Demo',             color: '#34D399', icon: Zap },
  deadline:        { label: 'Deadline',         color: '#F87171', icon: AlertCircle },
  decision:        { label: 'Decision',         color: '#A855F7', icon: Target },
  predicted_close: { label: 'Predicted Close',  color: '#A855F7', borderStyle: 'dashed', icon: Target },
  close:           { label: 'Expected Close',   color: '#A855F7', borderStyle: 'dashed', icon: Target },
  contract_start:  { label: 'Contract Start',   color: '#14B8A6', icon: FileText },
  contract_end:    { label: 'Contract Renewal',  color: '#14B8A6', icon: RefreshCw },
  task:            { label: 'Task Due',          color: '#F59E0B', icon: CheckSquare },
  phase:           { label: 'Phase Target',      color: '#06B6D4', icon: Flag },
  urgent:          { label: 'Urgent',            color: '#F87171', icon: AlertCircle },
  stale_followup:  { label: 'Stale Follow-up',   color: '#9CA3AF', icon: Clock },
}

function getConfig(type: string) {
  return EVENT_CONFIG[type] ?? EVENT_CONFIG.meeting
}

// ── Calendar helpers ─────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=Sun
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Text snippet cleaner ─────────────────────────────────────────────────────

function cleanSnippet(text: string): string {
  return text
    .replace(/^#+\s*/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 80)
}

// ── Extract dates from meeting notes text ────────────────────────────────────
// Parses patterns like "Monday 23 March 12:00", "25th March at 2pm",
// "call on March 25", "meeting 23/03/2026"

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
}

function extractDatesFromNotes(notes: string, dealId: string, dealName: string): CalEvent[] {
  if (!notes || notes.length < 10) return []
  const events: CalEvent[] = []
  const seen = new Set<string>()
  const currentYear = new Date().getFullYear()

  // Pattern 1: "23 March 12:00" or "23rd March" or "March 23"
  const datePatterns = [
    // "23 March 12:00-13:00" or "23 March at 2pm"
    /(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(?:(\d{4})\s*)?(?:(?:at\s+)?(\d{1,2}[:.]\d{2})\s*(?:-\s*\d{1,2}[:.]\d{2})?)?/gi,
    // "March 23, 2026" or "March 23"
    /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?(?:\s+(?:at\s+)?(\d{1,2}[:.]\d{2}))?/gi,
  ]

  // Get ~200 chars of context around each date match for event title
  for (const pattern of datePatterns) {
    let match
    while ((match = pattern.exec(notes)) !== null) {
      let day: number, monthStr: string, year: number, time: string | null = null

      if (/^\d/.test(match[1])) {
        // Pattern 1: day first
        day = parseInt(match[1])
        monthStr = match[2].toLowerCase()
        year = match[3] ? parseInt(match[3]) : currentYear
        time = match[4] ? match[4].replace('.', ':') : null
      } else {
        // Pattern 2: month first
        monthStr = match[1].toLowerCase()
        day = parseInt(match[2])
        year = match[3] ? parseInt(match[3]) : currentYear
        time = match[4] ? match[4].replace('.', ':') : null
      }

      // Truncate month name to match lookup
      const monthKey = Object.keys(MONTH_MAP).find(k => monthStr.startsWith(k))
      if (!monthKey || day < 1 || day > 31) continue
      const month = MONTH_MAP[monthKey]

      const dateObj = new Date(year, month, day)
      if (isNaN(dateObj.getTime())) continue

      const dateKey = `${dealId}-${dateObj.toISOString().slice(0, 10)}`
      if (seen.has(dateKey)) continue
      seen.add(dateKey)

      // Extract context around the match for a meaningful title
      const start = Math.max(0, match.index - 60)
      const end = Math.min(notes.length, match.index + match[0].length + 60)
      let context = notes.slice(start, end).replace(/\n+/g, ' ').trim()
      // Try to find a meaningful phrase
      const phrases = context.match(/(?:call|meeting|session|demo|review|walkthrough|discussion|connect|check-in|sync|training|workshop|presentation|webinar|catch[- ]?up|follow[- ]?up|kick[- ]?off)[^.!?\n]*/i)
      const subtitle = phrases ? phrases[0].trim().slice(0, 80) : context.slice(0, 80)

      events.push({
        id: `${dealId}-note-date-${dateObj.toISOString().slice(0, 10)}`,
        title: dealName,
        subtitle,
        date: dateObj,
        dealId,
        type: 'meeting',
        time,
        isPast: dateObj < new Date(),
      })
    }
  }

  return events
}

// ── Build all calendar events from deals + brain data ────────────────────────
// Uses getCalendarEvents() from the foundation module for scheduled events and
// close dates. Keeps inline logic for contract dates, project plans, stale
// deals, and urgent deals until those move into the foundation module too.

function buildCalendarEvents(deals: any[], brainData: any): CalEvent[] {
  const events: CalEvent[] = []
  const today = new Date()
  const now = new Date()

  // ── Foundation module: scheduled events + close dates ──────────────────────
  // Build lightweight DealContext array from deals data
  const dealContexts = (deals || []).map((d: any) => {
    const isClosed = d.stage === 'closed_won' || d.stage === 'closed_lost'
    const scheduledEvents = (d.scheduledEvents as any[]) || []
    const upcomingEvents = scheduledEvents.map((e: any) => ({
      type: e.type || 'meeting',
      title: e.description || e.title || 'Event',
      date: e.date,
      time: e.time || null,
    }))

    return {
      id: d.id,
      name: d.dealName || 'Untitled',
      company: d.prospectCompany || '',
      isClosed,
      closeDate: d.closeDate ? new Date(d.closeDate).toISOString() : null,
      upcomingEvents,
      // Defaults for other DealContext fields
      stage: d.stage || 'prospecting',
      dealValue: d.dealValue ?? 0,
      dealType: d.dealType || null,
      currency: 'GBP',
      outcome: null,
      wonDate: null,
      lostDate: null,
      lossReason: null,
      dealAgeDays: 0,
      daysSinceLastNote: 999,
      compositeScore: d.conversionScore ?? 0,
      scoreColor: '#6B7280',
      championIdentified: false,
      budgetConfirmed: false,
      nextStepDefined: false,
      competitorsPresent: [],
      sentimentRecent: 0.5,
      momentum: 0.5,
      noteCount: 0,
      lastNoteDate: null,
      lastNoteSummary: null,
      openActionCount: 0,
      completedActionCount: 0,
      recentCompletedActions: [],
      contacts: [],
    }
  })

  // Compute calendar events from deal contexts (wide range to cover navigation)
  const rangeStart = new Date(today.getFullYear() - 1, 0, 1)
  const rangeEnd = new Date(today.getFullYear() + 2, 11, 31)
  const foundationEvents: CalendarEvent[] = getCalendarEvents(dealContexts as any, rangeStart, rangeEnd)

  // Convert foundation CalendarEvent[] → CalEvent[]
  for (const fe of foundationEvents) {
    const feDate = new Date(fe.date)
    const calType: CalEventType = fe.type === 'predicted_close' ? 'close' : (fe.type as CalEventType) ?? 'meeting'
    events.push({
      id: `${fe.dealId}-foundation-${fe.type}-${fe.date}`,
      title: fe.dealName,
      subtitle: fe.title.includes(': ') ? fe.title.split(': ').slice(1).join(': ') : fe.title,
      date: feDate,
      dealId: fe.dealId,
      type: calType,
      time: fe.time ?? null,
      isPast: feDate < now,
    })
  }

  // ── Inline sources not yet in foundation module ────────────────────────────

  for (const deal of deals) {
    const dealName = deal.prospectCompany || deal.dealName || 'Deal'

    // Contract start/end dates
    if (deal.contractStartDate) {
      events.push({
        id: `${deal.id}-cstart`,
        title: dealName,
        subtitle: 'Contract starts',
        date: new Date(deal.contractStartDate),
        dealId: deal.id,
        type: 'contract_start',
      })
    }
    if (deal.contractEndDate) {
      events.push({
        id: `${deal.id}-cend`,
        title: dealName,
        subtitle: 'Contract renews',
        date: new Date(deal.contractEndDate),
        dealId: deal.id,
        type: 'contract_end',
      })
    }

    // Project plan phases and tasks
    const plan = deal.projectPlan as any
    if (plan?.phases) {
      for (const phase of (plan.phases ?? [])) {
        if (phase.targetDate) {
          const d = new Date(phase.targetDate)
          if (!isNaN(d.getTime())) {
            events.push({
              id: `${deal.id}-phase-${phase.id ?? phase.name}`,
              title: dealName,
              subtitle: `Phase: ${phase.name}`,
              date: d,
              dealId: deal.id,
              type: 'phase',
            })
          }
        }
        for (const task of (phase.tasks ?? [])) {
          if (task.dueDate && task.status !== 'complete') {
            const d = new Date(task.dueDate)
            if (!isNaN(d.getTime())) {
              events.push({
                id: `${deal.id}-task-${task.id ?? task.text}`,
                title: dealName,
                subtitle: `Task: ${task.text}`,
                date: d,
                dealId: deal.id,
                type: 'task',
              })
            }
          }
        }
      }
    }
  }

  // Extract dates from meeting notes text (catches events not in scheduledEvents)
  for (const deal of deals) {
    const dealName = deal.prospectCompany || deal.dealName || 'Deal'
    const notes = (deal.meetingNotes || '') + '\n' + (deal.hubspotNotes || '')
    if (notes.trim().length > 10) {
      const noteEvents = extractDatesFromNotes(notes, deal.id, dealName)
      // Only add note-extracted events that don't duplicate existing events on the same date
      const existingDateKeys = new Set(events.filter(e => e.dealId === deal.id).map(e => {
        const d = e.date instanceof Date ? e.date : new Date(e.date)
        return d.toISOString().slice(0, 10)
      }))
      for (const ne of noteEvents) {
        const neDate = ne.date instanceof Date ? ne.date : new Date(ne.date)
        if (!existingDateKeys.has(neDate.toISOString().slice(0, 10))) {
          events.push(ne)
        }
      }
    }
  }

  // Todo items with due dates
  for (const deal of deals) {
    const dealName = deal.prospectCompany || deal.dealName || 'Deal'
    const todos = (deal.todos as any[]) || []
    for (const todo of todos) {
      if (todo.dueDate && !todo.done) {
        const d = new Date(todo.dueDate)
        if (!isNaN(d.getTime())) {
          events.push({
            id: `${deal.id}-todo-${todo.id || todo.text?.slice(0, 20)}`,
            title: dealName,
            subtitle: `Action: ${(todo.text || '').slice(0, 60)}`,
            date: d,
            dealId: deal.id,
            type: 'task',
          })
        }
      }
    }
  }

  // Stale deal follow-up suggestions
  for (const s of (brainData?.staleDeals ?? [])) {
    const deal = deals.find((d: any) => d.id === s.dealId)
    if (!deal) continue
    const dealName = deal.prospectCompany || deal.dealName || 'Deal'
    const baseDate = new Date(deal.updatedAt ?? deal.createdAt)
    const followUpDate = new Date(baseDate.getTime() + 14 * 86_400_000)
    events.push({
      id: `${deal.id}-stale`,
      title: dealName,
      subtitle: `Follow up (${s.daysSinceUpdate}d without update)`,
      date: followUpDate,
      dealId: deal.id,
      type: 'stale_followup',
    })
  }

  // Urgent deals (show today)
  for (const u of (brainData?.urgentDeals ?? [])) {
    events.push({
      id: `${u.dealId}-urgent`,
      title: u.company,
      subtitle: u.reason,
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      dealId: u.dealId,
      type: 'urgent',
    })
  }

  return events
}

// ── Filter chip types (order matters for display) ────────────────────────────

const FILTER_TYPES: CalEventType[] = [
  'meeting', 'demo', 'follow_up', 'deadline', 'close',
  'contract_start', 'contract_end', 'phase', 'task',
  'stale_followup', 'urgent', 'decision', 'predicted_close',
]

// ── Event chip component ─────────────────────────────────────────────────────

function EventChip({
  event,
  isPast,
  onClick,
}: {
  event: CalEvent
  isPast: boolean
  onClick: (ev: CalEvent) => void
}) {
  const cfg = getConfig(event.type)

  return (
    <button
      title={`[${event.title}] ${event.subtitle}`}
      onClick={(e) => { e.stopPropagation(); onClick(event) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        width: '100%',
        background: cfg.color + (isPast ? '18' : '22'),
        color: cfg.color,
        border: `1.5px ${cfg.borderStyle ?? 'solid'} ${cfg.color}${isPast ? '55' : '88'}`,
        borderRadius: '5px',
        padding: '2px 5px',
        fontSize: '11px',
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
        opacity: isPast ? 0.5 : 1,
        transition: 'opacity 0.15s, filter 0.15s',
        overflow: 'hidden',
      }}
    >
      <cfg.icon size={9} style={{ flexShrink: 0 }} />
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        fontWeight: 600,
      }}>
        <span style={{ opacity: 0.7, fontWeight: 500 }}>[{event.title.length > 10 ? event.title.slice(0, 9) + '\u2026' : event.title}]</span>
        {' '}{event.subtitle || getConfig(event.type).label}
      </span>
      {event.time && (
        <span style={{ flexShrink: 0, opacity: 0.8, fontSize: '10px' }}>{event.time}</span>
      )}
    </button>
  )
}

// ── Event popover (detail modal) ─────────────────────────────────────────────

function EventPopover({
  event,
  onClose,
}: {
  event: CalEvent
  onClose: () => void
}) {
  const cfg = getConfig(event.type)
  const displayText = event.description || cleanSnippet(event.subtitle)
  const dateStr = event.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          zIndex: 999,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '14px',
          padding: '20px',
          minWidth: '320px',
          maxWidth: '420px',
          width: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
              {event.title}
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: cfg.color + '22', color: cfg.color,
              borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 600,
              border: `1px ${cfg.borderStyle ?? 'solid'} ${cfg.color}44`,
            }}>
              <cfg.icon size={11} />
              {cfg.label}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Description */}
        {displayText && (
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', marginBottom: '10px', lineHeight: 1.5 }}>
            {displayText}
          </div>
        )}

        {/* Date + time */}
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={13} />
          <span>{dateStr}{event.time ? ` at ${event.time}` : ''}</span>
        </div>

        {/* Source quote */}
        {event.source && (
          <div style={{
            fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '14px',
            padding: '8px 10px', background: 'var(--bg)', borderRadius: '6px',
            borderLeft: `3px solid ${cfg.color}`,
          }}>
            &ldquo;{event.source}&rdquo;
          </div>
        )}

        {/* Actions */}
        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '12px', display: 'flex', gap: '8px' }}>
          <Link
            href={`/deals/${event.dealId}`}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '8px 12px', borderRadius: '8px', textDecoration: 'none',
              background: 'var(--accent)', color: '#fff',
              fontSize: '12px', fontWeight: 600,
            }}
            onClick={onClose}
          >
            View Deal
          </Link>
          <button
            onClick={() => {
              const d = event.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
              window.dispatchEvent(new CustomEvent('openCommandPalette', {
                detail: { query: `Prep me for ${event.title} — ${displayText} on ${d}. Review the deal and tell me what I need to know and do before this date.` }
              }))
              onClose()
            }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              padding: '8px 12px', borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.12))',
              border: '1px solid rgba(99,102,241,0.3)',
              color: 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Sparkles size={11} />
            Prep for this
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main calendar page ───────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Fetch deals and brain data (same as pipeline page)
  const { data: dealsData, isLoading: dealsLoading } = useSWR('/api/deals', fetcher, { revalidateOnFocus: false })
  const deals: any[] = dealsData?.data ?? []
  const { data: brainRes, isLoading: brainLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brainData = brainRes?.data

  const isLoading = dealsLoading || brainLoading

  // Build events from all sources
  const allEvents = useMemo(
    () => buildCalendarEvents(deals, brainData),
    [deals, brainData],
  )

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // Events for current month
  const monthEvents = useMemo(() => {
    return allEvents.filter(ev => ev.date.getFullYear() === year && ev.date.getMonth() === month)
  }, [allEvents, year, month])

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (typeFilter === 'all') return monthEvents
    return monthEvents.filter(ev => ev.type === typeFilter)
  }, [monthEvents, typeFilter])

  // Group by date string
  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    for (const ev of filteredEvents) {
      const dateStr = `${ev.date.getFullYear()}-${String(ev.date.getMonth() + 1).padStart(2, '0')}-${String(ev.date.getDate()).padStart(2, '0')}`
      if (!map[dateStr]) map[dateStr] = []
      map[dateStr].push(ev)
    }
    // Sort events within each day by time
    for (const key in map) {
      map[key].sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time)
        if (a.time) return -1
        if (b.time) return 1
        return 0
      })
    }
    return map
  }, [filteredEvents])

  // Type counts for filter chips
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ev of monthEvents) {
      counts[ev.type] = (counts[ev.type] ?? 0) + 1
    }
    return counts
  }, [monthEvents])

  // Calendar grid
  const numDays = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const totalCells = Math.ceil((firstDay + numDays) / 7) * 7

  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '16px',
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={24} style={{ color: 'var(--accent)' }} />
            Calendar
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Meetings, demos, deadlines, close dates, contracts, and tasks across all deals
          </p>
        </div>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={prevMonth} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text)' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', minWidth: '160px', textAlign: 'center' }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text)' }}>
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}
          >
            Today
          </button>
        </div>
      </div>

      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button
          onClick={() => setTypeFilter('all')}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 12px', borderRadius: '20px',
            border: `1.5px solid ${typeFilter === 'all' ? 'var(--accent)' : 'var(--card-border)'}`,
            background: typeFilter === 'all' ? 'var(--accent)22' : 'transparent',
            color: typeFilter === 'all' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          All
          {monthEvents.length > 0 && (
            <span style={{
              background: typeFilter === 'all' ? 'var(--accent)' : 'var(--card-border)',
              color: typeFilter === 'all' ? '#fff' : 'var(--text-muted)',
              borderRadius: '10px', padding: '0 6px', fontSize: '11px', fontWeight: 600,
            }}>
              {monthEvents.length}
            </span>
          )}
        </button>
        {FILTER_TYPES.map(type => {
          const cfg = getConfig(type)
          const count = typeCounts[type] ?? 0
          if (count === 0) return null
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '20px',
                border: `1.5px solid ${typeFilter === type ? cfg.color : 'var(--card-border)'}`,
                background: typeFilter === type ? cfg.color + '22' : 'transparent',
                color: typeFilter === type ? cfg.color : 'var(--text-muted)',
                fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <cfg.icon size={12} />
              {cfg.label}
              <span style={{
                background: typeFilter === type ? cfg.color : 'var(--card-border)',
                color: typeFilter === type ? '#fff' : 'var(--text-muted)',
                borderRadius: '10px', padding: '0 6px', fontSize: '11px', fontWeight: 600,
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Calendar grid */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--card-border)' }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            Loading events...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {Array.from({ length: totalCells }).map((_, idx) => {
              const dayNum = idx - firstDay + 1
              const isCurrentMonth = dayNum >= 1 && dayNum <= numDays
              const dateStr = isCurrentMonth
                ? `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                : null
              const isToday = dateStr === todayStr
              const isPastDay = dateStr != null && dateStr < todayStr
              const dayEvents = dateStr ? (byDate[dateStr] ?? []) : []

              return (
                <div
                  key={idx}
                  style={{
                    minHeight: '110px',
                    borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--card-border)',
                    borderBottom: idx < totalCells - 7 ? '1px solid var(--card-border)' : 'none',
                    padding: '8px 6px',
                    background: isToday
                      ? 'var(--accent)12'
                      : !isCurrentMonth
                        ? 'var(--bg)'
                        : 'transparent',
                    position: 'relative',
                  }}
                >
                  {/* Day number */}
                  {isCurrentMonth && (
                    <div style={{
                      width: '26px', height: '26px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%',
                      background: isToday ? 'var(--accent)' : 'transparent',
                      color: isToday ? '#fff' : isPastDay ? 'var(--text-muted)' : 'var(--text)',
                      fontSize: '13px', fontWeight: isToday ? 700 : 400,
                      marginBottom: '4px',
                      flexShrink: 0,
                    }}>
                      {dayNum}
                    </div>
                  )}

                  {/* Events */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {dayEvents.slice(0, 4).map(ev => (
                      <EventChip
                        key={ev.id}
                        event={ev}
                        isPast={isPastDay}
                        onClick={setSelectedEvent}
                      />
                    ))}
                    {dayEvents.length > 4 && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '1px 4px' }}>
                        +{dayEvents.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Events list for this month (below grid) */}
      {!isLoading && filteredEvents.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
            Events this month ({filteredEvents.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[...filteredEvents]
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .map(ev => {
                const cfg = getConfig(ev.type)
                const evIsPast = ev.date < today && !(ev.date.getDate() === today.getDate() && ev.date.getMonth() === today.getMonth() && ev.date.getFullYear() === today.getFullYear())
                const dateStr = ev.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                const displayText = ev.description || cleanSnippet(ev.subtitle)
                return (
                  <div key={ev.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)', borderRadius: '10px',
                    opacity: evIsPast ? 0.5 : 1,
                    transition: 'opacity 0.1s',
                    cursor: 'pointer',
                  }}
                    onClick={() => setSelectedEvent(ev)}
                  >
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.title}
                        </span>
                        <span style={{
                          fontSize: '9px', fontWeight: 600, padding: '1px 5px', borderRadius: '10px',
                          background: cfg.color + '22', color: cfg.color,
                          border: `1px ${cfg.borderStyle ?? 'solid'} ${cfg.color}44`, flexShrink: 0,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {cfg.label}
                        </span>
                        {evIsPast && <span style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>(past)</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayText}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{dateStr}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const d = ev.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                        window.dispatchEvent(new CustomEvent('openCommandPalette', { detail: { query: `Prep me for ${ev.title} — ${displayText} on ${d}. Review the deal and tell me what I need to know and do before this date.` } }))
                      }}
                      style={{
                        flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '5px 10px', borderRadius: '6px',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.10))',
                        border: '1px solid rgba(99,102,241,0.25)',
                        color: 'var(--accent)', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <Sparkles size={10} />
                      Prep
                    </button>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && monthEvents.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <Calendar size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>No events this month</div>
          <div style={{ fontSize: '13px' }}>
            Events are built from deal close dates, contracts, project plans, meeting notes, and AI signals.
            Add deals with dates or process meeting notes to populate your calendar.
          </div>
        </div>
      )}

      {/* Event popover */}
      {selectedEvent && (
        <EventPopover
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      <style>{`
        @media (max-width: 700px) {
          [data-cal-grid] { grid-template-columns: repeat(7, minmax(40px, 1fr)); }
        }
      `}</style>
    </div>
  )
}
