'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import {
  AlertTriangle, CheckCircle, Clock, Package, ChevronDown, ChevronUp,
  Info, Download, Lock, BarChart3, Trash2, List, Columns, Swords, BookOpen, TrendingUp, Brain,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { PageTabs } from '@/components/shared/PageTabs'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ─── Win rate comparison bars ────────────────────────────────────────────────

function WinRateDeltaBar({ withGap, withoutGap }: { withGap: number; withoutGap: number }) {
  const maxVal = Math.max(withGap, withoutGap, 80)
  const delta = withoutGap - withGap
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', width: '60px', flexShrink: 0 }}>Without gap</div>
        <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(withoutGap / maxVal) * 100}%`, background: 'var(--success)', borderRadius: '3px', transition: 'width 0.1s ease' }} />
        </div>
        <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--success)', width: '28px' }}>{Math.round(withoutGap)}%</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', width: '60px', flexShrink: 0 }}>With gap</div>
        <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(withGap / maxVal) * 100}%`, background: delta >= 20 ? 'var(--danger)' : delta >= 10 ? 'var(--warning)' : 'var(--text-tertiary)', borderRadius: '3px', transition: 'width 0.1s ease' }} />
        </div>
        <div style={{ fontSize: '10px', fontWeight: '600', color: delta >= 20 ? 'var(--danger)' : delta >= 10 ? 'var(--warning)' : 'var(--text-secondary)', width: '28px' }}>{Math.round(withGap)}%</div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function GapCardSkeleton() {
  return (
    <div style={{ background: 'var(--card-bg)', border: 'none', borderRadius: '8px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--surface)', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ height: '13px', width: '45%', borderRadius: '4px', background: 'var(--surface)' }} />
          <div style={{ height: '11px', width: '70%', borderRadius: '4px', background: 'var(--surface)', opacity: 0.6 }} />
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
          <div style={{ height: '15px', width: '55px', borderRadius: '4px', background: 'var(--surface)' }} />
          <div style={{ height: '10px', width: '40px', borderRadius: '4px', background: 'var(--surface)', opacity: 0.5 }} />
        </div>
      </div>
    </div>
  )
}

// ─── Types & config ──────────────────────────────────────────────────────────

type GapStatus = 'open' | 'on_roadmap' | 'shipped' | 'in_review'
type SortKey   = 'revenue' | 'frequency' | 'delta' | 'status'

const statusConfig: Record<GapStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  open:       { label: 'Open',        color: '#f59e0b',          bg: 'color-mix(in srgb, #f59e0b 12%, transparent)',   icon: <AlertTriangle size={10} /> },
  on_roadmap: { label: 'On Roadmap',  color: '#06b6d4',          bg: 'color-mix(in srgb, #06b6d4 12%, transparent)',   icon: <Clock size={10} /> },
  shipped:    { label: 'Shipped',     color: 'var(--success)',   bg: 'color-mix(in srgb, var(--success) 12%, transparent)', icon: <CheckCircle size={10} /> },
  in_review:  { label: 'In Review',   color: '#818cf8',          bg: 'color-mix(in srgb, #818cf8 12%, transparent)',   icon: <Info size={10} /> },
}

const statusOrder: GapStatus[] = ['open', 'in_review', 'on_roadmap', 'shipped']

function getPriorityBadge(gap: EnrichedGap): { label: string; color: string; bg: string } {
  const rev = gap.revenueAtRisk ?? 0
  const freq = gap.frequency ?? 0
  if (freq >= 3 && rev >= 5000)  return { label: 'Critical', color: '#ef4444', bg: 'color-mix(in srgb, #ef4444 12%, transparent)' }
  if (freq >= 2 || rev >= 2000)  return { label: 'High',     color: '#f59e0b', bg: 'color-mix(in srgb, #f59e0b 12%, transparent)' }
  if (freq >= 1 && rev > 0)      return { label: 'Medium',   color: '#6366f1', bg: 'color-mix(in srgb, #6366f1 12%, transparent)' }
  return                                { label: 'Low',      color: 'var(--text-tertiary)', bg: 'var(--surface)' }
}

interface EnrichedGap {
  id: string
  title: string
  description?: string
  status: GapStatus
  revenueAtRisk: number
  frequency: number
  winRateWithGap: number | null
  winRateWithoutGap: number | null
  delta: number
  sourceDeals?: string[]
  affectedDealsData?: { id: string; name: string; stage: string; score?: number | null }[]
}

// ─── Score badge ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return null
  const color = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--danger)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '26px', height: '26px', borderRadius: '50%',
      fontSize: '9px', fontWeight: '700', lineHeight: 1,
      color, border: `2px solid ${color}`,
      background: `color-mix(in srgb, ${color} 10%, transparent)`,
    }}>
      {Math.round(score)}
    </span>
  )
}

// ─── Export helper ────────────────────────────────────────────────────────────

function exportReport(gaps: EnrichedGap[], totalGaps: number, uniqueDeals: number, totalRev: number) {
  const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
  const fmtRev = (v: number) => formatCurrency(v, true)
  const sortedByPriority = [...gaps].sort((a, b) => {
    const order = ['Critical', 'High', 'Medium', 'Low']
    return order.indexOf(getPriorityBadge(a).label) - order.indexOf(getPriorityBadge(b).label)
  })

  let md = `# Product Impact Report\nGenerated: ${today}\n\n`
  md += `## Summary\n${totalGaps} gaps tracked across ${uniqueDeals} deals — ${fmtRev(totalRev)} revenue at risk\n\n`
  md += `## Gaps by Priority\n\n`

  for (const gap of sortedByPriority) {
    const priority = getPriorityBadge(gap).label
    const statusLabel = statusConfig[(gap.status ?? 'open') as GapStatus]?.label ?? gap.status
    md += `### ${gap.title} — ${priority}\n`
    md += `- Revenue at Risk: ${gap.revenueAtRisk > 0 ? fmtRev(gap.revenueAtRisk) : 'Unknown'}\n`
    md += `- Frequency: ${gap.frequency} deal${gap.frequency !== 1 ? 's' : ''}\n`
    md += `- Status: ${statusLabel}\n`
    if (gap.winRateWithGap != null && gap.winRateWithoutGap != null) {
      md += `- Win Rate Impact: ${Math.round(gap.winRateWithGap)}% with gap vs ${Math.round(gap.winRateWithoutGap)}% without\n`
    } else {
      md += `- Win Rate Impact: Not enough data\n`
    }
    if (gap.description) md += `\n${gap.description}\n`
    md += `\n`
  }

  const blob = new Blob([md], { type: 'text/markdown' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'product-gaps-report.md'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProductGapsPage() {
  const { data: brainRes, isLoading: brainLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: gapsRes, isLoading: gapsLoading, mutate: mutateGaps } = useSWR('/api/product-gaps', fetcher)
  const brain = brainRes?.data

  const [sortBy, setSortBy]       = useState<SortKey>('revenue')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showMoreMap, setShowMoreMap] = useState<Record<string, boolean>>({})
  const [view, setView]           = useState<'list' | 'roadmap'>('list')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [localDeletedIds, setLocalDeletedIds] = useState<Set<string>>(new Set())

  const handleDeleteGap = async (id: string) => {
    if (!confirm('Delete this product gap? This cannot be undone.')) return
    setDeletingId(id)
    // Optimistically remove from local state immediately — prevents ghost item from reappearing
    // via the brain cache while the SWR re-fetch and brain rebuild are in flight
    setLocalDeletedIds(prev => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/product-gaps/${id}`, { method: 'DELETE' })
      if (res.ok) {
        // Update SWR cache optimistically then revalidate
        mutateGaps(
          (current: any) => {
            const items: any[] = Array.isArray(current) ? current : (Array.isArray(current?.data) ? current.data : [])
            const filtered = items.filter((g: any) => g.id !== id)
            return Array.isArray(current) ? filtered : { ...current, data: filtered }
          },
          { revalidate: true }
        )
      } else {
        // Restore if the server rejected the delete
        setLocalDeletedIds(prev => { const next = new Set(prev); next.delete(id); return next })
      }
    } catch (err) {
      console.error('Failed to delete gap:', err)
      setLocalDeletedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    } finally {
      setDeletingId(null)
    }
  }

  const isLoading = brainLoading || gapsLoading

  // Normalise stored gaps — filter any locally-deleted IDs so they can't ghost after optimistic delete
  const storedGaps: any[] = (Array.isArray(gapsRes) ? gapsRes : (Array.isArray(gapsRes?.data) ? gapsRes.data : []))
    .filter((g: any) => !localDeletedIds.has(g.id))
  const brainGaps: any[] = brain?.productGapPriority ?? []
  const overallWinRate: number = brain?.winLossIntel?.winRate ?? 50

  // Build enriched gap list
  const enrichedGaps: EnrichedGap[] = storedGaps.map((gap: any) => {
    const brainGap = brainGaps.find((bg: any) => bg.gapId === gap.id || bg.title === gap.title)
    const revenueAtRisk = brainGap?.revenueAtRisk ?? gap.affectedRevenue ?? gap.blockedRevenue ?? 0
    return {
      ...gap,
      revenueAtRisk,
      frequency:         brainGap?.dealsBlocked      ?? gap.frequency        ?? 0,
      winRateWithGap:    brainGap?.winRateWithGap    ?? null,
      winRateWithoutGap: brainGap?.winRateWithoutGap ?? null,
      delta:             (brainGap?.winRateWithoutGap ?? 0) - (brainGap?.winRateWithGap ?? 0),
    }
  })

  // Surface brain-only gaps — skip any that were locally deleted (brain cache may still reference them)
  for (const bg of brainGaps) {
    const alreadyPresent = enrichedGaps.some((g) => g.id === bg.gapId || g.title === bg.title)
    const wasDeleted = bg.gapId ? localDeletedIds.has(bg.gapId) : false
    if (!alreadyPresent && bg.title && !wasDeleted) {
      enrichedGaps.push({
        id:                bg.gapId ?? `brain-${bg.title}`,
        title:             bg.title,
        description:       bg.description ?? '',
        status:            (bg.status ?? 'open') as GapStatus,
        revenueAtRisk:     bg.revenueAtRisk    ?? 0,
        frequency:         bg.dealsBlocked     ?? 0,
        winRateWithGap:    bg.winRateWithGap   ?? null,
        winRateWithoutGap: bg.winRateWithoutGap ?? null,
        delta:             (bg.winRateWithoutGap ?? 0) - (bg.winRateWithGap ?? 0),
      })
    }
  }

  // Compute summary stats
  const totalGaps    = enrichedGaps.length
  const uniqueDeals  = new Set(enrichedGaps.flatMap(g => (g.sourceDeals ?? []))).size
  const totalRevRisk = enrichedGaps.reduce((s, g) => s + (g.revenueAtRisk ?? 0), 0)

  // Sort
  const sorted = [...enrichedGaps].sort((a, b) => {
    if (sortBy === 'revenue')   return b.revenueAtRisk - a.revenueAtRisk
    if (sortBy === 'frequency') return b.frequency - a.frequency
    if (sortBy === 'delta')     return b.delta - a.delta
    if (sortBy === 'status') {
      return statusOrder.indexOf((a.status ?? 'open') as GapStatus) - statusOrder.indexOf((b.status ?? 'open') as GapStatus)
    }
    return 0
  })

  const openGapCount = enrichedGaps.filter(g => g.status === 'open').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '960px' }}>
      <PageTabs tabs={[
        { label: 'Overview',     href: '/intelligence', icon: Brain         },
        { label: 'Competitors',  href: '/competitors',  icon: Swords        },
        { label: 'Case Studies', href: '/case-studies', icon: BookOpen      },
        { label: 'Feature Gaps', href: '/product-gaps', icon: AlertTriangle },
        { label: 'Playbook',     href: '/playbook',     icon: TrendingUp    },
        { label: 'Models',       href: '/models',       icon: Brain         },
      ]} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'color-mix(in srgb, var(--warning) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Package size={18} style={{ color: 'var(--warning)' }} />
            </div>
            <div>
              <h1 className="font-brand" style={{ fontSize: '26px', fontWeight: '500', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                Product Gaps
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Feature gaps extracted from deal notes — ranked by revenue at risk
              </p>
            </div>
          </div>

          {/* Summary stats line */}
          {!isLoading && totalGaps > 1 && (
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '48px', marginTop: '4px' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{totalGaps} gaps</span> tracked across{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{uniqueDeals > 0 ? uniqueDeals : enrichedGaps.reduce((s, g) => s + (g.frequency ?? 0), 0)} deals</span>
              {totalRevRisk > 0 && (
                <> — <span style={{ color: 'var(--danger)', fontWeight: '600' }}>
                  {formatCurrency(totalRevRisk, true)} revenue at risk
                </span></>
              )}
            </div>
          )}
          {!isLoading && totalGaps <= 1 && (
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '48px', marginTop: '4px', maxWidth: '500px', lineHeight: 1.5 }}>
              Gaps are auto-extracted when prospects mention missing features in your meeting notes. The more notes you paste, the more gaps surface.
            </div>
          )}
        </div>

        {/* View toggle + Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '2px', background: 'var(--surface)', border: 'none', borderRadius: '8px', padding: '3px' }}>
            <button
              onClick={() => setView('list')}
              title="List view"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                background: view === 'list' ? 'var(--accent)' : 'transparent',
                color: view === 'list' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <List size={12} /> List
            </button>
            <button
              onClick={() => setView('roadmap')}
              title="Roadmap view"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                background: view === 'roadmap' ? 'var(--accent)' : 'transparent',
                color: view === 'roadmap' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <Columns size={12} /> Roadmap
            </button>
          </div>

        <button
          onClick={() => exportReport(enrichedGaps, totalGaps, uniqueDeals, totalRevRisk)}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
            cursor: 'pointer', border: 'none',
            background: 'var(--surface)', color: 'var(--text-secondary)',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
        >
          <Download size={13} />
          Export Impact Report
        </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      {!isLoading && totalRevRisk > 0 && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ padding: '12px 16px', background: 'color-mix(in srgb, var(--danger) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '10px' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--danger)', lineHeight: 1 }}>
              {formatCurrency(totalRevRisk, true)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>Total revenue at risk</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--card-bg)', border: 'none', borderRadius: '10px' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>{openGapCount}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>Open gaps</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--card-bg)', border: 'none', borderRadius: '10px' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#06b6d4', lineHeight: 1 }}>{enrichedGaps.filter(g => g.status === 'on_roadmap').length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>On roadmap</div>
          </div>
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[0, 1, 2].map(i => <GapCardSkeleton key={i} />)}
        </div>
      )}

      {/* ── Sort controls (list view only) ── */}
      {!isLoading && sorted.length > 0 && view === 'list' && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginRight: '4px' }}>Sort by:</div>
          {(
            [
              ['revenue',   'Revenue at risk'],
              ['delta',     'Win rate impact'],
              ['frequency', 'Frequency'],
              ['status',    'Status'],
            ] as Array<[SortKey, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              style={{
                padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: sortBy === key ? '700' : '500',
                cursor: 'pointer', border: '1px solid', transition: 'all 0.12s',
                background:   sortBy === key ? 'var(--accent)'  : 'var(--surface)',
                color:        sortBy === key ? '#fff'           : 'var(--text-secondary)',
                borderColor:  sortBy === key ? 'var(--accent)'  : 'var(--border)',
                boxShadow:    sortBy === key ? '0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Gap list or empty state ── */}
      {!isLoading && sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--card-bg)', border: 'none', borderRadius: '8px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '8px', background: 'var(--surface)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={24} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
          </div>
          <div style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
            No open product gaps detected
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.6 }}>
            This is either great news — or you haven&apos;t pasted enough meeting notes yet. Every time a prospect says &ldquo;we&apos;d need X to move forward,&rdquo; Halvex captures it here automatically.
          </div>
          <a
            href="/pipeline"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              background: 'var(--accent)', color: '#fff', textDecoration: 'none',
              border: '1px solid var(--accent)',
            }}
          >
            <BarChart3 size={14} />
            Go to your deals to paste meeting notes
          </a>
        </div>
      )}

      {!isLoading && sorted.length > 0 && view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sorted.map((gap: EnrichedGap, idx: number) => {
            const statusKey     = (gap.status ?? 'open') as GapStatus
            const status        = statusConfig[statusKey] ?? statusConfig.open
            const priority      = getPriorityBadge(gap)
            const isExpanded    = expandedId === gap.id
            const hasWinData    = gap.winRateWithGap != null && gap.winRateWithoutGap != null
            const revRisk       = gap.revenueAtRisk ?? 0
            const sourceDeals   = gap.sourceDeals ?? []
            const showAll       = showMoreMap[gap.id] ?? false
            const visibleDeals  = showAll ? sourceDeals : sourceDeals.slice(0, 5)

            // Effective win rate without gap — use brain overall if we have no per-gap data
            const effectiveWithoutGap = gap.winRateWithoutGap ?? overallWinRate

            return (
              <div
                key={gap.id}
                style={{
                  background: 'var(--card-bg)',
                  border: 'none',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.15s, border-color 0.15s, opacity 0.15s',
                  opacity: deletingId === gap.id ? 0.5 : 1,
                  pointerEvents: deletingId === gap.id ? 'none' : undefined,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px color-mix(in srgb, var(--accent) 8%, transparent)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'color-mix(in srgb, var(--accent) 30%, var(--card-border))' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--card-border)' }}
              >
                {/* ── Main row ── */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : gap.id)}
                >
                  {/* Rank */}
                  <div style={{
                    flexShrink: 0, width: '28px', height: '28px', borderRadius: '7px',
                    background: idx < 3 ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : 'var(--surface)',
                    border: `1px solid ${idx < 3 ? 'color-mix(in srgb, var(--danger) 20%, transparent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: '600',
                    color: idx < 3 ? 'var(--danger)' : 'var(--text-tertiary)',
                  }}>
                    {idx + 1}
                  </div>

                  {/* Title + badges */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {gap.title ?? 'Unnamed gap'}
                      </div>
                      {/* Status badge */}
                      <div style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '100px', color: status.color, background: status.bg }}>
                        {status.icon} {status.label}
                      </div>
                      {/* Priority badge */}
                      <div style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '100px', color: priority.color, background: priority.bg, letterSpacing: '0.02em' }}>
                        {priority.label}
                      </div>
                    </div>
                    {gap.description && !isExpanded && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {gap.description}
                      </div>
                    )}
                  </div>

                  {/* Win rate bar */}
                  {hasWinData && (
                    <div style={{ flexShrink: 0 }}>
                      <WinRateDeltaBar withGap={gap.winRateWithGap!} withoutGap={effectiveWithoutGap} />
                    </div>
                  )}

                  {/* Revenue + frequency */}
                  <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '80px' }}>
                    {revRisk > 0 ? (
                      <>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: revRisk >= 10000 ? 'var(--danger)' : revRisk >= 1000 ? 'var(--warning)' : 'var(--text-secondary)', lineHeight: 1 }}>
                          {formatCurrency(revRisk, true)}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>at risk</div>
                      </>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Value unknown</div>
                    )}
                    {gap.frequency > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{gap.frequency}× mentioned</div>
                    )}
                  </div>

                  {/* Expand arrow */}
                  <div style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>

                  {/* Delete button */}
                  {!String(gap.id).startsWith('brain-') && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteGap(gap.id) }}
                      title="Delete this gap"
                      disabled={deletingId === gap.id}
                      style={{
                        flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                        color: '#52525B', padding: '4px', borderRadius: '4px',
                        display: 'flex', alignItems: 'center', opacity: deletingId === gap.id ? 0.4 : 1,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#52525B')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* ── Expanded detail ── */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ paddingTop: '12px' }}>

                      {/* Description */}
                      {gap.description && (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
                          {gap.description}
                        </div>
                      )}

                      {/* Win rate insight */}
                      {hasWinData ? (
                        <div style={{ padding: '12px 14px', background: 'color-mix(in srgb, var(--danger) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '8px', marginBottom: '12px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--danger)', marginBottom: '4px' }}>
                            Win rate drops {Math.round(gap.delta)}pp when this gap is present
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {Math.round(gap.winRateWithoutGap!)}% win rate on deals without this gap → {Math.round(gap.winRateWithGap!)}% with this gap
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '10px 14px', background: 'var(--surface)', border: 'none', borderRadius: '8px', marginBottom: '12px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                            Not enough data yet to calculate win rate impact for this gap.
                          </div>
                        </div>
                      )}

                      {/* Affected deals */}
                      {sourceDeals.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: showAll || sourceDeals.length <= 5 ? '8px' : '0' }}
                            onClick={e => { e.stopPropagation(); setShowMoreMap(prev => ({ ...prev, [gap.id]: !showAll })) }}
                          >
                            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                              {sourceDeals.length} deal{sourceDeals.length !== 1 ? 's' : ''} affected
                            </div>
                            <ChevronDown size={11} style={{ color: 'var(--text-tertiary)', transform: showAll ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
                          </div>

                          {(showAll || true) && visibleDeals.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {visibleDeals.map((dealId: string) => {
                                // Try to find deal info from brain
                                const dealSnap = brain?.deals?.find((d: any) => d.id === dealId)
                                return (
                                  <div key={dealId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--surface)', borderRadius: '6px', border: 'none' }}>
                                    <ScoreBadge score={dealSnap?.conversionScore} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {dealSnap?.name ?? dealId.slice(0, 8) + '…'}
                                      </div>
                                      {dealSnap?.stage && (
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px' }}>{dealSnap.stage.replace(/_/g, ' ')}</div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                              {!showAll && sourceDeals.length > 5 && (
                                <button
                                  onClick={e => { e.stopPropagation(); setShowMoreMap(prev => ({ ...prev, [gap.id]: true })) }}
                                  style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}
                                >
                                  + {sourceDeals.length - 5} more deals
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status change buttons */}
                    {!String(gap.id).startsWith('brain-') && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', alignSelf: 'center' }}>Status:</div>
                        {(['open', 'in_review', 'on_roadmap', 'shipped'] as GapStatus[]).map(s => (
                          <button
                            key={s}
                            onClick={async (e) => {
                              e.stopPropagation()
                              await fetch(`/api/product-gaps/${gap.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: s }),
                              })
                              mutateGaps()
                            }}
                            style={{
                              padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                              border: '1px solid', transition: 'all 0.12s',
                              background:   (gap.status ?? 'open') === s ? statusConfig[s]?.bg      : 'var(--surface)',
                              color:        (gap.status ?? 'open') === s ? statusConfig[s]?.color   : 'var(--text-secondary)',
                              borderColor:  (gap.status ?? 'open') === s ? statusConfig[s]?.color   : 'var(--border)',
                            }}
                          >
                            {statusConfig[s]?.label ?? s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Roadmap view ── */}
      {!isLoading && view === 'roadmap' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', alignItems: 'start' }}>
          {(['open', 'in_review', 'on_roadmap', 'shipped'] as GapStatus[]).map(col => {
            const colGaps = enrichedGaps.filter(g => (g.status ?? 'open') === col)
            const cfg = statusConfig[col]
            return (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 10px', borderRadius: '8px',
                  background: cfg.bg, border: `1px solid color-mix(in srgb, ${cfg.color} 25%, transparent)`,
                }}>
                  {cfg.icon}
                  <span style={{ fontSize: '12px', fontWeight: '600', color: cfg.color }}>{cfg.label}</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: '11px', fontWeight: '600',
                    background: `color-mix(in srgb, ${cfg.color} 18%, transparent)`,
                    color: cfg.color, borderRadius: '100px', padding: '1px 7px',
                  }}>{colGaps.length}</span>
                </div>
                {/* Gap cards */}
                {colGaps.length === 0 && (
                  <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                    No gaps
                  </div>
                )}
                {colGaps.map(gap => {
                  const priority = getPriorityBadge(gap)
                  return (
                    <div
                      key={gap.id}
                      style={{
                        background: 'var(--card-bg)', border: 'none',
                        borderRadius: '10px', padding: '10px 12px',
                        display: 'flex', flexDirection: 'column', gap: '6px',
                        opacity: deletingId === gap.id ? 0.5 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {/* Card header: title + delete */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <div style={{ flex: 1, fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          {gap.title}
                        </div>
                        {!String(gap.id).startsWith('brain-') && (
                          <button
                            onClick={() => handleDeleteGap(gap.id)}
                            title="Delete this gap"
                            disabled={deletingId === gap.id}
                            style={{
                              flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                              color: '#71717A', padding: '2px', borderRadius: '4px',
                              display: 'flex', alignItems: 'center',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#71717A')}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      {/* Priority + revenue */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', fontWeight: '600', padding: '1px 6px', borderRadius: '100px', color: priority.color, background: priority.bg }}>
                          {priority.label}
                        </span>
                        {gap.revenueAtRisk > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--danger)' }}>
                            {formatCurrency(gap.revenueAtRisk, true)}
                          </span>
                        )}
                      </div>
                      {/* Affected deals */}
                      {gap.frequency > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          {gap.frequency} deal{gap.frequency !== 1 ? 's' : ''} affected
                        </div>
                      )}
                      {/* Move status buttons */}
                      {!String(gap.id).startsWith('brain-') && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                          {(['open', 'in_review', 'on_roadmap', 'shipped'] as GapStatus[])
                            .filter(s => s !== col)
                            .map(s => (
                              <button
                                key={s}
                                onClick={async () => {
                                  await fetch(`/api/product-gaps/${gap.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: s }),
                                  })
                                  mutateGaps()
                                }}
                                style={{
                                  fontSize: '9px', fontWeight: '600', padding: '2px 6px',
                                  borderRadius: '4px', cursor: 'pointer', border: 'none',
                                  background: 'var(--surface)', color: 'var(--text-tertiary)',
                                  transition: 'all 0.1s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = statusConfig[s].bg; (e.currentTarget as HTMLButtonElement).style.color = statusConfig[s].color; (e.currentTarget as HTMLButtonElement).style.borderColor = statusConfig[s].color }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
                              >
                                {statusConfig[s].label}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
