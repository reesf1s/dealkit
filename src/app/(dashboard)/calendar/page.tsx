'use client'
export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Calendar,
  Users, Clock, Target, Zap, AlertCircle, CheckSquare, X,
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Event type config ──────────────────────────────────────────────────────

type EventType = 'meeting' | 'follow_up' | 'deadline' | 'demo' | 'decision' | 'predicted_close' | 'todo'

const EVENT_CONFIG: Record<EventType, { label: string; color: string; borderStyle?: string; icon: React.ElementType }> = {
  meeting:         { label: 'Meeting',         color: '#6366F1', icon: Users },
  follow_up:       { label: 'Follow-up',       color: '#FBBF24', icon: Clock },
  demo:            { label: 'Demo',            color: '#34D399', icon: Zap },
  deadline:        { label: 'Deadline',        color: '#F87171', icon: AlertCircle },
  decision:        { label: 'Decision',        color: '#A855F7', icon: Target },
  predicted_close: { label: 'Predicted Close', color: '#A855F7', borderStyle: 'dashed', icon: Target },
  todo:            { label: 'Action Item',     color: '#94A3B8', icon: CheckSquare },
}

function getConfig(type: string) {
  return EVENT_CONFIG[type as EventType] ?? EVENT_CONFIG.meeting
}

// ── Calendar helpers ───────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=Sun
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Popover ────────────────────────────────────────────────────────────────

interface PopoverEvent {
  id: string
  dealId: string
  dealName: string
  prospectCompany: string
  source: string
  type: string
  description: string
  date: string
  time?: string | null
  participants?: string[]
}

function EventPopover({
  event,
  anchorRef,
  onClose,
}: {
  event: PopoverEvent
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const popRef = useRef<HTMLDivElement>(null)
  const cfg = getConfig(event.type)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [anchorRef, onClose])

  return (
    <div
      ref={popRef}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '14px',
        padding: '20px',
        minWidth: '300px',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: cfg.color + '22', color: cfg.color,
            borderRadius: '6px', padding: '3px 8px', fontSize: '12px', fontWeight: 600,
            border: `1px solid ${cfg.color}44`,
          }}>
            <cfg.icon size={11} />
            {cfg.label}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px', lineHeight: 1.4 }}>
        {event.description}
      </div>

      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={13} />
          <span>{event.date}{event.time ? ` at ${event.time}` : ''}</span>
        </div>
        {(event.participants?.length ?? 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={13} />
            <span>{event.participants!.join(', ')}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{event.dealName}</strong>
          <div style={{ fontSize: '12px' }}>{event.prospectCompany}</div>
        </div>
        <Link
          href={`/deals/${event.dealId}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: 'var(--accent)', color: '#fff',
            padding: '6px 12px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 600, textDecoration: 'none',
          }}
        >
          View Deal
        </Link>
      </div>
    </div>
  )
}

// ── Backdrop ───────────────────────────────────────────────────────────────

function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 999,
      }}
    />
  )
}

// ── Event chip ─────────────────────────────────────────────────────────────

function EventChip({
  event,
  isPast,
  isToday,
  onClick,
}: {
  event: PopoverEvent
  isPast: boolean
  isToday: boolean
  onClick: (ref: React.RefObject<HTMLButtonElement | null>, event: PopoverEvent) => void
}) {
  const cfg = getConfig(event.type)
  const btnRef = useRef<HTMLButtonElement>(null)

  return (
    <button
      ref={btnRef}
      title={event.dealName + ' — ' + event.description}
      onClick={() => onClick(btnRef as React.RefObject<HTMLButtonElement | null>, event)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
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
      <cfg.icon size={10} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {event.dealName}
      </span>
      {event.time && (
        <span style={{ flexShrink: 0, opacity: 0.8, fontSize: '10px' }}>{event.time}</span>
      )}
    </button>
  )
}

// ── Main calendar page ─────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedEvent, setSelectedEvent] = useState<PopoverEvent | null>(null)
  const [anchorRef, setAnchorRef] = useState<React.RefObject<HTMLElement | null> | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const { data, isLoading } = useSWR('/api/calendar', fetcher, { revalidateOnFocus: false })
  const allEvents: PopoverEvent[] = data?.data ?? []

  const todayStr = today.toISOString().split('T')[0]

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function handleChipClick(ref: React.RefObject<HTMLElement | null>, event: PopoverEvent) {
    setAnchorRef(ref)
    setSelectedEvent(event)
  }

  function closePopover() {
    setSelectedEvent(null)
    setAnchorRef(null)
  }

  // Filter events for the current month view
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  const filteredEvents = allEvents.filter(ev => {
    if (!ev.date.startsWith(monthStr)) return false
    if (typeFilter !== 'all' && ev.type !== typeFilter) return false
    return true
  })

  // Group events by date
  const byDate: Record<string, PopoverEvent[]> = {}
  for (const ev of filteredEvents) {
    if (!byDate[ev.date]) byDate[ev.date] = []
    byDate[ev.date].push(ev)
  }

  // Build calendar grid
  const numDays = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const totalCells = Math.ceil((firstDay + numDays) / 7) * 7

  // Count events by type for this month (from all, not filtered)
  const monthEvents = allEvents.filter(ev => ev.date.startsWith(monthStr))
  const typeCounts: Record<string, number> = {}
  for (const ev of monthEvents) {
    typeCounts[ev.type] = (typeCounts[ev.type] ?? 0) + 1
  }

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
            Meetings, demos, deadlines, and predicted closes across all deals
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
        {(['all', 'meeting', 'demo', 'follow_up', 'deadline', 'decision', 'predicted_close', 'todo'] as const).map(type => {
          const cfg = type === 'all' ? null : getConfig(type)
          const count = type === 'all' ? monthEvents.length : (typeCounts[type] ?? 0)
          if (type !== 'all' && count === 0) return null
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px',
                borderRadius: '20px',
                border: `1.5px solid ${typeFilter === type ? (cfg?.color ?? 'var(--accent)') : 'var(--card-border)'}`,
                background: typeFilter === type ? (cfg?.color ?? 'var(--accent)') + '22' : 'transparent',
                color: typeFilter === type ? (cfg?.color ?? 'var(--accent)') : 'var(--text-muted)',
                fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {cfg && <cfg.icon size={12} />}
              {type === 'all' ? 'All' : cfg!.label}
              {count > 0 && (
                <span style={{
                  background: typeFilter === type ? (cfg?.color ?? 'var(--accent)') : 'var(--card-border)',
                  color: typeFilter === type ? '#fff' : 'var(--text-muted)',
                  borderRadius: '10px', padding: '0 6px', fontSize: '11px', fontWeight: 600,
                }}>
                  {count}
                </span>
              )}
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
                        isToday={isToday}
                        onClick={handleChipClick}
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

      {/* Empty state */}
      {!isLoading && monthEvents.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <Calendar size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>No events this month</div>
          <div style={{ fontSize: '13px' }}>
            Events are extracted from meeting notes and deal close dates.
            Process meeting notes via the AI copilot to see events here.
          </div>
        </div>
      )}

      {/* Popover */}
      {selectedEvent && anchorRef && (
        <>
          <Backdrop onClick={closePopover} />
          <EventPopover
            event={selectedEvent}
            anchorRef={anchorRef}
            onClose={closePopover}
          />
        </>
      )}

      <style>{`
        @media (max-width: 700px) {
          [data-cal-grid] { grid-template-columns: repeat(7, minmax(40px, 1fr)); }
        }
      `}</style>
    </div>
  )
}
