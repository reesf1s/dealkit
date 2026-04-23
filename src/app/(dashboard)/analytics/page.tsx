'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  Activity,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import AIVoice from '@/components/AIVoice'
import { fetcher } from '@/lib/fetcher'
import {
  stageLabelFor,
  type PipelineConfigLike,
} from '@/lib/pipeline-presentation'
import { formatCurrencyGBP, formatRelativeTime } from '@/lib/presentation'

type VelocityData = {
  stageMetrics: Array<{
    stage: string
    avgDays: number
    conversionRate: number
    dealCount: number
    dropOffRate: number
  }>
  velocity: { value: number }
  avgCycleLength: number
  winRate: number
  avgDealSize: number
  bottleneck: { stage: string; reason: string } | null
}

type WinLossData = {
  overall: {
    winRate: number
    totalClosed: number
    won: number
    lost: number
    avgWonValue: number
    avgLostValue: number
    avgWonCycle: number
    avgLostCycle: number
  }
  scoreCorrelation: {
    avgWonScore: number
    avgLostScore: number
  }
  lossReasons: Array<{ reason: string; count: number }>
  winFactors: Array<{ factor: string; count: number }>
  competitorImpact: Array<{ competitor: string; wonAgainst: number; lostTo: number }>
}

type ProductSignalsData = {
  gaps: Array<{
    title: string
    revenueAtRisk: number
    dealsBlocked: number
    status: string
  }>
  recentLoops: Array<{
    id: string
    label: string
    issueId?: string | null
    dealName?: string | null
    createdAt: string
  }>
  recentActions: Array<{
    id: string
    label: string
    issueId?: string | null
    dealName?: string | null
    createdAt: string
  }>
}

type LoopSignalsData = {
  signals: Array<{
    id: string
    company: string
    dealValue?: number | null
    stage: string
    suggestedCount: number
  }>
  inFlight: Array<{
    id: string
    company: string
    dealValue?: number | null
    stage: string
    loopStage: string
    pendingActionCreatedAt?: string | null
    inCycleIssues?: Array<{ linearIssueId: string; linearTitle: string }>
  }>
  closedLoops: Array<{
    id: string
    company: string
    dealValue?: number | null
    deployedAt?: string
    issueCount: number
  }>
  closedCount: number
}

type BrainData = {
  updatedAt?: string
  staleDeals?: Array<{
    dealId: string
    company: string
    daysSinceUpdate: number
  }>
  mlPredictions?: Array<{
    dealId: string
    churnRisk?: number
    winProbability?: number
  }>
  keyPatterns?: Array<{
    label: string
    dealIds: string[]
    companies: string[]
  }>
  urgentDeals?: Array<{
    dealId: string
    company: string
    reason: string
  }>
}

type DealRecord = {
  id: string
  dealName: string
  prospectCompany: string
  stage: string
  dealValue?: number | null
  conversionScore?: number | null
  forecastCategory?: 'commit' | 'upside' | 'pipeline' | 'omit' | null
  updatedAt?: string
}

type WatchItem = {
  dealId: string
  company: string
  stage: string
  risk: string
  score?: number | null
  value?: number | null
}

type IntelligenceBriefItem = {
  id: string
  title: string
  detail: string
  meta: string
  tone: 'risk' | 'active' | 'resolved'
}

type PipelineConfigResponse = {
  data?: PipelineConfigLike
}

function compactMoney(value: number | null | undefined) {
  return formatCurrencyGBP(value, { compact: true })
}

function SignalsMetric({
  label,
  value,
  meta,
}: {
  label: string
  value: string
  meta: string
}) {
  return (
    <div className="signals-metric">
      <div className="signals-metric-label">{label}</div>
      <div className="signals-metric-value mono">{value}</div>
      <div className="signals-metric-meta">{meta}</div>
    </div>
  )
}

function PatternRow({
  label,
  count,
  max,
  tone,
}: {
  label: string
  count: number
  max: number
  tone: 'positive' | 'risk'
}) {
  return (
    <div className="signals-pattern-row">
      <div className="signals-pattern-copy">
        <div className="signals-pattern-title">{label}</div>
        <div className="signals-pattern-bar">
          <div
            className={`signals-pattern-fill signals-pattern-fill-${tone}`}
            style={{ width: `${(count / Math.max(max, 1)) * 100}%` }}
          />
        </div>
      </div>
      <div className={`signals-pattern-count signals-pattern-count-${tone}`}>{count}</div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [refreshing, setRefreshing] = useState(false)

  const { data: velocityRes, isLoading: velocityLoading, mutate: mutateVelocity } = useSWR<{ data: VelocityData }>(
    '/api/analytics/pipeline-velocity',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 45_000 },
  )
  const { data: winLossRes, isLoading: winLossLoading, mutate: mutateWinLoss } = useSWR<{ data: WinLossData }>(
    '/api/analytics/win-loss',
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
  const { data: pipelineConfigRes } = useSWR<PipelineConfigResponse>('/api/pipeline-config', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  })
  const { data: productRes, mutate: mutateProduct } = useSWR<{ data: ProductSignalsData }>(
    '/api/dashboard/product-signals',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 45_000 },
  )
  const { data: loopRes, mutate: mutateLoops } = useSWR<{ data: LoopSignalsData }>(
    '/api/dashboard/loop-signals',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 45_000 },
  )

  const velocity = velocityRes?.data
  const winLoss = winLossRes?.data
  const brain = brainRes?.data ?? {}
  const deals = useMemo(() => dealsRes?.data ?? [], [dealsRes?.data])
  const pipelineConfig = pipelineConfigRes?.data
  const openDeals = useMemo(
    () => deals.filter(deal => !['closed_won', 'closed_lost'].includes(deal.stage)),
    [deals],
  )
  const productSignals = productRes?.data
  const loopSignals = loopRes?.data
  const commitValue = useMemo(
    () => openDeals.filter(deal => deal.forecastCategory === 'commit').reduce((sum, deal) => sum + (deal.dealValue ?? 0), 0),
    [openDeals],
  )
  const upsideValue = useMemo(
    () => openDeals.filter(deal => deal.forecastCategory === 'upside').reduce((sum, deal) => sum + (deal.dealValue ?? 0), 0),
    [openDeals],
  )
  const weightedValue = useMemo(
    () => openDeals.reduce((sum, deal) => sum + ((deal.dealValue ?? 0) * ((deal.conversionScore ?? 0) / 100)), 0),
    [openDeals],
  )
  const lateStageCount = useMemo(
    () => openDeals.filter(deal => ['proposal', 'negotiation'].includes(deal.stage)).length,
    [openDeals],
  )

  const watchlist = useMemo<WatchItem[]>(() => {
    const dealMap = new Map(deals.map(deal => [deal.id, deal]))
    const next: WatchItem[] = []
    const seen = new Set<string>()

    for (const prediction of brain.mlPredictions ?? []) {
      const deal = dealMap.get(prediction.dealId)
      if (!deal) continue
      if ((prediction.churnRisk ?? 0) < 60) continue
      next.push({
        dealId: deal.id,
        company: deal.prospectCompany,
        stage: deal.stage,
        risk: `${Math.round(prediction.churnRisk ?? 0)}% churn risk from inactivity and deal cooling.`,
        score: deal.conversionScore,
        value: deal.dealValue,
      })
      seen.add(deal.id)
    }

    for (const stale of brain.staleDeals ?? []) {
      if (seen.has(stale.dealId)) continue
      const deal = dealMap.get(stale.dealId)
      next.push({
        dealId: stale.dealId,
        company: deal?.prospectCompany ?? stale.company,
        stage: deal?.stage ?? '',
        risk: `${stale.daysSinceUpdate} days without an update.`,
        score: deal?.conversionScore,
        value: deal?.dealValue,
      })
      seen.add(stale.dealId)
    }

    for (const urgent of brain.urgentDeals ?? []) {
      if (seen.has(urgent.dealId)) continue
      const deal = dealMap.get(urgent.dealId)
      next.push({
        dealId: urgent.dealId,
        company: deal?.prospectCompany ?? urgent.company,
        stage: deal?.stage ?? '',
        risk: urgent.reason,
        score: deal?.conversionScore,
        value: deal?.dealValue,
      })
      seen.add(urgent.dealId)
    }

    return next.slice(0, 5)
  }, [brain.mlPredictions, brain.staleDeals, brain.urgentDeals, deals])

  const revenueFrictionItems = useMemo<IntelligenceBriefItem[]>(() => {
    const next: IntelligenceBriefItem[] = []

    for (const gap of (productSignals?.gaps ?? []).slice(0, 3)) {
      next.push({
        id: `gap-${gap.title}`,
        title: gap.title,
        detail: `${gap.dealsBlocked} live deal${gap.dealsBlocked === 1 ? '' : 's'} are feeling this friction right now.`,
        meta: `${compactMoney(gap.revenueAtRisk)} at risk · ${gap.status}`,
        tone: 'risk',
      })
    }

    for (const loop of (productSignals?.recentLoops ?? []).slice(0, 2)) {
      next.push({
        id: `recent-loop-${loop.id}`,
        title: loop.label,
        detail: loop.dealName ?? loop.issueId ?? 'A linked commercial issue is waiting for product or ops follow-through.',
        meta: `Raised ${formatRelativeTime(loop.createdAt)}`,
        tone: 'active',
      })
    }

    for (const item of (loopSignals?.inFlight ?? []).slice(0, 2)) {
      next.push({
        id: `in-flight-${item.id}`,
        title: item.company,
        detail: `Commercial feedback is already moving through delivery${item.inCycleIssues?.length ? ` with ${item.inCycleIssues.length} linked issue${item.inCycleIssues.length === 1 ? '' : 's'}` : ''}.`,
        meta: `${item.loopStage === 'awaiting_approval' ? 'Awaiting approval' : 'In flight'} · ${item.pendingActionCreatedAt ? `Updated ${formatRelativeTime(item.pendingActionCreatedAt)}` : stageLabelFor(item.stage, pipelineConfig)}`,
        tone: 'active',
      })
    }

    return next.slice(0, 6)
  }, [loopSignals?.inFlight, pipelineConfig, productSignals?.gaps, productSignals?.recentLoops])

  const recentChangeItems = useMemo<IntelligenceBriefItem[]>(() => {
    const next: IntelligenceBriefItem[] = []

    for (const action of (productSignals?.recentActions ?? []).slice(0, 3)) {
      next.push({
        id: `action-${action.id}`,
        title: action.label,
        detail: action.dealName ?? action.issueId ?? 'Workspace action captured by Halvex.',
        meta: `Logged ${formatRelativeTime(action.createdAt)}`,
        tone: 'active',
      })
    }

    for (const item of (loopSignals?.closedLoops ?? []).slice(0, 3)) {
      next.push({
        id: `closed-${item.id}`,
        title: item.company,
        detail: `A revenue loop closed with ${item.issueCount} shipped item${item.issueCount === 1 ? '' : 's'}.`,
        meta: item.deployedAt ? `Shipped ${formatRelativeTime(item.deployedAt)}` : 'Recently closed',
        tone: 'resolved',
      })
    }

    return next.slice(0, 6)
  }, [loopSignals?.closedLoops, productSignals?.recentActions])

  const heroCopy = useMemo(() => {
    const stagePressure = velocity?.bottleneck
      ? `${stageLabelFor(velocity.bottleneck.stage, pipelineConfig)} is constraining throughput with ${velocity.bottleneck.reason.toLowerCase()}.`
      : 'The pipeline is building signal across active stages.'
    const winSignal = winLoss?.winFactors?.[0]?.factor
      ? `The strongest repeatable win factor right now is ${winLoss.winFactors[0].factor.toLowerCase()}.`
      : 'Closed-deal patterns will sharpen as more outcomes land.'
    const riskSignal = watchlist[0]?.risk
      ? `The sharpest watch item is ${watchlist[0].company}: ${watchlist[0].risk.toLowerCase()}`
      : 'No single deal is materially overheating right now.'

    return `${stagePressure} ${winSignal} ${riskSignal}`
  }, [pipelineConfig, velocity?.bottleneck, watchlist, winLoss?.winFactors])

  const maxWinFactor = Math.max(...(winLoss?.winFactors?.map(item => item.count) ?? [1]), 1)
  const maxLossReason = Math.max(...(winLoss?.lossReasons?.map(item => item.count) ?? [1]), 1)
  const maxStageCount = Math.max(...(velocity?.stageMetrics?.map(item => item.dealCount) ?? [1]), 1)

  async function refreshAll() {
    setRefreshing(true)
    try {
      await Promise.all([
        mutateVelocity(),
        mutateWinLoss(),
        mutateBrain(),
        mutateDeals(),
        mutateProduct(),
        mutateLoops(),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="signals-shell">
      <style>{`
        .signals-shell {
          display: flex;
          flex-direction: column;
          gap: clamp(20px, 2.4vw, 28px);
          width: min(100%, 1280px);
        }
        .signals-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }
        .signals-eyebrow {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-4);
          margin-bottom: 6px;
        }
        .signals-title {
          font-size: 34px;
          line-height: 1.02;
          letter-spacing: -0.05em;
          color: var(--ink);
          font-weight: 600;
        }
        .signals-subtitle {
          margin-top: 10px;
          font-size: 13px;
          color: var(--ink-3);
          max-width: 720px;
        }
        .signals-refresh {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .signals-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(46, 90, 172, 0.08);
          color: var(--cool);
          font-size: 11px;
          font-weight: 500;
          border: 1px solid rgba(46, 90, 172, 0.12);
        }
        .signals-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
          gap: 16px;
        }
        .signals-hero-card {
          padding: clamp(18px, 2.2vw, 26px);
        }
        .signals-hero-copy {
          margin-top: 14px;
          font-size: 27px;
          line-height: 1.28;
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        .signals-hero-notes {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
        }
        .signals-note {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.44);
          border: 1px solid rgba(255, 255, 255, 0.72);
          font-size: 11px;
          color: var(--ink-2);
        }
        .signals-metric-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .signals-metric {
          padding: 14px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.72);
        }
        .signals-metric-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-4);
          margin-bottom: 4px;
          font-weight: 600;
        }
        .signals-metric-value {
          font-size: 24px;
          line-height: 1;
          color: var(--ink);
          letter-spacing: -0.04em;
          font-weight: 600;
        }
        .signals-metric-meta {
          margin-top: 6px;
          font-size: 11px;
          color: var(--ink-3);
        }
        .signals-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.92fr);
          gap: 16px;
        }
        .signals-panel {
          padding: clamp(16px, 2vw, 18px);
          min-width: 0;
        }
        .signals-stage-stack,
        .signals-pattern-stack,
        .signals-watch-stack,
        .signals-simple-stack {
          display: grid;
          gap: 12px;
        }
        .signals-stage-row,
        .signals-watch-row,
        .signals-simple-row {
          display: grid;
          gap: 10px;
          padding: 14px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.72);
        }
        .signals-stage-head,
        .signals-watch-head,
        .signals-simple-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .signals-row-title {
          font-size: 13px;
          color: var(--ink);
          font-weight: 600;
        }
        .signals-row-meta {
          font-size: 11px;
          color: var(--ink-4);
        }
        .signals-simple-body {
          font-size: 12px;
          line-height: 1.55;
          color: var(--ink-2);
        }
        .signals-stage-bar,
        .signals-pattern-bar {
          height: 5px;
          border-radius: 999px;
          background: rgba(20, 17, 10, 0.06);
          overflow: hidden;
        }
        .signals-stage-fill,
        .signals-pattern-fill {
          height: 100%;
          border-radius: 999px;
        }
        .signals-stage-fill {
          background: linear-gradient(90deg, #1DB86A 0%, #72D9A7 100%);
        }
        .signals-pattern-fill-positive {
          background: linear-gradient(90deg, #1DB86A 0%, #72D9A7 100%);
        }
        .signals-pattern-fill-risk {
          background: linear-gradient(90deg, #B23A3A 0%, #DA7777 100%);
        }
        .signals-stage-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 11px;
          color: var(--ink-3);
        }
        .signals-watch-row {
          transition: transform 0.16s ease, background 0.16s ease;
        }
        .signals-watch-row:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.56);
        }
        .signals-watch-copy {
          font-size: 12px;
          line-height: 1.55;
          color: var(--ink-2);
        }
        .signals-chip-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .signals-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 999px;
          font-size: 10px;
          color: var(--ink-3);
          background: rgba(20, 17, 10, 0.05);
        }
        .signals-chip-risk {
          background: rgba(178, 58, 58, 0.12);
          color: var(--risk);
        }
        .signals-chip-active {
          background: rgba(46, 90, 172, 0.12);
          color: var(--cool);
        }
        .signals-chip-resolved {
          background: rgba(29, 184, 106, 0.1);
          color: var(--signal);
        }
        .signals-pattern-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.72);
        }
        .signals-pattern-copy {
          min-width: 0;
        }
        .signals-pattern-title {
          font-size: 12px;
          color: var(--ink-2);
          line-height: 1.5;
          margin-bottom: 8px;
        }
        .signals-pattern-count {
          font-size: 12px;
          font-weight: 700;
        }
        .signals-pattern-count-positive {
          color: var(--signal);
        }
        .signals-pattern-count-risk {
          color: var(--risk);
        }
        .signals-loop-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .signals-loop-column {
          padding: 14px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.42);
          border: 1px solid rgba(255, 255, 255, 0.68);
        }
        .signals-loop-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-4);
          margin-bottom: 10px;
          font-weight: 600;
        }
        .signals-loop-stack {
          display: grid;
          gap: 8px;
        }
        .signals-empty {
          min-height: 160px;
          display: grid;
          place-items: center;
          text-align: center;
          color: var(--ink-3);
          font-size: 12px;
          line-height: 1.6;
        }
        @media (max-width: 1180px) {
          .signals-shell {
            width: 100%;
          }
        }
        @media (max-width: 1080px) {
          .signals-hero,
          .signals-grid {
            grid-template-columns: 1fr;
          }
          .signals-loop-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .signals-title {
            font-size: 28px;
          }
          .signals-hero-copy {
            font-size: 22px;
          }
          .signals-metric-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="signals-header">
        <div>
          <div className="signals-eyebrow">Intelligence</div>
          <div className="signals-title">Intelligence</div>
          <div className="signals-subtitle">
            See where momentum is compounding, where deals are sticking, and which patterns are actually worth acting on.
          </div>
        </div>
        <div className="signals-refresh">
          <div className="signals-status">
            <Activity size={12} strokeWidth={2} />
            {brain.updatedAt ? `Updated ${formatRelativeTime(brain.updatedAt)}` : 'Live'}
          </div>
          <button className="btn" onClick={refreshAll} disabled={refreshing}>
            <RefreshCw size={13} strokeWidth={2} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
            Refresh
          </button>
        </div>
      </div>

      <div className="signals-hero">
        <section className="panel-section signals-hero-card">
          <div className="ai-badge">
            <span className="pulse" />
            Intelligence briefing
          </div>
          <div className="signals-hero-copy">
            <AIVoice as="span">{heroCopy}</AIVoice>
          </div>
          <div className="signals-hero-notes">
            {(brain.keyPatterns?.length ? brain.keyPatterns : [{ label: 'Intelligence sharpens as Halvex sees more closed outcomes.', dealIds: [], companies: [] }])
              .slice(0, 3)
              .map((pattern, index) => (
                <span key={`${pattern.label}-${index}`} className="signals-note">
                  <Sparkles size={12} strokeWidth={2} />
                  {pattern.label}
                </span>
              ))}
          </div>
        </section>

        <section className="panel-section signals-panel">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <h2 className="section-title">Forecast lens</h2>
            <Link href="/deals?view=board" className="section-action">
              Pipeline board
              <ArrowRight size={12} />
            </Link>
          </div>
          <div className="signals-metric-grid">
            <SignalsMetric
              label="Commit"
              value={commitValue ? compactMoney(commitValue) : '—'}
              meta={`${openDeals.filter(deal => deal.forecastCategory === 'commit').length} deals in commit`}
            />
            <SignalsMetric
              label="Upside"
              value={upsideValue ? compactMoney(upsideValue) : '—'}
              meta={`${openDeals.filter(deal => deal.forecastCategory === 'upside').length} deals in upside`}
            />
            <SignalsMetric
              label="Weighted"
              value={weightedValue ? compactMoney(weightedValue) : '—'}
              meta="Probability-weighted pipeline"
            />
            <SignalsMetric
              label="Late stage"
              value={String(lateStageCount)}
              meta={velocity?.avgCycleLength ? `${velocity.avgCycleLength}d average cycle` : 'Proposal + negotiation'}
            />
          </div>
        </section>
      </div>

      <div className="signals-grid">
        <section className="panel-section signals-panel">
          <div className="section-head">
            <h2 className="section-title">Where deals are sticking</h2>
            <span className="section-action">{velocity?.bottleneck ? `Focus: ${stageLabelFor(velocity.bottleneck.stage, pipelineConfig)}` : 'Healthy flow'}</span>
          </div>
          {velocityLoading ? (
            <div className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-lg)' }} />
          ) : !velocity?.stageMetrics?.length ? (
            <div className="signals-empty">Stage pressure will appear once deals start moving through the pipeline.</div>
          ) : (
            <div className="signals-stage-stack">
              {velocity.stageMetrics.map(stage => (
                <div key={stage.stage} className="signals-stage-row">
                  <div className="signals-stage-head">
                    <div className="signals-row-title">{stageLabelFor(stage.stage, pipelineConfig)}</div>
                    <div className="signals-row-meta">{stage.dealCount} deals</div>
                  </div>
                  <div className="signals-stage-bar">
                    <div className="signals-stage-fill" style={{ width: `${(stage.dealCount / maxStageCount) * 100}%` }} />
                  </div>
                  <div className="signals-stage-footer">
                    <span>{stage.avgDays ? `${stage.avgDays}d avg dwell` : 'No dwell data yet'}</span>
                    <span>{stage.conversionRate}% progress</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel-section signals-panel">
          <div className="section-head">
            <h2 className="section-title">Needs intervention</h2>
            <Link href="/deals" className="section-action">
              Pipeline
              <ArrowRight size={12} />
            </Link>
          </div>
          {watchlist.length === 0 ? (
            <div className="signals-empty">No material churn or stale-deal pressure is showing right now.</div>
          ) : (
            <div className="signals-watch-stack">
              {watchlist.map(item => (
                <Link key={item.dealId} href={`/deals/${item.dealId}`} className="signals-watch-row">
                  <div className="signals-watch-head">
                    <div className="signals-row-title">{item.company}</div>
                    <div className="signals-chip-row">
                      <span className="signals-chip">{stageLabelFor(item.stage, pipelineConfig)}</span>
                      {item.score != null ? <span className="signals-chip mono">{Math.round(item.score)}</span> : null}
                      {item.value ? <span className="signals-chip mono">{compactMoney(item.value)}</span> : null}
                    </div>
                  </div>
                  <div className="signals-watch-copy">{item.risk}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="signals-grid">
        <section className="panel-section signals-panel">
          <div className="section-head">
            <h2 className="section-title">Signals to repeat</h2>
            <span className="section-action">{winLoss?.overall?.won ?? 0} closed won</span>
          </div>
          {winLossLoading ? (
            <div className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-lg)' }} />
          ) : !(winLoss?.winFactors?.length ?? 0) ? (
            <div className="signals-empty">Win patterns need a few closed-won deals before they become trustworthy.</div>
          ) : (
            <div className="signals-pattern-stack">
              {winLoss?.winFactors?.slice(0, 5).map(item => (
                <PatternRow
                  key={item.factor}
                  label={item.factor}
                  count={item.count}
                  max={maxWinFactor}
                  tone="positive"
                />
              ))}
            </div>
          )}
        </section>

        <section className="panel-section signals-panel">
          <div className="section-head">
            <h2 className="section-title">Signals that kill momentum</h2>
            <span className="section-action">{winLoss?.overall?.lost ?? 0} closed lost</span>
          </div>
          {winLossLoading ? (
            <div className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-lg)' }} />
          ) : !(winLoss?.lossReasons?.length ?? 0) ? (
            <div className="signals-empty">Loss reasons will appear once lost deals capture why they slipped away.</div>
          ) : (
            <div className="signals-pattern-stack">
              {winLoss?.lossReasons?.slice(0, 5).map(item => (
                <PatternRow
                  key={item.reason}
                  label={item.reason}
                  count={item.count}
                  max={maxLossReason}
                  tone="risk"
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="signals-grid">
        <section className="panel-section signals-panel">
          <div className="section-head">
            <h2 className="section-title">Competitive pressure</h2>
            <span className="section-action">{winLoss?.competitorImpact?.length ?? 0} tracked</span>
          </div>
          {!(winLoss?.competitorImpact?.length ?? 0) ? (
            <div className="signals-empty">Add competitors to deals to build a reliable head-to-head readout.</div>
          ) : (
            <div className="signals-simple-stack">
              {winLoss?.competitorImpact?.slice(0, 5).map(item => (
                <div key={item.competitor} className="signals-simple-row">
                  <div className="signals-simple-head">
                    <div className="signals-row-title">{item.competitor}</div>
                    <div className="signals-chip-row">
                      <span className="signals-chip">Won {item.wonAgainst}</span>
                      <span className="signals-chip">Lost {item.lostTo}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel-section signals-panel">
          <div className="section-head">
            <h2 className="section-title">Revenue friction</h2>
            <span className="section-action">{revenueFrictionItems.length} active threads</span>
          </div>
          {revenueFrictionItems.length === 0 ? (
            <div className="signals-empty">No material revenue friction is surfacing right now.</div>
          ) : (
            <div className="signals-simple-stack">
              {revenueFrictionItems.map(item => (
                <div key={item.id} className="signals-simple-row">
                  <div className="signals-simple-head">
                    <div className="signals-row-title">{item.title}</div>
                    <div className={`signals-chip signals-chip-${item.tone}`}>{item.tone === 'risk' ? 'Risk' : 'In motion'}</div>
                  </div>
                  <div className="signals-simple-body">{item.detail}</div>
                  <div className="signals-row-meta">{item.meta}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel-section signals-panel">
        <div className="section-head">
          <h2 className="section-title">What changed recently</h2>
          <span className="section-action">{recentChangeItems.length} recent shifts</span>
        </div>
        {recentChangeItems.length === 0 ? (
          <div className="signals-empty">Recent shifts will appear here once Halvex sees shipping, follow-through, and revenue feedback close the loop.</div>
        ) : (
          <div className="signals-simple-stack">
            {recentChangeItems.map(item => (
              <div key={item.id} className="signals-simple-row">
                <div className="signals-simple-head">
                  <div className="signals-row-title">{item.title}</div>
                  <div className={`signals-chip signals-chip-${item.tone}`}>{item.tone === 'resolved' ? 'Resolved' : 'Recent'}</div>
                </div>
                <div className="signals-simple-body">{item.detail}</div>
                <div className="signals-row-meta">{item.meta}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
