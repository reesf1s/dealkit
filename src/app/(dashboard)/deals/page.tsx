'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, Brain, Kanban, TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown } from 'lucide-react'
import { DealForm } from '@/components/deals/DealForm'
import { useToast } from '@/components/shared/Toast'
import SetupBanner from '@/components/shared/SetupBanner'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'
import type { DealLog } from '@/types'
import type { LoopEntry, LoopStatus } from '@/app/api/loops/route'

/* ── Constants ── */

const LOOP_STATUS_CONFIG: Record<LoopStatus, { label: string; color: string }> = {
  identified: { label: 'Identified', color: '#f59e0b' },
  in_cycle:   { label: 'In Cycle',   color: '#3b82f6' },
  shipped:    { label: 'Shipped',    color: '#22c55e' },
}

type Mode = 'intelligence' | 'kanban'
type Filter = 'all' | 'at_risk' | 'closing_soon' | 'stale' | 'won' | 'lost'
type SortKey = 'company' | 'value' | 'score' | 'stage'
type SortDir = 'asc' | 'desc'

const STAGES = [
  { id: 'prospecting',   label: 'Prospecting',   color: '#64748b' },
  { id: 'qualification', label: 'Qualification',  color: '#3b82f6' },
  { id: 'discovery',     label: 'Discovery',      color: '#8b5cf6' },
  { id: 'proposal',      label: 'Proposal',       color: '#f59e0b' },
  { id: 'negotiation',   label: 'Negotiation',    color: '#ef4444' },
  { id: 'closed_won',    label: 'Closed Won',     color: '#10b981' },
  { id: 'closed_lost',   label: 'Closed Lost',    color: '#94a3b8' },
]

const STAGE_ORDER: Record<string, number> = {}
STAGES.forEach((s, i) => { STAGE_ORDER[s.id] = i })

const FILTER_TABS: { id: Filter; label: string }[] = [
  { id: 'all',          label: 'All' },
  { id: 'at_risk',      label: 'At Risk' },
  { id: 'closing_soon', label: 'Closing Soon' },
  { id: 'stale',        label: 'Stale' },
  { id: 'won',          label: 'Won' },
  { id: 'lost',         label: 'Lost' },
]

/* ── Helpers ── */

function statusDot(score: number): string {
  if (score <= 0) return 'rgba(148,163,184,0.35)'
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function formatVal(v: number, sym: string): string {
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `${sym}${Math.round(v / 1_000)}k`
  return `${sym}${v}`
}

function fmtPipeline(n: number, sym: string): string {
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `${sym}${Math.round(n / 1_000)}k`
  return n > 0 ? `${sym}${Math.round(n)}` : '\u2014'
}

function stageLabel(id: string): string {
  return STAGES.find(s => s.id === id)?.label ?? id?.replace('_', ' ') ?? ''
}

/* ── Shared glass tokens ── */

const GLASS = {
  surface: 'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.08)',
  borderHover: 'rgba(255,255,255,0.14)',
  blur: 'blur(16px)',
  text: {
    primary: 'rgba(255,255,255,0.88)',
    secondary: 'rgba(255,255,255,0.60)',
    tertiary: 'rgba(255,255,255,0.38)',
    muted: 'rgba(255,255,255,0.22)',
  },
} as const

/* ── Stat Card ── */

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: 'amber' | 'green' | 'red' }) {
  const color = accent === 'amber' ? '#fbbf24' : accent === 'green' ? '#34d399' : accent === 'red' ? '#f87171' : GLASS.text.primary
  return (
    <div>
      <div style={{ fontSize: '11px', color: GLASS.text.tertiary, fontWeight: 500, marginBottom: '4px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

/* ── Sort Header ── */

function SortHeader({ label, sortKey, currentSort, currentDir, onSort, width, align }: {
  label: string; sortKey: SortKey; currentSort: SortKey; currentDir: SortDir
  onSort: (k: SortKey) => void; width?: string; align?: string
}) {
  const active = currentSort === sortKey
  return (
    <div
      onClick={() => onSort(sortKey)}
      style={{
        width, textAlign: (align as any) ?? 'left',
        fontSize: '10px', fontWeight: 600, color: active ? GLASS.text.secondary : GLASS.text.tertiary,
        cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center',
        gap: '2px', justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}
    >
      {label}
      {active && (currentDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
    </div>
  )
}

/* ── Main Page ── */

export default function DealsPage() {
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>('intelligence')
  const [filter, setFilter] = useState<Filter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  /* ── Data hooks ── */
  const { data, isLoading, error, mutate } = useSWR<{ data: DealLog[] }>('/api/deals', fetcher)
  const { data: configData } = useSWR('/api/pipeline-config', fetcher, { revalidateOnFocus: false })
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: loopSignalsRes } = useSWR('/api/dashboard/loop-signals', fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 })
  const { data: loopsRes } = useSWR<{ data: LoopEntry[] }>('/api/loops', fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 })

  const deals = data?.data ?? []
  const dbError = isDbNotConfigured(error)
  const currencySymbol: string = configData?.data?.currency ?? '\u00a3'
  const brain: any = brainRes?.data

  /* ── Derived maps ── */
  const loopMap = useMemo(() => {
    const m = new Map<string, LoopEntry[]>()
    for (const loop of (loopsRes?.data ?? [])) {
      const arr = m.get(loop.dealId) ?? []
      arr.push(loop)
      m.set(loop.dealId, arr)
    }
    return m
  }, [loopsRes?.data])

  const staleDealIds = useMemo(() =>
    new Set<string>((brain?.staleDeals ?? []).map((d: { dealId: string }) => d.dealId)),
    [brain?.staleDeals]
  )

  const urgentDealMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of (brain?.urgentDeals ?? [])) m.set(u.dealId, u.reason)
    return m
  }, [brain?.urgentDeals])

  const dealSnapshotMap = useMemo(() => {
    const m = new Map<string, any>()
    for (const ds of (brain?.deals ?? [])) m.set(ds.id, ds)
    return m
  }, [brain?.deals])

  /* ── Pipeline stats ── */
  const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const totalPipelineValue = activeDeals.reduce((sum: number, d: any) => sum + (Number(d.dealValue) || 0), 0)
  const winRatePct: number | null = brain?.winRate ?? null
  const activeLoopCount: number = loopSignalsRes?.data?.inFlight?.length ?? 0
  const atRiskCount = activeDeals.filter(d => (d.conversionScore ?? 0) > 0 && (d.conversionScore ?? 0) < 40).length

  /* ── Closing soon: deals with closeDate in next 7 days ── */
  const closingSoonIds = useMemo(() => {
    const now = Date.now()
    const week = 7 * 86400000
    const s = new Set<string>()
    for (const d of activeDeals) {
      if (d.closeDate && new Date(d.closeDate).getTime() - now < week && new Date(d.closeDate).getTime() > now) {
        s.add(d.id)
      }
    }
    // Also include urgent deals from brain
    for (const u of (brain?.urgentDeals ?? [])) s.add(u.dealId)
    return s
  }, [deals, brain?.urgentDeals])

  /* ── Filtered + sorted deals for intelligence table ── */
  const filteredDeals = useMemo(() => {
    let list = [...deals]
    switch (filter) {
      case 'at_risk':
        list = list.filter(d => {
          const score = d.conversionScore ?? 0
          return d.stage !== 'closed_won' && d.stage !== 'closed_lost' && score > 0 && score < 40
        })
        break
      case 'closing_soon':
        list = list.filter(d => closingSoonIds.has(d.id) && d.stage !== 'closed_won' && d.stage !== 'closed_lost')
        break
      case 'stale':
        list = list.filter(d => staleDealIds.has(d.id))
        break
      case 'won':
        list = list.filter(d => d.stage === 'closed_won')
        break
      case 'lost':
        list = list.filter(d => d.stage === 'closed_lost')
        break
      default: // all
        break
    }

    list.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'company':
          cmp = (a.prospectCompany ?? '').localeCompare(b.prospectCompany ?? '')
          break
        case 'value':
          cmp = (Number(a.dealValue) || 0) - (Number(b.dealValue) || 0)
          break
        case 'score':
          cmp = (a.conversionScore ?? 0) - (b.conversionScore ?? 0)
          break
        case 'stage':
          cmp = (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [deals, filter, sortKey, sortDir, closingSoonIds, staleDealIds])

  /* ── Kanban ── */
  const dealsByStage: Record<string, DealLog[]> = {}
  for (const s of STAGES) dealsByStage[s.id] = deals.filter(d => d.stage === s.id)

  /* ── Sort toggle ── */
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  /* ── Add deal ── */
  async function handleAdd(payload: Partial<DealLog>) {
    setAddLoading(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Failed to log deal', 'error'); return }
      await mutate()
      setAddOpen(false)
      toast('Deal logged', 'success')
    } finally { setAddLoading(false) }
  }

  /* ── Get top risk for a deal ── */
  function getTopRisk(dealId: string): string | null {
    // Check urgent deals first
    const urgent = urgentDealMap.get(dealId)
    if (urgent) return urgent

    // Check brain deal snapshot risks
    const snap = dealSnapshotMap.get(dealId)
    if (snap?.risks?.length) return snap.risks[0]

    // Check key patterns
    for (const pattern of (brain?.keyPatterns ?? [])) {
      if (pattern.dealIds?.includes(dealId)) return pattern.label
    }

    // Check stale
    if (staleDealIds.has(dealId)) return 'No activity 14+ days'

    return null
  }

  /* ── Get loop summary for a deal ── */
  function getLoopSummary(dealId: string): { count: number; label: string; color: string } | null {
    const loops = loopMap.get(dealId)
    if (!loops || loops.length === 0) return null
    const activeCount = loops.filter(l => l.loopStatus !== 'shipped').length
    // Worst status: awaiting_approval > in_cycle > shipped
    const worst = loops.find(l => l.loopStatus === 'identified')
      ?? loops.find(l => l.loopStatus === 'in_cycle')
      ?? loops[0]
    const cfg = LOOP_STATUS_CONFIG[worst.loopStatus]
    if (activeCount > 0) {
      return { count: activeCount, label: `${activeCount} active`, color: cfg.color }
    }
    return { count: loops.length, label: `${loops.length} shipped`, color: cfg.color }
  }

  /* ── Get score trend for a deal ── */
  function getScoreTrend(dealId: string): 'improving' | 'declining' | 'stable' | 'new' | null {
    const snap = dealSnapshotMap.get(dealId)
    return snap?.scoreTrend ?? null
  }

  /* ── Filter tab counts ── */
  const filterCounts: Record<Filter, number> = {
    all: deals.length,
    at_risk: activeDeals.filter(d => (d.conversionScore ?? 0) > 0 && (d.conversionScore ?? 0) < 40).length,
    closing_soon: closingSoonIds.size,
    stale: staleDealIds.size,
    won: deals.filter(d => d.stage === 'closed_won').length,
    lost: deals.filter(d => d.stage === 'closed_lost').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1400px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 600, color: GLASS.text.primary, margin: '0 0 3px', letterSpacing: '-0.02em' }}>Deals</h1>
          <p style={{ fontSize: '12px', color: GLASS.text.tertiary, margin: 0 }}>
            {deals.length} total &middot; {activeDeals.length} active
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Segmented control: Intelligence | Pipeline */}
          <div style={{
            display: 'flex', gap: '1px', padding: '2px',
            background: GLASS.surface, border: `1px solid ${GLASS.border}`,
            borderRadius: '7px',
          }}>
            {([
              { id: 'intelligence' as Mode, Icon: Brain, label: 'Intelligence' },
              { id: 'kanban' as Mode, Icon: Kanban, label: 'Pipeline' },
            ]).map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 12px', borderRadius: '5px',
                  fontSize: '11.5px', fontWeight: mode === id ? 500 : 400,
                  color: mode === id ? GLASS.text.primary : GLASS.text.tertiary,
                  background: mode === id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: '1px solid ' + (mode === id ? 'rgba(255,255,255,0.10)' : 'transparent'),
                  cursor: 'pointer', transition: 'all 0.10s',
                }}
              >
                <Icon size={10} /> {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setAddOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              height: '32px', padding: '0 14px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${GLASS.border}`,
              color: GLASS.text.primary, fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.12s ease',
              backdropFilter: GLASS.blur, WebkitBackdropFilter: GLASS.blur,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.10)'
              e.currentTarget.style.borderColor = GLASS.borderHover
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.borderColor = GLASS.border
            }}
          >
            <Plus size={13} strokeWidth={2} /> Log Deal
          </button>
        </div>
      </div>

      {dbError && <SetupBanner context="Add a DATABASE_URL to start logging deals and tracking your win rate." />}

      {/* ── Pipeline Stat Strip ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        padding: '16px', background: GLASS.surface,
        backdropFilter: GLASS.blur, WebkitBackdropFilter: GLASS.blur,
        borderRadius: 12, border: `1px solid ${GLASS.border}`,
      }}>
        <StatCard label="Pipeline Value" value={isLoading ? '\u2014' : fmtPipeline(totalPipelineValue, currencySymbol)} />
        <StatCard label="At Risk" value={isLoading ? '\u2014' : `${atRiskCount} deal${atRiskCount !== 1 ? 's' : ''}`} accent={!isLoading && atRiskCount > 0 ? 'amber' : undefined} />
        <StatCard label="Win Rate" value={winRatePct != null ? `${winRatePct}%` : '\u2014'} accent={winRatePct != null && winRatePct >= 50 ? 'green' : winRatePct != null ? 'amber' : undefined} />
        <StatCard label="Active Loops" value={activeLoopCount > 0 ? activeLoopCount : '\u2014'} />
      </div>

      {/* ════════════════ INTELLIGENCE TABLE ════════════════ */}
      {mode === 'intelligence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>

          {/* Filter Tabs */}
          <div style={{
            display: 'flex', gap: '2px', padding: '3px',
            background: GLASS.surface, border: `1px solid ${GLASS.border}`,
            borderRadius: '8px', marginBottom: '12px',
            backdropFilter: GLASS.blur, WebkitBackdropFilter: GLASS.blur,
          }}>
            {FILTER_TABS.map(tab => {
              const active = filter === tab.id
              const count = filterCounts[tab.id]
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  style={{
                    padding: '5px 10px', borderRadius: '5px',
                    fontSize: '11px', fontWeight: active ? 600 : 400,
                    color: active ? GLASS.text.primary : GLASS.text.tertiary,
                    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: '1px solid ' + (active ? 'rgba(255,255,255,0.10)' : 'transparent'),
                    cursor: 'pointer', transition: 'all 0.10s',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  {tab.label}
                  {count > 0 && (
                    <span style={{
                      fontSize: '9px', fontWeight: 600,
                      color: active ? GLASS.text.secondary : GLASS.text.muted,
                      background: 'rgba(255,255,255,0.04)',
                      padding: '1px 5px', borderRadius: '100px',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Table */}
          <div style={{
            background: GLASS.surface,
            backdropFilter: GLASS.blur, WebkitBackdropFilter: GLASS.blur,
            border: `1px solid ${GLASS.border}`,
            borderRadius: '10px', overflow: 'hidden',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '20px 1fr 90px 70px 100px 100px 1fr',
              gap: '8px', padding: '8px 14px',
              borderBottom: `1px solid ${GLASS.border}`,
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div /> {/* Status dot col */}
              <SortHeader label="Company" sortKey="company" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Value" sortKey="value" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
              <SortHeader label="Score" sortKey="score" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
              <SortHeader label="Stage" sortKey="stage" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <div style={{ fontSize: '10px', fontWeight: 600, color: GLASS.text.tertiary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Loops</div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: GLASS.text.tertiary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Top Risk</div>
            </div>

            {/* Rows */}
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: '36px', borderBottom: `1px solid rgba(255,255,255,0.03)` }} className="skeleton" />
              ))
            ) : filteredDeals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px', color: GLASS.text.tertiary, fontSize: '12px' }}>
                No deals match this filter
              </div>
            ) : (
              filteredDeals.map((deal: any) => {
                const score = deal.conversionScore ?? 0
                const trend = getScoreTrend(deal.id)
                const loopSummary = getLoopSummary(deal.id)
                const topRisk = getTopRisk(deal.id)
                const isStale = staleDealIds.has(deal.id)

                return (
                  <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '20px 1fr 90px 70px 100px 100px 1fr',
                        gap: '8px', padding: '7px 14px',
                        borderBottom: `1px solid rgba(255,255,255,0.04)`,
                        cursor: 'pointer', transition: 'background 0.10s',
                        alignItems: 'center',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = GLASS.surfaceHover }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      {/* Status dot */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                          width: '7px', height: '7px', borderRadius: '50%',
                          background: isStale ? '#ef4444' : statusDot(score),
                          boxShadow: score >= 70 ? '0 0 4px rgba(16,185,129,0.3)' : score > 0 && score < 40 ? '0 0 4px rgba(239,68,68,0.3)' : 'none',
                        }} />
                      </div>

                      {/* Company */}
                      <div style={{
                        fontSize: '12.5px', fontWeight: 500, color: GLASS.text.primary,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {deal.prospectCompany ?? deal.dealName ?? 'Untitled'}
                      </div>

                      {/* Value */}
                      <div style={{
                        fontSize: '12px', color: GLASS.text.secondary,
                        textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      }}>
                        {deal.dealValue > 0 ? formatVal(deal.dealValue, currencySymbol) : '\u2014'}
                      </div>

                      {/* Score + trend */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px',
                      }}>
                        {score > 0 ? (
                          <>
                            <span style={{
                              fontSize: '12px', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                              color: score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444',
                            }}>{score}</span>
                            {trend === 'improving' && <TrendingUp size={10} color="#10b981" />}
                            {trend === 'declining' && <TrendingDown size={10} color="#ef4444" />}
                            {trend === 'stable' && <Minus size={10} color={GLASS.text.muted} />}
                          </>
                        ) : (
                          <span style={{ fontSize: '11px', color: GLASS.text.muted }}>\u2014</span>
                        )}
                      </div>

                      {/* Stage */}
                      <div style={{
                        fontSize: '11px', color: GLASS.text.secondary,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {stageLabel(deal.stage)}
                      </div>

                      {/* Loops */}
                      <div>
                        {loopSummary ? (
                          <span style={{
                            fontSize: '10.5px', fontWeight: 500,
                            color: loopSummary.color,
                            padding: '1px 6px', borderRadius: '4px',
                            background: `${loopSummary.color}14`,
                          }}>
                            {loopSummary.label}
                          </span>
                        ) : (
                          <span style={{ fontSize: '10.5px', color: GLASS.text.muted }}>\u2014</span>
                        )}
                      </div>

                      {/* Top risk */}
                      <div style={{
                        fontSize: '11px', color: topRisk ? '#f59e0b' : GLASS.text.muted,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {topRisk ?? '\u2014'}
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ════════════════ PIPELINE (KANBAN) ════════════════ */}
      {mode === 'kanban' && (
        <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              {STAGES.slice(0, 5).map((_, i) => (
                <div key={i} style={{ minWidth: '200px', height: '280px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }} className="skeleton" />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', minWidth: `${STAGES.length * 215}px` }}>
              {STAGES.map(stage => (
                <div key={stage.id} style={{
                  minWidth: '200px', width: '200px', flexShrink: 0,
                  background: GLASS.surface,
                  backdropFilter: GLASS.blur, WebkitBackdropFilter: GLASS.blur,
                  border: `1px solid ${GLASS.border}`,
                  borderRadius: '8px', padding: '10px',
                }}>
                  {/* Column header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 500, color: GLASS.text.secondary }}>{stage.label}</span>
                    </div>
                    <span style={{
                      fontSize: '10px', color: GLASS.text.muted,
                      background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '100px',
                    }}>
                      {(dealsByStage[stage.id] ?? []).length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div>
                    {(dealsByStage[stage.id] ?? []).map((deal: any) => {
                      const score = deal.conversionScore ?? 0
                      const loops = loopMap.get(deal.id)
                      const worstLoop = loops?.find(l => l.loopStatus === 'identified')
                        ?? loops?.find(l => l.loopStatus === 'in_cycle')
                        ?? loops?.[0]
                      const loopCfg = worstLoop ? LOOP_STATUS_CONFIG[worstLoop.loopStatus] : null

                      return (
                        <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                          <div
                            style={{
                              padding: '8px 10px', borderRadius: '7px', marginBottom: '4px',
                              background: 'rgba(255,255,255,0.04)',
                              border: `1px solid rgba(255,255,255,0.06)`,
                              cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s',
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.background = GLASS.surfaceHover
                              ;(e.currentTarget as HTMLElement).style.borderColor = GLASS.borderHover
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'
                            }}
                          >
                            {/* Row 1: dot + name + score */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <div style={{
                                width: '5px', height: '5px', borderRadius: '50%',
                                background: staleDealIds.has(deal.id) ? '#ef4444' : statusDot(score),
                                flexShrink: 0,
                              }} />
                              <div style={{
                                flex: 1, fontSize: '12px', fontWeight: 500,
                                color: GLASS.text.primary,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {deal.prospectCompany ?? deal.dealName ?? 'Untitled'}
                              </div>
                              {score > 0 && (
                                <span style={{
                                  fontSize: '10px', fontWeight: 700,
                                  color: score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444',
                                  flexShrink: 0,
                                }}>{score}%</span>
                              )}
                            </div>

                            {/* Row 2: value */}
                            {deal.dealValue > 0 && (
                              <div style={{ marginTop: '3px', paddingLeft: '10px' }}>
                                <span style={{ fontSize: '10px', color: GLASS.text.tertiary, fontVariantNumeric: 'tabular-nums' }}>
                                  {formatVal(deal.dealValue, currencySymbol)}
                                </span>
                              </div>
                            )}

                            {/* Row 3: Loop badge */}
                            {loopCfg && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', paddingLeft: '10px' }}>
                                <span style={{
                                  fontSize: '10px', fontWeight: 500,
                                  color: loopCfg.color, padding: '1px 5px', borderRadius: '3px',
                                  background: `${loopCfg.color}14`,
                                }}>
                                  {loopCfg.label}
                                </span>
                              </div>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                    {(dealsByStage[stage.id] ?? []).length === 0 && (
                      <div style={{
                        height: '48px', borderRadius: '5px',
                        border: '1px dashed rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: '10px', color: GLASS.text.muted }}>empty</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Deal Modal ── */}
      <Dialog.Root open={addOpen} onOpenChange={setAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 500,
          }} />
          <Dialog.Content style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)', zIndex: 501,
            width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto',
            background: 'rgba(15,15,20,0.85)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            border: `1px solid ${GLASS.border}`, borderRadius: '12px', padding: '24px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.70)', outline: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <Dialog.Title style={{ fontSize: '14px', fontWeight: 600, color: GLASS.text.primary, margin: 0, letterSpacing: '-0.01em' }}>
                Log a deal
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{
                  width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${GLASS.border}`, cursor: 'pointer', color: GLASS.text.tertiary,
                }}>
                  <X size={13} strokeWidth={2} />
                </button>
              </Dialog.Close>
            </div>
            <DealForm onSubmit={handleAdd} loading={addLoading} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
