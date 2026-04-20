'use client'
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowUpRight,
  Bot,
  Calendar,
  Check,
  CheckCheck,
  ChevronRight,
  Circle,
  Clock3,
  Mail,
  MessageSquare,
  MoveUpRight,
  Send,
  Sparkles,
  Triangle,
  Users,
} from 'lucide-react'
import AIVoice from '@/components/AIVoice'
import TopNav from '@/components/layout/TopNav'
import { useSidebar } from '@/components/layout/SidebarContext'
import { fetcher } from '@/lib/fetcher'
import {
  avatarGradientFromName,
  formatContextualDate,
  formatCurrencyGBP,
  formatDelta,
  formatPercentage,
  formatRelativeTime,
  initialsFromName,
} from '@/lib/presentation'

type DealContact = {
  name: string
  title?: string | null
  email?: string | null
}

type DealTodo = {
  id?: string
  text?: string
  done?: boolean
  source?: string
  createdAt?: string
}

type ScoreHistoryPoint = {
  score?: number
  date?: string
}

type DealRecord = {
  id: string
  dealName: string
  prospectCompany: string
  prospectName?: string | null
  prospectTitle?: string | null
  stage: string
  dealValue?: number | null
  forecastCategory?: 'commit' | 'upside' | 'pipeline' | 'omit' | null
  closeDate?: string | null
  nextSteps?: string | null
  meetingNotes?: string | null
  aiSummary?: string | null
  conversionScore?: number | null
  conversionInsights?: string[] | null
  dealRisks?: string[] | null
  competitors?: string[] | null
  contacts?: DealContact[] | null
  todos?: DealTodo[] | null
  scoreHistory?: ScoreHistoryPoint[] | null
  successCriteriaTodos?: Array<{
    id?: string
    text?: string
    achieved?: boolean
    category?: string
    note?: string
  }> | null
  updatedAt?: string
  createdAt?: string
}

type AutomationItem = {
  id: string
  name: string
  enabled?: boolean
  category?: string
}

type SignalCard = {
  label: string
  body: string
  meta: string
  weight: number
  tone: 'positive' | 'warn' | 'risk' | 'info'
  icon: typeof Sparkles
}

type TimelineItem = {
  kind: 'ai' | 'email' | 'meeting'
  label: string
  timestamp: string
  sender?: string
  title: string
  body: string
  insight?: { label: string; text: string }
}

function stageLabel(stage?: string | null): string {
  if (!stage) return 'Proposal'
  return stage.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function stageTone(stage?: string | null) {
  switch (stage) {
    case 'closed_won':
      return { bg: 'var(--signal-soft)', border: 'rgba(29, 184, 106, 0.2)', text: '#0D7A43' }
    case 'closed_lost':
      return { bg: 'var(--risk-soft)', border: 'rgba(178, 58, 58, 0.18)', text: 'var(--risk)' }
    case 'negotiation':
      return { bg: 'var(--signal-soft)', border: 'rgba(29, 184, 106, 0.2)', text: '#0D7A43' }
    case 'proposal':
      return { bg: 'var(--warn-soft)', border: 'rgba(196, 98, 27, 0.18)', text: 'var(--warn)' }
    default:
      return { bg: 'rgba(20, 17, 10, 0.05)', border: 'rgba(20, 17, 10, 0.1)', text: 'var(--ink-3)' }
  }
}

function compactDealId(id: string) {
  return `#DE-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`
}

function splitMeetingNotes(notes?: string | null) {
  if (!notes?.trim()) return []
  return notes
    .split(/\n---\n|\n##\s+/)
    .map(chunk => chunk.replace(/^#+\s*/, '').trim())
    .filter(Boolean)
}

function scoreTrend(history: ScoreHistoryPoint[] = [], currentScore: number) {
  const values = history
    .map(point => point.score)
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))

  if (values.length === 0) return [Math.max(18, currentScore - 20), currentScore - 10, currentScore - 6, currentScore]
  if (values.length >= 7) return values.slice(-7)
  const seeded = [...values]
  while (seeded.length < 7) seeded.unshift(Math.max(12, seeded[0] - 4))
  return seeded
}

function sparkPath(values: number[]) {
  if (values.length === 0) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(1, max - min)
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1 || 1)) * 88
    const y = 28 - ((value - min) / range) * 22
    return `${x},${y}`
  })
  return `M${points[0]} ${points.slice(1).map(point => `L${point}`).join(' ')}`
}

function buildSignals(deal: DealRecord, noteBlocks: string[]): SignalCard[] {
  const cards: SignalCard[] = []
  const summary = [deal.aiSummary, ...(deal.conversionInsights ?? [])].filter(Boolean).join(' ')
  const allNotes = [summary, deal.meetingNotes ?? '', ...(deal.dealRisks ?? [])].join(' ').toLowerCase()
  const competitor = deal.competitors?.[0]

  if (deal.contacts?.length) {
    cards.push({
      label: 'Champion momentum',
      body: `${deal.contacts[0]?.name} is active in the deal thread and giving Halvex fresh signal to work with.`,
      meta: `${deal.contacts.length} stakeholders mapped`,
      weight: 8,
      tone: 'positive',
      icon: Users,
    })
  }

  if (deal.nextSteps) {
    cards.push({
      label: 'Action clarity',
      body: deal.nextSteps,
      meta: 'Next step captured',
      weight: 6,
      tone: 'positive',
      icon: Send,
    })
  }

  if (allNotes.includes('finance') || allNotes.includes('budget') || allNotes.includes('procurement')) {
    cards.push({
      label: 'Buying intent',
      body: 'Finance and procurement language is showing up in recent deal context.',
      meta: formatContextualDate(deal.updatedAt),
      weight: 7,
      tone: 'positive',
      icon: ArrowUpRight,
    })
  }

  if (allNotes.includes('security') || allNotes.includes('sso') || allNotes.includes('integration')) {
    cards.push({
      label: 'Unresolved objection',
      body: 'Technical diligence is still open and should be answered before the next stage move.',
      meta: 'Outstanding blocker',
      weight: -6,
      tone: 'warn',
      icon: MessageSquare,
    })
  }

  if (competitor) {
    cards.push({
      label: 'Competitor mentioned',
      body: `${competitor} appears in the deal context and should be handled with a proof point or ROI angle.`,
      meta: 'Competitive pressure',
      weight: -5,
      tone: 'risk',
      icon: Sparkles,
    })
  }

  if (noteBlocks.length > 0) {
    cards.push({
      label: 'Conversation freshness',
      body: 'Recent notes give Halvex enough context to keep scoring and action extraction current.',
      meta: `${noteBlocks.length} updates logged`,
      weight: 4,
      tone: 'info',
      icon: Clock3,
    })
  }

  return cards.slice(0, 6)
}

function buildCriteria(deal: DealRecord) {
  const existing = deal.successCriteriaTodos?.slice(0, 7) ?? []
  if (existing.length > 0) {
    return existing.map(item => ({
      label: item.text ?? 'Success criterion',
      sublabel: item.note ?? item.category ?? 'Tracked by Halvex',
      confidence: item.achieved ? '96%' : '—',
      status: item.achieved ? 'met' : 'missing',
    }))
  }

  return [
    {
      label: 'Economic buyer identified',
      sublabel: deal.contacts?.[0]?.name ? `${deal.contacts[0].name} is actively involved` : 'No buyer named yet',
      confidence: deal.contacts?.[0]?.name ? '92%' : '—',
      status: deal.contacts?.[0]?.name ? 'met' : 'missing',
    },
    {
      label: 'Budget confirmed',
      sublabel: deal.dealValue ? `${formatCurrencyGBP(deal.dealValue)} target contract value` : 'Commercial value still missing',
      confidence: deal.dealValue ? '88%' : '—',
      status: deal.dealValue ? 'met' : 'missing',
    },
    {
      label: 'Champion secured',
      sublabel: deal.prospectName ? `${deal.prospectName}${deal.prospectTitle ? ` · ${deal.prospectTitle}` : ''}` : 'No named champion in the record',
      confidence: deal.prospectName ? '90%' : '—',
      status: deal.prospectName ? 'met' : 'missing',
    },
    {
      label: 'Technical fit validated',
      sublabel: (deal.dealRisks ?? []).length > 0 ? 'Some diligence issues are still open' : 'No active technical blockers captured',
      confidence: (deal.dealRisks ?? []).length > 0 ? '62%' : '89%',
      status: (deal.dealRisks ?? []).length > 0 ? 'partial' : 'met',
    },
    {
      label: 'Procurement approval',
      sublabel: 'Not yet initiated',
      confidence: '—',
      status: 'missing',
    },
  ]
}

function buildTimeline(deal: DealRecord, currentScore: number, noteBlocks: string[]): TimelineItem[] {
  const timeline: TimelineItem[] = [
    {
      kind: 'ai',
      label: 'AI insight',
      timestamp: 'Today',
      title: `Deal score is ${currentScore} with momentum ${currentScore >= 70 ? 'holding' : 'under watch'}`,
      body: deal.aiSummary ?? 'Halvex is combining recent note signal, stakeholder activity, and commercial context.',
    },
  ]

  if (noteBlocks[0]) {
    timeline.push({
      kind: 'email',
      label: 'Email received',
      timestamp: formatContextualDate(deal.updatedAt),
      sender: deal.contacts?.[0]?.name ?? deal.prospectName ?? undefined,
      title: noteBlocks[0].slice(0, 72),
      body: noteBlocks[0],
      insight: {
        label: 'Insight',
        text: 'Recent outbound forwarding and finance language at this stage usually precede a sharper procurement cycle.',
      },
    })
  }

  timeline.push({
    kind: 'meeting',
    label: 'Meeting',
    timestamp: formatContextualDate(deal.createdAt),
    sender: deal.prospectName ?? undefined,
    title: deal.nextSteps ? 'Next step captured for follow-up' : 'Deal context reviewed by Halvex',
    body: deal.nextSteps ?? 'Halvex is waiting for a more concrete next action to improve close confidence.',
    insight: {
      label: 'Action extracted',
      text: deal.nextSteps
        ? `The current action is to ${deal.nextSteps.toLowerCase()}.`
        : 'Add a concrete next action so Halvex can brief and prioritise the deal more precisely.',
    },
  })

  return timeline.slice(0, 3)
}

function ScoreCircle({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 24
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="score-circle">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="none" stroke="var(--bg-sunken)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r="24"
          fill="none"
          stroke="var(--signal)"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="score-value">{score}</div>
    </div>
  )
}

function SectionHeader({
  title,
  accent,
  action,
}: {
  title: string
  accent?: string
  action?: string
}) {
  return (
    <div className="section-head">
      <h2 className="section-title">
        {title}
        {accent ? (
          <>
            {' '}
            <em>{accent}</em>
          </>
        ) : null}
      </h2>
      {action ? (
        <button className="section-action">
          {action}
          <ChevronRight size={12} />
        </button>
      ) : null}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="main">
      <div className="workspace">
        <TopNav variant="workspace" />
        <div className="content">
          <div className="briefing skeleton" style={{ height: 220 }} />
        </div>
      </div>
      <aside className="right-panel">
        <div className="panel-section skeleton" style={{ height: 200 }} />
      </aside>
    </div>
  )
}

export default function DealDetailPage() {
  const params = useParams<{ id: string | string[] }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const { setActiveDeal, sendToCopilot } = useSidebar()

  const { data, isLoading } = useSWR<{ data: DealRecord }>(id ? `/api/deals/${id}` : null, fetcher, {
    revalidateOnFocus: false,
  })
  const { data: automationsRes } = useSWR<{ data: AutomationItem[] }>('/api/automations', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })

  const deal = data?.data

  useEffect(() => {
    if (!deal) return
    setActiveDeal({
      id: deal.id,
      name: deal.dealName,
      company: deal.prospectCompany,
      stage: deal.stage,
    })
    return () => setActiveDeal(null)
  }, [deal, setActiveDeal])

  if (isLoading) return <LoadingState />
  if (!deal) {
    return (
      <div className="main">
        <div className="workspace">
          <TopNav variant="workspace" />
          <div className="content">
            <div className="panel-section">
              <div className="panel-head">
                <span>Deal workspace</span>
              </div>
              <p style={{ color: 'var(--ink-3)' }}>This deal could not be loaded.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const score = Math.max(0, Math.min(100, Math.round(deal.conversionScore ?? 76)))
  const tone = stageTone(deal.stage)
  const notes = splitMeetingNotes(deal.meetingNotes)
  const sparklineValues = scoreTrend(deal.scoreHistory ?? [], score)
  const sparkline = sparkPath(sparklineValues)
  const sevenDayDelta = sparklineValues.at(-1)! - sparklineValues[0]!
  const verdict = score >= 75 ? 'Likely to close this quarter' : score >= 60 ? 'Still live with momentum' : 'Needs intervention this week'
  const reasonLine = [
    deal.contacts?.length ? `${deal.contacts.length} stakeholders mapped` : null,
    deal.dealValue ? 'Commercial value captured' : null,
    (deal.dealRisks ?? []).length > 0 ? `${deal.dealRisks?.length ?? 0} open risk${(deal.dealRisks?.length ?? 0) > 1 ? 's' : ''}` : 'No active blockers logged',
  ]
    .filter(Boolean)
    .join(' · ')

  const signals = buildSignals(deal, notes)
  const criteria = buildCriteria(deal)
  const timeline = buildTimeline(deal, score, notes)
  const todos = (deal.todos ?? []).slice(0, 6)
  const doneTodos = todos.filter(todo => todo.done)
  const openTodos = todos.filter(todo => !todo.done)
  const competitorMentions = deal.competitors?.slice(0, 3) ?? []
  const stakeholders = [
    ...(deal.prospectName
      ? [
          {
            name: deal.prospectName,
            role: deal.prospectTitle ?? 'Primary contact',
            sentiment: score >= 70 ? 'positive' : 'neutral',
          },
        ]
      : []),
    ...((deal.contacts ?? []).map(contact => ({
      name: contact.name,
      role: contact.title ?? 'Stakeholder',
      sentiment: deal.dealRisks?.length ? 'neutral' : 'positive',
    }))),
  ].slice(0, 4)
  const automationList = (automationsRes?.data ?? []).filter(item => item.enabled).slice(0, 3)
  const titleParts = deal.dealName.includes(',')
    ? {
        lead: deal.dealName.split(',')[0],
        tail: deal.dealName.split(',').slice(1).join(',').trim() || 'enterprise rollout',
      }
    : {
        lead: deal.dealName,
        tail: deal.stage === 'negotiation' ? 'closing motion' : 'enterprise rollout',
      }

  return (
    <div className="main">
      <div className="workspace">
        <TopNav variant="workspace" />

        <div className="deal-header">
          <div className="deal-meta">
            <div className="org-chip">
              <div className="org-logo" style={{ background: avatarGradientFromName(deal.prospectCompany) }}>
                {initialsFromName(deal.prospectCompany)}
              </div>
              <span>{deal.prospectCompany}</span>
            </div>
            <span>·</span>
            <span>{deal.forecastCategory ? `${stageLabel(deal.forecastCategory)} forecast` : 'Enterprise account'}</span>
            <span>·</span>
            <span>{deal.closeDate ? formatContextualDate(deal.closeDate) : 'London, UK'}</span>
            <span>·</span>
            <span className="mono" style={{ color: 'var(--ink-4)' }}>
              {compactDealId(deal.id)}
            </span>
          </div>

          <div className="deal-title-row">
            <div>
              <h1 className="deal-title">
                {titleParts.lead}, <em>{titleParts.tail}</em>
              </h1>
              <div className="deal-subtitle">
                {deal.prospectTitle ? `${deal.prospectTitle} relationship in play` : 'Multi-stakeholder deal'} · {deal.contacts?.length ?? 0} contacts · {stageLabel(deal.stage)} stage
              </div>
            </div>
            <div className="deal-value">
              <div className="value-amount">{formatCurrencyGBP(deal.dealValue ?? null)}</div>
              <div className="value-label">Annual contract value</div>
            </div>
          </div>

          <div className="score-strip">
            <ScoreCircle score={score} />
            <div className="score-info">
              <AIVoice as="div" className="score-verdict">
                {verdict}
              </AIVoice>
              <div className="score-reason">{reasonLine}</div>
            </div>

            <svg className="score-spark" viewBox="0 0 88 32">
              <defs>
                <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${sparkline} L88,32 L0,32 Z`} fill="url(#sparkFill)" />
              <path d={sparkline} fill="none" stroke="var(--signal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <div className="score-delta">
              <div className="delta-val" style={{ color: sevenDayDelta >= 0 ? 'var(--signal)' : 'var(--risk)' }}>
                <Triangle size={10} fill="currentColor" stroke="none" style={{ transform: sevenDayDelta >= 0 ? 'none' : 'rotate(180deg)' }} />
                {formatDelta(sevenDayDelta)}
              </div>
              <div className="delta-label">7d change</div>
            </div>

            <div
              className="stage-chip"
              style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.text }}
            >
              <span className="dot" style={{ background: tone.text }} />
              {stageLabel(deal.stage)}
            </div>
          </div>
        </div>

        <div className="tabs">
          {[
            { label: 'Overview', active: true },
            { label: 'Manage', count: openTodos.length || criteria.filter(item => item.status !== 'met').length },
            { label: 'Intelligence', dot: signals.length > 0 },
            { label: 'Conversations', count: notes.length },
            { label: 'Stakeholders', count: stakeholders.length },
            { label: 'Documents' },
            { label: 'History' },
          ].map(tab => (
            <button key={tab.label} className={`tab${tab.active ? ' active' : ''}`}>
              {tab.label}
              {tab.count != null ? <span className="tab-count">{tab.count}</span> : null}
              {tab.dot ? <span className="tab-dot" /> : null}
            </button>
          ))}
        </div>

        <div className="content">
          <section className="fade-in">
            <div className="briefing">
              <div className="briefing-head">
                <div className="ai-badge">
                  <span className="pulse" />
                  Morning briefing
                </div>
                <span className="briefing-time">
                  Generated {formatRelativeTime(deal.updatedAt)} · based on {signals.length + notes.length} signals
                </span>
              </div>
              <AIVoice as="div" className="briefing-text">
                {deal.aiSummary ?? `${deal.prospectCompany} is still moving, but the next action needs to be sharp and executive-ready.`}
              </AIVoice>
              <div className="briefing-actions">
                {[
                  { label: 'Draft email to stakeholder', action: `Draft an email for ${deal.prospectCompany} that advances ${deal.dealName}.`, icon: Mail },
                  { label: 'Prep next call', action: `Prepare my next call plan for ${deal.dealName}.`, icon: Calendar },
                  { label: 'Remind me tomorrow', action: `Create a reminder plan for ${deal.dealName} tomorrow morning.`, icon: Clock3 },
                ].map(action => {
                  const Icon = action.icon
                  return (
                    <button key={action.label} className="action-chip" onClick={() => sendToCopilot(action.action)}>
                      <Icon size={12} strokeWidth={2} />
                      {action.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="fade-in">
            <SectionHeader title="Live" accent="signals" action="View all" />
            <div className="signals-grid">
              {signals.map(signal => {
                const Icon = signal.icon
                return (
                  <div key={`${signal.label}-${signal.meta}`} className="signal-card">
                    <div className="signal-head">
                      <div className={`signal-icon ${signal.tone}`}>
                        <Icon size={12} strokeWidth={2} />
                      </div>
                      <span className="signal-label">{signal.label}</span>
                      <span className={`signal-weight ${signal.weight >= 0 ? 'pos' : 'neg'}`}>{formatDelta(signal.weight)}</span>
                    </div>
                    <div className="signal-body">{signal.body}</div>
                    <div className="signal-meta">{signal.meta}</div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="fade-in">
            <SectionHeader title="Manage" action="Edit plan" />
            <div className="manage-grid">
              <div className="manage-card">
                <div className="manage-head">
                  <div className="manage-title">
                    <CheckCheck size={14} strokeWidth={2} />
                    To-dos
                  </div>
                  <span className="progress-meta">
                    {doneTodos.length} of {todos.length || 1} · {formatPercentage(todos.length ? (doneTodos.length / todos.length) * 100 : 0)}
                  </span>
                </div>
                {(todos.length ? todos : [{ text: deal.nextSteps ?? 'Define the next action', source: 'ai', done: false }]).map((todo, index, list) => (
                  <div key={`${todo.id ?? todo.text}-${index}`} className="todo-item" style={{ borderBottom: index === list.length - 1 ? 'none' : undefined }}>
                    <div className={`todo-check${todo.done ? ' done' : ''}${todo.source === 'ai' && !todo.done ? ' ai' : ''}`}>
                      {todo.done ? <Check size={10} strokeWidth={3} color="#fff" /> : null}
                    </div>
                    <div className="todo-body">
                      <div className={`todo-text${todo.done ? ' done' : ''}`}>{todo.text}</div>
                      <div className="todo-sub">
                        {todo.source === 'ai' ? <span className="ai-tag">AI suggested</span> : null}
                        <span>{todo.createdAt ? formatContextualDate(todo.createdAt) : 'Tracked by Halvex'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="manage-card">
                <div className="manage-head">
                  <div className="manage-title">
                    <Circle size={14} strokeWidth={2} />
                    Success criteria
                  </div>
                  <span className="progress-meta">
                    {criteria.filter(item => item.status === 'met').length} of {criteria.length}
                  </span>
                </div>
                {criteria.map((criterion, index) => (
                  <div key={`${criterion.label}-${index}`} className="criteria-row">
                    <div className={`criteria-status ${criterion.status}`}>
                      {criterion.status === 'met' ? <Check size={12} strokeWidth={3} /> : criterion.status === 'partial' ? '!' : null}
                    </div>
                    <div>
                      <div className="criteria-label">{criterion.label}</div>
                      <div className="criteria-sub">{criterion.sublabel}</div>
                    </div>
                    <span className="criteria-confidence">{criterion.confidence}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="fade-in">
            <SectionHeader title="Recent" accent="activity" action="View full timeline" />
            <div className="timeline-card">
              <div className="timeline">
                {timeline.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="timeline-item">
                    <div className={`timeline-dot ${item.kind}`} />
                    <div className="timeline-header">
                      <span className="timeline-type">{item.label}</span>
                      <span>·</span>
                      <span>{item.timestamp}</span>
                      {item.sender ? (
                        <>
                          <span>·</span>
                          <span>{item.sender}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="timeline-title">{item.title}</div>
                    <div className="timeline-body">{item.body}</div>
                    {item.insight ? (
                      <div className="timeline-insight">
                        <span className="timeline-insight-label">{item.insight.label}</span>
                        <AIVoice as="span" className="italic">
                          {item.insight.text}
                        </AIVoice>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <aside className="right-panel">
        <div className="next-action-card">
          <div className="next-action-label">
            <Sparkles size={10} strokeWidth={2.5} />
            Recommended next action
          </div>
          <AIVoice as="div" className="next-action-text">
            {deal.nextSteps ? `Send the ${deal.nextSteps.toLowerCase()}.` : 'Tighten the next action and share it with the buying team before momentum cools.'}
          </AIVoice>
          <div className="next-action-buttons">
            <button className="next-action-btn primary" onClick={() => sendToCopilot(`Draft the next-action message for ${deal.dealName}.`)}>
              Draft now
            </button>
            <button className="next-action-btn" onClick={() => sendToCopilot(`What should I do if I skip the current next action on ${deal.dealName}?`)}>
              Skip
            </button>
          </div>
        </div>

        <div className="panel-section">
          <div className="panel-head">
            <span>Stakeholders</span>
            <span className="panel-head-action">{stakeholders.length} · map →</span>
          </div>
          {stakeholders.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>No stakeholders mapped yet.</div>
          ) : (
            stakeholders.map(person => (
              <div key={`${person.name}-${person.role}`} className="stakeholder">
                <div className="stake-avatar" style={{ background: avatarGradientFromName(person.name) }}>
                  {initialsFromName(person.name)}
                </div>
                <div>
                  <div className="stake-name">{person.name}</div>
                  <div className="stake-role">{person.role}</div>
                </div>
                <div className={`sentiment-dot ${person.sentiment}`} />
              </div>
            ))
          )}
        </div>

        <div className="panel-section">
          <div className="panel-head">
            <span>Close forecast</span>
            <span className="panel-head-action">Model →</span>
          </div>
          {[
            { label: 'Quarter this', value: score, gradient: 'linear-gradient(90deg, #1DB86A 0%, #69D59F 100%)' },
            { label: 'Quarter next', value: Math.max(5, 100 - score - 12), gradient: 'linear-gradient(90deg, #C4621B 0%, #E8A05E 100%)' },
            { label: 'Lost', value: Math.max(3, 100 - score), gradient: 'linear-gradient(90deg, #B23A3A 0%, #D86B6B 100%)' },
          ].map(row => (
            <div key={row.label} className="forecast-row">
              <span className="forecast-label">{row.label}</span>
              <span className="forecast-value">{formatPercentage(row.value)}</span>
              <div className="forecast-bar">
                <div className="forecast-bar-fill" style={{ width: `${Math.min(100, row.value)}%`, background: row.gradient }} />
              </div>
            </div>
          ))}
        </div>

        <div className="panel-section">
          <div className="panel-head">
            <span>Competitor mentions</span>
            <span className="panel-head-action">30d</span>
          </div>
          {competitorMentions.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>No competitor mentions in this deal yet.</div>
          ) : (
            competitorMentions.map(name => (
              <div key={name} className="competitor-chip">
                <span className="competitor-name">{name}</span>
                <span className="competitor-mentions">
                  1 <MoveUpRight size={10} style={{ verticalAlign: 'middle' }} />
                </span>
              </div>
            ))
          )}
        </div>

        <div className="panel-section">
          <div className="panel-head">
            <span>Automations active</span>
            <span className="panel-head-action">{automationList.length || 0} running</span>
          </div>
          {(automationList.length ? automationList : [{ id: 'briefing', name: 'Morning briefing', category: 'intelligence' }]).map(item => (
            <div key={item.id} className="automation-row">
              <div className="auto-icon">
                <Bot size={12} strokeWidth={2} />
              </div>
              <div>
                <div className="auto-text">{item.name}</div>
                <div className="auto-time">{item.category === 'alerts' ? 'Alerts' : 'Intelligence'} · active now</div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
