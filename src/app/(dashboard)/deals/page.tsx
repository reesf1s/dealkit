'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, Search, SlidersHorizontal, ChevronUp, ChevronDown, Target } from 'lucide-react'
import { DealForm } from '@/components/deals/DealForm'
import { useToast } from '@/components/shared/Toast'
import SetupBanner from '@/components/shared/SetupBanner'
import { GradientAvatar } from '@/components/shared/GradientAvatar'
import { OrgLogo } from '@/components/shared/OrgLogo'
import { HealthDot } from '@/components/shared/HealthDot'
import { StageBadge } from '@/components/shared/StageBadge'
import { MiniBarChart } from '@/components/shared/MiniBarChart'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'
import type { DealLog } from '@/types'

/* ── Types ── */

type Tab = 'active' | 'pipeline' | 'archived'
type SortKey = 'contact' | 'org' | 'value' | 'stage' | 'health' | 'activity' | 'score'
type SortDir = 'asc' | 'desc'
type Health = 'green' | 'amber' | 'red' | 'grey'
type FocusZone = 'ready_to_close' | 'engaged_recently' | 'waiting_on_reply' | 'cold' | null

/* ── Constants ── */

const STAGES = [
  { id: 'prospecting',   label: 'Prospecting',   color: 'var(--text-tertiary)' },
  { id: 'qualification', label: 'Qualification', color: '#3b82f6' },
  { id: 'discovery',     label: 'Discovery',     color: '#8b5cf6' },
  { id: 'proposal',      label: 'Proposal',      color: '#f59e0b' },
  { id: 'negotiation',   label: 'Negotiation',   color: '#ef4444' },
  { id: 'closed_won',    label: 'Closed Won',    color: '#22c55e' },
  { id: 'closed_lost',   label: 'Closed Lost',   color: 'var(--text-tertiary)' },
]

const STAGE_ORDER: Record<string, number> = {}
STAGES.forEach((s, i) => { STAGE_ORDER[s.id] = i })

/* ── Helpers ── */

function getDealHealth(deal: DealLog): Health {
  const score = deal.conversionScore ?? 0
  if (score <= 0) return 'grey'
  if (score >= 70) return 'green'
  if (score >= 40) return 'amber'
  return 'red'
}

function healthOrder(h: Health): number {
  return { red: 0, amber: 1, grey: 2, green: 3 }[h]
}

function formatVal(v: number | null, sym: string): string {
  if (!v || v <= 0) return '—'
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `${sym}${Math.round(v / 1_000)}k`
  return `${sym}${v}`
}

function relativeTime(dateStr: string | Date): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function contactName(deal: DealLog): string {
  if (deal.contacts?.length > 0) return deal.contacts[0].name
  if (deal.prospectName) return deal.prospectName
  return deal.dealName
}

function dealInsight(deal: DealLog): string | null {
  // Use real AI analysis from meeting notes first — specific over generic
  if (deal.aiSummary) return deal.aiSummary
  const insights = deal.conversionInsights as string[] | undefined
  if (insights?.length) return insights[0]
  if (deal.nextSteps) return deal.nextSteps
  return null
}

function daysAgo(dateStr: string | Date): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

const FOCUS_ZONE_LABELS: Record<NonNullable<FocusZone>, string> = {
  ready_to_close:   'Ready to Close',
  engaged_recently: 'Engaged Recently',
  waiting_on_reply: 'Waiting on Reply',
  cold:             'Cold',
}

function applyFocusFilter(deals: DealLog[], focus: FocusZone): DealLog[] {
  if (!focus) return deals
  return deals.filter(d => {
    const days = daysAgo(d.updatedAt)
    const score = d.conversionScore ?? 0
    switch (focus) {
      case 'ready_to_close':
        return score >= 70 || d.stage === 'negotiation' || d.stage === 'proposal'
      case 'engaged_recently':
        return days < 7
      case 'waiting_on_reply':
        return days >= 5 && days <= 13
      case 'cold':
        return days >= 14 || (score > 0 && score < 30)
      default:
        return true
    }
  })
}

/* ── Stats item ── */

function StatCell({
  label,
  value,
  trend,
  trendLabel,
  chartValues,
  last,
}: {
  label: string
  value: string
  trend?: string
  trendLabel?: string
  chartValues?: number[]
  last?: boolean
}) {
  return (
    <div style={{
      flex: 1,
      padding: '20px 24px',
      borderRight: last ? 'none' : '1px solid #eeeeee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend && (
            <span style={{ fontSize: 12, fontFamily: "'Geist Mono', monospace", color: '#1DB86A' }}>
              ↗ {trend}
            </span>
          )}
          <span style={{ fontSize: 12.5, color: '#999999' }}>{trendLabel ?? label}</span>
        </div>
      </div>
      {chartValues && (
        <MiniBarChart values={chartValues} />
      )}
    </div>
  )
}

/* ── Sort header ── */

function SortHeader({
  label, icon, sortKey, currentSort, currentDir, onSort, align,
}: {
  label: string; icon?: string; sortKey: SortKey; currentSort: SortKey
  currentDir: SortDir; onSort: (k: SortKey) => void; align?: 'left' | 'right' | 'center'
}) {
  const active = currentSort === sortKey
  return (
    <div
      onClick={() => onSort(sortKey)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        cursor: 'pointer',
        userSelect: 'none',
        fontSize: 11.5,
        fontWeight: 500,
        color: 'var(--text-tertiary)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        transition: 'color 100ms',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)' }}
    >
      {icon && <span style={{ opacity: 0.6, fontSize: 10 }}>{icon}</span>}
      {label}
      {active && (currentDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
    </div>
  )
}

/* ── Skeleton row ── */

function SkeletonRow({ delay = 0 }: { delay?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr minmax(100px,180px) minmax(80px,110px) minmax(80px,120px) 72px minmax(120px,200px)',
        gap: 8,
        padding: '13px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        alignItems: 'center',
        animationDelay: `${delay}ms`,
      }}
      className="skeleton"
    >
      {[36, 180, 120, 80, 90, 40, 120].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 16 : 14,
          width: i === 0 ? 16 : '80%',
          borderRadius: 4,
          background: 'var(--surface-2)',
        }} />
      ))}
    </div>
  )
}

/* ── Empty state ── */

function EmptyState({ onAdd, filtered }: { onAdd: () => void; filtered?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '72px 32px',
      gap: 16,
      textAlign: 'center',
    }}>
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        background: 'var(--surface-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Target size={26} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 16, letterSpacing: '-0.01em' }}>
        {filtered ? 'No deals match this view' : 'No opportunities logged yet'}
      </div>
      <div style={{ fontSize: 13, color: '#999999', maxWidth: 340, lineHeight: 1.7 }}>
        {filtered
          ? 'Try adjusting your filters or searching for something else.'
          : 'Log your first deal to start tracking pipeline health and get AI insights on every opportunity.'}
      </div>
      {!filtered && (
        <button
          onClick={onAdd}
          style={{
            marginTop: 4,
            height: 38,
            padding: '0 22px',
            borderRadius: 8,
            background: 'var(--text-primary)',
            border: 'none',
            color: 'var(--text-inverse)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            transition: 'opacity 100ms',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
        >
          <Plus size={14} /> Log first opportunity
        </button>
      )}
    </div>
  )
}

/* ── Kanban (Pipeline Map) ── */

const FORECAST_CYCLE: Array<DealLog['forecastCategory']> = ['commit', 'upside', 'pipeline', 'omit', null]

const FORECAST_META: Record<string, { label: string; color: string; bg: string }> = {
  commit:   { label: 'Commit',   color: '#1DB86A', bg: 'rgba(29,184,106,0.10)' },
  upside:   { label: 'Upside',   color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
  pipeline: { label: 'Pipeline', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  omit:     { label: 'Omit',     color: '#9ca3af', bg: 'rgba(156,163,175,0.10)' },
}

function ForecastPill({ dealId, current, onChanged }: {
  dealId: string
  current: DealLog['forecastCategory']
  onChanged: (id: string, next: DealLog['forecastCategory']) => void
}) {
  const meta = current ? FORECAST_META[current] : null
  return (
    <button
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        const idx = FORECAST_CYCLE.indexOf(current)
        const next = FORECAST_CYCLE[(idx + 1) % FORECAST_CYCLE.length]
        onChanged(dealId, next)
      }}
      title={`Forecast: ${current ?? 'none'} — click to change`}
      style={{
        padding: '1px 7px',
        borderRadius: 5,
        fontSize: 9.5,
        fontWeight: 700,
        cursor: 'pointer',
        border: '1px solid transparent',
        letterSpacing: '0.03em',
        lineHeight: 1.5,
        transition: 'opacity 80ms',
        background: meta ? meta.bg : 'var(--surface-3)',
        color: meta ? meta.color : 'var(--text-muted)',
        borderColor: meta ? meta.bg : 'transparent',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.75'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
    >
      {meta ? meta.label : '+ Forecast'}
    </button>
  )
}

function KanbanView({
  dealsByStage,
  stages,
  currencySymbol,
  isLoading,
  onAdd,
  brain,
  onForecastChange,
}: {
  dealsByStage: Record<string, DealLog[]>
  stages: Array<{ id: string; label: string; color: string }>
  currencySymbol: string
  isLoading: boolean
  onAdd: () => void
  brain?: any
  onForecastChange: (dealId: string, category: DealLog['forecastCategory']) => void
}) {
  const activeStages = stages.filter(s => s.id !== 'closed_won' && s.id !== 'closed_lost')

  if (isLoading) {
    return (
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
        {activeStages.map((_, i) => (
          <div key={i} style={{
            minWidth: 200,
            height: 280,
            borderRadius: 9,
            background: 'var(--surface-2)',
            border: '1px solid var(--border-default)',
          }} className="skeleton" />
        ))}
      </div>
    )
  }

  const hasAny = activeStages.some(s => (dealsByStage[s.id] ?? []).length > 0)
  if (!hasAny) {
    return <EmptyState onAdd={onAdd} />
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', gap: 10, minWidth: `${activeStages.length * 215}px` }}>
        {activeStages.map(stage => (
          <div key={stage.id} style={{
            minWidth: 200,
            width: 200,
            flexShrink: 0,
            background: 'var(--surface-2)',
            border: '1px solid var(--border-default)',
            borderRadius: 9,
            padding: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: stage.color }} />
                <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)' }}>{stage.label}</span>
              </div>
              <span style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                background: 'var(--surface-3)',
                padding: '1px 7px',
                borderRadius: 99,
                fontFamily: "'Geist Mono', monospace",
              }}>
                {(dealsByStage[stage.id] ?? []).length}
              </span>
            </div>

            <div>
              {(dealsByStage[stage.id] ?? []).map((deal: any) => {
                const health = getDealHealth(deal)
                const insight = dealInsight(deal)
                const hasAI = !!(deal.aiSummary || (deal.conversionInsights as string[])?.length)
                const insightColor = hasAI ? 'var(--text-secondary)' : 'var(--text-tertiary)'
                return (
                  <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div
                      style={{
                        padding: '9px 10px 9px 12px',
                        borderRadius: 7,
                        marginBottom: 5,
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-default)',
                        borderLeft: `3px solid ${stage.color}`,
                        cursor: 'pointer',
                        transition: 'border-color 100ms, box-shadow 100ms',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {deal.dealName || contactName(deal)}
                          </div>
                          {deal.prospectCompany && (
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {deal.prospectCompany}
                            </div>
                          )}
                        </div>
                        <HealthDot health={health} />
                      </div>

                      <div style={{
                        marginTop: 5, fontSize: 10.5, color: insightColor,
                        lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                        fontStyle: insight ? 'normal' : 'italic',
                      }}>
                        {insight
                          ? insight.slice(0, 130) + (insight.length > 130 ? '…' : '')
                          : 'No AI analysis yet — run analysis to generate insights'}
                      </div>

                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                          fontVariantNumeric: 'tabular-nums',
                          fontFamily: "'Geist Mono', monospace",
                          fontWeight: 500,
                        }}>
                          {formatVal(deal.dealValue, currencySymbol)}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                          {relativeTime(deal.updatedAt)}
                        </span>
                      </div>
                      <div style={{ marginTop: 5, display: 'flex', justifyContent: 'flex-end' }}>
                        <ForecastPill
                          dealId={deal.id}
                          current={deal.forecastCategory ?? null}
                          onChanged={onForecastChange}
                        />
                      </div>
                    </div>
                  </Link>
                )
              })}
              {(dealsByStage[stage.id] ?? []).length === 0 && (
                <div style={{
                  height: 48,
                  borderRadius: 7,
                  border: '1px dashed var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>empty</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main Page ── */

function DealsPageInner() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>('active')
  const [sortKey, setSortKey] = useState<SortKey>('activity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus zone from sidebar navigation
  const focusParam = searchParams.get('focus') as FocusZone
  const [activeFocus, setActiveFocus] = useState<FocusZone>(focusParam)

  // Sync focus when URL changes
  useEffect(() => {
    setActiveFocus(searchParams.get('focus') as FocusZone)
  }, [searchParams])

  /* ── Data ── */
  const { data, isLoading, error, mutate } = useSWR<{ data: DealLog[] }>('/api/deals', fetcher)
  const { data: configData } = useSWR('/api/pipeline-config', fetcher, { revalidateOnFocus: false })
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })

  // AI snapshots — generated once, cached in aiSummary field on deals
  // dedupingInterval: 5 min so we don't hammer on every navigation
  const { data: snapshotData, isLoading: snapshotsLoading } = useSWR<{
    snapshots: Record<string, string>
    health: Record<string, 'improving' | 'at_risk' | 'stable' | 'new'>
  }>('/api/deals/ai-snapshots', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000,
  })
  const aiSnapshots = snapshotData?.snapshots ?? {}
  const aiHealth = snapshotData?.health ?? {}

  const deals = data?.data ?? []
  const dbError = isDbNotConfigured(error)
  const currencySymbol: string = configData?.data?.currency ?? '£'
  const brain: any = brainRes?.data

  /* ── Derived maps ── */
  const staleDealIds = useMemo(() =>
    new Set<string>((brain?.staleDeals ?? []).map((d: { dealId: string }) => d.dealId)),
    [brain?.staleDeals]
  )

  const urgentDealMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of (brain?.urgentDeals ?? [])) m.set(u.dealId, u.reason)
    return m
  }, [brain?.urgentDeals])

  /* ── Pipeline stats ── */
  const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0)
  const winRatePct: number | null = brain?.winRate ?? null
  const highPriCount = activeDeals.filter(d => (d.conversionScore ?? 0) >= 70).length

  const avgScore = useMemo(() => {
    const scored = activeDeals.filter(d => (d.conversionScore ?? 0) > 0)
    if (!scored.length) return null
    return Math.round(scored.reduce((s, d) => s + (d.conversionScore ?? 0), 0) / scored.length)
  }, [activeDeals])

  /* ── Tab filtering ── */
  const tabDeals = useMemo(() => {
    let base: DealLog[]
    switch (tab) {
      case 'active':   base = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost'); break
      case 'archived': base = deals.filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost'); break
      case 'pipeline': base = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost'); break
      default:         base = deals
    }
    // Apply focus zone filter from sidebar if active (only on non-archived tabs)
    if (activeFocus && tab !== 'archived') {
      return applyFocusFilter(base, activeFocus)
    }
    return base
  }, [deals, tab, activeFocus])

  /* ── Search filter ── */
  const searchedDeals = useMemo(() => {
    if (!search.trim()) return tabDeals
    const q = search.toLowerCase()
    return tabDeals.filter(d =>
      d.dealName?.toLowerCase().includes(q) ||
      d.prospectCompany?.toLowerCase().includes(q) ||
      d.prospectName?.toLowerCase().includes(q) ||
      contactName(d).toLowerCase().includes(q)
    )
  }, [tabDeals, search])

  /* ── Sort ── */
  const sortedDeals = useMemo(() => {
    const list = [...searchedDeals]
    list.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'contact':  cmp = contactName(a).localeCompare(contactName(b)); break
        case 'org':      cmp = (a.prospectCompany ?? '').localeCompare(b.prospectCompany ?? ''); break
        case 'value':    cmp = (Number(a.dealValue) || 0) - (Number(b.dealValue) || 0); break
        case 'stage':    cmp = (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99); break
        case 'health':   cmp = healthOrder(getDealHealth(a)) - healthOrder(getDealHealth(b)); break
        case 'score':    cmp = (a.conversionScore ?? 0) - (b.conversionScore ?? 0); break
        case 'activity': cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [searchedDeals, sortKey, sortDir])

  /* ── Resolve stages from pipeline-config (supports custom stage labels/colors) ── */
  const configStages = useMemo(() => {
    const raw = configData?.data?.stages as Array<{ id: string; label: string; color: string; order?: number; hidden?: boolean }> | undefined
    if (!raw || raw.length === 0) return STAGES
    return [...raw]
      .filter(s => !s.hidden)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(s => ({ id: s.id, label: s.label, color: s.color }))
  }, [configData?.data?.stages])

  /* ── Kanban map ── */
  const dealsByStage: Record<string, DealLog[]> = {}
  for (const s of configStages) dealsByStage[s.id] = deals.filter(d => d.stage === s.id)
  // Also bucket any deals in stages not in configStages (custom or removed stages)
  for (const deal of deals) {
    if (!dealsByStage[deal.stage]) dealsByStage[deal.stage] = []
    if (!dealsByStage[deal.stage].includes(deal)) dealsByStage[deal.stage].push(deal)
  }

  /* ── Forecast stats ── */
  const commitValue = activeDeals.filter(d => d.forecastCategory === 'commit').reduce((s, d) => s + (Number(d.dealValue) || 0), 0)
  const upsideValue = activeDeals.filter(d => d.forecastCategory === 'upside').reduce((s, d) => s + (Number(d.dealValue) || 0), 0)

  async function handleForecastChange(dealId: string, category: DealLog['forecastCategory']) {
    // Optimistic update
    mutate(
      prev => {
        if (!prev?.data) return prev
        return { data: prev.data.map(d => d.id === dealId ? { ...d, forecastCategory: category } : d) }
      },
      false
    )
    await fetch(`/api/deals/${dealId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ forecastCategory: category }),
    })
    mutate()
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

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
      toast('Opportunity logged', 'success')
    } finally { setAddLoading(false) }
  }

  function toggleRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === sortedDeals.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedDeals.map(d => d.id)))
    }
  }

  /* ── Breadcrumb pills ── */
  const breadcrumbs = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
      <span style={{
        background: 'var(--surface-2)',
        borderRadius: 5,
        padding: '3px 10px',
        fontSize: 12,
        color: 'var(--text-tertiary)',
        fontWeight: 400,
      }}>Opportunities</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/</span>
      <span style={{
        background: 'var(--surface-2)',
        borderRadius: 5,
        padding: '3px 10px',
        fontSize: 12,
        color: 'var(--text-secondary)',
        fontWeight: 500,
      }}>Active Flow</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {dbError && <SetupBanner context="Add a DATABASE_URL to start logging deals and tracking your win rate." />}

      {breadcrumbs}

      {/* ── Focus zone banner ── */}
      {activeFocus && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px',
          borderRadius: 8,
          background: 'var(--brand-bg)',
          border: '1px solid var(--brand-border)',
          marginBottom: 16,
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand)' }}>
              Focus: {FOCUS_ZONE_LABELS[activeFocus]}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              — showing {tabDeals.length} deal{tabDeals.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={() => setActiveFocus(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              padding: 2,
              borderRadius: 4,
            }}
            title="Clear focus filter"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: '0 0 4px',
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
          }}>
            Active Opportunities
          </h1>
          <p style={{ fontSize: 14, color: '#999999', margin: 0 }}>
            Real-time signals shaping your revenue pipeline
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 36,
            padding: '0 16px',
            borderRadius: 8,
            background: 'var(--text-primary)',
            border: 'none',
            color: 'var(--text-inverse)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'opacity 100ms',
            flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
        >
          <Plus size={14} strokeWidth={2.5} /> New Deal
        </button>
      </div>

      {/* ── Stats row — merged card ── */}
      <div style={{
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        marginBottom: 24,
      }}>
        <StatCell
          label="Leads"
          value={isLoading ? '—' : String(activeDeals.length)}
          trend={activeDeals.length > 0 ? '+8.4%' : undefined}
          trendLabel="Leads"
          chartValues={[3, 5, 4, 6, 5, 7, 6, 8, 7, 6, 8, activeDeals.length > 0 ? 9 : 0]}
        />
        <StatCell
          label="High Priority"
          value={isLoading ? '—' : String(highPriCount)}
          trend={highPriCount > 0 ? '+2.4%' : undefined}
          trendLabel="High priority"
          chartValues={[2, 3, 2, 4, 3, 5, 4, 3, 5, 4, 6, highPriCount]}
        />
        <StatCell
          label="Pipeline"
          value={isLoading ? '—' : formatVal(totalPipelineValue, currencySymbol)}
          trendLabel="Pipeline value"
          chartValues={[4, 5, 6, 5, 7, 6, 8, 7, 9, 8, 7, 9]}
        />
        <StatCell
          label="Win Rate"
          value={isLoading ? '—' : winRatePct != null ? `${winRatePct}%` : avgScore != null ? `${avgScore}%` : '—'}
          trendLabel="Win rate"
          chartValues={[5, 6, 5, 7, 6, 8, 7, 9, 8, 7, 8, 9]}
        />
        <StatCell
          label="Commit"
          value={isLoading ? '—' : commitValue > 0 ? formatVal(commitValue, currencySymbol) : '—'}
          trendLabel="Committed forecast"
          chartValues={[0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, commitValue > 0 ? 5 : 0]}
        />
        <StatCell
          label="Upside"
          value={isLoading ? '—' : upsideValue > 0 ? formatVal(upsideValue, currencySymbol) : '—'}
          trendLabel="Upside forecast"
          chartValues={[1, 2, 1, 3, 2, 4, 3, 4, 3, 5, 4, upsideValue > 0 ? 5 : 0]}
          last
        />
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        borderBottom: '1px solid var(--border-default)',
        marginBottom: 16,
      }}>
        {([
          { id: 'active' as Tab,   label: 'Intelligence',  icon: '◉' },
          { id: 'pipeline' as Tab, label: 'Pipeline',      icon: '▦' },
          { id: 'archived' as Tab, label: 'Archived',      icon: '▣' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              fontSize: 13.5,
              fontWeight: tab === t.id ? 500 : 400,
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              borderBottom: tab === t.id ? '2px solid var(--text-primary)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 100ms',
            }}
          >
            <span style={{ opacity: tab === t.id ? 1 : 0.45, fontSize: 12 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Search + filter bar ── */}
      {tab !== 'pipeline' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid var(--border-default)',
            borderRadius: 9,
            padding: '9px 16px',
            background: 'var(--surface-1)',
            transition: 'border-color 100ms',
          }}
          onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
          onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search people, companies, or activity..."
              style={{
                border: 'none',
                outline: 'none',
                flex: 1,
                fontSize: 14,
                color: 'var(--text-primary)',
                background: 'transparent',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              border: '1px solid var(--border-default)',
              borderRadius: 9,
              background: 'var(--surface-1)',
              fontSize: 14,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'border-color 100ms, color 100ms',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'var(--border-strong)'
              el.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = 'var(--border-default)'
              el.style.color = 'var(--text-secondary)'
            }}
          >
            <SlidersHorizontal size={14} />
            Refine
          </button>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          background: '#f0fdf4',
          border: '1px solid rgba(29,184,106,0.24)',
          borderRadius: 8,
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 13, color: '#15803d', fontWeight: 500 }}>
            {selectedIds.size} selected
          </span>
          <div style={{ width: 1, height: 16, background: 'rgba(29,184,106,0.30)' }} />
          {['Change Stage', 'Archive', 'Delete'].map(action => (
            <button key={action} style={{
              fontSize: 12.5,
              color: '#15803d',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 5,
              transition: 'background 100ms',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(29,184,106,0.10)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
            >
              {action}
            </button>
          ))}
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ════════════ PIPELINE MAP (Kanban) ════════════ */}
      {tab === 'pipeline' && (
        <KanbanView
          dealsByStage={dealsByStage}
          stages={configStages}
          currencySymbol={currencySymbol}
          isLoading={isLoading}
          onAdd={() => setAddOpen(true)}
          brain={brain}
          onForecastChange={handleForecastChange}
        />
      )}

      {/* ════════════ ACTIVE FLOW / ARCHIVED (Table) ════════════ */}
      {tab !== 'pipeline' && (
        <div>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr minmax(100px,180px) minmax(80px,110px) minmax(80px,120px) 72px minmax(120px,200px)',
            gap: 8,
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--surface-2)',
          }}>
            {/* Select all checkbox */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={sortedDeals.length > 0 && selectedIds.size === sortedDeals.length}
                onChange={toggleAll}
                style={{ accentColor: '#1DB86A', width: 15, height: 15, cursor: 'pointer' }}
              />
            </div>
            <SortHeader label="Contact" icon="👤" sortKey="contact" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Organization" icon="🏢" sortKey="org" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Value" icon="£" sortKey="value" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
            <SortHeader label="Stage" icon="◆" sortKey="stage" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Score" icon="●" sortKey="score" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
            <SortHeader label="AI Intel" sortKey="health" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          </div>

          {/* Rows */}
          {isLoading ? (
            Array.from({ length: 7 }).map((_, i) => (
              <SkeletonRow key={i} delay={i * 40} />
            ))
          ) : sortedDeals.length === 0 ? (
            <EmptyState onAdd={() => setAddOpen(true)} filtered={deals.length > 0} />
          ) : (
            sortedDeals.map((deal: any) => {
              const health = getDealHealth(deal)
              const name = contactName(deal)
              const org = deal.prospectCompany ?? ''
              const selected = selectedIds.has(deal.id)
              const stale = staleDealIds.has(deal.id)
              const urgentReason = urgentDealMap.get(deal.id)
              const score = deal.conversionScore as number | null
              const scoreColor = score == null ? '#ccc' : score >= 70 ? '#1DB86A' : score >= 40 ? '#f59e0b' : '#ef4444'
              const topRisk = urgentReason
                ?? (stale ? `${daysAgo(deal.updatedAt)}d no activity` : null)

              // AI snapshot — prefer freshly-fetched snapshot over cached aiSummary
              const snapshot = aiSnapshots[deal.id] ?? dealInsight(deal)
              const healthStatus = aiHealth[deal.id] ?? null
              const snapshotPending = snapshotsLoading && !snapshot

              return (
                <div
                  key={deal.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr minmax(100px,180px) minmax(80px,110px) minmax(80px,120px) 72px minmax(120px,200px)',
                    gap: 8,
                    padding: '13px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    alignItems: 'center',
                    background: selected ? 'var(--color-green-bg)' : 'transparent',
                    transition: 'background 100ms',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'
                  }}
                  onMouseLeave={e => {
                    if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  {/* Checkbox */}
                  <div
                    style={{ display: 'flex', alignItems: 'center' }}
                    onClick={e => { e.stopPropagation(); toggleRow(deal.id) }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleRow(deal.id)}
                      style={{ accentColor: '#1DB86A', width: 15, height: 15, cursor: 'pointer' }}
                    />
                  </div>

                  {/* Contact */}
                  <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <GradientAvatar name={name} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}>
                        {deal.dealName || name}
                      </div>
                      {name && name !== deal.dealName && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {name}
                        </div>
                      )}
                      {snapshotPending ? (
                        <div style={{
                          marginTop: 3, height: 8, width: 140, borderRadius: 4,
                          background: 'var(--surface-2)', animation: 'pulse 1.6s ease-in-out infinite',
                        }} />
                      ) : snapshot ? (
                        <div style={{
                          fontSize: 11,
                          color: healthStatus === 'at_risk' ? '#b45309'
                            : healthStatus === 'improving' ? '#15803d'
                            : 'var(--text-secondary)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 300,
                          fontWeight: healthStatus === 'at_risk' ? 500 : 400,
                        }}>
                          {healthStatus === 'at_risk' && '⚠ '}
                          {healthStatus === 'improving' && '↑ '}
                          {snapshot.slice(0, 90) + (snapshot.length > 90 ? '…' : '')}
                        </div>
                      ) : null}
                    </div>
                  </Link>

                  {/* Organization */}
                  <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {org ? (
                      <>
                        <OrgLogo name={org} size={22} />
                        <span style={{
                          fontSize: 13.5,
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {org}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </Link>

                  {/* Value */}
                  <Link href={`/deals/${deal.id}`} style={{
                    textDecoration: 'none',
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: deal.dealValue > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                    textAlign: 'right',
                    fontFamily: "'Geist Mono', monospace",
                    letterSpacing: '-0.03em',
                    display: 'block',
                  }}>
                    {formatVal(deal.dealValue, currencySymbol)}
                  </Link>

                  {/* Stage */}
                  <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                    <StageBadge stage={deal.stage} />
                  </Link>

                  {/* Score */}
                  <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {score != null ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '3px 8px', borderRadius: 6,
                        background: `${scoreColor}12`,
                        border: `1px solid ${scoreColor}30`,
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: scoreColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor, fontVariantNumeric: 'tabular-nums' }}>
                          {score}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </Link>

                  {/* AI Intel — snapshot or topRisk fallback */}
                  <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'block', minWidth: 0 }}>
                    {snapshotPending ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ height: 8, width: '90%', borderRadius: 3, background: 'var(--surface-2)', animation: 'pulse 1.6s ease-in-out infinite' }} />
                        <div style={{ height: 8, width: '60%', borderRadius: 3, background: 'var(--surface-2)', animation: 'pulse 1.6s ease-in-out infinite', animationDelay: '0.2s' }} />
                      </div>
                    ) : snapshot ? (
                      <div style={{
                        fontSize: 12,
                        color: healthStatus === 'at_risk' ? '#b45309'
                          : healthStatus === 'improving' ? '#166534'
                          : urgentReason ? '#ef4444'
                          : stale ? '#f59e0b'
                          : 'var(--text-secondary)',
                        fontWeight: healthStatus === 'at_risk' || urgentReason ? 500 : 400,
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as any,
                        overflow: 'hidden',
                      }}>
                        {snapshot}
                      </div>
                    ) : (
                      <span style={{
                        fontSize: 12,
                        color: urgentReason ? '#ef4444' : stale ? '#f59e0b' : 'var(--text-tertiary)',
                        fontWeight: (urgentReason || stale) ? 500 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        display: 'block',
                      }}>
                        {topRisk ?? '—'}
                      </span>
                    )}
                  </Link>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Add Deal Modal ── */}
      <Dialog.Root open={addOpen} onOpenChange={setAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 500,
          }} />
          <Dialog.Content style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 501,
            width: '100%',
            maxWidth: 520,
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            padding: 28,
            boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
            outline: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Log a deal
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 7,
                  backgroundColor: '#f5f5f5',
                  border: '1px solid var(--border-default)',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
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

export default function DealsPage() {
  return (
    <Suspense fallback={null}>
      <DealsPageInner />
    </Suspense>
  )
}
