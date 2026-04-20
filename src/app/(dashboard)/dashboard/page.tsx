'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import Link from 'next/link'
import {
  TrendingUp, Target, ArrowRight,
  RefreshCw, CheckCircle2, Zap,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { formatCurrencyGBP, humanizeActivityLabel } from '@/lib/presentation'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrainData {
  dailyBriefing?: string
  dailyBriefingGeneratedAt?: string
  urgentDeals?: Array<{
    dealId: string
    dealName?: string
    company: string
    reason: string
    topAction?: string
    dealValue?: number | null
    score?: number | null
  }>
  staleDeals?: Array<{
    dealId: string
    dealName?: string
    company: string
    dealValue?: number | null
    daysSinceUpdate: number
    score?: number | null
    stage?: string
  }>
  keyPatterns?: Array<{
    label: string
    dealIds: string[]
    companies: string[]
    dealNames?: string[]
  }>
  winLossIntel?: {
    winRate: number
    winCount: number
    lossCount: number
  }
  pipeline?: {
    totalValue: number
    activeDeals: number
    stageBreakdown?: Record<string, { count: number; value: number }>
  }
  pipelineHealthIndex?: number
  updatedAt?: string
  status?: string
}

interface ActivityEvent {
  id: string
  type: string
  metadata: Record<string, unknown>
  createdAt: string
  dealName?: string
  prospectCompany?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`
  return formatCurrencyGBP(n)
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function eventLabel(type: string, meta: Record<string, unknown>, enrichedDealName?: string): string {
  return humanizeActivityLabel(type, meta, enrichedDealName)
}

function eventDotColor(type: string): string {
  if (['deal_log.created', 'deal_log.closed_won', 'deal_created', 'deal_won', 'case_study.created', 'collateral.generated'].includes(type)) return '#1DB86A'
  if (['deal_log.closed_lost', 'deal_log.deleted', 'deal_lost'].includes(type)) return '#ef4444'
  if (['ai_analysis', 'deal_log.ai_scored', 'deal_log.todos_updated'].includes(type)) return '#f59e0b'
  if (['collateral.archived', 'plan.downgraded'].includes(type)) return '#aaa'
  return '#3b82f6'
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Skeleton({ h = 80 }: { h?: number }) {
  return (
    <div style={{ height: h, borderRadius: 8 }} className="skeleton" />
  )
}

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prospecting', qualification: 'Qualification', discovery: 'Discovery',
  demo: 'Demo', proposal: 'Proposal', negotiation: 'Negotiation',
}

interface TodayAction {
  dealId: string
  dealName: string
  stage: string
  action: string
  context: string
  value?: number | null
  score?: number | null
  priority: 'high' | 'medium' | 'low'
  daysSinceUpdate?: number
}

function buildTodayActions(
  deals: Array<{ id: string; dealName: string; prospectCompany: string; stage: string; dealValue: number | null; conversionScore: number | null; aiSummary: string | null; nextSteps: string | null; conversionInsights: string[]; updatedAt: string }>,
  brain: BrainData
): TodayAction[] {
  const actions: TodayAction[] = []
  const seen = new Set<string>()

  const openDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))

  const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

  // 1. Deals with explicit nextSteps — most specific, direct instructions
  const withNextSteps = openDeals
    .filter(d => d.nextSteps?.trim())
    .sort((a, b) => (a.conversionScore ?? 50) - (b.conversionScore ?? 50))

  for (const deal of withNextSteps) {
    if (actions.length >= 5) break
    if (seen.has(deal.id)) continue
    const score = deal.conversionScore
    const priority: TodayAction['priority'] = score != null && score < 40 ? 'high' : score != null && score < 65 ? 'medium' : 'low'
    const context = deal.aiSummary?.slice(0, 120) ?? deal.conversionInsights?.[0]?.slice(0, 120) ?? ''
    actions.push({ dealId: deal.id, dealName: deal.dealName || deal.prospectCompany, stage: deal.stage, action: deal.nextSteps!.trim(), context, value: deal.dealValue, score, priority, daysSinceUpdate: daysSince(deal.updatedAt) })
    seen.add(deal.id)
  }

  // 2. Top-up: deals with AI insights but no nextSteps
  if (actions.length < 5) {
    const withInsights = openDeals
      .filter(d => !seen.has(d.id) && (d.aiSummary || d.conversionInsights?.length))
      .sort((a, b) => (a.conversionScore ?? 50) - (b.conversionScore ?? 50))

    for (const deal of withInsights) {
      if (actions.length >= 5) break
      const insights = deal.conversionInsights ?? []
      const bestInsight = [...insights].sort((a, b) => b.length - a.length)[0]
      const action = bestInsight || deal.aiSummary?.split('.')[0] || ''
      if (!action || action.length < 20) continue
      const score = deal.conversionScore
      const priority: TodayAction['priority'] = score != null && score < 40 ? 'high' : score != null && score < 65 ? 'medium' : 'low'
      const context = deal.aiSummary?.slice(0, 120) ?? insights[1]?.slice(0, 120) ?? ''
      actions.push({ dealId: deal.id, dealName: deal.dealName || deal.prospectCompany, stage: deal.stage, action, context, value: deal.dealValue, score, priority, daysSinceUpdate: daysSince(deal.updatedAt) })
      seen.add(deal.id)
    }
  }

  // 3. Brain urgent/stale deals as fallback
  for (const d of (brain.urgentDeals ?? [])) {
    if (actions.length >= 5) break
    if (seen.has(d.dealId)) continue
    actions.push({ dealId: d.dealId, dealName: d.dealName ?? d.company, stage: '', action: d.topAction ?? d.reason ?? 'Address this deal urgently', context: d.reason ?? '', value: d.dealValue, score: d.score, priority: 'high' })
    seen.add(d.dealId)
  }
  for (const d of (brain.staleDeals ?? [])) {
    if (actions.length >= 5) break
    if (seen.has(d.dealId)) continue
    actions.push({ dealId: d.dealId, dealName: d.dealName ?? d.company, stage: d.stage ?? '', action: `Re-engage — no contact in ${d.daysSinceUpdate} days`, context: d.stage ? `In ${d.stage.replace(/_/g, ' ')}` : '', value: d.dealValue, score: d.score, priority: d.daysSinceUpdate > 14 ? 'high' : 'medium', daysSinceUpdate: d.daysSinceUpdate })
    seen.add(d.dealId)
  }

  return actions.slice(0, 5)
}

function TodayActionCard({ item }: { item: TodayAction }) {
  const isHigh = item.priority === 'high'
  const isMed  = item.priority === 'medium'
  const accentColor = isHigh ? '#ef4444' : isMed ? '#f59e0b' : '#1DB86A'
  const staleFlag = item.daysSinceUpdate != null && item.daysSinceUpdate >= 7

  return (
    <Link href={`/deals/${item.dealId}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          padding: '13px 16px', borderRadius: 9,
          border: '1px solid var(--border-default)',
          background: 'var(--surface-2)',
          cursor: 'pointer', transition: 'border-color 80ms, background 80ms',
          display: 'flex', gap: 12, alignItems: 'flex-start',
          borderLeft: `3px solid ${accentColor}`,
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = 'var(--border-strong)'
          el.style.background = 'var(--surface-hover)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = 'var(--border-default)'
          el.style.background = 'var(--surface-2)'
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row: company + metadata chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {item.dealName}
            </span>
            {item.stage && STAGE_LABELS[item.stage] && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--surface-3)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '1px 6px' }}>
                {STAGE_LABELS[item.stage]}
              </span>
            )}
            {item.value != null && item.value > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--brand)', fontFamily: 'var(--font-mono)' }}>
                {fmtCurrency(item.value)}
              </span>
            )}
            {item.score != null && (
              <span style={{ fontSize: 10, fontWeight: 700, color: accentColor }}>
                {Math.round(item.score)}
              </span>
            )}
            {staleFlag && (
              <span style={{ fontSize: 10, color: 'var(--color-amber)', fontWeight: 500 }}>
                · {item.daysSinceUpdate}d ago
              </span>
            )}
          </div>
          {/* Action — the key thing to do */}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45 }}>
            {item.action}
          </div>
          {/* Context — why */}
          {item.context && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
              {item.context}
            </div>
          )}
        </div>
        <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
      </div>
    </Link>
  )
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const dot = eventDotColor(event.type)
  const label = eventLabel(event.type, event.metadata, event.dealName)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: dot, boxShadow: `0 0 0 3px ${dot}20`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{relativeTime(event.createdAt)}</div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [renderedAt] = useState(() => new Date())
  const { user } = useUser()

  const { data: brainRes, isLoading: brainLoading, mutate: mutateBrain } = useSWR('/api/brain', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const { data: activityRes, isLoading: actLoading } = useSWR('/api/activity?limit=20', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
  const { data: dealsRes } = useSWR('/api/deals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const brain: BrainData = brainRes?.data ?? {}
  const activity: ActivityEvent[] = activityRes?.data ?? []
  const deals: Array<{
    id: string
    dealName: string
    prospectCompany: string
    stage: string
    dealValue: number | null
    conversionScore: number | null
    aiSummary: string | null
    nextSteps: string | null
    conversionInsights: string[]
    updatedAt: string
    forecastCategory?: 'commit' | 'upside' | 'pipeline' | 'omit' | null
  }> = dealsRes?.data ?? []

  const openDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const pipelineValue = openDeals.reduce((s, d) => s + (d.dealValue ?? 0), 0)

  // ── Forecast buckets ──────────────────────────────────────────────────────
  const commitDeals  = openDeals.filter(d => d.forecastCategory === 'commit')
  const upsideDeals  = openDeals.filter(d => d.forecastCategory === 'upside')
  const pipelineDeals= openDeals.filter(d => d.forecastCategory === 'pipeline')
  const uncategorised= openDeals.filter(d => !d.forecastCategory || d.forecastCategory === null)
  const commitValue  = commitDeals.reduce((s, d) => s + (d.dealValue ?? 0), 0)
  const upsideValue  = upsideDeals.reduce((s, d) => s + (d.dealValue ?? 0), 0)
  const pipelineCatValue = pipelineDeals.reduce((s, d) => s + (d.dealValue ?? 0), 0)
  const hasForecast  = commitDeals.length + upsideDeals.length + pipelineDeals.length > 0
  // Weighted: commit=90%, upside=50%, pipeline/uncategorised=score-based or 20%
  const weightedForecast = Math.round(
    commitValue  * 0.90 +
    upsideValue  * 0.50 +
    pipelineCatValue * 0.20 +
    uncategorised.reduce((s, d) => s + (d.dealValue ?? 0) * ((d.conversionScore ?? 30) / 100) * 0.5, 0)
  )
  const bestCase = commitValue + upsideValue
  const atRisk = openDeals.filter(d => (d.conversionScore ?? 50) < 40).length
  const onTrack = openDeals.filter(d => (d.conversionScore ?? 50) >= 60).length
  const staleCount = (brain.staleDeals ?? []).length
  const wonCount = brain.winLossIntel?.winCount ?? 0
  const avgScore = openDeals.length > 0
    ? Math.round(openDeals.reduce((s, d) => s + (d.conversionScore ?? 50), 0) / openDeals.length)
    : null
  const winRate = brain.winLossIntel ? Math.round(brain.winLossIntel.winRate * 100) : null

  const todayActions = buildTodayActions(deals, brain)

  const isBrainBuilding = brainRes?.status === 'building'
  const brainAge = brain.updatedAt
    ? (() => {
        const mins = Math.floor((renderedAt.getTime() - new Date(brain.updatedAt).getTime()) / 60000)
        if (mins < 2) return 'live'
        if (mins < 60) return `${mins}m ago`
        return `${Math.floor(mins / 60)}h ago`
      })()
    : null

  const hour = renderedAt.getHours()
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  return (
    <div style={{ paddingTop: 4, maxWidth: 1100 }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
            {todayLabel()}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0 }}>
            {user?.firstName ? `Good ${greeting}, ${user.firstName}` : 'Today'}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(brainAge || isBrainBuilding) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 100,
              background: isBrainBuilding ? 'var(--color-amber-bg)' : 'var(--color-green-bg)',
              border: `1px solid ${isBrainBuilding ? 'rgba(251,191,36,0.30)' : 'rgba(29,184,106,0.20)'}`,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: isBrainBuilding ? '#f59e0b' : '#1DB86A',
              }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: isBrainBuilding ? 'var(--color-amber)' : 'var(--color-green)' }}>
                {isBrainBuilding ? 'Analysing…' : `Updated ${brainAge}`}
              </span>
            </div>
          )}
          <button
            onClick={() => mutateBrain()}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={10} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── TODAY'S 5 ACTIONS ── */}
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border-default)',
        borderRadius: 12, marginBottom: 16, overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 22px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 5,
              background: todayActions.length > 0 ? 'var(--color-red-bg)' : 'var(--color-green-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={10} style={{ color: todayActions.length > 0 ? '#ef4444' : '#1DB86A' }} />
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              5 Things To Do Today
            </span>
            {todayActions.length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#ef4444',
                background: 'var(--color-red-bg)', border: '1px solid rgba(248,113,113,0.30)',
                borderRadius: 99, padding: '1px 6px',
              }}>{todayActions.length}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>AI-identified from your pipeline</span>
            <Link href="/deals" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>All deals →</Link>
          </div>
        </div>

        <div style={{ padding: '16px 22px' }}>
          {brainLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton h={66} /><Skeleton h={66} /><Skeleton h={66} />
            </div>
          ) : todayActions.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
              <CheckCircle2 size={20} style={{ color: '#1DB86A', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Pipeline is clear</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {openDeals.length === 0
                    ? 'Add your first deal to start tracking intelligence.'
                    : 'No urgent actions or stale deals right now. Great work!'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {todayActions.map((item) => (
                <TodayActionCard key={item.dealId} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Pipeline + Forecast (merged) ── */}
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border-default)',
        borderRadius: 12, marginBottom: 16, overflow: 'hidden',
      }}>
        {/* Top: pipeline stats */}
        <div style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 22, flexShrink: 0 }}>
            <TrendingUp size={11} style={{ color: '#1DB86A' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pipeline
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
            {[
              { value: fmtCurrency(pipelineValue), label: 'value' },
              { value: String(openDeals.length), label: 'deals' },
              { value: avgScore != null ? String(avgScore) : '—', label: 'avg score' },
              { value: winRate != null ? `${winRate}%` : '—', label: 'win rate' },
            ].map((item, i) => (
              <div key={i} style={{
                padding: '2px 18px',
                borderRight: i < 3 ? '1px solid var(--border-subtle)' : 'none',
                display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.label}</div>
              </div>
            ))}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, paddingLeft: 18, flexWrap: 'wrap' }}>
              {[
                { count: atRisk,    label: 'at risk',  color: '#ef4444' },
                { count: onTrack,   label: 'on track', color: '#1DB86A' },
                { count: staleCount,label: 'stale',    color: '#f59e0b' },
                { count: wonCount,  label: 'won',      color: '#3b82f6' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {s.count} {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: forecast */}
        <div style={{ padding: '14px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasForecast ? 12 : 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Forecast
            </span>
            {!hasForecast && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Tag deals as <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Commit</strong>, <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Upside</strong> or <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Pipeline</strong> to unlock
              </span>
            )}
            <Link href="/deals" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
              Deals →
            </Link>
          </div>
          {hasForecast && (
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
              {[
                { label: 'Commit',   value: commitValue,        color: '#1DB86A',          count: commitDeals.length,  sub: '90% confidence' },
                { label: 'Upside',   value: upsideValue,        color: '#3b82f6',          count: upsideDeals.length,  sub: '50% confidence' },
                { label: 'Best case',value: bestCase,           color: '#f59e0b',          count: null,                sub: 'Commit + Upside' },
                { label: 'Weighted', value: weightedForecast,   color: 'var(--text-tertiary)', count: null,            sub: 'Probability-adjusted' },
              ].map((item, i) => (
                <div key={i} style={{
                  flex: 1,
                  paddingLeft: i > 0 ? 20 : 0,
                  paddingRight: i < 3 ? 20 : 0,
                  borderRight: i < 3 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div style={{ fontSize: 10, color: item.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1.1 }}>{fmtCurrency(item.value)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {item.count != null ? `${item.count} deal${item.count !== 1 ? 's' : ''} · ` : ''}{item.sub}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Intelligence + Activity ── */}
      <div className="dash-bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14 }}>
        <style>{`@media (max-width: 900px) { .dash-bottom-grid { grid-template-columns: 1fr !important; } }`}</style>

        {/* Intelligence / Patterns */}
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border-default)',
          borderRadius: 12, padding: '18px 22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <TrendingUp size={11} style={{ color: '#1DB86A' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Win Patterns
              </span>
            </div>
            <Link href="/intelligence" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>All signals →</Link>
          </div>

          {brainLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton h={48} /><Skeleton h={48} /><Skeleton h={48} />
            </div>
          ) : (brain.keyPatterns ?? []).length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <Target size={20} style={{ color: 'var(--border-strong)', display: 'block', margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>Patterns emerge after AI analysis on deals.</div>
              <Link href="/deals" style={{ fontSize: 12, color: '#1DB86A', textDecoration: 'none', fontWeight: 600 }}>
                Analyse a deal →
              </Link>
            </div>
          ) : (
            <>
              {brain.dailyBriefing && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
                  {brain.dailyBriefing}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(brain.keyPatterns ?? []).slice(0, 6).map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</div>
                      {(p.dealNames ?? []).length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.dealNames!.slice(0, 3).join(' · ')}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1DB86A', background: 'rgba(29,184,106,0.10)', border: '1px solid rgba(29,184,106,0.20)', borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>
                      {p.dealIds.length} deal{p.dealIds.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Activity Feed */}
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border-default)',
          borderRadius: 12, padding: '18px 20px', alignSelf: 'start',
        }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Recent Activity
            </span>
          </div>

          {actLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...Array(5)].map((_, i) => <Skeleton key={i} h={28} />)}
            </div>
          ) : activity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Target size={18} style={{ color: 'var(--border-default)', display: 'block', margin: '0 auto 6px' }} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No activity yet</div>
            </div>
          ) : (
            <div>{activity.slice(0, 12).map(event => <ActivityRow key={event.id} event={event} />)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
