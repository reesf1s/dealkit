'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useParams } from 'next/navigation'
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MailPlus,
  RefreshCw,
  Sparkles,
  Users,
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
  CrmScoreBadge,
  CrmTimeline,
  CrmTimelineItem,
} from '@/components/crm/CrmDesignSystem'

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

const concernTerms = [
  'concern',
  'blocked',
  'blocker',
  'procurement',
  'legal',
  'compliance',
  'security',
  'disagree',
  'alignment',
  'uncertain',
  'issue',
  'risk',
  'delay',
]

function money(value: number | null) {
  if (!value || value <= 0) return 'Value missing'
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${value}`
}

function dt(value: string | null) {
  if (!value) return 'Missing'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function day(value: string | null) {
  if (!value) return 'Close date missing'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function trustAdjusted(context: DealContext | undefined) {
  const deal = context?.deal
  if (!deal) return { score: null, confidence: null, risk: 'unknown', reasons: [] as string[] }

  const evidence = [
    deal.aiSummary,
    deal.aiNextAction,
    ...(context?.latestActivities ?? []).flatMap(activity => [activity.title, activity.summary, activity.body]),
    ...(context?.signals ?? []).map(signal => signal.explanation),
  ].filter(Boolean).join(' ').toLowerCase()

  const reasons: string[] = []
  if (!deal.valueAmount || deal.valueAmount <= 0) reasons.push('Value is missing, so forecast confidence is limited.')
  if (!deal.expectedCloseDate) reasons.push('Close date is missing, so timing confidence is limited.')
  if (!deal.aiNextAction && (context?.openTasks.length ?? 0) === 0) reasons.push('No next action is recorded.')
  if (concernTerms.some(term => evidence.includes(term))) reasons.push('Recent context contains unresolved concerns or risk language.')
  for (const signal of context?.signals ?? []) {
    if (signal.direction === 'negative' && reasons.length < 5) reasons.push(signal.explanation)
  }

  let score = deal.aiScore
  let confidence = deal.aiConfidence
  let risk = deal.aiRiskLevel

  if (reasons.length > 0) {
    confidence = Math.min(confidence ?? 55, 68)
    if (risk === 'low') risk = 'medium'
    if (typeof score === 'number' && score > 82) score = 82
  }

  return { score, confidence, risk, reasons: Array.from(new Set(reasons)).slice(0, 5) }
}

export default function DealPage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading, mutate } = useSWR<{ data: DealContext }>(params?.id ? `/api/crm/deals/${params.id}` : null, fetcher, {
    revalidateOnFocus: false,
  })
  const context = data?.data
  const deal = context?.deal
  const adjusted = trustAdjusted(context)

  async function refresh() {
    if (!params?.id) return
    await fetch(`/api/crm/deals/${params.id}`, { method: 'POST' })
    mutate()
  }

  if (!deal && !isLoading) {
    return (
      <CrmPageShell>
        <CrmPanel>
          <CrmEmptyAction title="Deal not found" description="This deal may have moved, been archived, or be outside your workspace." />
        </CrmPanel>
      </CrmPageShell>
    )
  }

  return (
    <CrmPageShell>
      <CrmHero
        eyebrow={<Link href="/deals" style={{ color: 'inherit', textDecoration: 'none' }}>Deal workspace</Link>}
        title={deal?.title ?? 'Loading deal'}
        brief={deal?.companyName ? `${deal.companyName} · ${deal.stageName ?? 'No stage'} · ${adjusted.risk} risk` : 'A calm workspace for deal context, risk, tasks, meetings, and next actions.'}
        primary={<CrmButton onClick={refresh} variant="primary"><RefreshCw size={15} /> Refresh intelligence</CrmButton>}
        secondary={<CrmButton href="/assistant" variant="secondary"><Bot size={15} /> Ask Halvex</CrmButton>}
        meta={
          <div className="crm-mini-brief">
            <strong>Trust layer</strong>
            Score and risk are adjusted when evidence mentions blockers, uncertainty, missing value, or no next step.
          </div>
        }
      />

      <section className="crm-deal-header-grid">
        <div className="crm-deal-fact"><span>Company</span><strong>{deal?.companyName ?? context?.company.name ?? 'Missing'}</strong></div>
        <div className="crm-deal-fact"><span>Value</span><strong>{money(deal?.valueAmount ?? null)}</strong></div>
        <div className="crm-deal-fact"><span>Stage</span><strong>{deal?.stageName ?? 'Missing'}</strong></div>
        <div className="crm-deal-fact"><span>Close date</span><strong>{day(deal?.expectedCloseDate ?? null)}</strong></div>
        <div className="crm-deal-fact"><span>Next action</span><strong>{deal?.aiNextAction ? 'Set' : 'Missing'}</strong></div>
      </section>

      <div className="crm-record-layout">
        <div style={{ display: 'grid', gap: 18 }}>
          <CrmPanel
            title="AI deal brief"
            description="Short, evidence-aware, and honest about weak context."
            icon={Sparkles}
            action={<CrmPill tone={adjusted.confidence && adjusted.confidence >= 70 ? 'good' : 'watch'}>Confidence {adjusted.confidence ?? 'limited'}</CrmPill>}
          >
            <p className="crm-brief-reset">
              {deal?.aiSummary ?? context?.previousAiSummaries[0]?.content ?? 'No deal brief yet. Add activity, meetings, notes, or tasks and refresh intelligence.'}
            </p>
            <CrmPriorityCard
              title="Next best action"
              reason={deal?.aiNextAction ?? 'No concrete next action is recorded for this deal.'}
              action={deal?.aiNextAction ? 'Turn this into a task or draft a follow-up from the latest context.' : 'Create a dated next step before treating this deal as healthy.'}
              tone={deal?.aiNextAction ? 'blue' : 'watch'}
            />
          </CrmPanel>

          <CrmPanel title="Timeline" description="Recent activity that Halvex can cite." icon={Clock3}>
            <CrmTimeline>
              {(context?.latestActivities ?? []).map(activity => (
                <CrmTimelineItem
                  key={activity.id}
                  title={activity.title}
                  body={activity.summary ?? activity.body}
                  time={dt(activity.occurredAt)}
                  type={activity.type}
                />
              ))}
              {!isLoading && (context?.latestActivities.length ?? 0) === 0 && (
                <CrmEmptyAction title="No activity yet" description="Add notes, tasks, or synced meetings so Halvex has evidence to reason from." />
              )}
            </CrmTimeline>
          </CrmPanel>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <CrmPanel title="Deal intelligence" description="Score, confidence, risk, and why." icon={Bot}>
            <CrmScoreBadge score={adjusted.score} confidence={adjusted.confidence} risk={adjusted.risk} />
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {(adjusted.reasons.length > 0 ? adjusted.reasons : ['No major risk drivers found in the available context.']).map(reason => (
                <CrmPriorityCard
                  key={reason}
                  title={adjusted.reasons.length > 0 ? 'Risk driver' : 'Current read'}
                  reason={reason}
                  action={adjusted.reasons.length > 0 ? 'Resolve or add evidence before trusting the forecast.' : 'Keep activity and next steps current.'}
                  tone={adjusted.reasons.length > 0 ? 'watch' : 'good'}
                />
              ))}
            </div>
          </CrmPanel>

          <CrmPanel title="Open tasks" icon={CheckCircle2}>
            {(context?.openTasks ?? []).map(task => (
              <div key={task.id} className="crm-pulse-row">
                <strong>{task.title}</strong>
                <span>{task.priority} · {dt(task.dueAt)}</span>
              </div>
            ))}
            {!isLoading && (context?.openTasks.length ?? 0) === 0 && (
              <CrmEmptyAction title="No tasks" description="Create one from the next action so this deal has an owner and date." />
            )}
          </CrmPanel>

          <CrmPanel title="Meetings" icon={CalendarDays}>
            {(context?.meetings ?? []).map(meeting => (
              <CrmMeetingCard
                key={meeting.id}
                title={meeting.title}
                time={dt(meeting.startsAt)}
                company={deal?.companyName}
                dealHref={null}
                prep="Use this deal brief and risk panel before the meeting."
              />
            ))}
            {!isLoading && (context?.meetings.length ?? 0) === 0 && (
              <CrmEmptyAction title="No linked meetings" description="Connect Google Calendar to surface meeting prep and follow-up tasks here." />
            )}
          </CrmPanel>

          <CrmPanel title="Contacts" icon={Users}>
            {(context?.contacts ?? []).map(contact => (
              <div key={contact.id} className="crm-pulse-row">
                <strong>{contact.fullName}</strong>
                <span>{contact.jobTitle ?? contact.email ?? 'Contact'}</span>
              </div>
            ))}
            {(context?.contacts.length ?? 0) === 0 && <CrmEmptyAction title="No contacts linked" description="Link contacts so Halvex can prep meetings and draft better follow-ups." />}
          </CrmPanel>

          <CrmPanel title="Assistant shortcuts" icon={MailPlus}>
            <CrmPriorityCard title="Draft follow-up" reason="Use latest activity and next action." action="Open Assistant and ask for a concise follow-up." href="/assistant" tone="blue" />
            <CrmPriorityCard title="Prep me for the next meeting" reason="Summarise blockers, people, and likely objections." action="Use this before customer calls." href="/assistant" tone="blue" />
          </CrmPanel>
        </div>
      </div>
    </CrmPageShell>
  )
}
