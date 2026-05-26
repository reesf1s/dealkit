'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDollarSign, Sparkles } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorInsightCard, OperatorKpi, OperatorMetricGrid, OperatorPage, OperatorPanel } from '@/components/shared/OperatorUI'

export const dynamic = 'force-dynamic'

type TodayData = {
  priorities: Array<{ id: string; title: string; reason: string; linkedType: string; linkedId: string; dealId?: string | null; suggestedAction: string; dueAt?: string | null; confidence: string }>
  atRiskDeals: Array<{ id: string; title: string; companyName: string | null; valueAmount: number | null; aiScore: number | null; aiRiskLevel: string }>
  staleDeals: Array<{ id: string; title: string; companyName: string | null; lastActivityAt: string | null }>
  upcomingMeetings: Array<{ id: string; title: string; startsAt: string; dealId: string | null; dealTitle: string | null; companyName: string | null }>
  overdueTasks: Array<{ id: string; title: string; dueAt: string | null; dealId: string | null; dealTitle: string | null; companyName: string | null }>
  openPipelineValue: number
  likelyClosers: Array<{ id: string; title: string; companyName: string | null; valueAmount: number | null }>
}

function money(value: number | null | undefined) {
  const v = value ?? 0
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `£${Math.round(v / 1_000)}k`
  return `£${v}`
}

function dateTime(value: string | null | undefined) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function TodayPage() {
  const { data, isLoading, mutate } = useSWR<{ data: TodayData }>('/api/crm/today', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  })
  const today = data?.data

  async function completeTask(taskId: string) {
    await fetch('/api/crm/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId, action: 'complete' }),
    })
    mutate()
  }

  return (
    <OperatorPage>
      <OperatorHeader
        eyebrow="Today"
        title="What needs attention now"
        description="Your pipeline, meetings, stale deals, and next actions in one calm operating view."
        actions={<Link className="operator-button operator-button-primary" href="/pipeline">Open pipeline</Link>}
      />

      <OperatorMetricGrid>
        <OperatorKpi label="Open pipeline" value={money(today?.openPipelineValue)} icon={CircleDollarSign} />
        <OperatorKpi label="Priorities" value={today?.priorities.length ?? (isLoading ? '...' : 0)} icon={Sparkles} tone="green" />
        <OperatorKpi label="At risk" value={today?.atRiskDeals.length ?? 0} icon={AlertTriangle} tone={(today?.atRiskDeals.length ?? 0) > 0 ? 'red' : 'neutral'} />
        <OperatorKpi label="Meetings" value={today?.upcomingMeetings.length ?? 0} icon={CalendarClock} />
      </OperatorMetricGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.8fr)', gap: 16, alignItems: 'start' }}>
        <OperatorPanel title="Today’s priorities" description="Suggested actions are grounded in native CRM records.">
          <div style={{ display: 'grid', gap: 10 }}>
            {(today?.priorities ?? []).map(priority => (
              <OperatorInsightCard
                key={priority.id}
                title={priority.title}
                tone={priority.reason.includes('overdue') ? 'red' : 'neutral'}
                href={priority.dealId ? `/deals/${priority.dealId}` : priority.linkedType === 'task' ? '/tasks' : undefined}
                meta={<span>{priority.confidence}</span>}
              >
                <p style={{ margin: '5px 0 8px', color: 'var(--text-secondary)' }}>{priority.reason}</p>
                <strong style={{ color: 'var(--text-primary)' }}>{priority.suggestedAction}</strong>
                {priority.linkedType === 'task' && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      completeTask(priority.linkedId)
                    }}
                    className="operator-button"
                    style={{ marginTop: 10 }}
                  >
                    <CheckCircle2 size={13} /> Mark done
                  </button>
                )}
              </OperatorInsightCard>
            ))}
            {!isLoading && (today?.priorities.length ?? 0) === 0 && (
              <div className="empty-state">No urgent priorities yet. Add deals, tasks, or connect Google Calendar to start filling Today.</div>
            )}
          </div>
        </OperatorPanel>

        <div style={{ display: 'grid', gap: 16 }}>
          <OperatorPanel title="Upcoming meetings">
            <div style={{ display: 'grid', gap: 8 }}>
              {(today?.upcomingMeetings ?? []).map(meeting => (
                <Link key={meeting.id} href={meeting.dealId ? `/deals/${meeting.dealId}` : '/settings'} className="crm-row-link">
                  <span>{meeting.title}</span>
                  <small>{dateTime(meeting.startsAt)} · {meeting.companyName ?? meeting.dealTitle ?? 'Unlinked'}</small>
                </Link>
              ))}
              {!isLoading && (today?.upcomingMeetings.length ?? 0) === 0 && <div className="empty-state">No upcoming meetings found.</div>}
            </div>
          </OperatorPanel>

          <OperatorPanel title="At-risk deals">
            <div style={{ display: 'grid', gap: 8 }}>
              {(today?.atRiskDeals ?? []).map(deal => (
                <Link key={deal.id} href={`/deals/${deal.id}`} className="crm-row-link">
                  <span>{deal.companyName ?? deal.title}</span>
                  <small>{money(deal.valueAmount)} · score {deal.aiScore ?? 'n/a'} · {deal.aiRiskLevel}</small>
                </Link>
              ))}
              {!isLoading && (today?.atRiskDeals.length ?? 0) === 0 && <div className="empty-state">No high-risk deals right now.</div>}
            </div>
          </OperatorPanel>
        </div>
      </div>
    </OperatorPage>
  )
}
