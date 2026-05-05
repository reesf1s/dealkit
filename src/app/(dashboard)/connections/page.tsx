'use client'
export const dynamic = 'force-dynamic'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Activity, ArrowUpRight, CheckSquare, Clock3, MessageSquareText, Search } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorKpi, OperatorPage } from '@/components/shared/OperatorUI'

interface ActivityEvent {
  id: string
  type: string
  metadata: Record<string, unknown>
  createdAt: string
  dealName?: string
  prospectCompany?: string
}

interface Note {
  id: string
  dealId: string
  dealName: string
  prospectCompany: string
  stage: string
  date: string
  content: string
  source: string
}

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - +new Date(iso)) / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function eventLabel(event: ActivityEvent): string {
  const deal = String(event.metadata?.dealName ?? event.dealName ?? 'Deal')
  const stage = String(event.metadata?.value ?? event.metadata?.newStage ?? '').replace(/_/g, ' ')

  switch (event.type) {
    case 'deal_log.created':
    case 'deal_created':
      return `${deal} was added to pipeline`
    case 'deal_log.closed_won':
    case 'deal_won':
      return `${deal} was closed won`
    case 'deal_log.closed_lost':
    case 'deal_lost':
      return `${deal} was closed lost`
    case 'deal_log.updated':
      if (event.metadata?.field === 'stage' && stage) return `${deal} moved to ${stage}`
      return `${deal} was updated`
    case 'note_added':
    case 'deal_log.note_added':
      return `Conversation captured for ${deal}`
    case 'deal_log.ai_scored':
      return `Intelligence score updated for ${deal}`
    default:
      return event.type.replace(/[_.]/g, ' ')
  }
}

function extractAction(note: Note): string | null {
  const lines = note.content.split('\n').map(l => l.trim()).filter(Boolean)
  const candidate = lines.find(l => /next step|follow[- ]?up|send|schedule|review|confirm|proposal|security|legal|pricing/i.test(l))
  if (!candidate) return null
  return candidate.length > 120 ? `${candidate.slice(0, 120).trim()}…` : candidate
}

export default function ConnectionsPage() {
  const [query, setQuery] = useState('')

  const { data: activityRes, isLoading: activityLoading } = useSWR<{ data: ActivityEvent[] }>('/api/activity?limit=80', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  })

  const { data: notesRes, isLoading: notesLoading } = useSWR<{ data: Note[] }>('/api/notes', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const activity = activityRes?.data ?? []
  const notes = notesRes?.data ?? []

  const filteredActivity = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return activity

    return activity.filter(item => {
      const deal = String(item.metadata?.dealName ?? item.dealName ?? '')
      const company = String(item.metadata?.company ?? item.prospectCompany ?? '')
      return eventLabel(item).toLowerCase().includes(q) || deal.toLowerCase().includes(q) || company.toLowerCase().includes(q)
    })
  }, [activity, query])

  const actionQueue = useMemo(() => {
    return notes
      .map(note => ({ note, action: extractAction(note) }))
      .filter((item): item is { note: Note; action: string } => Boolean(item.action))
      .slice(0, 10)
  }, [notes])

  const recentEvents = activity.filter(item => Date.now() - +new Date(item.createdAt) < 24 * 60 * 60 * 1000).length
  const dealsTouched = new Set(activity.map(item => String(item.metadata?.dealId ?? item.dealName ?? item.id))).size

  return (
    <OperatorPage>
      <OperatorHeader
        eyebrow="Activity Console"
        title="Execution feed and action extraction"
        description="Review pipeline movement and turn captured notes into concrete follow-ups."
      />

      <section className="connections-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {[
          { label: 'Events (24h)', value: String(recentEvents), sub: 'Recent CRM movement', icon: Activity },
          { label: 'Actionable Notes', value: String(actionQueue.length), sub: 'Conversation-derived actions', icon: CheckSquare },
          { label: 'Deals Touched', value: String(dealsTouched), sub: 'Unique opportunities with activity', icon: MessageSquareText },
          { label: 'Total Timeline', value: String(activity.length), sub: 'Events in current window', icon: Clock3 },
        ].map(card => (
          <OperatorKpi key={card.label} label={card.label} value={card.value} sub={card.sub} icon={card.icon} />
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 10 }}>
        <article className="notion-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, borderRadius: 9, border: '1px solid var(--border-default)', padding: '0 10px', background: 'var(--surface-2)', minWidth: 250, marginBottom: 10 }}>
            <Search size={13} style={{ color: 'var(--text-tertiary)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search activity"
              style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
          </div>

          <h2 style={{ margin: '0 0 8px', textTransform: 'none', fontSize: 15, letterSpacing: 0, color: 'var(--text-primary)' }}>
            Timeline
          </h2>

          {activityLoading ? (
            <div className="skeleton" style={{ height: 240, borderRadius: 10 }} />
          ) : filteredActivity.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No events found for this filter.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {filteredActivity.slice(0, 24).map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, background: 'var(--brand)', boxShadow: '0 0 0 4px var(--brand-bg)' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{eventLabel(item)}</div>
                    <div style={{ marginTop: 1, fontSize: 11.5, color: 'var(--text-tertiary)' }}>{relTime(item.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="notion-panel" style={{ padding: '12px 14px' }}>
          <h2 style={{ margin: '0 0 8px', textTransform: 'none', fontSize: 15, letterSpacing: 0, color: 'var(--text-primary)' }}>
            Action Queue From Notes
          </h2>

          {notesLoading ? (
            <div className="skeleton" style={{ height: 240, borderRadius: 10 }} />
          ) : actionQueue.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
              Add meeting notes to let Halvex extract concrete follow-ups.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {actionQueue.map(item => (
                <Link key={item.note.id} href={`/deals/${item.note.dealId}`} style={{ textDecoration: 'none' }}>
                  <div style={{ border: '1px solid var(--border-default)', borderRadius: 10, padding: '10px 11px', background: 'var(--surface-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.note.prospectCompany}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.action}</div>
                      </div>
                      <ArrowUpRight size={13} style={{ color: 'var(--brand)', flexShrink: 0 }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </article>
      </section>

      <style>{`
        @media (max-width: 1120px) {
          .connections-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 960px) {
          section[style*='grid-template-columns: 1.35fr 1fr'] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 760px) {
          .connections-kpis { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </OperatorPage>
  )
}
