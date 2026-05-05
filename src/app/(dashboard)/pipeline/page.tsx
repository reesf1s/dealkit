'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import useSWR from 'swr'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Kanban,
  Plus,
  Search,
  Sparkles,
  Target,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { useToast } from '@/components/shared/Toast'
import type { PipelineConfig, PipelineStageConfig } from '@/types'
import { buildDealSnapshot } from '@/lib/deal-snapshot'
import { OperatorHeader, OperatorKpi, OperatorPage } from '@/components/shared/OperatorUI'

type ViewMode = 'kanban' | 'focus' | 'funnel'
type SortMode = 'score_desc' | 'value_desc' | 'recent' | 'name'
type ExecutionFilter = 'all' | 'stale' | 'missing_next' | 'missing_close' | 'missing_contact' | 'at_risk'

type DealType = 'one_off' | 'recurring' | null
type RecurringInterval = 'monthly' | 'quarterly' | 'annual' | null

type ApiDeal = {
  id: string
  dealName: string
  prospectCompany: string
  prospectName?: string | null
  contacts?: Array<{ name?: string | null }> | null
  stage: string
  dealValue: number | null
  conversionScore: number | null
  closeDate?: string | null
  nextSteps: string | null
  competitors: string[]
  notes?: string | null
  meetingNotes?: string | null
  aiSummary?: string | null
  dealRisks?: string[] | null
  dealType: DealType
  recurringInterval: RecurringInterval
  createdAt: string
  updatedAt: string
}

type DealsResponse = { data: ApiDeal[] }

type PipelineResponse = {
  data: PipelineConfig & {
    currency?: string
  }
}

const CLOSED_STAGE_IDS = new Set(['closed_won', 'closed_lost'])

const DEFAULT_STAGES: PipelineStageConfig[] = [
  { id: 'prospecting', label: 'Prospecting', color: '#64748b', order: 1, isDefault: true },
  { id: 'qualification', label: 'Qualification', color: '#60a5fa', order: 2, isDefault: true },
  { id: 'discovery', label: 'Discovery', color: '#a78bfa', order: 3, isDefault: true },
  { id: 'proposal', label: 'Proposal', color: '#fbbf24', order: 4, isDefault: true },
  { id: 'negotiation', label: 'Negotiation', color: '#fb7185', order: 5, isDefault: true },
  { id: 'closed_won', label: 'Closed Won', color: '#4ade80', order: 6, isDefault: true },
  { id: 'closed_lost', label: 'Closed Lost', color: '#f87171', order: 7, isDefault: true },
]

function humanizeStage(stageId: string): string {
  return stageId.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function formatMoney(value: number, currencySymbol: string): string {
  if (value >= 1_000_000) return `${currencySymbol}${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${currencySymbol}${Math.round(value / 1_000)}k`
  return `${currencySymbol}${Math.round(value)}`
}

function annualizedValue(deal: ApiDeal): number {
  const value = deal.dealValue ?? 0
  if (!value) return 0
  if (deal.dealType !== 'recurring') return value
  if (deal.recurringInterval === 'monthly') return value * 12
  if (deal.recurringInterval === 'quarterly') return value * 4
  return value
}

function daysSince(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 86_400_000))
}

function relTime(iso: string, nowMs: number): string {
  const mins = Math.floor((nowMs - new Date(iso).getTime()) / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function hasPrimaryContact(deal: ApiDeal): boolean {
  if (String(deal.prospectName ?? '').trim().length > 0) return true
  const contacts = Array.isArray(deal.contacts) ? deal.contacts : []
  return contacts.some(contact => String(contact?.name ?? '').trim().length > 0)
}

function scoreColor(score: number): string {
  if (score >= 75) return '#4ade80'
  if (score >= 45) return '#fbbf24'
  return '#fb7185'
}

function riskLabel(score: number, staleDays: number): { label: string; color: string } {
  if (staleDays >= 14) return { label: 'Stale', color: '#fb7185' }
  if (score >= 75) return { label: 'Healthy', color: '#4ade80' }
  if (score >= 45) return { label: 'Watch', color: '#fbbf24' }
  return { label: 'At Risk', color: '#fb7185' }
}

function compareDeals(sortMode: SortMode, nowMs: number) {
  return (left: ApiDeal, right: ApiDeal): number => {
    if (sortMode === 'score_desc') return (right.conversionScore ?? 0) - (left.conversionScore ?? 0)
    if (sortMode === 'value_desc') return annualizedValue(right) - annualizedValue(left)
    if (sortMode === 'recent') return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()

    const leftName = `${left.prospectCompany} ${left.dealName}`.toLowerCase()
    const rightName = `${right.prospectCompany} ${right.dealName}`.toLowerCase()
    const nameCompare = leftName.localeCompare(rightName)
    if (nameCompare !== 0) return nameCompare

    return daysSince(left.updatedAt, nowMs) - daysSince(right.updatedAt, nowMs)
  }
}

export default function PipelinePage() {
  const { toast } = useToast()
  const [view, setView] = useState<ViewMode>('kanban')
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('score_desc')
  const [executionFilter, setExecutionFilter] = useState<ExecutionFilter>('all')
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null)
  const [movingDealId, setMovingDealId] = useState<string | null>(null)

  const { data: dealsRes, isLoading, mutate } = useSWR<DealsResponse>('/api/deals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  })

  const { data: pipelineRes } = useSWR<PipelineResponse>('/api/pipeline-config', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const deals = useMemo(() => dealsRes?.data ?? [], [dealsRes?.data])
  const currencySymbol = pipelineRes?.data?.currency ?? '£'
  const nowMs = Date.now()

  const visibleStages = useMemo(() => {
    const configuredStages = pipelineRes?.data?.stages?.length ? pipelineRes.data.stages : DEFAULT_STAGES

    const stageMap = new Map<string, PipelineStageConfig>()
    for (const stage of configuredStages) {
      if (!stage.isHidden || CLOSED_STAGE_IDS.has(stage.id)) {
        stageMap.set(stage.id, stage)
      }
    }

    for (const deal of deals) {
      if (!stageMap.has(deal.stage)) {
        stageMap.set(deal.stage, {
          id: deal.stage,
          label: humanizeStage(deal.stage),
          color: '#94a3b8',
          order: 999,
          isDefault: false,
        })
      }
    }

    return [...stageMap.values()].sort((a, b) => a.order - b.order)
  }, [pipelineRes?.data?.stages, deals])

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase()
    return deals.filter(deal => {
      if (!q) return true
      return (
        deal.prospectCompany.toLowerCase().includes(q) ||
        deal.dealName.toLowerCase().includes(q) ||
        (deal.nextSteps ?? '').toLowerCase().includes(q)
      )
    })
  }, [deals, search])

  const executionCounts = useMemo(() => {
    const open = filteredDeals.filter(deal => !CLOSED_STAGE_IDS.has(deal.stage))
    return {
      all: open.length,
      stale: open.filter(deal => daysSince(deal.updatedAt, nowMs) >= 14).length,
      missing_next: open.filter(deal => !(deal.nextSteps ?? '').trim()).length,
      missing_close: open.filter(deal => !deal.closeDate).length,
      missing_contact: open.filter(deal => !hasPrimaryContact(deal)).length,
      at_risk: open.filter(deal => (deal.conversionScore ?? 0) < 45).length,
    }
  }, [filteredDeals, nowMs])

  const executionFilteredDeals = useMemo(() => {
    if (executionFilter === 'all') return filteredDeals
    const openOnly = filteredDeals.filter(deal => !CLOSED_STAGE_IDS.has(deal.stage))
    return openOnly.filter(deal => {
      if (executionFilter === 'stale') return daysSince(deal.updatedAt, nowMs) >= 14
      if (executionFilter === 'missing_next') return !(deal.nextSteps ?? '').trim()
      if (executionFilter === 'missing_close') return !deal.closeDate
      if (executionFilter === 'missing_contact') return !hasPrimaryContact(deal)
      if (executionFilter === 'at_risk') return (deal.conversionScore ?? 0) < 45
      return true
    })
  }, [filteredDeals, executionFilter, nowMs])

  const openDeals = useMemo(
    () => executionFilteredDeals.filter(deal => !CLOSED_STAGE_IDS.has(deal.stage)),
    [executionFilteredDeals]
  )

  const closedDeals = useMemo(
    () => executionFilter === 'all'
      ? executionFilteredDeals.filter(deal => CLOSED_STAGE_IDS.has(deal.stage))
      : [],
    [executionFilteredDeals, executionFilter]
  )

  const openPipelineValue = useMemo(
    () => openDeals.reduce((sum, deal) => sum + annualizedValue(deal), 0),
    [openDeals]
  )

  const dealSummaryMap = useMemo(() => {
    const map = new Map<string, { latest: string | null; blocker: string | null }>()
    for (const deal of deals) {
      const snapshot = buildDealSnapshot({
        stage: deal.stage,
        nextSteps: deal.nextSteps,
        notes: deal.notes,
        meetingNotes: deal.meetingNotes,
        aiSummary: deal.aiSummary,
        dealRisks: deal.dealRisks,
      })
      map.set(deal.id, {
        latest: snapshot.latestUpdate,
        blocker: snapshot.blocker,
      })
    }
    return map
  }, [deals])

  const weightedPipelineValue = useMemo(
    () => openDeals.reduce((sum, deal) => {
      const probability = (deal.conversionScore ?? 45) / 100
      return sum + annualizedValue(deal) * probability
    }, 0),
    [openDeals]
  )

  const staleDealsCount = useMemo(
    () => openDeals.filter(deal => daysSince(deal.updatedAt, nowMs) >= 14).length,
    [openDeals, nowMs]
  )

  const noNextStepCount = useMemo(
    () => openDeals.filter(deal => !(deal.nextSteps ?? '').trim()).length,
    [openDeals]
  )

  const stageDeals = useMemo(() => {
    const grouped = new Map<string, ApiDeal[]>()
    for (const stage of visibleStages) {
      grouped.set(stage.id, [])
    }

    for (const deal of executionFilteredDeals) {
      const bucket = grouped.get(deal.stage)
      if (bucket) bucket.push(deal)
    }

    const sorter = compareDeals(sortMode, nowMs)
    for (const [stageId, stageDealList] of grouped) {
      grouped.set(stageId, [...stageDealList].sort(sorter))
    }

    return grouped
  }, [visibleStages, executionFilteredDeals, sortMode, nowMs])

  const focusList = useMemo(() => {
    const ranked = [...openDeals].sort((left, right) => {
      const leftStale = daysSince(left.updatedAt, nowMs)
      const rightStale = daysSince(right.updatedAt, nowMs)
      const leftRisk = leftStale >= 14 ? 2 : (left.conversionScore ?? 0) < 45 ? 1 : 0
      const rightRisk = rightStale >= 14 ? 2 : (right.conversionScore ?? 0) < 45 ? 1 : 0
      if (rightRisk !== leftRisk) return rightRisk - leftRisk
      return (right.conversionScore ?? 0) - (left.conversionScore ?? 0)
    })

    return ranked.slice(0, 10)
  }, [openDeals, nowMs])

  const funnelRows = useMemo(() => {
    return visibleStages.map(stage => {
      const stageDealList = stageDeals.get(stage.id) ?? []
      const value = stageDealList.reduce((sum, deal) => sum + annualizedValue(deal), 0)
      return {
        stage,
        count: stageDealList.length,
        value,
      }
    })
  }, [visibleStages, stageDeals])

  const maxFunnelCount = useMemo(
    () => Math.max(1, ...funnelRows.map(row => row.count)),
    [funnelRows]
  )

  const moveDeal = async (dealId: string, nextStage: string) => {
    const existing = deals
    const currentDeal = existing.find(deal => deal.id === dealId)
    if (!currentDeal || currentDeal.stage === nextStage) return

    setMovingDealId(dealId)

    const optimisticDeals = existing.map(deal =>
      deal.id === dealId ? { ...deal, stage: nextStage, updatedAt: new Date().toISOString() } : deal
    )
    mutate({ data: optimisticDeals }, { revalidate: false })

    try {
      const res = await fetch(`/api/deals/${dealId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stage: nextStage }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to update stage')
      }

      await mutate()
    } catch (error) {
      mutate({ data: existing }, { revalidate: false })
      toast(error instanceof Error ? error.message : 'Failed to update stage', 'error')
    } finally {
      setMovingDealId(null)
    }
  }

  return (
    <OperatorPage>
      <OperatorHeader
        eyebrow="Pipeline Operating System"
        title="Enterprise sales pipeline control"
        description="Stage flow, risk visibility, and deal execution in one compact workspace."
        actions={(
          <Link href="/deals" className="operator-button operator-button-primary">
            <Plus size={14} /> Add Deal
          </Link>
        )}
      />

      <section className="pipeline-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {[
          { label: 'Open Pipeline', value: formatMoney(openPipelineValue, currencySymbol), sub: `${openDeals.length} active deals`, icon: Target },
          { label: 'Weighted Forecast', value: formatMoney(weightedPipelineValue, currencySymbol), sub: 'Value adjusted by score confidence', icon: Sparkles },
          { label: 'Stale Opportunities', value: String(staleDealsCount), sub: 'No movement in 14+ days', icon: AlertTriangle },
          { label: 'Missing Next Step', value: String(noNextStepCount), sub: 'No explicit action logged', icon: CalendarClock },
        ].map(metric => (
          <OperatorKpi key={metric.label} label={metric.label} value={metric.value} sub={metric.sub} icon={metric.icon} />
        ))}
      </section>

      <section className="notion-panel" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, borderRadius: 9, border: '1px solid var(--border-default)', padding: '0 10px', background: 'var(--surface-2)', minWidth: 240 }}>
            <Search size={13} style={{ color: 'var(--text-tertiary)' }} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search company, deal, or next step"
              style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
          </div>

          <select
            value={sortMode}
            onChange={event => setSortMode(event.target.value as SortMode)}
            style={{
              height: 34,
              borderRadius: 9,
              border: '1px solid var(--border-default)',
              background: 'var(--surface-2)',
              color: 'var(--text-primary)',
              padding: '0 10px',
              fontSize: 12.5,
              outline: 'none',
            }}
          >
            <option value="score_desc">Sort: Score</option>
            <option value="value_desc">Sort: Value</option>
            <option value="recent">Sort: Recent activity</option>
            <option value="name">Sort: Name</option>
          </select>

          <div style={{ display: 'inline-flex', gap: 6, marginLeft: 'auto' }}>
            {([
              { id: 'kanban', label: 'Kanban', icon: Kanban },
              { id: 'focus', label: 'Focus', icon: Target },
              { id: 'funnel', label: 'Funnel', icon: BarChart3 },
            ] as Array<{ id: ViewMode; label: string; icon: React.ElementType }>).map(tab => {
              const active = view === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  style={{
                    height: 32,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: active ? '1px solid var(--border-strong)' : '1px solid var(--border-default)',
                    background: active ? 'var(--surface-1)' : 'var(--surface-2)',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: active ? 700 : 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <tab.icon size={12} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {([
            { id: 'all', label: 'All open' },
            { id: 'stale', label: 'Stale (14+d)' },
            { id: 'missing_next', label: 'Missing next step' },
            { id: 'missing_close', label: 'Missing close date' },
            { id: 'missing_contact', label: 'Missing contact' },
            { id: 'at_risk', label: 'At risk score' },
          ] as Array<{ id: ExecutionFilter; label: string }>).map(item => {
            const active = executionFilter === item.id
            const count = executionCounts[item.id]
            return (
              <button
                key={item.id}
                onClick={() => setExecutionFilter(item.id)}
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 999,
                  border: active ? '1px solid var(--brand-border)' : '1px solid var(--border-default)',
                  background: active ? 'var(--surface-selected)' : 'var(--surface-1)',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 11.5,
                  fontWeight: active ? 700 : 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <span>{item.label}</span>
                <span className="notion-chip" style={{ fontSize: 10.5 }}>{count}</span>
              </button>
            )
          })}
        </div>

        {!isLoading && executionFilter !== 'all' && openDeals.length === 0 && (
          <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
            No open deals match this execution filter.
          </div>
        )}

        {isLoading ? (
          <div className="skeleton" style={{ height: 320, borderRadius: 10 }} />
        ) : view === 'kanban' ? (
          <div style={{ overflowX: 'auto' }}>
            <div className="pipeline-columns" style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleStages.length}, minmax(250px, 1fr))`, gap: 10, minWidth: `${Math.max(visibleStages.length * 255, 820)}px` }}>
              {visibleStages.map(stage => {
                const stageDealList = stageDeals.get(stage.id) ?? []
                const stageValue = stageDealList.reduce((sum, deal) => sum + annualizedValue(deal), 0)

                return (
                  <article
                    key={stage.id}
                    className="notion-column"
                    style={{ padding: 10, minHeight: 360, display: 'flex', flexDirection: 'column', gap: 9 }}
                    onDragOver={event => event.preventDefault()}
                    onDrop={() => {
                      if (draggedDealId) {
                        void moveDeal(draggedDealId, stage.id)
                        setDraggedDealId(null)
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: stage.color }} />
                          <h2 style={{ margin: 0, fontSize: 12, color: 'var(--text-primary)', textTransform: 'none', letterSpacing: '0.01em' }}>{stage.label}</h2>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                          {stageDealList.length} deals · {formatMoney(stageValue, currencySymbol)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      {stageDealList.length === 0 ? (
                        <div style={{ padding: '12px 10px', borderRadius: 9, border: '1px dashed var(--border-default)', color: 'var(--text-tertiary)', fontSize: 12, background: 'var(--surface-2)' }}>
                          Drop deals here
                        </div>
	                      ) : (
	                        stageDealList.map(deal => {
	                          const score = deal.conversionScore ?? 0
	                          const staleDays = daysSince(deal.updatedAt, nowMs)
	                          const risk = riskLabel(score, staleDays)
	                          const dealScoreColor = scoreColor(score)
	                          const summary = dealSummaryMap.get(deal.id)

	                          return (
                            <Link
                              key={deal.id}
                              href={`/deals/${deal.id}`}
                              draggable
                              onDragStart={() => setDraggedDealId(deal.id)}
                              onDragEnd={() => setDraggedDealId(null)}
                              style={{
                                textDecoration: 'none',
                                borderRadius: 10,
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--surface-1)',
                                padding: '10px 10px 9px',
                                display: 'grid',
                                gap: 8,
                              }}
                            >
	                              <div style={{ minWidth: 0 }}>
	                                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
	                                  {deal.prospectCompany}
	                                </div>
	                                <div style={{ marginTop: 1, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.35 }}>
	                                  {deal.dealName}
	                                </div>
	                                {summary?.latest && (
	                                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.35 }}>
	                                    Latest: {summary.latest}
	                                  </div>
	                                )}
                                  {summary?.blocker && (
                                    <div style={{ marginTop: 1, fontSize: 10.5, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>
                                      Blocker: {summary.blocker}
                                    </div>
                                  )}
	                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>{formatMoney(annualizedValue(deal), currencySymbol)}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: dealScoreColor }}>{score}%</span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ fontSize: 10.5, color: risk.color, fontWeight: 700 }}>{risk.label}</span>
                                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{relTime(deal.updatedAt, nowMs)}</span>
                              </div>

                              <select
                                value={deal.stage}
                                onChange={event => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  void moveDeal(deal.id, event.target.value)
                                }}
                                disabled={movingDealId === deal.id}
                                onClick={event => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                }}
                                style={{
                                  height: 28,
                                  borderRadius: 8,
                                  border: '1px solid var(--border-default)',
                                  background: 'var(--surface-2)',
                                  color: 'var(--text-secondary)',
                                  fontSize: 11.5,
                                  padding: '0 8px',
                                  outline: 'none',
                                }}
                              >
                                {visibleStages.map(option => (
                                  <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                              </select>
                            </Link>
                          )
                        })
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        ) : view === 'focus' ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {focusList.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--text-secondary)' }}>No open deals in this filter.</div>
            ) : (
	              focusList.map((deal, index) => {
	                const score = deal.conversionScore ?? 0
	                const staleDays = daysSince(deal.updatedAt, nowMs)
	                const risk = riskLabel(score, staleDays)
	                const competitor = deal.competitors[0]
	                const summary = dealSummaryMap.get(deal.id)
                  const latestLine = summary?.latest ?? 'No recent activity captured yet.'
                  const secondaryLine =
                    summary?.blocker
                    ? `Blocker: ${summary.blocker}`
                    : deal.nextSteps?.trim()
                    ? `Next: ${deal.nextSteps.trim()}`
                    : competitor
                    ? `Competing vs ${competitor}`
                    : ''

	                return (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    style={{
                      textDecoration: 'none',
                      display: 'grid',
                      gridTemplateColumns: '44px 1.2fr 0.8fr 0.7fr 1fr 90px',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-1)',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)' }}>#{index + 1}</div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>{deal.prospectCompany}</div>
                      <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.35 }}>{deal.dealName}</div>
                    </div>

	                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 700 }}>{formatMoney(annualizedValue(deal), currencySymbol)}</div>

	                    <div style={{ fontSize: 11.5, fontWeight: 700, color: scoreColor(score) }}>{score}%</div>

	                    <div style={{ display: 'grid', gap: 2 }}>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                          Latest: {latestLine}
                        </div>
                        {secondaryLine && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.35 }}>
                            {secondaryLine}
                          </div>
                        )}
                      </div>

                    <div style={{ textAlign: 'right', fontSize: 11, color: risk.color, fontWeight: 700 }}>{risk.label}</div>
                  </Link>
                )
              })
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {funnelRows.map(row => {
              const width = `${(row.count / maxFunnelCount) * 100}%`
              return (
                <div
                  key={row.stage.id}
                  style={{
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-1)',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: row.stage.color }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{row.stage.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.count} deals · {formatMoney(row.value, currencySymbol)}</div>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
                    <div style={{ width, height: '100%', background: row.stage.color, opacity: 0.85 }} />
                  </div>
                </div>
              )
            })}

            <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              Closed deals in filter: {closedDeals.length}
            </div>
          </div>
        )}
      </section>

      <style>{`
        @media (max-width: 1120px) {
          .pipeline-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 760px) {
          .pipeline-kpis { grid-template-columns: 1fr !important; }
          .pipeline-columns { grid-template-columns: 1fr !important; min-width: 0 !important; }
        }
      `}</style>
    </OperatorPage>
  )
}
