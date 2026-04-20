'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowUpRight,
  Calendar,
  Check,
  CheckCheck,
  ChevronRight,
  Circle,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  MoveUpRight,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Triangle,
  Users,
  X,
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
  humanizeActivityLabel,
  initialsFromName,
} from '@/lib/presentation'

type WorkspaceTab =
  | 'overview'
  | 'manage'
  | 'intelligence'
  | 'conversations'
  | 'stakeholders'
  | 'documents'
  | 'history'

type DealContact = {
  name: string
  title?: string | null
  email?: string | null
}

type DealTodo = {
  id: string
  text: string
  done: boolean
  source?: 'manual' | 'ai'
  priority?: 'low' | 'normal' | 'high'
  createdAt?: string
}

type SuccessCriterion = {
  id: string
  text: string
  category?: string
  achieved?: boolean
  assignee?: string
  note?: string
  createdAt?: string
}

type ProjectPlanTask = {
  id: string
  text: string
  status?: 'not_started' | 'in_progress' | 'complete'
  owner?: string | null
  assignee?: string | null
  dueDate?: string | null
  linkedTodoId?: string | null
  notes?: string | null
}

type ProjectPlanPhase = {
  id: string
  name: string
  description?: string | null
  order?: number
  targetDate?: string | null
  tasks?: ProjectPlanTask[]
}

type ProjectPlan = {
  title?: string | null
  createdAt?: string
  updatedAt?: string
  sourceText?: string | null
  phases?: ProjectPlanPhase[]
}

type DealLinkType =
  | 'proposal'
  | 'contract'
  | 'deck'
  | 'document'
  | 'sharepoint'
  | 'google'
  | 'salesforce'
  | 'notion'
  | 'figma'
  | 'github'
  | 'other'

type DealLink = {
  id: string
  url: string
  label: string
  type: DealLinkType
  addedAt?: string
  addedBy?: string
}

type DealRecord = {
  id: string
  dealName: string
  prospectCompany: string
  prospectName?: string | null
  prospectTitle?: string | null
  description?: string | null
  contacts?: DealContact[] | null
  stage: string
  dealValue?: number | null
  dealType?: 'one_off' | 'recurring'
  recurringInterval?: 'monthly' | 'quarterly' | 'annual' | null
  forecastCategory?: 'commit' | 'upside' | 'pipeline' | 'omit' | null
  closeDate?: string | null
  wonDate?: string | null
  lostDate?: string | null
  nextSteps?: string | null
  meetingNotes?: string | null
  notes?: string | null
  aiSummary?: string | null
  conversionScore?: number | null
  conversionInsights?: string[] | null
  dealRisks?: string[] | null
  competitors?: string[] | null
  todos?: DealTodo[] | null
  scoreHistory?: Array<{ score?: number; date?: string }> | null
  successCriteria?: string | null
  successCriteriaTodos?: SuccessCriterion[] | null
  projectPlan?: ProjectPlan | null
  links?: DealLink[] | null
  engagementType?: string | null
  contractEndDate?: string | null
  dealShareToken?: string | null
  dealIsShared?: boolean
  updatedAt?: string
  createdAt?: string
}

type BrainPrediction = {
  dealId: string
  winProbability?: number
  churnRisk?: number
  churnDaysOverdue?: number
}

type BrainData = {
  updatedAt?: string
  mlPredictions?: BrainPrediction[]
}

type BriefResponse = {
  brief: string | null
  generatedAt: string | null
}

type StakeholderMap = {
  stakeholders: Array<{
    name: string
    title: string | null
    role: 'Champion' | 'Economic Buyer' | 'Technical Evaluator' | 'Blocker' | 'Coach' | 'End User'
    influence: 'high' | 'medium' | 'low'
    sentiment: 'positive' | 'neutral' | 'negative' | 'unknown'
    engagement: 'active' | 'passive' | 'disengaged'
    concerns: string[]
    action: string
    reportsTo: string | null
    influencedBy: string[]
  }>
  gaps: string[]
  recommendation: string
  generatedAt: string
}

type ComposeEmailResponse = {
  subject: string
  body: string
}

type AiActivityItem = {
  id: string
  actionType: string
  triggeredBy?: string
  status?: string
  payload?: Record<string, unknown> | null
  result?: Record<string, unknown> | null
  createdAt: string
}

type NoteEntry = {
  id: string
  text: string
  title: string
  dateLabel: string
  iso: string | null
}

type TimelineItem = {
  id: string
  kind: 'ai' | 'meeting' | 'email'
  label: string
  timestamp: string
  sender?: string
  title: string
  body: string
  insight?: string
}

type SignalCard = {
  label: string
  body: string
  meta: string
  weight: number
  tone: 'positive' | 'warn' | 'risk' | 'info'
  icon: typeof Sparkles
}

type ToastState = {
  kind: 'success' | 'error'
  message: string
} | null

const DOCUMENT_TYPES: Array<{ value: DealLinkType; label: string }> = [
  { value: 'document', label: 'Document' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'contract', label: 'Contract' },
  { value: 'deck', label: 'Deck' },
  { value: 'notion', label: 'Notion' },
  { value: 'google', label: 'Google' },
  { value: 'sharepoint', label: 'SharePoint' },
  { value: 'figma', label: 'Figma' },
  { value: 'github', label: 'GitHub' },
  { value: 'salesforce', label: 'Salesforce' },
  { value: 'other', label: 'Other' },
]

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((json as { error?: string }).error ?? 'Request failed')
  }
  return json as T
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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

function ensureSentence(value?: string | null) {
  if (!value?.trim()) return ''
  const trimmed = value.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function splitMeetingNotes(notes?: string | null): NoteEntry[] {
  if (!notes?.trim()) return []

  return notes
    .trim()
    .split(/\n{2,}(?=\[\d{4}-\d{2}-\d{2}\])/)
    .map((chunk, index) => {
      const match = chunk.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*([\s\S]*)$/)
      const text = (match?.[2] ?? chunk).trim()
      const title = text.split(/\n|[.!?]/).find(Boolean)?.trim() ?? 'Meeting update'
      return {
        id: `${match?.[1] ?? 'note'}-${index}`,
        text,
        title,
        iso: match?.[1] ? `${match[1]}T09:00:00.000Z` : null,
        dateLabel: match?.[1] ? formatContextualDate(`${match[1]}T09:00:00.000Z`) : 'Recent',
      }
    })
    .filter(entry => entry.text.length > 0)
    .reverse()
}

function scoreTrend(history: Array<{ score?: number; date?: string }> = [], currentScore: number) {
  const values = history
    .map(point => point.score)
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))

  if (values.length === 0) {
    return [Math.max(18, currentScore - 20), currentScore - 10, currentScore - 6, currentScore]
  }
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

function buildSignals(deal: DealRecord, notes: NoteEntry[], prediction?: BrainPrediction | null): SignalCard[] {
  const cards: SignalCard[] = []
  const summary = [deal.aiSummary, ...(deal.conversionInsights ?? [])].filter(Boolean).join(' ')
  const noteBlob = [summary, deal.meetingNotes ?? '', ...(deal.dealRisks ?? [])].join(' ').toLowerCase()
  const competitor = deal.competitors?.[0]

  if (deal.contacts?.length) {
    cards.push({
      label: 'Champion momentum',
      body: `${deal.contacts[0]?.name} is still active in the thread and giving Halvex live signal to work with.`,
      meta: `${deal.contacts.length} stakeholders mapped`,
      weight: 8,
      tone: 'positive',
      icon: Users,
    })
  }

  if (deal.nextSteps?.trim()) {
    cards.push({
      label: 'Action clarity',
      body: ensureSentence(deal.nextSteps),
      meta: 'Next step captured',
      weight: 6,
      tone: 'positive',
      icon: Send,
    })
  }

  if ((prediction?.winProbability ?? 0) > 0.65 || (deal.conversionScore ?? 0) >= 70) {
    cards.push({
      label: 'Close confidence',
      body: 'This deal is tracking with late-stage intent and enough signal to support a clean push this quarter.',
      meta: prediction?.winProbability ? `${Math.round(prediction.winProbability * 100)}% model confidence` : `${deal.conversionScore ?? 0} score`,
      weight: 10,
      tone: 'positive',
      icon: ArrowUpRight,
    })
  }

  if (noteBlob.includes('finance') || noteBlob.includes('budget') || noteBlob.includes('procurement')) {
    cards.push({
      label: 'Buying motion',
      body: 'Finance and procurement language is surfacing in recent context, which usually means the deal is tightening commercially.',
      meta: formatContextualDate(deal.updatedAt),
      weight: 7,
      tone: 'positive',
      icon: Sparkles,
    })
  }

  if (noteBlob.includes('security') || noteBlob.includes('sso') || noteBlob.includes('integration')) {
    cards.push({
      label: 'Unresolved objection',
      body: 'Technical diligence is still open and needs a direct answer before the next stage move.',
      meta: 'Open blocker',
      weight: -6,
      tone: 'warn',
      icon: MessageSquare,
    })
  }

  if ((prediction?.churnRisk ?? 0) >= 50) {
    cards.push({
      label: 'Attention risk',
      body: `Modelled churn risk is ${prediction?.churnRisk}% and the deal likely needs a decisive next touch.`,
      meta: prediction?.churnDaysOverdue ? `${prediction.churnDaysOverdue} days overdue` : 'Model signal',
      weight: -8,
      tone: 'risk',
      icon: Clock3,
    })
  }

  if (competitor) {
    cards.push({
      label: 'Competitor mentioned',
      body: `${competitor} appears in the deal context and should be handled with proof points before the next conversation.`,
      meta: 'Competitive pressure',
      weight: -5,
      tone: 'risk',
      icon: Sparkles,
    })
  }

  if (notes.length > 0) {
    cards.push({
      label: 'Conversation freshness',
      body: 'Recent notes give Halvex enough context to keep briefing and prioritisation current.',
      meta: `${notes.length} updates logged`,
      weight: 4,
      tone: 'info',
      icon: Clock3,
    })
  }

  return cards.slice(0, 6)
}

function buildFallbackCriteria(deal: DealRecord) {
  return [
    {
      id: 'criterion-buyer',
      text: 'Economic buyer identified',
      category: 'Buying team',
      achieved: Boolean(deal.contacts?.[0]?.name),
      note: deal.contacts?.[0]?.name ? `${deal.contacts[0].name} is already involved` : 'No buyer is named yet',
    },
    {
      id: 'criterion-budget',
      text: 'Commercial value captured',
      category: 'Commercial',
      achieved: Boolean(deal.dealValue),
      note: deal.dealValue ? formatCurrencyGBP(deal.dealValue) : 'Value still missing',
    },
    {
      id: 'criterion-risk',
      text: 'Technical fit validated',
      category: 'Technical',
      achieved: !(deal.dealRisks?.length ?? 0),
      note: (deal.dealRisks?.length ?? 0) > 0 ? `${deal.dealRisks?.length ?? 0} blocker(s) still open` : 'No active blockers logged',
    },
  ]
}

function buildStakeholders(deal: DealRecord, stakeholderMap?: StakeholderMap | null) {
  if (stakeholderMap?.stakeholders?.length) {
    return stakeholderMap.stakeholders.map(stakeholder => ({
      name: stakeholder.name,
      role: stakeholder.title ? `${stakeholder.title} · ${stakeholder.role}` : stakeholder.role,
      sentiment:
        stakeholder.sentiment === 'positive'
          ? 'positive'
          : stakeholder.sentiment === 'negative'
            ? 'negative'
            : stakeholder.engagement === 'disengaged'
              ? 'cold'
              : 'neutral',
      concern: stakeholder.concerns[0] ?? null,
      action: stakeholder.action,
    }))
  }

  const primary = deal.prospectName
    ? [
        {
          name: deal.prospectName,
          role: deal.prospectTitle ?? 'Primary contact',
          sentiment: (deal.dealRisks?.length ?? 0) > 0 ? 'neutral' : 'positive',
          concern: deal.dealRisks?.[0] ?? null,
          action: ensureSentence(deal.nextSteps) || 'Name the next action clearly.',
        },
      ]
    : []

  const contacts = (deal.contacts ?? []).map(contact => ({
    name: contact.name,
    role: contact.title ?? 'Stakeholder',
    sentiment: (deal.dealRisks?.length ?? 0) > 0 ? 'neutral' : 'positive',
    concern: deal.dealRisks?.[0] ?? null,
    action: ensureSentence(deal.nextSteps) || 'Clarify the next action.',
  }))

  return [...primary, ...contacts].slice(0, 7)
}

function countMentions(haystack: string, needle: string) {
  if (!haystack || !needle) return 0
  const matches = haystack.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'))
  return matches?.length ?? 0
}

function buildForecastRows(deal: DealRecord, prediction?: BrainPrediction | null) {
  const win = clamp(
    Math.round(
      prediction?.winProbability != null
        ? prediction.winProbability * 100
        : deal.conversionScore ?? 58
    ),
    6,
    92,
  )
  const lateStage = ['proposal', 'negotiation'].includes(deal.stage)
  const slip = clamp(Math.round((100 - win) * (lateStage ? 0.45 : 0.62)), 5, 60)
  const lost = clamp(100 - win - slip, 3, 45)

  return [
    {
      label: 'Q2 (this quarter)',
      value: win,
      gradient: 'linear-gradient(90deg, #1DB86A 0%, #69D59F 100%)',
    },
    {
      label: 'Q3 (slips)',
      value: slip,
      gradient: 'linear-gradient(90deg, #C4621B 0%, #E8A05E 100%)',
    },
    {
      label: 'Lost / stalled',
      value: lost,
      gradient: 'linear-gradient(90deg, #B23A3A 0%, #D86B6B 100%)',
    },
  ]
}

function buildTimeline(
  deal: DealRecord,
  notes: NoteEntry[],
  aiActivity: AiActivityItem[],
  recommendedAction: string,
): TimelineItem[] {
  const timeline: TimelineItem[] = []

  timeline.push({
    id: 'timeline-ai',
    kind: 'ai',
    label: 'AI briefing',
    timestamp: formatRelativeTime(deal.updatedAt),
    title: `Halvex refreshed the deal outlook for ${deal.prospectCompany}.`,
    body: deal.aiSummary ?? 'Halvex is blending note signal, deal score, and stakeholder coverage.',
    insight: recommendedAction,
  })

  notes.slice(0, 2).forEach((entry, index) => {
    timeline.push({
      id: entry.id,
      kind: index === 0 ? 'email' : 'meeting',
      label: index === 0 ? 'Latest update' : 'Meeting history',
      timestamp: entry.dateLabel,
      sender: deal.contacts?.[0]?.name ?? deal.prospectName ?? undefined,
      title: entry.title,
      body: entry.text,
      insight: index === 0 ? ensureSentence(deal.nextSteps) : undefined,
    })
  })

  aiActivity.slice(0, 2).forEach(item => {
    timeline.push({
      id: item.id,
      kind: item.actionType.includes('email') ? 'email' : 'ai',
      label: 'AI activity',
      timestamp: formatRelativeTime(item.createdAt),
      title: humanizeActivityLabel(item.actionType, item.payload ?? {}, deal.dealName),
      body: item.status ? `Status: ${item.status}` : 'Halvex recorded an internal action against this deal.',
    })
  })

  return timeline.slice(0, 5)
}

function recommendedActionText(deal: DealRecord, notes: NoteEntry[]) {
  const latestContext = [deal.nextSteps, deal.dealRisks?.[0], notes[0]?.text]
    .filter(Boolean)
    .join(' ')

  if (/sso|security|integration/i.test(latestContext)) {
    return 'Send the technical brief and resolve the open integration question before the next follow-up call.'
  }

  if (deal.nextSteps?.trim()) {
    return ensureSentence(deal.nextSteps)
  }

  if ((deal.dealRisks?.length ?? 0) > 0) {
    return `Address the open blocker around ${deal.dealRisks?.[0]?.toLowerCase() ?? 'technical diligence'} before momentum cools.`
  }

  return `Create a named follow-up for ${deal.prospectCompany} this week so the deal keeps moving.`
}

function titleParts(value: string, stage: string) {
  if (value.includes(',')) {
    return {
      lead: value.split(',')[0],
      tail: value.split(',').slice(1).join(',').trim(),
    }
  }

  return {
    lead: value,
    tail: ['proposal', 'negotiation'].includes(stage) ? 'closing motion' : 'enterprise rollout',
  }
}

function scoreVerdict(score: number) {
  if (score >= 75) return 'Likely to close this quarter'
  if (score >= 60) return 'Still live with momentum'
  return 'Needs intervention this week'
}

function scoreReasonLine(deal: DealRecord) {
  return [
    deal.contacts?.length ? `${deal.contacts.length} stakeholders mapped` : null,
    deal.dealValue ? 'Commercial value captured' : null,
    (deal.dealRisks?.length ?? 0) > 0 ? `${deal.dealRisks?.length ?? 0} open blocker${(deal.dealRisks?.length ?? 0) > 1 ? 's' : ''}` : 'No active blockers logged',
  ]
    .filter(Boolean)
    .join(' · ')
}

function EmptyPanel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div
      style={{
        border: '1px dashed rgba(20, 17, 10, 0.14)',
        borderRadius: 'var(--radius)',
        padding: '18px',
        background: 'rgba(255, 255, 255, 0.3)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>{body}</div>
      {actionLabel && onAction ? (
        <button className="action-chip" style={{ marginTop: 14 }} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

function SectionHeader({
  title,
  accent,
  action,
  onAction,
}: {
  title: string
  accent?: string
  action?: string
  onAction?: () => void
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
        <button className="section-action" onClick={onAction}>
          {action}
          <ChevronRight size={12} />
        </button>
      ) : null}
    </div>
  )
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

function TimelineList({ items }: { items: TimelineItem[] }) {
  return (
    <div className="timeline">
      {items.map(item => (
        <div key={item.id} className="timeline-item">
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
              <span className="timeline-insight-label">AI takeaway</span>
              <AIVoice as="span">{item.insight}</AIVoice>
            </div>
          ) : null}
        </div>
      ))}
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
          <div className="manage-grid">
            <div className="manage-card skeleton" style={{ height: 200 }} />
            <div className="manage-card skeleton" style={{ height: 200 }} />
          </div>
        </div>
      </div>
      <aside className="right-panel">
        <div className="panel-section skeleton" style={{ height: 220 }} />
        <div className="panel-section skeleton" style={{ height: 200 }} />
      </aside>
    </div>
  )
}

function EmailComposerModal({
  open,
  loading,
  data,
  primaryEmail,
  onClose,
  onCopy,
  onRegenerate,
}: {
  open: boolean
  loading: boolean
  data: ComposeEmailResponse | null
  primaryEmail?: string | null
  onClose: () => void
  onCopy: () => void
  onRegenerate: (tone: 'professional' | 'friendly' | 'urgent') => void
}) {
  if (!open) return null

  const mailto =
    primaryEmail && data
      ? `mailto:${primaryEmail}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.body)}`
      : null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(20, 17, 10, 0.22)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <div
        className="panel-section"
        style={{
          width: 'min(720px, 100%)',
          maxHeight: 'min(88vh, 900px)',
          overflow: 'auto',
          padding: 24,
          boxShadow: 'var(--glass-shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>Follow-up email</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.03em' }}>
              Draft an exact next-step email
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
              Uses current deal notes, stage, next steps, and risks.
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { label: 'Professional', tone: 'professional' as const },
            { label: 'Friendly', tone: 'friendly' as const },
            { label: 'Urgent', tone: 'urgent' as const },
          ].map(option => (
            <button key={option.tone} className="action-chip" onClick={() => onRegenerate(option.tone)}>
              <RefreshCw size={12} strokeWidth={2} />
              {option.label}
            </button>
          ))}
          <button className="action-chip" onClick={onCopy} disabled={loading || !data}>
            <Copy size={12} strokeWidth={2} />
            Copy draft
          </button>
          {mailto ? (
            <a href={mailto} className="action-chip">
              <Send size={12} strokeWidth={2} />
              Open in email
            </a>
          ) : null}
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 240, color: 'var(--ink-3)', gap: 10 }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Generating a personalised follow-up...</span>
          </div>
        ) : data ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="surface-glass-light" style={{ padding: 14, borderRadius: 'var(--radius)' }}>
              <div className="section-label" style={{ marginBottom: 6 }}>Subject</div>
              <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{data.subject}</div>
            </div>
            <div className="surface-glass-light" style={{ padding: 14, borderRadius: 'var(--radius)' }}>
              <div className="section-label" style={{ marginBottom: 6 }}>Body</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{data.body}</div>
            </div>
          </div>
        ) : (
          <EmptyPanel
            title="No draft generated yet"
            body="Kick off a draft from the Morning briefing actions or the Conversations tab."
          />
        )}
      </div>
    </div>
  )
}

function TodoListPanel({
  deal,
  onPatchDeal,
  onGenerateAiTasks,
}: {
  deal: DealRecord
  onPatchDeal: (fields: Partial<DealRecord>) => Promise<void>
  onGenerateAiTasks: () => Promise<void>
}) {
  const todos = deal.todos ?? []
  const doneTodos = todos.filter(todo => todo.done)
  const openTodos = todos.filter(todo => !todo.done)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)

  async function saveTodos(nextTodos: DealTodo[]) {
    setBusy(true)
    try {
      await onPatchDeal({ todos: nextTodos })
    } finally {
      setBusy(false)
    }
  }

  async function addTodo(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.trim()) return
    const nextTodo: DealTodo = {
      id: crypto.randomUUID(),
      text: draft.trim(),
      done: false,
      source: 'manual',
      createdAt: new Date().toISOString(),
    }
    await saveTodos([nextTodo, ...todos])
    setDraft('')
  }

  async function toggleTodo(id: string) {
    await saveTodos(todos.map(todo => (todo.id === id ? { ...todo, done: !todo.done } : todo)))
  }

  async function deleteTodo(id: string) {
    await saveTodos(todos.filter(todo => todo.id !== id))
  }

  async function generateAiTasks() {
    setAiBusy(true)
    try {
      await onGenerateAiTasks()
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div className="manage-card">
      <div className="manage-head">
        <div className="manage-title">
          <CheckCheck size={14} strokeWidth={2} />
          Tasks
        </div>
        <span className="progress-meta">
          {doneTodos.length} of {Math.max(todos.length, 1)} · {formatPercentage(todos.length ? (doneTodos.length / todos.length) * 100 : 0)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="action-chip" onClick={generateAiTasks} disabled={aiBusy}>
          {aiBusy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} strokeWidth={2} />}
          AI tasks
        </button>
      </div>

      <form onSubmit={addTodo} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder="Add an action item..."
          className="glass-input"
          style={{ flex: 1, padding: '8px 10px' }}
        />
        <button type="submit" className="action-chip" disabled={busy || !draft.trim()}>
          <Plus size={12} strokeWidth={2} />
          Add
        </button>
      </form>

      {todos.length === 0 ? (
        <EmptyPanel
          title="No tasks yet"
          body="Tasks can be generated from notes or added manually so the rep always has a next move."
        />
      ) : (
        <div style={{ display: 'grid', gap: 2 }}>
          {[...openTodos, ...doneTodos].map(todo => (
            <div key={todo.id} className="todo-item">
              <button
                type="button"
                className={`todo-check${todo.done ? ' done' : ''}${todo.source === 'ai' && !todo.done ? ' ai' : ''}`}
                onClick={() => toggleTodo(todo.id)}
              >
                {todo.done ? <Check size={10} strokeWidth={3} color="#fff" /> : null}
              </button>
              <div className="todo-body">
                <div className={`todo-text${todo.done ? ' done' : ''}`}>{todo.text}</div>
                <div className="todo-sub">
                  {todo.source === 'ai' ? <span className="ai-tag">AI</span> : null}
                  <span>{todo.createdAt ? formatContextualDate(todo.createdAt) : 'Tracked by Halvex'}</span>
                </div>
              </div>
              <button className="icon-btn" type="button" onClick={() => deleteTodo(todo.id)}>
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectPlanPanel({
  deal,
  onRefresh,
}: {
  deal: DealRecord
  onRefresh: () => Promise<void>
}) {
  const phases = deal.projectPlan?.phases ?? []
  const totalTasks = phases.flatMap(phase => phase.tasks ?? []).length
  const completeTasks = phases.flatMap(phase => phase.tasks ?? []).filter(task => task.status === 'complete').length
  const [pasteText, setPasteText] = useState('')
  const [phaseDraft, setPhaseDraft] = useState('')
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function generatePlan() {
    if (!pasteText.trim()) return
    setBusy(true)
    try {
      await requestJson(`/api/deals/${deal.id}/project-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText.trim() }),
      })
      setPasteText('')
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function addPhase() {
    if (!phaseDraft.trim()) return
    setBusy(true)
    try {
      await requestJson(`/api/deals/${deal.id}/project-plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addPhase: { name: phaseDraft.trim() } }),
      })
      setPhaseDraft('')
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function addTask(phaseId: string) {
    const text = taskDrafts[phaseId]?.trim()
    if (!text) return
    setBusy(true)
    try {
      await requestJson(`/api/deals/${deal.id}/project-plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phaseId, addTask: text }),
      })
      setTaskDrafts(current => ({ ...current, [phaseId]: '' }))
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function updateTask(taskId: string, updates: Record<string, unknown>) {
    setBusy(true)
    try {
      await requestJson(`/api/deals/${deal.id}/project-plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, ...updates }),
      })
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function deleteTask(taskId: string) {
    setBusy(true)
    try {
      await requestJson(`/api/deals/${deal.id}/project-plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteTaskId: taskId }),
      })
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  function nextStatus(status?: ProjectPlanTask['status']) {
    if (status === 'not_started') return 'in_progress'
    if (status === 'in_progress') return 'complete'
    return 'not_started'
  }

  return (
    <div className="panel-section" style={{ padding: 18 }}>
      <div className="manage-head">
        <div className="manage-title">
          <Calendar size={14} strokeWidth={2} />
          Project plan
        </div>
        <span className="progress-meta">
          {completeTasks}/{Math.max(totalTasks, 1)} complete
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <textarea
          value={pasteText}
          onChange={event => setPasteText(event.target.value)}
          rows={4}
          className="glass-input"
          placeholder="Paste an implementation plan, timeline, or milestone list and Halvex will structure it."
          style={{ padding: 10, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="action-chip" onClick={generatePlan} disabled={busy || !pasteText.trim()}>
            {busy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} strokeWidth={2} />}
            Generate plan
          </button>
          <input
            value={phaseDraft}
            onChange={event => setPhaseDraft(event.target.value)}
            placeholder="Add phase..."
            className="glass-input"
            style={{ minWidth: 180, padding: '8px 10px' }}
          />
          <button className="action-chip" onClick={addPhase} disabled={busy || !phaseDraft.trim()}>
            <Plus size={12} strokeWidth={2} />
            Add phase
          </button>
        </div>
      </div>

      {phases.length === 0 ? (
        <EmptyPanel
          title="No project plan yet"
          body="Paste the onboarding plan, POC milestones, or rollout timeline to turn it into a live execution view."
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {phases.map(phase => (
            <div key={phase.id} className="surface-glass-light" style={{ padding: 14, borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{phase.name}</div>
                  {phase.description ? (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{phase.description}</div>
                  ) : null}
                </div>
                {phase.targetDate ? (
                  <span className="notion-chip">{formatContextualDate(phase.targetDate)}</span>
                ) : null}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {(phase.tasks ?? []).map(task => (
                  <div key={task.id} className="todo-item" style={{ padding: '6px 0', borderBottom: '1px solid rgba(20, 17, 10, 0.05)' }}>
                    <button
                      type="button"
                      className={`todo-check${task.status === 'complete' ? ' done' : ''}${task.status === 'in_progress' ? ' ai' : ''}`}
                      onClick={() => updateTask(task.id, { status: nextStatus(task.status) })}
                    >
                      {task.status === 'complete' ? <Check size={10} strokeWidth={3} color="#fff" /> : null}
                    </button>
                    <div className="todo-body">
                      <div className={`todo-text${task.status === 'complete' ? ' done' : ''}`}>{task.text}</div>
                      <div className="todo-sub">
                        {task.owner ? <span>{task.owner}</span> : null}
                        {task.dueDate ? <span>{formatContextualDate(task.dueDate)}</span> : null}
                      </div>
                    </div>
                    <button className="icon-btn" type="button" onClick={() => deleteTask(task.id)}>
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input
                  value={taskDrafts[phase.id] ?? ''}
                  onChange={event => setTaskDrafts(current => ({ ...current, [phase.id]: event.target.value }))}
                  placeholder="Add task..."
                  className="glass-input"
                  style={{ flex: 1, padding: '8px 10px' }}
                />
                <button className="action-chip" onClick={() => addTask(phase.id)} disabled={busy || !(taskDrafts[phase.id] ?? '').trim()}>
                  <Plus size={12} strokeWidth={2} />
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CriteriaPanel({
  deal,
  onPatchDeal,
  onRefresh,
}: {
  deal: DealRecord
  onPatchDeal: (fields: Partial<DealRecord>) => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const hasStructuredCriteria = Boolean(deal.successCriteriaTodos?.length)
  const criteria = (deal.successCriteriaTodos?.length ? deal.successCriteriaTodos : buildFallbackCriteria(deal)) as SuccessCriterion[]
  const [pasteText, setPasteText] = useState('')
  const [manualText, setManualText] = useState('')
  const [busy, setBusy] = useState(false)

  async function extractCriteria() {
    if (!pasteText.trim()) return
    setBusy(true)
    try {
      await requestJson(`/api/deals/${deal.id}/success-criteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText.trim() }),
      })
      setPasteText('')
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function toggleCriterion(criterion: SuccessCriterion) {
    setBusy(true)
    try {
      await requestJson(`/api/deals/${deal.id}/success-criteria`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criterionId: criterion.id, achieved: !criterion.achieved }),
      })
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function deleteCriterion(id: string) {
    if (!deal.successCriteriaTodos?.length) return
    setBusy(true)
    try {
      await requestJson(`/api/deals/${deal.id}/success-criteria`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criterionId: id }),
      })
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function addManualCriterion() {
    if (!manualText.trim()) return
    const updated = [
      ...(deal.successCriteriaTodos ?? []),
      {
        id: crypto.randomUUID(),
        text: manualText.trim(),
        category: 'Manual',
        achieved: false,
        note: '',
        createdAt: new Date().toISOString(),
      },
    ]
    setBusy(true)
    try {
      await onPatchDeal({ successCriteriaTodos: updated })
      setManualText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel-section" style={{ padding: 18 }}>
      <div className="manage-head">
        <div className="manage-title">
          <Circle size={14} strokeWidth={2} />
          Success criteria
        </div>
        <span className="progress-meta">
          {criteria.filter(item => item.achieved).length}/{criteria.length} met
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
        <textarea
          value={pasteText}
          onChange={event => setPasteText(event.target.value)}
          rows={3}
          className="glass-input"
          placeholder="Paste proposal requirements or test criteria and Halvex will structure them."
          style={{ padding: 10, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="action-chip" onClick={extractCriteria} disabled={busy || !pasteText.trim()}>
            {busy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} strokeWidth={2} />}
            Extract criteria
          </button>
          <input
            value={manualText}
            onChange={event => setManualText(event.target.value)}
            placeholder="Add criterion manually..."
            className="glass-input"
            style={{ minWidth: 220, padding: '8px 10px' }}
          />
          <button className="action-chip" onClick={addManualCriterion} disabled={busy || !manualText.trim()}>
            <Plus size={12} strokeWidth={2} />
            Add
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 2 }}>
        {criteria.map(criterion => {
          const statusClass = criterion.achieved ? 'met' : 'missing'
          return (
            <div key={criterion.id} className="criteria-row">
              {hasStructuredCriteria ? (
                <button
                  type="button"
                  className={`criteria-status ${statusClass}`}
                  onClick={() => toggleCriterion(criterion)}
                  style={{ border: 'none', cursor: 'pointer' }}
                >
                  {criterion.achieved ? <Check size={12} strokeWidth={3} /> : null}
                </button>
              ) : (
                <div className={`criteria-status ${statusClass}`}>
                  {criterion.achieved ? <Check size={12} strokeWidth={3} /> : null}
                </div>
              )}
              <div>
                <div className="criteria-label">{criterion.text}</div>
                <div className="criteria-sub">{criterion.note || criterion.category || 'Tracked by Halvex'}</div>
              </div>
              {hasStructuredCriteria ? (
                <button className="icon-btn" type="button" onClick={() => deleteCriterion(criterion.id)}>
                  <Trash2 size={13} strokeWidth={1.8} />
                </button>
              ) : (
                <span className="criteria-confidence">{criterion.category ?? 'Baseline'}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MeetingPrepPanel({
  prep,
  loading,
  onGenerate,
}: {
  prep: string | null
  loading: boolean
  onGenerate: (force?: boolean) => Promise<void>
}) {
  return (
    <div className="panel-section" style={{ padding: 18 }}>
      <div className="manage-head">
        <div className="manage-title">
          <Sparkles size={14} strokeWidth={2} />
          Meeting prep
        </div>
        <button className="action-chip" onClick={() => onGenerate(true)} disabled={loading}>
          {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} strokeWidth={2} />}
          Regenerate
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 180, color: 'var(--ink-3)', gap: 10 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Building a sharp prep brief...</span>
        </div>
      ) : prep ? (
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.75 }}>
          {prep.split('\n').map((line, index) => {
            if (line.startsWith('## ')) {
              return (
                <div key={`${line}-${index}`} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: index === 0 ? 0 : 14, marginBottom: 6 }}>
                  {line.slice(3)}
                </div>
              )
            }
            if (line.startsWith('- ')) {
              return (
                <div key={`${line}-${index}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{ color: 'var(--signal)', marginTop: 1 }}>•</span>
                  <span>{line.slice(2)}</span>
                </div>
              )
            }
            if (!line.trim()) {
              return <div key={`gap-${index}`} style={{ height: 4 }} />
            }
            return <div key={`${line}-${index}`} style={{ marginBottom: 4 }}>{line}</div>
          })}
        </div>
      ) : (
        <EmptyPanel
          title="No meeting prep yet"
          body="Generate a deal-specific brief before your next call to turn the current signal into a sharper conversation."
          actionLabel="Generate prep"
          onAction={() => onGenerate()}
        />
      )}
    </div>
  )
}

function ConversationsTab({
  deal,
  notes,
  onRefresh,
  onOpenEmail,
}: {
  deal: DealRecord
  notes: NoteEntry[]
  onRefresh: () => Promise<void>
  onOpenEmail: () => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  async function logNotes(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.trim()) return
    setBusy(true)
    try {
      await requestJson(`/api/deals/${deal.id}/meeting-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: draft.trim() }),
      })
      setDraft('')
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel-section" style={{ padding: 18 }}>
        <div className="manage-head">
          <div className="manage-title">
            <MessageSquare size={14} strokeWidth={2} />
            Log activity
          </div>
          <button className="action-chip" onClick={onOpenEmail}>
            <Mail size={12} strokeWidth={2} />
            Draft follow-up
          </button>
        </div>
        <form onSubmit={logNotes} style={{ display: 'grid', gap: 10 }}>
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            rows={7}
            className="glass-input"
            placeholder="Paste call notes, email updates, or any new signal from the deal..."
            style={{ padding: 12, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" type="submit" disabled={busy || !draft.trim()}>
              {busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} strokeWidth={2} />}
              Log activity
            </button>
          </div>
        </form>
      </div>

      <div className="panel-section" style={{ padding: 18 }}>
        <div className="manage-head">
          <div className="manage-title">
            <Calendar size={14} strokeWidth={2} />
            Conversation history
          </div>
          <span className="progress-meta">{notes.length} entries</span>
        </div>
        {notes.length === 0 ? (
          <EmptyPanel
            title="No conversations logged yet"
            body="As soon as you log notes, Halvex will extract objections, next steps, and competitor mentions into the workspace."
          />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {notes.map(note => (
              <div key={note.id} className="surface-glass-light" style={{ padding: 14, borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{note.title}</div>
                  <span className="notion-chip">{note.dateLabel}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{note.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StakeholdersTab({
  stakeholders,
  stakeholderMap,
  loading,
  error,
  onAnalyze,
}: {
  stakeholders: ReturnType<typeof buildStakeholders>
  stakeholderMap: StakeholderMap | null
  loading: boolean
  error: string | null
  onAnalyze: () => Promise<void>
}) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel-section" style={{ padding: 18 }}>
        <div className="manage-head">
          <div className="manage-title">
            <Users size={14} strokeWidth={2} />
            Stakeholder map
          </div>
          <button className="action-chip" onClick={onAnalyze} disabled={loading}>
            {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} strokeWidth={2} />}
            {stakeholderMap ? 'Refresh map' : 'Analyse map'}
          </button>
        </div>

        {error ? <div style={{ fontSize: 12, color: 'var(--risk)', marginBottom: 12 }}>{error}</div> : null}

        <div style={{ display: 'grid', gap: 10 }}>
          {stakeholders.map(stakeholder => (
            <div key={`${stakeholder.name}-${stakeholder.role}`} className="surface-glass-light" style={{ padding: 14, borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center' }}>
                <div className="stake-avatar" style={{ background: avatarGradientFromName(stakeholder.name) }}>
                  {initialsFromName(stakeholder.name)}
                </div>
                <div>
                  <div className="stake-name">{stakeholder.name}</div>
                  <div className="stake-role">{stakeholder.role}</div>
                  {stakeholder.concern ? (
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>{stakeholder.concern}</div>
                  ) : null}
                </div>
                <div className={`sentiment-dot ${stakeholder.sentiment}`} />
              </div>
              {stakeholder.action ? (
                <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ink-3)' }}>
                  Next action: {stakeholder.action}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {stakeholderMap ? (
        <>
          {stakeholderMap.gaps.length > 0 ? (
            <div className="panel-section" style={{ padding: 18 }}>
              <div className="manage-head">
                <div className="manage-title">
                  <Circle size={14} strokeWidth={2} />
                  Coverage gaps
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {stakeholderMap.gaps.map(gap => (
                  <span key={gap} className="notion-chip">{gap}</span>
                ))}
              </div>
            </div>
          ) : null}
          {stakeholderMap.recommendation ? (
            <div className="panel-section" style={{ padding: 18 }}>
              <div className="manage-head">
                <div className="manage-title">
                  <Sparkles size={14} strokeWidth={2} />
                  Recommended coverage move
                </div>
              </div>
              <AIVoice as="div" style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--ink)' }}>
                {stakeholderMap.recommendation}
              </AIVoice>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function DocumentsTab({
  deal,
  origin,
  onPatchDeal,
  onRefresh,
}: {
  deal: DealRecord
  origin: string
  onPatchDeal: (fields: Partial<DealRecord>) => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const links = deal.links ?? []
  const [draft, setDraft] = useState<{ label: string; url: string; type: DealLinkType }>({
    label: '',
    url: '',
    type: 'document',
  })
  const [busy, setBusy] = useState(false)
  const shareUrl = deal.dealIsShared && deal.dealShareToken ? `${origin}/deal-share/${deal.dealShareToken}` : null

  async function toggleShare() {
    setBusy(true)
    try {
      await requestJson(`/api/deals/${deal.id}/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enable: !deal.dealIsShared }) })
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function addLink(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.label.trim() || !draft.url.trim()) return
    const updated = [
      {
        id: crypto.randomUUID(),
        label: draft.label.trim(),
        url: draft.url.trim(),
        type: draft.type,
        addedAt: new Date().toISOString(),
      },
      ...links,
    ]
    setBusy(true)
    try {
      await onPatchDeal({ links: updated })
      setDraft({ label: '', url: '', type: 'document' })
    } finally {
      setBusy(false)
    }
  }

  async function deleteLink(id: string) {
    setBusy(true)
    try {
      await onPatchDeal({ links: links.filter(link => link.id !== id) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel-section" style={{ padding: 18 }}>
        <div className="manage-head">
          <div className="manage-title">
            <Share2 size={14} strokeWidth={2} />
            Share workspace
          </div>
          <button className="action-chip" onClick={toggleShare} disabled={busy}>
            {busy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Share2 size={12} strokeWidth={2} />}
            {deal.dealIsShared ? 'Disable share' : 'Enable share'}
          </button>
        </div>
        {shareUrl ? (
          <div className="surface-glass-light" style={{ padding: 14, borderRadius: 'var(--radius)' }}>
            <div className="section-label" style={{ marginBottom: 6 }}>Live share link</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href={shareUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--ink-2)', textDecoration: 'underline' }}>
                {shareUrl}
              </a>
              <button
                className="action-chip"
                onClick={() => {
                  void navigator.clipboard.writeText(shareUrl)
                }}
              >
                <Copy size={12} strokeWidth={2} />
                Copy
              </button>
            </div>
          </div>
        ) : (
          <EmptyPanel
            title="Private by default"
            body="Turn on sharing when you want to send the live deal workspace outside the team."
          />
        )}
      </div>

      <div className="panel-section" style={{ padding: 18 }}>
        <div className="manage-head">
          <div className="manage-title">
            <FileText size={14} strokeWidth={2} />
            Documents and links
          </div>
        </div>

        <form onSubmit={addLink} style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 160px auto', gap: 8 }}>
            <input
              value={draft.label}
              onChange={event => setDraft(current => ({ ...current, label: event.target.value }))}
              placeholder="Label"
              className="glass-input"
              style={{ padding: '8px 10px' }}
            />
            <input
              value={draft.url}
              onChange={event => setDraft(current => ({ ...current, url: event.target.value }))}
              placeholder="https://..."
              className="glass-input"
              style={{ padding: '8px 10px' }}
            />
            <select
              value={draft.type}
              onChange={event => setDraft(current => ({ ...current, type: event.target.value as DealLinkType }))}
              className="glass-input"
              style={{ padding: '8px 10px' }}
            >
              {DOCUMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <button type="submit" className="action-chip" disabled={busy || !draft.label.trim() || !draft.url.trim()}>
              <Plus size={12} strokeWidth={2} />
              Add
            </button>
          </div>
        </form>

        {links.length === 0 ? (
          <EmptyPanel
            title="No supporting documents yet"
            body="Add proposals, contracts, decks, or workspace documents so the deal workspace becomes the single place a rep can work from."
          />
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {links.map(link => (
              <div key={link.id} className="surface-glass-light" style={{ padding: 14, borderRadius: 'var(--radius)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{link.label}</div>
                    <span className="notion-chip">{DOCUMENT_TYPES.find(type => type.value === link.type)?.label ?? link.type}</span>
                  </div>
                  <a href={link.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--ink-3)', textDecoration: 'underline' }}>
                    {link.url}
                  </a>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={link.url} target="_blank" rel="noreferrer" className="icon-btn">
                    <ExternalLink size={13} strokeWidth={1.8} />
                  </a>
                  <button className="icon-btn" type="button" onClick={() => deleteLink(link.id)}>
                    <Trash2 size={13} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryTab({
  timeline,
  aiActivity,
  loading,
}: {
  timeline: TimelineItem[]
  aiActivity: AiActivityItem[]
  loading: boolean
}) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="timeline-card">
        <SectionHeader title="Deal" accent="timeline" />
        <TimelineList items={timeline} />
      </div>

      <div className="panel-section" style={{ padding: 18 }}>
        <div className="manage-head">
          <div className="manage-title">
            <Sparkles size={14} strokeWidth={2} />
            AI activity log
          </div>
        </div>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 120 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : aiActivity.length === 0 ? (
          <EmptyPanel
            title="No AI activity recorded yet"
            body="As Halvex drafts, briefs, and analyses this deal, those actions will show up here."
          />
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {aiActivity.map(item => (
              <div key={item.id} className="surface-glass-light" style={{ padding: 14, borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {humanizeActivityLabel(item.actionType, item.payload ?? {})}
                  </div>
                  <span className="notion-chip">{formatRelativeTime(item.createdAt)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>
                  {item.status ? `Status: ${item.status}` : 'Recorded against this deal.'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DealDetailPage() {
  const params = useParams<{ id: string | string[] }>()
  const searchParams = useSearchParams()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const { setActiveDeal, sendToCopilot } = useSidebar()

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview')
  const [toast, setToast] = useState<ToastState>(null)
  const [origin, setOrigin] = useState('')
  const [stakeholderMap, setStakeholderMap] = useState<StakeholderMap | null>(null)
  const [stakeholderBusy, setStakeholderBusy] = useState(false)
  const [stakeholderError, setStakeholderError] = useState<string | null>(null)
  const [meetingPrep, setMeetingPrep] = useState<string | null>(null)
  const [meetingPrepBusy, setMeetingPrepBusy] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailDraft, setEmailDraft] = useState<ComposeEmailResponse | null>(null)

  const { data: dealRes, isLoading, mutate: mutateDeal } = useSWR<{ data: DealRecord }>(
    id ? `/api/deals/${id}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )
  const { data: brainRes } = useSWR<{ data: BrainData }>('/api/brain', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
  const { data: briefRes, mutate: mutateBrief } = useSWR<{ data: BriefResponse }>(
    id ? `/api/deals/${id}/brief` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  )
  const {
    data: aiActivityRes,
    isLoading: aiActivityLoading,
    mutate: mutateAiActivity,
  } = useSWR<{ data: AiActivityItem[] }>(
    id ? `/api/deals/${id}/ai-activity` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  )

  const deal = dealRes?.data
  const prediction = useMemo(
    () => brainRes?.data?.mlPredictions?.find(item => item.dealId === id) ?? null,
    [brainRes?.data?.mlPredictions, id],
  )
  const notes = useMemo(() => splitMeetingNotes(deal?.meetingNotes), [deal?.meetingNotes])
  const signals = useMemo(() => (deal ? buildSignals(deal, notes, prediction) : []), [deal, notes, prediction])
  const criteria = useMemo(
    () => (deal ? (deal.successCriteriaTodos?.length ? deal.successCriteriaTodos : buildFallbackCriteria(deal)) : []),
    [deal],
  )
  const stakeholders = useMemo(() => (deal ? buildStakeholders(deal, stakeholderMap) : []), [deal, stakeholderMap])
  const recommendedAction = useMemo(
    () => (deal ? recommendedActionText(deal, notes) : ''),
    [deal, notes],
  )
  const aiActivity = useMemo(() => aiActivityRes?.data ?? [], [aiActivityRes?.data])
  const timeline = useMemo(
    () => (deal ? buildTimeline(deal, notes, aiActivity, recommendedAction) : []),
    [aiActivity, deal, notes, recommendedAction],
  )

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

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

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['overview', 'manage', 'intelligence', 'conversations', 'stakeholders', 'documents', 'history'].includes(tab)) {
      setActiveTab(tab as WorkspaceTab)
    }
  }, [searchParams])

  useEffect(() => {
    const aiParam = searchParams.get('ai')
    if (!aiParam || !id) return
    sendToCopilot(aiParam)
    window.history.replaceState({}, '', `/deals/${id}`)
  }, [id, searchParams, sendToCopilot])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  async function refreshAll() {
    await Promise.all([mutateDeal(), mutateAiActivity(), mutateBrief()])
  }

  async function patchDeal(fields: Partial<DealRecord>) {
    await requestJson(`/api/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    await mutateDeal()
  }

  async function openEmailComposer(tone: 'professional' | 'friendly' | 'urgent' = 'professional') {
    if (!id) return
    setEmailModalOpen(true)
    setEmailBusy(true)
    try {
      const response = await requestJson<{ data: ComposeEmailResponse }>(`/api/deals/${id}/compose-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone }),
      })
      setEmailDraft(response.data)
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Could not generate email' })
    } finally {
      setEmailBusy(false)
    }
  }

  async function copyEmailDraft() {
    if (!emailDraft) return
    await navigator.clipboard.writeText(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`)
    setToast({ kind: 'success', message: 'Email draft copied' })
  }

  async function ensureMeetingPrep(force = false) {
    if (!id || (meetingPrep && !force)) return
    setMeetingPrepBusy(true)
    try {
      const response = await requestJson<{ data: { prep: string } }>(`/api/deals/${id}/meeting-prep`, { method: 'POST' })
      setMeetingPrep(response.data.prep)
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Could not generate meeting prep' })
    } finally {
      setMeetingPrepBusy(false)
    }
  }

  async function analyzeStakeholders() {
    if (!id) return
    setStakeholderBusy(true)
    setStakeholderError(null)
    try {
      const response = await requestJson<{ data: StakeholderMap }>(`/api/deals/${id}/stakeholder-map`, { method: 'POST' })
      setStakeholderMap(response.data)
    } catch (error) {
      setStakeholderError(error instanceof Error ? error.message : 'Could not build stakeholder map')
    } finally {
      setStakeholderBusy(false)
    }
  }

  async function createTomorrowReminder() {
    if (!deal) return
    const reminderTodo: DealTodo = {
      id: crypto.randomUUID(),
      text: `Follow up with ${deal.prospectCompany} tomorrow and confirm the next move.`,
      done: false,
      source: 'manual',
      createdAt: new Date().toISOString(),
    }
    const updatedTodos: DealTodo[] = [reminderTodo, ...(deal.todos ?? [])]
    await patchDeal({ todos: updatedTodos })
    setToast({ kind: 'success', message: 'Reminder added to tasks' })
  }

  async function generateAiTasks() {
    if (!id) return
    try {
      await requestJson(`/api/deals/${id}/ai-tasks`, { method: 'POST' })
      await mutateDeal()
      setToast({ kind: 'success', message: 'AI tasks added' })
    } catch (error) {
      setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Could not generate AI tasks' })
    }
  }

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

  const score = clamp(Math.round(deal.conversionScore ?? 76), 0, 100)
  const tone = stageTone(deal.stage)
  const sparklineValues = scoreTrend(deal.scoreHistory ?? [], score)
  const sparkline = sparkPath(sparklineValues)
  const sevenDayDelta = sparklineValues.at(-1)! - sparklineValues[0]!
  const forecastRows = buildForecastRows(deal, prediction)
  const title = titleParts(deal.dealName, deal.stage)
  const competitorMentions = (deal.competitors ?? []).map(name => ({
    name,
    count: countMentions((deal.meetingNotes ?? '').toLowerCase(), name.toLowerCase()) || 1,
  }))
  const manageCount =
    (deal.todos?.filter(todo => !todo.done).length ?? 0) +
    ((deal.projectPlan?.phases ?? []).flatMap(phase => phase.tasks ?? []).filter(task => task.status !== 'complete').length ?? 0) +
    criteria.filter(item => !item.achieved).length
  const briefingText =
    briefRes?.data?.brief ??
    deal.aiSummary ??
    `${deal.prospectCompany} is moving, but the next action needs to be sharper and more specific to the buying team.`
  const briefingGeneratedAt = briefRes?.data?.generatedAt ?? deal.updatedAt ?? deal.createdAt ?? null
  const primaryEmail = deal.contacts?.find(contact => contact.email)?.email ?? null
  const primaryName = deal.contacts?.[0]?.name ?? deal.prospectName ?? deal.prospectCompany

  return (
    <>
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
              <span>{deal.engagementType ?? 'Enterprise account'}</span>
              <span>·</span>
              <span>{deal.contractEndDate ? formatContextualDate(deal.contractEndDate) : 'London, UK'}</span>
              <span>·</span>
              <span className="mono" style={{ color: 'var(--ink-4)' }}>{compactDealId(deal.id)}</span>
            </div>

            <div className="deal-title-row">
              <div>
                <h1 className="deal-title">
                  {title.lead}, <em>{title.tail}</em>
                </h1>
                <div className="deal-subtitle">
                  {deal.description || `${deal.contacts?.length ?? 0} stakeholders · ${stageLabel(deal.stage)} stage`}
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
                  {scoreVerdict(score)}
                </AIVoice>
                <div className="score-reason">{scoreReasonLine(deal)}</div>
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

              <div className="stage-chip" style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.text }}>
                <span className="dot" style={{ background: tone.text }} />
                {stageLabel(deal.stage)}
              </div>
            </div>
          </div>

          <div className="tabs">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'manage', label: 'Manage', count: manageCount || undefined },
              { id: 'intelligence', label: 'Intelligence', dot: signals.length > 0 },
              { id: 'conversations', label: 'Conversations', count: notes.length || undefined },
              { id: 'stakeholders', label: 'Stakeholders', count: stakeholders.length || undefined },
              { id: 'documents', label: 'Documents', count: (deal.links?.length ?? 0) || undefined },
              { id: 'history', label: 'History', count: aiActivity.length || undefined },
            ].map(tab => (
              <button
                key={tab.id}
                className={`tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id as WorkspaceTab)
                  if (tab.id === 'intelligence') {
                    void ensureMeetingPrep()
                  }
                }}
              >
                {tab.label}
                {tab.count ? <span className="tab-count">{tab.count}</span> : null}
                {tab.dot ? <span className="tab-dot" /> : null}
              </button>
            ))}
          </div>

          <div className="content">
            {activeTab === 'overview' ? (
              <>
                <section className="fade-in">
                  <div className="briefing">
                    <div className="briefing-head">
                      <div className="ai-badge">
                        <span className="pulse" />
                        Morning briefing
                      </div>
                      <span className="briefing-time">
                        Generated {briefingGeneratedAt ? formatRelativeTime(briefingGeneratedAt) : 'just now'} · based on {signals.length + notes.length} signals
                      </span>
                    </div>
                    <AIVoice as="div" className="briefing-text">
                      {briefingText}
                    </AIVoice>
                    <div className="briefing-actions">
                      <button className="action-chip" onClick={() => void openEmailComposer()}>
                        <Mail size={12} strokeWidth={2} />
                        Draft email to {primaryName}
                      </button>
                      <button
                        className="action-chip"
                        onClick={async () => {
                          setActiveTab('intelligence')
                          await ensureMeetingPrep()
                        }}
                      >
                        <Calendar size={12} strokeWidth={2} />
                        Prep next call
                      </button>
                      <button className="action-chip" onClick={() => void createTomorrowReminder()}>
                        <Clock3 size={12} strokeWidth={2} />
                        Remind me tomorrow
                      </button>
                    </div>
                  </div>
                </section>

                <section className="fade-in">
                  <SectionHeader title="Live" accent="signals" action="View intelligence" onAction={() => setActiveTab('intelligence')} />
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
                  <SectionHeader title="Manage" action="Open full manage view" onAction={() => setActiveTab('manage')} />
                  <div className="manage-grid">
                    <TodoListPanel deal={deal} onPatchDeal={patchDeal} onGenerateAiTasks={generateAiTasks} />
                    <div className="manage-card">
                      <div className="manage-head">
                        <div className="manage-title">
                          <Circle size={14} strokeWidth={2} />
                          Success criteria
                        </div>
                        <span className="progress-meta">
                          {criteria.filter(item => item.achieved).length} of {criteria.length}
                        </span>
                      </div>
                      {criteria.slice(0, 6).map(item => (
                        <div key={item.id} className="criteria-row">
                          <div className={`criteria-status ${item.achieved ? 'met' : 'missing'}`}>
                            {item.achieved ? <Check size={12} strokeWidth={3} /> : null}
                          </div>
                          <div>
                            <div className="criteria-label">{item.text}</div>
                            <div className="criteria-sub">{item.note || item.category || 'Tracked by Halvex'}</div>
                          </div>
                          <span className="criteria-confidence">{item.achieved ? 'met' : 'open'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="fade-in">
                  <SectionHeader title="Recent" accent="activity" action="Open history" onAction={() => setActiveTab('history')} />
                  <div className="timeline-card">
                    <TimelineList items={timeline} />
                  </div>
                </section>
              </>
            ) : null}

            {activeTab === 'manage' ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <div className="manage-grid">
                  <TodoListPanel deal={deal} onPatchDeal={patchDeal} onGenerateAiTasks={generateAiTasks} />
                  <CriteriaPanel deal={deal} onPatchDeal={patchDeal} onRefresh={refreshAll} />
                </div>
                <ProjectPlanPanel deal={deal} onRefresh={refreshAll} />
              </div>
            ) : null}

            {activeTab === 'intelligence' ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <MeetingPrepPanel prep={meetingPrep} loading={meetingPrepBusy} onGenerate={ensureMeetingPrep} />
                <div className="timeline-card">
                  <SectionHeader title="Signal" accent="narrative" />
                  <AIVoice as="div" style={{ fontSize: 21, lineHeight: 1.5, color: 'var(--ink)' }}>
                    {briefingText}
                  </AIVoice>
                </div>
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
              </div>
            ) : null}

            {activeTab === 'conversations' ? (
              <ConversationsTab deal={deal} notes={notes} onRefresh={refreshAll} onOpenEmail={() => openEmailComposer()} />
            ) : null}

            {activeTab === 'stakeholders' ? (
              <StakeholdersTab
                stakeholders={stakeholders}
                stakeholderMap={stakeholderMap}
                loading={stakeholderBusy}
                error={stakeholderError}
                onAnalyze={analyzeStakeholders}
              />
            ) : null}

            {activeTab === 'documents' ? (
              <DocumentsTab deal={deal} origin={origin} onPatchDeal={patchDeal} onRefresh={refreshAll} />
            ) : null}

            {activeTab === 'history' ? (
              <HistoryTab timeline={timeline} aiActivity={aiActivity} loading={aiActivityLoading} />
            ) : null}
          </div>
        </div>

        <aside className="right-panel">
          <div className="next-action-card">
            <div className="next-action-label">
              <Sparkles size={10} strokeWidth={2.5} />
              Recommended next action
            </div>
            <AIVoice as="div" className="next-action-text">
              {recommendedAction}
            </AIVoice>
            <div className="next-action-buttons">
              <button className="next-action-btn primary" onClick={() => void openEmailComposer()}>
                Draft now
              </button>
              <button
                className="next-action-btn"
                onClick={() => {
                  setActiveTab('manage')
                }}
              >
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
              stakeholders.slice(0, 5).map(person => (
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
            {forecastRows.map(row => (
              <div key={row.label} className="forecast-row">
                <span className="forecast-label">{row.label}</span>
                <span className="forecast-value">{formatPercentage(row.value)}</span>
                <div className="forecast-bar">
                  <div className="forecast-bar-fill" style={{ width: `${row.value}%`, background: row.gradient }} />
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
              competitorMentions.map(item => (
                <div key={item.name} className="competitor-chip">
                  <span className="competitor-name">{item.name}</span>
                  <span className="competitor-mentions">
                    {item.count} mention{item.count !== 1 ? 's' : ''} <MoveUpRight size={10} style={{ verticalAlign: 'middle' }} />
                  </span>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      <EmailComposerModal
        open={emailModalOpen}
        loading={emailBusy}
        data={emailDraft}
        primaryEmail={primaryEmail}
        onClose={() => setEmailModalOpen(false)}
        onCopy={copyEmailDraft}
        onRegenerate={openEmailComposer}
      />

      {toast ? (
        <div
          style={{
            position: 'fixed',
            right: 22,
            bottom: 22,
            zIndex: 80,
            padding: '12px 14px',
            borderRadius: 'var(--radius)',
            background: toast.kind === 'success' ? 'rgba(29, 184, 106, 0.92)' : 'rgba(178, 58, 58, 0.92)',
            color: '#fff',
            boxShadow: '0 12px 32px rgba(20, 17, 10, 0.16)',
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          {toast.message}
        </div>
      ) : null}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
