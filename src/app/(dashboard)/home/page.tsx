'use client'

import Link from 'next/link'
import useSWR from 'swr'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Plus,
  Sparkles,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  CrmButton,
  CrmEmptyAction,
  CrmHero,
  CrmMeetingCard,
  CrmPageShell,
  CrmPanel,
  CrmPill,
  CrmPriorityCard,
} from '@/components/crm/CrmDesignSystem'

export const dynamic = 'force-dynamic'

type HomeData = {
  priorities: Array<{
    id: string
    title: string
    reason: string
    linkedType: string
    linkedId: string
    dealId?: string | null
    suggestedAction: string
    confidence: string
  }>
  atRiskDeals: Array<{ id: string; title: string; companyName: string | null; valueAmount: number | null; aiScore: number | null; aiRiskLevel: string }>
  staleDeals: Array<{ id: string; title: string; companyName: string | null; lastActivityAt: string | null }>
  upcomingMeetings: Array<{ id: string; title: string; startsAt: string; dealId: string | null; dealTitle: string | null; companyName: string | null }>
  overdueTasks: Array<{ id: string; title: string; dueAt: string | null; dealId: string | null; dealTitle: string | null; companyName: string | null }>
  openPipelineValue: number
  likelyClosers: Array<{ id: string; title: string; companyName: string | null; valueAmount: number | null }>
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Value missing'
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${value}`
}

function time(value: string | null | undefined) {
  if (!value) return 'No time'
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function dateShort(value: string | null | undefined) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function priorityTone(reason: string) {
  const lower = reason.toLowerCase()
  if (lower.includes('risk') || lower.includes('overdue') || lower.includes('stale')) return 'risk' as const
  if (lower.includes('no next') || lower.includes('follow')) return 'watch' as const
  return 'neutral' as const
}

export default function HomePage() {
  const { data, isLoading, mutate } = useSWR<{ data: HomeData }>('/api/crm/today', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  })
  const home = data?.data
  const priorities = home?.priorities ?? []
  const meetings = home?.upcomingMeetings ?? []
  const hasWork = priorities.length > 0 || meetings.length > 0 || (home?.atRiskDeals.length ?? 0) > 0

  async function completeTask(taskId: string) {
    await fetch('/api/crm/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId, action: 'complete' }),
    })
    mutate()
  }

  return (
    <CrmPageShell>
      <CrmHero
        eyebrow="Home"
        title="Your revenue day, already organized."
        brief={
          hasWork
            ? `Halvex found ${priorities.length} priority actions, ${meetings.length} upcoming meetings, and ${(home?.atRiskDeals.length ?? 0)} deals that need a closer look.`
            : 'Connect Calendar or add your first deals and Halvex will turn your meetings, follow-ups, and risks into a clear daily plan.'
        }
        primary={<CrmButton href="/calendar" variant="primary"><CalendarDays size={15} /> Review my day</CrmButton>}
        secondary={<CrmButton href="/pipeline" variant="secondary"><Plus size={15} /> Add deal</CrmButton>}
        meta={
          <>
            <div className="crm-mini-brief">
              <strong>AI daily brief</strong>
              {hasWork
                ? 'Start with meetings, then clear overdue follow-ups and review any deals with no next step.'
                : 'Your daily brief will appear here once Halvex has meetings, deals, or tasks to reason over.'}
            </div>
            <div className="crm-mini-brief">
              <strong>Pipeline pulse</strong>
              {money(home?.openPipelineValue ?? 0)} open pipeline · {(home?.likelyClosers.length ?? 0)} likely closers
            </div>
          </>
        }
      />

      <div className="crm-page-grid">
        <CrmPanel
          title="Today’s meetings"
          description="Calendar-led selling with linked deals, context, and prep."
          icon={CalendarDays}
          action={<CrmButton href="/calendar" variant="ghost">Calendar <ArrowRight size={14} /></CrmButton>}
        >
          {meetings.slice(0, 5).map(meeting => (
            <CrmMeetingCard
              key={meeting.id}
              title={meeting.title}
              time={time(meeting.startsAt)}
              company={meeting.companyName ?? meeting.dealTitle}
              dealHref={meeting.dealId ? `/deals/${meeting.dealId}` : null}
              prep={meeting.dealId ? 'Prep available from linked deal context.' : 'Link this meeting to a deal for AI prep.'}
            />
          ))}

          {!isLoading && meetings.length === 0 && (
            <CrmEmptyAction
              icon={CalendarDays}
              title="Bring your sales day into Halvex"
              description="Connect Google Calendar so meetings show here with linked contacts, deals, and AI prep."
              action={<CrmButton href="/settings" variant="primary">Connect Google Calendar</CrmButton>}
            />
          )}
        </CrmPanel>

        <CrmPanel
          title="Priority actions"
          description="The work Halvex thinks will move revenue today."
          icon={Sparkles}
        >
          {priorities.slice(0, 7).map(priority => (
            <div key={priority.id}>
              <CrmPriorityCard
                title={priority.title}
                reason={priority.reason}
                action={priority.suggestedAction}
                tone={priorityTone(priority.reason)}
                href={priority.dealId ? `/deals/${priority.dealId}` : undefined}
                meta={<CrmPill>{priority.confidence}</CrmPill>}
              />
              {priority.linkedType === 'task' && (
                <button
                  className="crm-action-button ghost"
                  type="button"
                  onClick={() => completeTask(priority.linkedId)}
                  style={{ margin: '-2px 0 10px 8px' }}
                >
                  <CheckCircle2 size={14} /> Mark done
                </button>
              )}
            </div>
          ))}

          {!isLoading && priorities.length === 0 && (
            <CrmEmptyAction
              title="No busywork yet"
              description="Import deals or add next steps and Halvex will turn them into a daily action list."
              action={<CrmButton href="/settings" variant="primary">Import deals</CrmButton>}
            />
          )}
        </CrmPanel>
      </div>

      <section className="crm-home-lower">
        <CrmPanel title="Pipeline pulse" icon={CircleDollarSign}>
          <div className="crm-pulse-row">
            <strong>Open pipeline</strong>
            <span>{money(home?.openPipelineValue ?? 0)}</span>
          </div>
          <div className="crm-pulse-row">
            <strong>Likely to close</strong>
            <span>{home?.likelyClosers.length ?? 0} deals</span>
          </div>
          <div className="crm-pulse-row">
            <strong>At risk</strong>
            <span>{home?.atRiskDeals.length ?? 0} deals</span>
          </div>
        </CrmPanel>

        <CrmPanel title="Likely closers" icon={CheckCircle2}>
          {(home?.likelyClosers ?? []).slice(0, 4).map(deal => (
            <Link href={`/deals/${deal.id}`} key={deal.id} className="crm-card-link">
              <div className="crm-pulse-row">
                <strong>{deal.companyName ?? deal.title}</strong>
                <span>{money(deal.valueAmount)}</span>
              </div>
            </Link>
          ))}
          {!isLoading && (home?.likelyClosers.length ?? 0) === 0 && <CrmEmptyAction title="No close candidates yet" description="Set values, close dates, and next steps to build a believable close list." />}
        </CrmPanel>

        <CrmPanel title="Slipping or stuck" icon={AlertTriangle}>
          {(home?.atRiskDeals ?? []).slice(0, 3).map(deal => (
            <Link href={`/deals/${deal.id}`} key={deal.id} className="crm-card-link">
              <div className="crm-pulse-row">
                <strong>{deal.companyName ?? deal.title}</strong>
                <span>{deal.aiScore ?? '—'} score</span>
              </div>
            </Link>
          ))}
          {(home?.staleDeals ?? []).slice(0, 2).map(deal => (
            <Link href={`/deals/${deal.id}`} key={deal.id} className="crm-card-link">
              <div className="crm-pulse-row">
                <strong>{deal.companyName ?? deal.title}</strong>
                <span>{dateShort(deal.lastActivityAt)}</span>
              </div>
            </Link>
          ))}
          {!isLoading && (home?.atRiskDeals.length ?? 0) === 0 && (home?.staleDeals.length ?? 0) === 0 && (
            <CrmEmptyAction title="Nothing is slipping" description="Halvex will call out stale deals, overdue close dates, and missing next steps here." />
          )}
        </CrmPanel>
      </section>
    </CrmPageShell>
  )
}
