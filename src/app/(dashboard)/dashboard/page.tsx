'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  RefreshCw,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import AIVoice from '@/components/AIVoice'
import { useSidebar } from '@/components/layout/SidebarContext'
import { fetcher } from '@/lib/fetcher'
import {
  formatContextualDate,
  formatCurrencyGBP,
  formatRelativeTime,
  humanizeActivityLabel,
} from '@/lib/presentation'
import { buildPreferredNoteCorpus, extractDatedEntries } from '@/lib/note-intelligence'

type AIOverview = {
  summary: string
  keyActions: string[]
  focusBullets: string[]
  pipelineHealth: string
  momentum: string | null
  topRisk: string | null
  generatedAt: string
  briefingHealth: 'green' | 'amber' | 'red'
  topAttentionDeals: Array<{
    dealId: string
    dealName: string
    company: string
    reason: string
    urgency: 'high' | 'medium'
  }>
  singleMostImportantAction: string
}

type BrainData = {
  updatedAt?: string
  staleDeals?: Array<{
    dealId: string
    dealName?: string
    company: string
    daysSinceUpdate: number
    reason?: string
  }>
  urgentDeals?: Array<{
    dealId: string
    dealName?: string
    company: string
    reason: string
    topAction?: string
  }>
  keyPatterns?: Array<{
    label: string
    dealIds: string[]
    companies: string[]
  }>
  pipeline?: {
    totalValue: number
    activeDeals: number
    stageBreakdown?: Record<string, { count: number; value: number }>
  }
  winLossIntel?: {
    winRate: number
    winCount: number
    lossCount: number
  }
  productGapPriority?: Array<{
    title: string
    revenueAtRisk?: number
    dealsBlocked?: number
  }>
}

type DealRecord = {
  id: string
  dealName: string
  prospectCompany: string
  stage: string
  dealValue?: number | null
  conversionScore?: number | null
  updatedAt?: string
  aiSummary?: string | null
  nextSteps?: string | null
  notes?: string | null
  meetingNotes?: string | null
  hubspotNotes?: string | null
  dealRisks?: string[] | null
  closeDate?: string | null
  forecastCategory?: 'commit' | 'upside' | 'pipeline' | 'omit' | null
  todos?: Array<{ id: string; text: string; done: boolean }> | null
}

type ActivityEvent = {
  id: string
  type: string
  metadata: Record<string, unknown>
  createdAt: string
  dealName?: string
  prospectCompany?: string
}

type CalendarEvent = {
  id: string
  dealId: string
  dealName: string
  prospectCompany: string
  type: string
  description: string
  date: string
  time?: string | null
}

type AttentionItem = {
  dealId: string
  company: string
  stage: string
  reason: string
  urgency: 'high' | 'medium'
  value?: number | null
  score?: number | null
  lastNoteAt?: string | null
  updatedAt?: string
}

type LatestNoteMeta = {
  at: string | null
  summary: string | null
  daysSince: number | null
}

type RankedAttentionItem = AttentionItem & {
  sortKey: number
}

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function stageLabel(stage?: string | null) {
  if (!stage) return 'Pipeline'
  return stage.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function compactMoney(value: number | null | undefined) {
  return formatCurrencyGBP(value, { compact: true })
}

function extractLatestNoteMeta(deal: DealRecord): LatestNoteMeta {
  const allNotes = buildPreferredNoteCorpus({
    meetingNotes: deal.meetingNotes,
    hubspotNotes: deal.hubspotNotes,
    notes: deal.notes,
  })
  if (!allNotes.trim()) return { at: null, summary: null, daysSince: null }

  const latest = extractDatedEntries(allNotes)[0]

  if (!latest) return { at: null, summary: null, daysSince: null }

  const cleaned = latest.text
    .replace(/^\[?\d{4}[-/]\d{1,2}[-/]\d{1,2}\]?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    at: latest.date.toISOString(),
    summary: cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : null,
    daysSince: Math.round((Date.now() - latest.date.getTime()) / 86_400_000),
  }
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function OverviewMetric({
  label,
  value,
  meta,
}: {
  label: string
  value: string
  meta: string
}) {
  return (
    <div className="overview-metric">
      <div className="overview-metric-label">{label}</div>
      <div className="overview-metric-value mono">{value}</div>
      <div className="overview-metric-meta">{meta}</div>
    </div>
  )
}

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <Link href={`/deals/${item.dealId}`} className="overview-list-row">
      <div className={`overview-urgency overview-urgency-${item.urgency}`} />
      <div className="overview-list-copy">
        <div className="overview-row-top">
          <span className="overview-row-title">{item.company}</span>
          <span className="overview-row-chip">{stageLabel(item.stage)}</span>
          {item.score != null ? <span className="overview-row-chip mono">{Math.round(item.score)}</span> : null}
          {item.value ? <span className="overview-row-chip mono">{compactMoney(item.value)}</span> : null}
        </div>
        <div className="overview-row-body">{item.reason}</div>
        <div className="overview-row-meta">
          {item.lastNoteAt
            ? `Latest note ${formatRelativeTime(item.lastNoteAt)}`
            : item.updatedAt
              ? `Updated ${formatRelativeTime(item.updatedAt)}`
              : 'In the focus queue'}
        </div>
      </div>
      <ChevronRight size={14} strokeWidth={1.8} />
    </Link>
  )
}

function CalendarRow({ event }: { event: CalendarEvent }) {
  const when = new Date(`${event.date}T${event.time ?? '09:00'}:00`)
  return (
    <Link href={`/deals/${event.dealId}`} className="overview-mini-row">
      <div className="overview-mini-icon">
        <CalendarClock size={13} strokeWidth={1.9} />
      </div>
      <div className="overview-mini-copy">
        <div className="overview-row-title">{event.prospectCompany || event.dealName}</div>
        <div className="overview-row-body">{event.description}</div>
      </div>
      <div className="overview-mini-meta">{formatContextualDate(when.toISOString())}</div>
    </Link>
  )
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="overview-mini-row overview-mini-row-static">
      <div className="overview-activity-dot" />
      <div className="overview-mini-copy">
        <div className="overview-row-title">
          {humanizeActivityLabel(event.type, event.metadata, event.dealName ?? event.prospectCompany)}
        </div>
      </div>
      <div className="overview-mini-meta">{formatRelativeTime(event.createdAt)}</div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useUser()
  const { sendToCopilot } = useSidebar()
  const [refreshing, setRefreshing] = useState(false)
  const overviewAutoRequested = useRef(false)

  const { data: overviewRes, isLoading: overviewLoading, mutate: mutateOverview } = useSWR<{ data: AIOverview }>(
    '/api/dashboard/ai-overview',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 45_000 },
  )
  const { data: brainRes, mutate: mutateBrain } = useSWR<{ data: BrainData }>('/api/brain', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })
  const { data: dealsRes, mutate: mutateDeals } = useSWR<{ data: DealRecord[] }>('/api/deals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })
  const { data: activityRes, mutate: mutateActivity } = useSWR<{ data: ActivityEvent[] }>(
    '/api/activity?limit=10',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  )
  const { data: calendarRes, mutate: mutateCalendar } = useSWR<{ data: CalendarEvent[] }>('/api/calendar', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })

  const overview = overviewRes?.data
  const brain = brainRes?.data ?? {}
  const activity = activityRes?.data ?? []
  const deals = useMemo(() => dealsRes?.data ?? [], [dealsRes?.data])
  const calendar = useMemo(() => calendarRes?.data ?? [], [calendarRes?.data])
  const hour = new Date().getHours()
  const fullName = user?.firstName ?? user?.fullName?.split(' ')[0] ?? 'there'

  const openDeals = useMemo(
    () => deals.filter(deal => !['closed_won', 'closed_lost'].includes(deal.stage)),
    [deals],
  )

  const pipelineValue = useMemo(
    () => openDeals.reduce((sum, deal) => sum + (deal.dealValue ?? 0), 0),
    [openDeals],
  )

  const avgScore = useMemo(() => {
    if (openDeals.length === 0) return null
    return Math.round(
      openDeals.reduce((sum, deal) => sum + (deal.conversionScore ?? 50), 0) / openDeals.length,
    )
  }, [openDeals])

  const openTaskCount = useMemo(
    () =>
      openDeals.reduce(
        (sum, deal) => sum + ((deal.todos ?? []).filter(todo => !todo.done).length ?? 0),
        0,
      ),
    [openDeals],
  )

  const stageBreakdown = useMemo(() => {
    const stageMap = brain.pipeline?.stageBreakdown
    const fromDeals =
      stageMap ??
      openDeals.reduce<Record<string, { count: number; value: number }>>((acc, deal) => {
        const key = deal.stage || 'pipeline'
        acc[key] = acc[key] ?? { count: 0, value: 0 }
        acc[key].count += 1
        acc[key].value += deal.dealValue ?? 0
        return acc
      }, {})

    return Object.entries(fromDeals)
      .map(([stage, metrics]) => ({ stage, ...metrics }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5)
  }, [brain.pipeline?.stageBreakdown, openDeals])

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const overviewAttentionDeals = overview?.topAttentionDeals ?? []
    const dealMap = new Map(openDeals.map(deal => [deal.id, deal]))
    if (overviewAttentionDeals.length > 0) {
      return overviewAttentionDeals.slice(0, 5).map(item => {
        const deal = dealMap.get(item.dealId)
        const noteMeta = deal ? extractLatestNoteMeta(deal) : { at: null, summary: null, daysSince: null }
        return {
          dealId: item.dealId,
          company: deal?.prospectCompany ?? item.company ?? item.dealName,
          stage: deal?.stage ?? '',
          reason: item.reason,
          urgency: item.urgency,
          value: deal?.dealValue,
          score: deal?.conversionScore,
          lastNoteAt: noteMeta.at,
          updatedAt: deal?.updatedAt,
        }
      })
    }

    const fallbackItems: RankedAttentionItem[] = openDeals
      .map(deal => {
        const noteMeta = extractLatestNoteMeta(deal)
        const risk = deal.dealRisks?.[0] ?? null
        const closeDate = deal.closeDate ? new Date(deal.closeDate) : null
        const daysToClose = closeDate && !Number.isNaN(closeDate.getTime())
          ? Math.round((closeDate.getTime() - Date.now()) / 86_400_000)
          : null

        let reason: string | null = null
        let urgency: 'high' | 'medium' = 'medium'
        let sortKey = 0

        if (risk && noteMeta.daysSince != null) {
          reason = `${risk} Latest note was ${noteMeta.daysSince}d ago${noteMeta.summary ? ` — ${noteMeta.summary.slice(0, 72)}${noteMeta.summary.length > 72 ? '…' : ''}` : ''}`
          urgency = noteMeta.daysSince > 10 ? 'high' : 'medium'
          sortKey = 100 - (deal.conversionScore ?? 50) + Math.max(noteMeta.daysSince, 0)
        } else if (daysToClose != null && daysToClose <= 14 && noteMeta.summary) {
          reason = `Close date in ${daysToClose}d. Latest dated note: ${noteMeta.summary.slice(0, 88)}${noteMeta.summary.length > 88 ? '…' : ''}`
          urgency = daysToClose <= 7 ? 'high' : 'medium'
          sortKey = 80 - Math.max(daysToClose, 0)
        } else if (noteMeta.daysSince != null && noteMeta.daysSince >= 14 && noteMeta.summary) {
          reason = `No new note for ${noteMeta.daysSince}d. Last recorded context: ${noteMeta.summary.slice(0, 88)}${noteMeta.summary.length > 88 ? '…' : ''}`
          urgency = noteMeta.daysSince >= 21 ? 'high' : 'medium'
          sortKey = noteMeta.daysSince
        } else if (deal.nextSteps && noteMeta.daysSince != null && noteMeta.daysSince >= 7) {
          reason = `Latest next step still reads: ${deal.nextSteps}`
          urgency = 'medium'
          sortKey = noteMeta.daysSince
        }

        if (!reason) return null

        return {
              dealId: deal.id,
              company: deal.prospectCompany,
              stage: deal.stage,
              reason,
              urgency,
              value: deal.dealValue,
              score: deal.conversionScore,
              lastNoteAt: noteMeta.at,
              updatedAt: deal.updatedAt,
              sortKey,
            }
      })
      .flatMap(item => (item ? [item] : []))

    return fallbackItems
      .sort((left, right) => right.sortKey - left.sortKey)
      .slice(0, 5)
      .map(item => ({
        dealId: item.dealId,
        company: item.company,
        stage: item.stage,
        reason: item.reason,
        urgency: item.urgency,
        value: item.value,
        score: item.score,
        lastNoteAt: item.lastNoteAt,
        updatedAt: item.updatedAt,
      }))
  }, [openDeals, overview?.topAttentionDeals])

  const upcomingEvents = useMemo(() => {
    const now = new Date()
    return calendar
      .map(event => ({ ...event, sortAt: new Date(`${event.date}T${event.time ?? '09:00'}:00`) }))
      .filter(event => !Number.isNaN(event.sortAt.getTime()) && event.sortAt >= now)
      .sort((left, right) => left.sortAt.getTime() - right.sortAt.getTime())
      .slice(0, 5)
      .map(event => ({
        id: event.id,
        dealId: event.dealId,
        dealName: event.dealName,
        prospectCompany: event.prospectCompany,
        type: event.type,
        description: event.description,
        date: event.date,
        time: event.time,
      }))
  }, [calendar])

  const signalNotes = useMemo(() => {
    const notes: Array<{ title: string; detail: string }> = []

    if (brain.keyPatterns?.[0]) {
      notes.push({
        title: 'Pattern surfacing',
        detail: brain.keyPatterns[0].label,
      })
    }
    if (brain.productGapPriority?.[0]) {
      notes.push({
        title: 'Commercial friction',
        detail: `${brain.productGapPriority[0].title} is blocking ${brain.productGapPriority[0].dealsBlocked ?? 0} deals.`,
      })
    }
    if (overview?.topRisk) {
      notes.push({
        title: 'Primary risk',
        detail: overview.topRisk,
      })
    }
    if (notes.length === 0) {
      notes.push({
        title: 'Signal layer warming up',
        detail: 'Halvex will elevate patterns here as more calls, notes, and outcomes accumulate.',
      })
    }

    return notes.slice(0, 3)
  }, [brain.keyPatterns, brain.productGapPriority, overview?.topRisk])
  useEffect(() => {
    if (overview || overviewLoading || overviewAutoRequested.current) return
    overviewAutoRequested.current = true
    void (async () => {
      try {
        await fetch('/api/dashboard/ai-overview', { method: 'POST' })
        await mutateOverview()
      } catch {
        overviewAutoRequested.current = false
      }
    })()
  }, [mutateOverview, overview, overviewLoading])

  async function refreshAll() {
    setRefreshing(true)
    try {
      await Promise.all([
        fetch('/api/dashboard/ai-overview', { method: 'POST' }).then(() => mutateOverview()),
        mutateBrain(),
        mutateDeals(),
        mutateActivity(),
        mutateCalendar(),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="overview-shell">
      <style>{`
        .overview-shell {
          padding-top: 4px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .overview-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }
        .overview-date {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-4);
          margin-bottom: 6px;
        }
        .overview-title {
          font-size: 34px;
          line-height: 1.02;
          letter-spacing: -0.05em;
          color: var(--ink);
          font-weight: 600;
        }
        .overview-subtitle {
          margin-top: 10px;
          font-size: 13px;
          color: var(--ink-3);
          max-width: 720px;
        }
        .overview-refresh {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .overview-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(29, 184, 106, 0.08);
          color: #0C7A43;
          font-size: 11px;
          font-weight: 500;
          border: 1px solid rgba(29, 184, 106, 0.15);
        }
        .overview-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--signal);
        }
        .overview-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.95fr);
          gap: 16px;
          align-items: stretch;
        }
        .overview-briefing {
          padding: 24px 26px;
          position: relative;
          overflow: hidden;
        }
        .overview-briefing::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 3px;
          height: 100%;
          background: linear-gradient(180deg, var(--signal) 0%, transparent 100%);
        }
        .overview-briefing-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .overview-voice {
          font-size: 27px;
          line-height: 1.28;
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        .overview-bullets {
          display: grid;
          gap: 8px;
          margin-top: 18px;
        }
        .overview-bullet {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 12.5px;
          color: var(--ink-2);
        }
        .overview-bullet-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--signal);
          margin-top: 6px;
          flex-shrink: 0;
        }
        .overview-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid rgba(20, 17, 10, 0.06);
        }
        .overview-action-chip {
          max-width: 100%;
          text-align: left;
        }
        .overview-side-stack {
          display: grid;
          gap: 16px;
        }
        .overview-next-action {
          background:
            linear-gradient(180deg, rgba(21, 19, 14, 0.98) 0%, rgba(29, 26, 20, 0.94) 100%);
          color: var(--bg);
          border-radius: var(--radius-lg);
          padding: 18px;
          box-shadow: 0 12px 26px rgba(20, 17, 10, 0.18);
        }
        .overview-next-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(250, 250, 247, 0.52);
          margin-bottom: 10px;
          font-weight: 600;
        }
        .overview-next-copy {
          font-size: 28px;
          line-height: 1.08;
          letter-spacing: -0.03em;
          color: var(--bg);
          margin-bottom: 14px;
        }
        .overview-next-actions {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
        }
        .overview-kpi-panel {
          padding: 18px;
        }
        .overview-kpi-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .overview-metric {
          padding: 12px 14px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.72);
        }
        .overview-metric-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-4);
          margin-bottom: 4px;
          font-weight: 600;
        }
        .overview-metric-value {
          font-size: 24px;
          line-height: 1;
          color: var(--ink);
          letter-spacing: -0.04em;
          font-weight: 600;
        }
        .overview-metric-meta {
          margin-top: 6px;
          font-size: 11px;
          color: var(--ink-3);
        }
        .overview-stage-stack {
          display: grid;
          gap: 10px;
          margin-top: 16px;
        }
        .overview-stage-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
        }
        .overview-stage-copy {
          min-width: 0;
        }
        .overview-stage-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          color: var(--ink-2);
          margin-bottom: 4px;
        }
        .overview-stage-title span:last-child {
          color: var(--ink-4);
          font-size: 11px;
        }
        .overview-stage-bar {
          height: 5px;
          border-radius: 999px;
          background: rgba(20, 17, 10, 0.06);
          overflow: hidden;
        }
        .overview-stage-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(29, 184, 106, 0.95) 0%, rgba(105, 213, 159, 0.75) 100%);
        }
        .overview-section-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
          gap: 16px;
        }
        .overview-list-card,
        .overview-mini-card {
          padding: 18px;
        }
        .overview-list {
          display: grid;
          gap: 10px;
        }
        .overview-list-row,
        .overview-mini-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.72);
        }
        .overview-list-row {
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        }
        .overview-list-row:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.56);
          border-color: rgba(20, 17, 10, 0.08);
        }
        .overview-mini-row-static {
          grid-template-columns: auto minmax(0, 1fr) auto;
        }
        .overview-urgency {
          width: 3px;
          align-self: stretch;
          border-radius: 999px;
          background: rgba(20, 17, 10, 0.08);
        }
        .overview-urgency-high {
          background: linear-gradient(180deg, var(--risk) 0%, rgba(178, 58, 58, 0.15) 100%);
        }
        .overview-urgency-medium {
          background: linear-gradient(180deg, var(--warn) 0%, rgba(196, 98, 27, 0.15) 100%);
        }
        .overview-list-copy,
        .overview-mini-copy {
          min-width: 0;
        }
        .overview-row-top {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 5px;
        }
        .overview-row-title {
          font-size: 13px;
          color: var(--ink);
          font-weight: 600;
        }
        .overview-row-body {
          font-size: 12px;
          color: var(--ink-2);
          line-height: 1.5;
        }
        .overview-row-meta,
        .overview-mini-meta {
          font-size: 11px;
          color: var(--ink-4);
          white-space: nowrap;
        }
        .overview-row-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 999px;
          font-size: 10px;
          color: var(--ink-3);
          background: rgba(20, 17, 10, 0.05);
        }
        .overview-mini-icon {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.6);
          color: var(--ink-3);
          border: 1px solid rgba(255, 255, 255, 0.78);
        }
        .overview-activity-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--signal);
          box-shadow: 0 0 0 4px rgba(29, 184, 106, 0.12);
        }
        .overview-empty {
          display: grid;
          place-items: center;
          min-height: 180px;
          text-align: center;
          color: var(--ink-3);
          font-size: 12px;
          line-height: 1.6;
        }
        @media (max-width: 1240px) {
          .overview-header {
            align-items: flex-start;
          }
          .overview-refresh {
            width: 100%;
            justify-content: space-between;
            flex-wrap: wrap;
          }
          .overview-hero-grid,
          .overview-section-grid {
            grid-template-columns: 1fr;
          }
          .overview-next-actions {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 840px) {
          .overview-briefing,
          .overview-kpi-panel,
          .overview-list-card,
          .overview-mini-card {
            padding: 16px;
          }
          .overview-list-row,
          .overview-mini-row,
          .overview-mini-row-static {
            grid-template-columns: auto minmax(0, 1fr);
            align-items: flex-start;
          }
          .overview-row-meta,
          .overview-mini-meta {
            grid-column: 2;
            white-space: normal;
            margin-top: 6px;
          }
        }
        @media (max-width: 720px) {
          .overview-title {
            font-size: 28px;
          }
          .overview-voice,
          .overview-next-copy {
            font-size: 22px;
          }
          .overview-kpi-grid {
            grid-template-columns: 1fr;
          }
          .overview-header {
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="overview-header">
        <div>
          <div className="overview-date">{todayLabel()}</div>
          <div className="overview-title">
            {greetingForHour(hour)}, {fullName}
          </div>
          <div className="overview-subtitle">
            A single operating view for what needs attention, what is moving, and what Halvex recommends doing next.
          </div>
        </div>
        <div className="overview-refresh">
          <div className="overview-status">
            <span className="overview-status-dot" />
            {overview?.generatedAt || brain.updatedAt ? `Updated ${formatRelativeTime(overview?.generatedAt ?? brain.updatedAt)}` : 'Live'}
          </div>
          <button className="btn" onClick={refreshAll} disabled={refreshing}>
            <RefreshCw size={13} strokeWidth={2} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overview-hero-grid">
        <section className="panel-section overview-briefing">
          <div className="overview-briefing-head">
            <div className="ai-badge">
              <span className="pulse" />
              Morning briefing
            </div>
            <div className="briefing-time">
              {overview?.generatedAt ? `Generated ${formatRelativeTime(overview.generatedAt)}` : 'Generated from your workspace'}
            </div>
          </div>

          {overviewLoading ? (
            <div className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-lg)' }} />
          ) : (
            <>
              <div className="overview-voice">
                <AIVoice as="span">
                  {overview?.summary ??
                    'Halvex is combining deal motion, follow-up cadence, and active blockers into one operating view.'}
                </AIVoice>
              </div>

              <div className="overview-bullets">
                {(overview?.focusBullets?.length ? overview.focusBullets : [
                  overview?.pipelineHealth,
                  overview?.momentum,
                  overview?.topRisk,
                ])
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((item, index) => (
                    <div key={`${item}-${index}`} className="overview-bullet">
                      <span className="overview-bullet-dot" />
                      <span>{item}</span>
                    </div>
                  ))}
              </div>

              <div className="overview-chip-row">
                {(overview?.keyActions?.length ? overview.keyActions : [
                  'Show me the deals most likely to slip this quarter.',
                  'Draft the right follow-up for the highest-risk account.',
                  'Summarise the blockers across my late-stage pipeline.',
                ])
                  .slice(0, 3)
                  .map((action, index) => (
                    <button
                      key={`${action}-${index}`}
                      className="action-chip overview-action-chip"
                      onClick={() => sendToCopilot(action)}
                    >
                      <Sparkles size={12} strokeWidth={2} />
                      {action}
                    </button>
                  ))}
              </div>
            </>
          )}
        </section>

        <div className="overview-side-stack">
          <section className="overview-next-action">
            <div className="overview-next-label">Recommended next action</div>
            <div className="overview-next-copy">
              <AIVoice as="span">
                {overview?.singleMostImportantAction ??
                  'Focus the team on the one account most likely to slip before the week closes.'}
              </AIVoice>
            </div>
            <div className="overview-next-actions">
              <button
                className="btn"
                style={{ background: 'rgba(29, 184, 106, 0.95)', color: '#0B2418', borderColor: 'rgba(29, 184, 106, 0.95)' }}
                onClick={() =>
                  sendToCopilot(
                    overview?.singleMostImportantAction ??
                      'Help me execute the single most important action across my pipeline.',
                  )
                }
              >
                <ArrowRight size={13} strokeWidth={2} />
                Draft now
              </button>
              <Link href="/tasks" className="btn" style={{ justifyContent: 'center', background: 'rgba(255,255,255,0.06)', color: 'var(--bg)', borderColor: 'rgba(255,255,255,0.18)' }}>
                Open tasks
              </Link>
            </div>
          </section>

          <section className="panel-section overview-kpi-panel">
            <div className="section-head" style={{ marginBottom: 16 }}>
              <h2 className="section-title">Pipeline pulse</h2>
              <Link href="/deals?view=board" className="section-action">
                Pipeline
                <ChevronRight size={12} />
              </Link>
            </div>

            <div className="overview-kpi-grid">
              <OverviewMetric label="Pipeline" value={compactMoney(pipelineValue)} meta={`${openDeals.length} open deals`} />
              <OverviewMetric
                label="Avg score"
                value={avgScore != null ? String(avgScore) : '—'}
                meta={`${brain.staleDeals?.length ?? 0} stale`}
              />
              <OverviewMetric
                label="Win rate"
                value={brain.winLossIntel ? `${Math.round(brain.winLossIntel.winRate * 100)}%` : '—'}
                meta={`${brain.winLossIntel?.winCount ?? 0} won`}
              />
              <OverviewMetric label="Open work" value={String(openTaskCount)} meta="Tasks still to close" />
            </div>

            <div className="overview-stage-stack">
              {stageBreakdown.map(stage => {
                const maxCount = Math.max(...stageBreakdown.map(item => item.count), 1)
                return (
                  <div key={stage.stage} className="overview-stage-row">
                    <div className="overview-stage-copy">
                      <div className="overview-stage-title">
                        <span>{stageLabel(stage.stage)}</span>
                        <span>{stage.count} deals</span>
                      </div>
                      <div className="overview-stage-bar">
                        <div className="overview-stage-fill" style={{ width: `${(stage.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                    <div className="overview-mini-meta mono">{compactMoney(stage.value)}</div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      <div className="overview-section-grid">
        <section className="panel-section overview-list-card">
          <div className="section-head">
            <h2 className="section-title">Attention queue</h2>
            <Link href="/deals" className="section-action">
              All deals
              <ChevronRight size={12} />
            </Link>
          </div>
          {attentionItems.length === 0 ? (
            <div className="overview-empty">
              No urgent attention items right now. Halvex will push live deal risk and stale-follow-up signal into this queue.
            </div>
          ) : (
            <div className="overview-list">
              {attentionItems.map(item => (
                <AttentionRow key={item.dealId} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="panel-section overview-mini-card">
          <div className="section-head">
            <h2 className="section-title">Upcoming</h2>
            <Link href="/calendar" className="section-action">
              Calendar
              <ChevronRight size={12} />
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="overview-empty">
              No upcoming meetings or due dates are scheduled yet. Confirmed call notes and due dates will populate this automatically.
            </div>
          ) : (
            <div className="overview-list">
              {upcomingEvents.map(event => (
                <CalendarRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="overview-section-grid">
        <section className="panel-section overview-mini-card">
          <div className="section-head">
            <h2 className="section-title">Recent activity</h2>
            <Link href="/connections" className="section-action">
              Conversations
              <ChevronRight size={12} />
            </Link>
          </div>
          {activity.length === 0 ? (
            <div className="overview-empty">
              Activity will appear here as deals are updated, notes are logged, and Halvex takes actions on the workspace.
            </div>
          ) : (
            <div className="overview-list">
              {activity.slice(0, 6).map(event => (
                <ActivityRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        <section className="panel-section overview-mini-card">
          <div className="section-head">
            <h2 className="section-title">Signals to watch</h2>
            <Link href="/intelligence" className="section-action">
              Intelligence
              <ChevronRight size={12} />
            </Link>
          </div>
          <div className="overview-list">
            {signalNotes.map((note, index) => (
              <div key={`${note.title}-${index}`} className="overview-mini-row overview-mini-row-static">
                <div className="overview-mini-icon">
                  {index === 0 ? <TrendingUp size={13} strokeWidth={1.9} /> : index === 1 ? <TriangleAlert size={13} strokeWidth={1.9} /> : <Activity size={13} strokeWidth={1.9} />}
                </div>
                <div className="overview-mini-copy">
                  <div className="overview-row-title">{note.title}</div>
                  <div className="overview-row-body">{note.detail}</div>
                </div>
                <div className="overview-mini-meta">{index === 0 ? 'Live' : index === 1 ? 'Risk' : 'Watch'}</div>
              </div>
            ))}
            <Link href="/tasks" className="overview-mini-row">
              <div className="overview-mini-icon">
                <CheckCircle2 size={13} strokeWidth={1.9} />
              </div>
              <div className="overview-mini-copy">
                <div className="overview-row-title">Execution lane</div>
                <div className="overview-row-body">
                  {openTaskCount} open tasks across {openDeals.length} active deals. Keep work anchored to the deals that matter.
                </div>
              </div>
              <div className="overview-mini-meta">
                <Clock3 size={12} strokeWidth={1.8} />
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
