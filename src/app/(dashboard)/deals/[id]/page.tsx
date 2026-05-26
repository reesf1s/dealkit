'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useParams } from 'next/navigation'
import { AlertTriangle, Bot, CheckCircle2, RefreshCw } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorKpi, OperatorMetricGrid, OperatorPage, OperatorPanel } from '@/components/shared/OperatorUI'

export const dynamic = 'force-dynamic'

type DealContext = {
  deal: {
    id: string
    title: string
    valueAmount: number | null
    valueCurrency: string
    expectedCloseDate: string | null
    status: string
    aiScore: number | null
    aiConfidence: number | null
    aiRiskLevel: string
    aiSummary: string | null
    aiNextAction: string | null
    stageName: string | null
    companyName: string | null
  }
  company: { name: string | null; domain: string | null; website: string | null }
  contacts: Array<{ id: string; fullName: string; email: string | null; jobTitle: string | null; isPrimary: boolean }>
  latestActivities: Array<{ id: string; type: string; title: string; body: string | null; summary: string | null; occurredAt: string }>
  openTasks: Array<{ id: string; title: string; dueAt: string | null; priority: string; source: string }>
  previousAiSummaries: Array<{ id: string; content: string; createdAt: string; confidence: number | null }>
  signals: Array<{ id: string; type: string; direction: string; strength: number; explanation: string; confidence: number; createdAt: string }>
  meetings: Array<{ id: string; title: string; startsAt: string; meetingUrl: string | null }>
}

function money(value: number | null) {
  if (!value) return '—'
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${value}`
}

function dt(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function DealPage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading, mutate } = useSWR<{ data: DealContext }>(params?.id ? `/api/crm/deals/${params.id}` : null, fetcher, {
    revalidateOnFocus: false,
  })
  const context = data?.data
  const deal = context?.deal

  async function refresh() {
    if (!params?.id) return
    await fetch(`/api/crm/deals/${params.id}`, { method: 'POST' })
    mutate()
  }

  if (!deal && !isLoading) {
    return (
      <OperatorPage>
        <OperatorPanel><div className="empty-state">Deal not found.</div></OperatorPanel>
      </OperatorPage>
    )
  }

  return (
    <OperatorPage>
      <OperatorHeader
        eyebrow={<Link href="/deals">Deals</Link>}
        title={deal?.title ?? 'Loading deal'}
        description={context?.company.name ?? 'Native CRM deal record'}
        actions={<button className="operator-button" onClick={refresh}><RefreshCw size={14} /> Refresh intelligence</button>}
      />

      <OperatorMetricGrid>
        <OperatorKpi label="Value" value={money(deal?.valueAmount ?? null)} />
        <OperatorKpi label="Stage" value={deal?.stageName ?? '—'} />
        <OperatorKpi label="Score" value={deal?.aiScore === null || deal?.aiScore === undefined ? '—' : `${deal.aiScore}%`} />
        <OperatorKpi label="Risk" value={deal?.aiRiskLevel ?? 'unknown'} tone={deal?.aiRiskLevel === 'high' ? 'red' : deal?.aiRiskLevel === 'medium' ? 'amber' : 'green'} />
      </OperatorMetricGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.8fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <OperatorPanel title="AI deal brief" icon={Bot} action={<span className="crm-pill">Evidence-backed</span>}>
            <p className="crm-brief">{deal?.aiSummary ?? context?.previousAiSummaries[0]?.content ?? 'No AI summary yet. Refresh intelligence after adding activity, meetings, or notes.'}</p>
            <div className="crm-next-action">
              <strong>Next best action</strong>
              <span>{deal?.aiNextAction ?? 'Create a concrete next step for this deal.'}</span>
            </div>
          </OperatorPanel>

          <OperatorPanel title="Activity timeline">
            <div className="crm-timeline">
              {(context?.latestActivities ?? []).map(activity => (
                <article key={activity.id}>
                  <div>
                    <strong>{activity.title}</strong>
                    <p>{activity.summary ?? activity.body ?? activity.type}</p>
                  </div>
                  <time>{dt(activity.occurredAt)}</time>
                </article>
              ))}
              {!isLoading && (context?.latestActivities.length ?? 0) === 0 && <div className="empty-state">No activity yet.</div>}
            </div>
          </OperatorPanel>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <OperatorPanel title="Risk explanation" icon={AlertTriangle}>
            <div style={{ display: 'grid', gap: 8 }}>
              {(context?.signals ?? []).slice(0, 5).map(signal => (
                <div key={signal.id} className="crm-signal">
                  <strong>{signal.type.replace(/_/g, ' ')}</strong>
                  <span>{signal.explanation}</span>
                </div>
              ))}
              {!isLoading && (context?.signals.length ?? 0) === 0 && <div className="empty-state">No risk signals found.</div>}
            </div>
          </OperatorPanel>

          <OperatorPanel title="Open tasks" icon={CheckCircle2}>
            <div style={{ display: 'grid', gap: 8 }}>
              {(context?.openTasks ?? []).map(task => (
                <div key={task.id} className="crm-row-link">
                  <span>{task.title}</span>
                  <small>{task.priority} · {dt(task.dueAt)}</small>
                </div>
              ))}
              {!isLoading && (context?.openTasks.length ?? 0) === 0 && <div className="empty-state">No open tasks.</div>}
            </div>
          </OperatorPanel>

          <OperatorPanel title="Contacts">
            <div style={{ display: 'grid', gap: 8 }}>
              {(context?.contacts ?? []).map(contact => (
                <div key={contact.id} className="crm-row-link">
                  <span>{contact.fullName}</span>
                  <small>{contact.jobTitle ?? 'Contact'} · {contact.email ?? 'No email'}</small>
                </div>
              ))}
            </div>
          </OperatorPanel>

          <OperatorPanel title="Meetings">
            <div style={{ display: 'grid', gap: 8 }}>
              {(context?.meetings ?? []).map(meeting => (
                <a key={meeting.id} className="crm-row-link" href={meeting.meetingUrl ?? '#'} target={meeting.meetingUrl ? '_blank' : undefined}>
                  <span>{meeting.title}</span>
                  <small>{dt(meeting.startsAt)}</small>
                </a>
              ))}
              {!isLoading && (context?.meetings.length ?? 0) === 0 && <div className="empty-state">No linked meetings.</div>}
            </div>
          </OperatorPanel>
        </div>
      </div>
    </OperatorPage>
  )
}
