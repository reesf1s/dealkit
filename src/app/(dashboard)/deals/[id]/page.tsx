'use client'
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import useSWR from 'swr'
import { useParams } from 'next/navigation'
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
      return { bg: 'var(--signal-soft)', border: 'rgba(29, 184, 106, 0.2)', text: 'var(--signal)' }
    case 'closed_lost':
      return { bg: 'var(--risk-soft)', border: 'rgba(178, 58, 58, 0.18)', text: 'var(--risk)' }
    case 'negotiation':
      return { bg: 'var(--signal-soft)', border: 'rgba(29, 184, 106, 0.2)', text: 'var(--signal)' }
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
  while (seeded.length < 7) {
    seeded.unshift(Math.max(12, seeded[0] - 4))
  }
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
    <div style={{ width: 56, height: 56, position: 'relative' }}>
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
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
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--ink)',
        }}
      >
        {score}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ padding: '28px 28px 32px' }}>
      <div className="surface-glass-elevated skeleton" style={{ height: 220 }} />
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

  const score = Math.max(0, Math.min(100, Math.round(deal?.conversionScore ?? 76)))
  const tone = stageTone(deal?.stage)
  const notes = splitMeetingNotes(deal?.meetingNotes)
  const sparklineValues = scoreTrend(deal?.scoreHistory ?? [], score)
  const sparkline = sparkPath(sparklineValues)
  const sevenDayDelta = sparklineValues.at(-1)! - sparklineValues[0]!
  const verdict = score >= 75 ? 'Likely to close this quarter' : score >= 60 ? 'Still live with momentum' : 'Needs intervention this week'
  const reasonLine = [
    deal?.contacts?.length ? `${deal.contacts.length} stakeholders mapped` : null,
    deal?.dealValue ? 'Commercial value captured' : null,
    (deal?.dealRisks ?? []).length > 0 ? `${deal?.dealRisks?.length ?? 0} open risk${(deal?.dealRisks?.length ?? 0) > 1 ? 's' : ''}` : 'No active blockers logged',
  ]
    .filter(Boolean)
    .join(' · ')

  const signals = deal ? buildSignals(deal, notes) : []
  const criteria = deal ? buildCriteria(deal) : []
  const timeline = deal ? buildTimeline(deal, score, notes) : []
  const todos = (deal?.todos ?? []).slice(0, 6)
  const openTodos = todos.filter(todo => !todo.done)
  const doneTodos = todos.filter(todo => todo.done)
  const competitorMentions = deal?.competitors?.slice(0, 3) ?? []
  const stakeholders = [
    ...(deal?.prospectName
      ? [
          {
            name: deal.prospectName,
            role: deal.prospectTitle ?? 'Primary contact',
            sentiment: score >= 70 ? 'positive' : 'neutral',
          },
        ]
      : []),
    ...((deal?.contacts ?? []).map(contact => ({
      name: contact.name,
      role: contact.title ?? 'Stakeholder',
      sentiment: deal?.dealRisks?.length ? 'neutral' : 'positive',
    }))),
  ].slice(0, 4)
  const automationList = (automationsRes?.data ?? []).filter(item => item.enabled).slice(0, 3)

  if (isLoading) return <LoadingState />
  if (!deal) {
    return (
      <div style={{ padding: '28px' }}>
        <div className="surface-glass-elevated" style={{ borderRadius: 14, padding: '24px 26px' }}>
          <div className="section-label">Deal workspace</div>
          <p style={{ marginTop: 10, color: 'var(--ink-3)' }}>This deal could not be loaded.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="deal-workspace-layout"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 360px',
        gap: 0,
        minWidth: 0,
      }}
    >
      <div className="deal-workspace-main" style={{ minWidth: 0, borderRight: '1px solid rgba(20, 17, 10, 0.06)' }}>
        <div style={{ padding: '28px 28px 24px', borderBottom: '1px solid rgba(20, 17, 10, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: 'var(--ink-3)', fontSize: 11 }}>
            <div
              className="surface-glass-light"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px 4px 4px',
                borderRadius: 20,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: avatarGradientFromName(deal.prospectCompany),
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 600,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {initialsFromName(deal.prospectCompany)}
              </div>
              <span>{deal.prospectCompany}</span>
            </div>
            <span>·</span>
            <span>{deal.forecastCategory ? `${stageLabel(deal.forecastCategory)} forecast` : 'Enterprise account'}</span>
            <span>·</span>
            <span>{deal.closeDate ? formatContextualDate(deal.closeDate) : 'London, UK'}</span>
            <span>·</span>
            <span className="mono" style={{ color: 'var(--ink-4)' }}>{compactDealId(deal.id)}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 32,
              marginTop: 18,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h1 className="page-title" style={{ margin: 0 }}>
                {deal.dealName.includes(',') ? (
                  <>
                    {deal.dealName.split(',')[0]},{' '}
                    <em>{deal.dealName.split(',').slice(1).join(',').trim() || 'enterprise rollout'}</em>
                  </>
                ) : (
                  <>
                    {deal.dealName}, <em>{deal.stage === 'negotiation' ? 'closing motion' : 'enterprise rollout'}</em>
                  </>
                )}
              </h1>
              <div className="page-subtitle">
                {deal.prospectTitle ? `${deal.prospectTitle} relationship in play` : 'Multi-stakeholder deal'} · {deal.contacts?.length ?? 0} contacts · {deal.stage ? stageLabel(deal.stage) : 'Proposal'} stage
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 28,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  color: 'var(--ink)',
                }}
              >
                {formatCurrencyGBP(deal.dealValue ?? null)}
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--ink-4)',
                }}
              >
                Annual contract value
              </div>
            </div>
          </div>

          <div
            className="surface-glass"
            style={{
              marginTop: 20,
              borderRadius: 14,
              padding: '14px 18px',
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto auto auto',
              gap: 20,
              alignItems: 'center',
            }}
          >
            <ScoreCircle score={score} />
            <div style={{ minWidth: 0 }}>
              <AIVoice
                as="div"
                style={{
                  fontSize: 19,
                  lineHeight: 1.35,
                  letterSpacing: '-0.01em',
                }}
              >
                {verdict.split(' ').slice(0, 2).join(' ')} <em style={{ fontStyle: 'italic' }}>{verdict.split(' ').slice(2).join(' ')}</em>
              </AIVoice>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{reasonLine}</div>
            </div>

            <svg width="88" height="32" viewBox="0 0 88 32" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${sparkline} L88,32 L0,32 Z`} fill="url(#sparkFill)" />
              <path d={sparkline} fill="none" stroke="var(--signal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: sevenDayDelta >= 0 ? 'var(--signal)' : 'var(--risk)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <Triangle size={10} fill="currentColor" stroke="none" style={{ transform: sevenDayDelta >= 0 ? 'none' : 'rotate(180deg)' }} />
                {formatDelta(sevenDayDelta)}
              </div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)' }}>
                7D change
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 11px',
                borderRadius: 999,
                background: tone.bg,
                border: `1px solid ${tone.border}`,
                color: tone.text,
                fontSize: 11.5,
                fontWeight: 500,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone.text }} />
              {stageLabel(deal.stage)}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 28px', borderBottom: '1px solid rgba(20, 17, 10, 0.06)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[
            { label: 'Overview', count: undefined, active: true },
            { label: 'Manage', count: openTodos.length || criteria.filter(item => item.status !== 'met').length },
            { label: 'Intelligence', dot: signals.length > 0 },
            { label: 'Conversations', count: notes.length },
            { label: 'Stakeholders', count: stakeholders.length },
            { label: 'Documents' },
            { label: 'History' },
          ].map(tab => (
            <button
              key={tab.label}
              style={{
                padding: '11px 14px',
                fontSize: 12.5,
                color: tab.active ? 'var(--ink)' : 'var(--ink-3)',
                fontWeight: tab.active ? 500 : 450,
                border: 'none',
                borderBottom: tab.active ? '2px solid var(--ink)' : '2px solid transparent',
                marginBottom: -1,
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--ink-4)',
                    background: 'rgba(20, 17, 10, 0.05)',
                    borderRadius: 3,
                    padding: '1px 5px',
                  }}
                >
                  {tab.count}
                </span>
              )}
              {tab.dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--signal)' }} />}
            </button>
          ))}
        </div>

        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 28 }}>
          <section className="fade-in">
            <div
              className="surface-glass-elevated"
              style={{
                position: 'relative',
                borderRadius: 14,
                padding: '24px 26px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: 3,
                  background: 'linear-gradient(180deg, var(--signal) 0%, transparent 100%)',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    borderRadius: 20,
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    padding: '3px 9px',
                    fontSize: 10.5,
                    fontWeight: 500,
                  }}
                >
                  <span
                    className="pulse-dot"
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 'var(--signal)',
                      boxShadow: '0 0 0 2px rgba(29, 184, 106, 0.25)',
                    }}
                  />
                  Morning briefing
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                  Generated {formatRelativeTime(deal.updatedAt)} · based on {signals.length + notes.length} signals
                </span>
              </div>
              <AIVoice
                as="div"
                style={{
                  marginTop: 18,
                  fontSize: 22,
                  lineHeight: 1.4,
                  letterSpacing: '-0.01em',
                  color: 'var(--ink)',
                }}
              >
                {(deal.aiSummary ?? `${deal.prospectCompany} is still moving, but the next action needs to be sharp and executive-ready.`)
                  .replace(/\s+/g, ' ')
                  .trim()}
              </AIVoice>
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 18,
                  borderTop: '1px solid rgba(20, 17, 10, 0.06)',
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {[
                  { label: 'Draft email to stakeholder', action: `Draft an email for ${deal.prospectCompany} that advances ${deal.dealName}.`, icon: Mail },
                  { label: 'Prep next call', action: `Prepare my next call plan for ${deal.dealName}.`, icon: Calendar },
                  { label: 'Remind me tomorrow', action: `Create a reminder plan for ${deal.dealName} tomorrow morning.`, icon: Clock3 },
                ].map(action => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.label}
                      className="surface-glass-light"
                      onClick={() => sendToCopilot(action.action)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11.5,
                      }}
                    >
                      <Icon size={12} strokeWidth={2} />
                      {action.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                Live <em style={{ fontStyle: 'normal', fontWeight: 300, color: 'var(--ink-2)' }}>signals</em>
              </h2>
              <button style={{ border: 'none', background: 'transparent', fontSize: 11.5, color: 'var(--ink-3)' }}>
                View all <ChevronRight size={12} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
            <div className="deal-signals-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {signals.map(signal => {
                const toneColors =
                  signal.tone === 'positive'
                    ? { bg: 'var(--signal-soft)', color: 'var(--signal)' }
                    : signal.tone === 'warn'
                      ? { bg: 'var(--warn-soft)', color: 'var(--warn)' }
                      : signal.tone === 'risk'
                        ? { bg: 'var(--risk-soft)', color: 'var(--risk)' }
                        : { bg: 'var(--cool-soft)', color: 'var(--cool)' }
                const Icon = signal.icon
                return (
                  <div
                    key={`${signal.label}-${signal.meta}`}
                    className="surface-glass"
                    style={{
                      borderRadius: 10,
                      padding: '14px 16px',
                      transition: 'transform 0.16s ease, box-shadow 0.16s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          background: toneColors.bg,
                          color: toneColors.color,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={12} strokeWidth={2} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', flex: 1 }}>{signal.label}</span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10.5,
                          color: signal.weight >= 0 ? 'var(--signal)' : 'var(--risk)',
                        }}
                      >
                        {formatDelta(signal.weight)}
                      </span>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 13, fontWeight: 450, color: 'var(--ink)', lineHeight: 1.45 }}>
                      {signal.body}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--ink-4)' }}>{signal.meta}</div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Manage</h2>
              <button style={{ border: 'none', background: 'transparent', fontSize: 11.5, color: 'var(--ink-3)' }}>
                Edit plan <ChevronRight size={12} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
            <div className="deal-manage-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
              <div className="surface-glass-strong" style={{ borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                    <CheckCheck size={14} strokeWidth={2} />
                    To-dos
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                    {doneTodos.length} of {todos.length || 1} · {formatPercentage(todos.length ? (doneTodos.length / todos.length) * 100 : 0)}
                  </span>
                </div>
                {(todos.length ? todos : [{ text: deal.nextSteps ?? 'Define the next action', source: 'ai', done: false }]).map((todo, index, list) => (
                  <div
                    key={`${todo.id ?? todo.text}-${index}`}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: index === list.length - 1 ? 'none' : '1px solid rgba(20, 17, 10, 0.05)',
                    }}
                  >
                    <div
                      style={{
                        width: 15,
                        height: 15,
                        borderRadius: 4,
                        border: `1.5px solid ${todo.done ? 'var(--signal)' : todo.source === 'ai' ? 'var(--signal)' : 'rgba(20, 17, 10, 0.25)'}`,
                        background: todo.done ? 'var(--signal)' : todo.source === 'ai' ? 'var(--signal-soft)' : 'transparent',
                        marginTop: 2,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {todo.done && <Check size={10} strokeWidth={3} color="#fff" />}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 450,
                          color: todo.done ? 'var(--ink-4)' : 'var(--ink)',
                          textDecoration: todo.done ? 'line-through' : 'none',
                        }}
                      >
                        {todo.text}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-4)' }}>
                        {todo.source === 'ai' && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginRight: 6,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: 'var(--signal-soft)',
                              color: 'var(--signal)',
                              fontSize: 9.5,
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                            }}
                          >
                            AI suggested
                          </span>
                        )}
                        {todo.createdAt ? formatContextualDate(todo.createdAt) : 'Tracked by Halvex'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="surface-glass-strong" style={{ borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                    <Circle size={14} strokeWidth={2} />
                    Success criteria
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                    {criteria.filter(item => item.status === 'met').length} of {criteria.length}
                  </span>
                </div>
                {criteria.map((criterion, index) => {
                  const statusStyle =
                    criterion.status === 'met'
                      ? { bg: 'var(--signal-soft)', color: 'var(--signal)' }
                      : criterion.status === 'partial'
                        ? { bg: 'var(--warn-soft)', color: 'var(--warn)' }
                        : { bg: 'rgba(255,255,255,0.42)', color: 'var(--ink-4)' }
                  return (
                    <div
                      key={`${criterion.label}-${index}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: 12,
                        padding: '10px 0',
                        borderBottom: index === criteria.length - 1 ? 'none' : '1px solid rgba(20, 17, 10, 0.05)',
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          border: criterion.status === 'missing' ? '1px dashed var(--ink-4)' : 'none',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {criterion.status === 'met' ? <Check size={12} strokeWidth={3} /> : criterion.status === 'partial' ? '!' : null}
                      </div>
                      <div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>{criterion.label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>{criterion.sublabel}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                        {criterion.confidence}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                Recent <em style={{ fontStyle: 'normal', fontWeight: 300, color: 'var(--ink-2)' }}>activity</em>
              </h2>
              <button style={{ border: 'none', background: 'transparent', fontSize: 11.5, color: 'var(--ink-3)' }}>
                View full timeline <ChevronRight size={12} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
            <div className="surface-glass-strong" style={{ borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    bottom: 6,
                    left: 7,
                    width: 1,
                    background: 'rgba(20, 17, 10, 0.08)',
                  }}
                />
                {timeline.map((item, index) => {
                  const dotColor =
                    item.kind === 'ai' ? 'var(--signal)' : item.kind === 'meeting' ? 'var(--cool)' : 'var(--ink-2)'
                  return (
                    <div key={`${item.title}-${index}`} style={{ position: 'relative', paddingBottom: index === timeline.length - 1 ? 0 : 18 }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: -24,
                          top: 2,
                          width: 15,
                          height: 15,
                          borderRadius: '50%',
                          border: `2px solid ${dotColor}`,
                          background: item.kind === 'ai' ? dotColor : item.kind === 'meeting' ? dotColor : '#fff',
                          boxShadow: item.kind === 'ai' ? '0 0 0 3px rgba(29, 184, 106, 0.15)' : 'none',
                        }}
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11.5, color: 'var(--ink-3)' }}>
                        <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{item.label}</span>
                        <span>·</span>
                        <span>{item.timestamp}</span>
                        {item.sender && (
                          <>
                            <span>·</span>
                            <span>{item.sender}</span>
                          </>
                        )}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{item.title}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{item.body}</div>
                      {item.insight && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '10px 14px',
                            background: 'rgba(29, 184, 106, 0.06)',
                            border: '1px solid rgba(29, 184, 106, 0.15)',
                            borderLeft: '2px solid var(--signal)',
                            borderRadius: '0 8px 8px 0',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                          }}
                        >
                          <span
                            style={{
                              marginRight: 6,
                              color: 'var(--signal)',
                              fontSize: 9.5,
                              fontWeight: 600,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {item.insight.label}
                          </span>
                          <AIVoice as="span" style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--ink-2)' }}>
                            {item.insight.text}
                          </AIVoice>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      </div>

      <aside className="deal-right-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 14,
            padding: '16px 18px',
            color: 'var(--bg)',
            background: 'linear-gradient(135deg, var(--ink) 0%, #2A2822 100%)',
            boxShadow: '0 16px 40px rgba(20, 17, 10, 0.16)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '-24px -24px auto auto',
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(29, 184, 106, 0.15) 0%, transparent 72%)',
              filter: 'blur(20px)',
            }}
          />
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(250, 250, 247, 0.6)',
            }}
          >
            <Sparkles size={10} strokeWidth={2.5} />
            Recommended next action
          </div>
          <AIVoice as="div" style={{ position: 'relative', marginTop: 12, fontSize: 17, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
            {deal.nextSteps ? `Send the ${deal.nextSteps.toLowerCase()}.` : 'Tighten the next action and share it with the buying team before momentum cools.'}
          </AIVoice>
          <div style={{ position: 'relative', marginTop: 14, display: 'flex', gap: 8 }}>
            <button
              onClick={() => sendToCopilot(`Draft the next-action message for ${deal.dealName}.`)}
              style={{
                flex: 1,
                padding: '5px 10px',
                borderRadius: 5,
                border: 'none',
                background: 'var(--signal)',
                color: 'var(--bg)',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Draft now
            </button>
            <button
              onClick={() => sendToCopilot(`What should I do if I skip the current next action on ${deal.dealName}?`)}
              style={{
                flex: 1,
                padding: '5px 10px',
                borderRadius: 5,
                border: '1px solid rgba(250, 250, 247, 0.15)',
                background: 'rgba(250, 250, 247, 0.1)',
                color: 'var(--bg)',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              Skip
            </button>
          </div>
        </div>

        <div className="surface-glass-strong" style={{ borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="section-label">Stakeholders</span>
            <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{stakeholders.length} · map →</span>
          </div>
          {stakeholders.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>No stakeholders mapped yet.</div>
          ) : (
            stakeholders.map(person => (
              <div
                key={`${person.name}-${person.role}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(20, 17, 10, 0.05)',
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: avatarGradientFromName(person.name),
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {initialsFromName(person.name)}
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>{person.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>{person.role}</div>
                </div>
                <div
                  className={person.sentiment === 'positive' ? 'sentiment-ripple' : undefined}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: person.sentiment === 'positive' ? 'var(--signal)' : 'var(--ink-4)',
                  }}
                />
              </div>
            ))
          )}
        </div>

        <div className="surface-glass-strong" style={{ borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="section-label">Close forecast</span>
            <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Model →</span>
          </div>
          {[
            { label: 'Quarter this', value: score, gradient: 'linear-gradient(90deg, #1DB86A 0%, #69D59F 100%)' },
            { label: 'Quarter next', value: Math.max(5, 100 - score - 12), gradient: 'linear-gradient(90deg, #C4621B 0%, #E8A05E 100%)' },
            { label: 'Lost', value: Math.max(3, 100 - score), gradient: 'linear-gradient(90deg, #B23A3A 0%, #D86B6B 100%)' },
          ].map(row => (
            <div key={row.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{formatPercentage(row.value)}</span>
              </div>
              <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'rgba(20, 17, 10, 0.06)' }}>
                <div style={{ width: `${Math.min(100, row.value)}%`, height: 4, borderRadius: 999, background: row.gradient }} />
              </div>
            </div>
          ))}
        </div>

        <div className="surface-glass-strong" style={{ borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="section-label">Competitor mentions</span>
            <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>30d</span>
          </div>
          {competitorMentions.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>No competitor mentions in this deal yet.</div>
          ) : (
            competitorMentions.map(name => (
              <div
                key={name}
                className="surface-glass-light"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  borderRadius: 6,
                  padding: '8px 10px',
                  marginBottom: 8,
                }}
              >
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                  1 <MoveUpRight size={10} style={{ verticalAlign: 'middle' }} />
                </span>
              </div>
            ))
          )}
        </div>

        <div className="surface-glass-strong" style={{ borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="section-label">Automations active</span>
            <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{automationList.length || 0} running</span>
          </div>
          {(automationList.length ? automationList : [{ id: 'briefing', name: 'Morning briefing', category: 'intelligence' }]).map(item => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr',
                gap: 10,
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid rgba(20, 17, 10, 0.05)',
              }}
            >
              <div
                className="surface-glass-light"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Bot size={12} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>{item.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>
                  {item.category === 'alerts' ? 'Alerts' : 'Intelligence'} · active now
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <style>{`
        @media (max-width: 1180px) {
          .deal-workspace-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .deal-workspace-main {
            border-right: none !important;
            border-bottom: 1px solid rgba(20, 17, 10, 0.06);
          }

          .deal-right-panel {
            padding-top: 0 !important;
          }
        }

        @media (max-width: 900px) {
          .deal-signals-grid,
          .deal-manage-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
