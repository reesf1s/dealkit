'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import Link from 'next/link'
import {
  AlertTriangle, Clock, TrendingUp, Target, ArrowRight,
  RefreshCw, CheckCircle2, Zap, Activity, Sparkles,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'

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

function fmtCurrency(n: number | null | undefined, sym = '£'): string {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `${sym}${Math.round(n / 1_000)}k`
  return `${sym}${Math.round(n)}`
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
  const deal = (meta?.dealName ?? enrichedDealName ?? meta?.customerName ?? 'Unknown') as string
  const stage = String(meta?.value ?? meta?.newStage ?? meta?.stage ?? '').replace(/_/g, ' ')
  switch (type) {
    case 'deal_log.created':   return `${deal} added to pipeline`
    case 'deal_log.updated':
      if (meta?.field === 'stage' && stage) return `${deal} moved to ${stage}`
      return `${deal} updated`
    case 'deal_log.deleted':   return `${deal} removed`
    case 'deal_log.closed_won':  return `${deal} won`
    case 'deal_log.closed_lost': return `${deal} lost`
    case 'deal_log.todos_updated': return `${deal} todos updated`
    case 'note_added':         return `Note added to ${deal}`
    case 'deal_log.note_added': return `Note added to ${deal}`
    case 'ai_analysis':        return `AI analysed ${deal}`
    case 'deal_log.ai_scored': return `AI scored ${deal}`
    case 'collateral.generated': return `${String(meta?.collateralType ?? 'Collateral').replace(/_/g, ' ')} generated`
    case 'collateral.archived':  return 'Collateral archived'
    case 'competitor.created':  return `Competitor added — ${deal}`
    case 'competitor.updated':  return `Competitor updated — ${deal}`
    case 'company_profile.updated': return 'Company profile updated'
    case 'case_study.created':  return `Case study — ${deal}`
    case 'case_study.updated':  return `Case study updated — ${deal}`
    case 'plan.upgraded':   return 'Plan upgraded'
    case 'plan.downgraded': return 'Plan downgraded'
    case 'deal_created': return `${deal} added to pipeline`
    case 'deal_stage_changed': return `${deal} moved to ${stage}`
    case 'deal_won': return `${deal} won`
    case 'deal_lost': return `${deal} lost`
    default: return type.replace(/[_.]/g, ' ')
  }
}

function eventDotColor(type: string): string {
  if (['deal_log.created', 'deal_log.closed_won', 'deal_created', 'deal_won', 'case_study.created', 'collateral.generated'].includes(type)) return '#1DB86A'
  if (['deal_log.closed_lost', 'deal_log.deleted', 'deal_lost'].includes(type)) return '#ef4444'
  if (['ai_analysis', 'deal_log.ai_scored', 'deal_log.todos_updated'].includes(type)) return '#f59e0b'
  if (['collateral.archived', 'plan.downgraded'].includes(type)) return '#aaa'
  return '#3b82f6'
}

// ─── Deal Monitor Mini ──────────────────────────────────────────────────────

function DealMonitorMini() {
  const { data, isLoading } = useSWR<{
    data: {
      alerts: Array<{ dealId: string; dealName: string; company: string; type: string; severity: string; message: string }>
      summary: { totalActive: number; criticalCount: number; warningCount: number; healthyCount: number }
    }
  }>('/api/deals/monitor', fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 })

  const summary = data?.data?.summary
  const alerts = data?.data?.alerts ?? []
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').slice(0, 3)

  // Loading skeleton
  if (isLoading) {
    return (
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border-default)',
        borderRadius: 10, marginBottom: 14, padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--surface-2)' }} />
          <div style={{ height: 10, width: 90, borderRadius: 4, background: 'var(--surface-2)' }} />
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, height: 22, borderRadius: 4, background: 'var(--surface-2)' }} />
          {[1, 2].map(i => (
            <div key={i} style={{ width: 40, height: 22, borderRadius: 4, background: 'var(--surface-2)' }} />
          ))}
        </div>
      </div>
    )
  }

  // Data loaded but no summary — monitor API unavailable
  if (!summary) return null

  const total = summary.totalActive
  const healthy = summary.healthyCount
  const atRisk = summary.criticalCount + summary.warningCount
  const healthPct = total > 0 ? Math.round((healthy / total) * 100) : 100

  return (
    <div style={{
      background: 'var(--surface-1)', border: '1px solid var(--border-default)',
      borderRadius: 10, marginBottom: 14, padding: '14px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={11} style={{ color: atRisk > 0 ? '#ef4444' : '#1DB86A' }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Deal Monitor
          </span>
          {atRisk > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '1px 6px', borderRadius: 99,
              background: 'var(--color-red-bg)',
              color: 'var(--color-red)',
              border: '1px solid rgba(239,68,68,0.30)',
            }}>{atRisk} alert{atRisk !== 1 ? 's' : ''}</span>
          )}
        </div>
        <Link href="/workflows" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          View all →
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: criticalAlerts.length > 0 ? 10 : 0 }}>
        {/* Health bar */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Pipeline health</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: healthPct >= 70 ? '#1DB86A' : healthPct >= 40 ? 'var(--color-amber)' : 'var(--color-red)' }}>
              {healthPct}%
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${healthPct}%`,
              background: healthPct >= 70 ? '#1DB86A' : healthPct >= 40 ? '#f59e0b' : '#ef4444',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{total}</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', fontWeight: 500 }}>Active</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1DB86A', letterSpacing: '-0.02em' }}>{healthy}</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', fontWeight: 500 }}>Healthy</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: atRisk > 0 ? 'var(--color-red)' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>{atRisk}</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', fontWeight: 500 }}>At risk</div>
          </div>
        </div>
      </div>

      {criticalAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {criticalAlerts.map((a, i) => (
            <Link key={`${a.dealId}-${a.type}-${i}`} href={`/deals/${a.dealId}`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 6,
                background: 'var(--color-red-bg)',
                border: '1px solid rgba(239,68,68,0.15)',
                transition: 'background 80ms',
                cursor: 'pointer',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-red-bg)'}
              >
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-red)', flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.dealName || a.company}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  {a.message}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Focus Briefing ────────────────────────────────────────────────────────

function FocusBriefing() {
  const { data, mutate } = useSWR<{ text: string | null; generatedAt?: string; cached: boolean; stale?: boolean; error?: string }>(
    '/api/dashboard/focus-briefing', fetcher, { revalidateOnFocus: false },
  )
  const [refreshing, setRefreshing] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const autoTriggered = useRef(false)

  const regenerate = async () => {
    setRefreshing(true)
    setGenError(null)
    try {
      const res = await fetch('/api/dashboard/focus-briefing', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate')
      mutate(json, false)
    } catch (e: any) {
      setGenError(e.message ?? 'Generation failed')
    }
    setRefreshing(false)
  }

  // Auto-generate on first load if no briefing exists, and refresh if stale
  useEffect(() => {
    if (!data || autoTriggered.current || refreshing) return
    if (!data.text || data.stale) {
      autoTriggered.current = true
      regenerate()
    }
  }, [data?.text, data?.stale]) // eslint-disable-line react-hooks/exhaustive-deps

  // Loading skeleton
  if (!data) {
    return (
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border-default)',
        borderRadius: 10, marginBottom: 14, padding: '16px 18px',
        borderLeft: '3px solid #8b5cf6',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Sparkles size={11} style={{ color: '#8b5cf6' }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Daily Focus
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[100, 85, 92, 70].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 10, borderRadius: 4, width: `${w}%`, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    )
  }

  const hasText = !!data.text

  return (
    <div style={{
      background: 'var(--surface-1)', border: '1px solid var(--border-default)',
      borderRadius: 10, marginBottom: 14, padding: '16px 18px',
      borderLeft: '3px solid #8b5cf6',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasText ? 10 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={11} style={{ color: '#8b5cf6' }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Daily Focus
          </span>
          {data.generatedAt && !refreshing && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 4 }}>
              {data.stale ? '· stale — refreshing' : `· ${relativeTime(data.generatedAt)}`}
            </span>
          )}
          {refreshing && (
            <span style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 500, marginLeft: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
              <RefreshCw size={9} style={{ animation: 'spin 1s linear infinite' }} />
              Generating…
            </span>
          )}
        </div>
        {hasText && !refreshing && (
          <button
            onClick={regenerate}
            disabled={refreshing}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10.5, padding: '2px 6px', borderRadius: 4,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
          >
            <RefreshCw size={10} />
            Refresh
          </button>
        )}
      </div>

      {/* Generating skeleton */}
      {refreshing && !hasText && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
          {[100, 88, 94, 75, 82].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 10, borderRadius: 4, width: `${w}%`, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      )}

      {/* Error state */}
      {genError && !refreshing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-red-bg)', borderRadius: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-red)' }}>{genError}</span>
          <button onClick={regenerate} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-red)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Retry
          </button>
        </div>
      )}

      {/* Briefing text */}
      {hasText && !refreshing && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {data.text}
        </div>
      )}

      {/* First-time empty state (no text, not loading) */}
      {!hasText && !refreshing && !genError && (
        <div style={{ padding: '8px 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', flex: 1 }}>
            Add deals with meeting notes to get your AI-generated daily briefing.
          </div>
          <button
            onClick={regenerate}
            style={{
              background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6,
              padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Generate now
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Skeleton({ h = 80 }: { h?: number }) {
  return (
    <div style={{ height: h, borderRadius: 8 }} className="skeleton" />
  )
}

interface TodayAction {
  dealId: string
  dealName: string
  action: string
  context: string
  value?: number | null
  score?: number | null
  priority: 'high' | 'medium' | 'low'
}

function buildTodayActions(
  deals: Array<{ id: string; dealName: string; prospectCompany: string; stage: string; dealValue: number | null; conversionScore: number | null; aiSummary: string | null; nextSteps: string | null; conversionInsights: string[]; updatedAt: string }>,
  brain: BrainData
): TodayAction[] {
  const actions: TodayAction[] = []
  const seen = new Set<string>()

  const openDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))

  // ── 1. Deals with explicit nextSteps — most specific, direct instructions ─
  const withNextSteps = openDeals
    .filter(d => d.nextSteps?.trim())
    .sort((a, b) => (a.conversionScore ?? 50) - (b.conversionScore ?? 50)) // most at-risk first

  for (const deal of withNextSteps) {
    if (actions.length >= 5) break
    if (seen.has(deal.id)) continue
    const action = deal.nextSteps!.trim()
    // aiSummary gives the "why" — the full context for this action
    const contextRaw = deal.aiSummary || deal.conversionInsights?.[0] || ''
    const context = contextRaw ? contextRaw.slice(0, 130) + (contextRaw.length > 130 ? '…' : '') : ''
    const score = deal.conversionScore
    const priority: TodayAction['priority'] = score != null && score < 40 ? 'high' : score != null && score < 65 ? 'medium' : 'low'
    actions.push({ dealId: deal.id, dealName: deal.dealName || deal.prospectCompany, action, context, value: deal.dealValue, score, priority })
    seen.add(deal.id)
  }

  // ── 2. Top-up: deals with aiSummary/insights but no nextSteps ────────────
  if (actions.length < 5) {
    const withInsights = openDeals
      .filter(d => !seen.has(d.id) && (d.aiSummary || d.conversionInsights?.length))
      .sort((a, b) => (a.conversionScore ?? 50) - (b.conversionScore ?? 50))

    for (const deal of withInsights) {
      if (actions.length >= 5) break
      // Use the most specific-sounding insight (longer = more specific)
      const insights = deal.conversionInsights ?? []
      const bestInsight = insights.sort((a, b) => b.length - a.length)[0]
      const action = bestInsight || deal.aiSummary?.split('.')[0] || ''
      if (!action || action.length < 20) continue
      const contextRaw = deal.aiSummary || insights[1] || ''
      const context = contextRaw ? contextRaw.slice(0, 130) + (contextRaw.length > 130 ? '…' : '') : ''
      const score = deal.conversionScore
      const priority: TodayAction['priority'] = score != null && score < 40 ? 'high' : score != null && score < 65 ? 'medium' : 'low'
      actions.push({ dealId: deal.id, dealName: deal.dealName || deal.prospectCompany, action, context, value: deal.dealValue, score, priority })
      seen.add(deal.id)
    }
  }

  // ── 3. Top-up with brain urgent/stale if still under 5 ───────────────────
  for (const d of (brain.urgentDeals ?? [])) {
    if (actions.length >= 5) break
    if (seen.has(d.dealId)) continue
    const action = d.topAction ?? d.reason ?? 'Address this deal urgently'
    actions.push({ dealId: d.dealId, dealName: d.dealName ?? d.company, action, context: d.reason ?? '', value: d.dealValue, score: d.score, priority: 'high' })
    seen.add(d.dealId)
  }
  for (const d of (brain.staleDeals ?? [])) {
    if (actions.length >= 5) break
    if (seen.has(d.dealId)) continue
    const stage = d.stage ? d.stage.replace(/_/g, ' ') : null
    actions.push({ dealId: d.dealId, dealName: d.dealName ?? d.company, action: `Re-engage — ${d.daysSinceUpdate}d since last contact`, context: stage ? `Currently in ${stage}` : '', value: d.dealValue, score: d.score, priority: d.daysSinceUpdate > 14 ? 'high' : 'medium' })
    seen.add(d.dealId)
  }

  return actions.slice(0, 5)
}

function TodayActionCard({ item, index }: { item: TodayAction; index: number }) {
  const priorityColor = item.priority === 'high' ? '#ef4444' : item.priority === 'medium' ? '#f59e0b' : '#3b82f6'
  const priorityBg   = item.priority === 'high' ? 'var(--color-red-bg)' : item.priority === 'medium' ? 'var(--color-amber-bg)' : 'var(--color-blue-bg)'
  const priorityBdr  = item.priority === 'high' ? 'rgba(248,113,113,0.30)' : item.priority === 'medium' ? 'rgba(251,191,36,0.30)' : 'rgba(96,165,250,0.30)'

  return (
    <Link href={`/deals/${item.dealId}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          padding: '11px 14px', borderRadius: 8,
          border: `1px solid ${priorityBdr}`, background: priorityBg,
          cursor: 'pointer', transition: 'box-shadow 100ms',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
      >
        {/* Number badge */}
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          background: priorityColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, color: '#fff', marginTop: 1,
        }}>
          {index + 1}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Deal name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {item.dealName}
            </span>
            {item.value != null && item.value > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'Geist Mono', monospace" }}>
                {fmtCurrency(item.value)}
              </span>
            )}
            {item.score != null && (
              <span style={{ fontSize: 10, fontWeight: 700, color: priorityColor, background: `${priorityColor}15`, border: `1px solid ${priorityColor}25`, borderRadius: 4, padding: '1px 5px' }}>
                {Math.round(item.score)}
              </span>
            )}
          </div>
          {/* Action */}
          <div style={{ fontSize: 12.5, fontWeight: 600, color: priorityColor, marginTop: 3, lineHeight: 1.35 }}>
            {item.action}
          </div>
          {/* Context */}
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.35 }}>
            {item.context}
          </div>
        </div>

        <ArrowRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }} />
      </div>
    </Link>
  )
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const dot = eventDotColor(event.type)
  const label = eventLabel(event.type, event.metadata, event.dealName)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: dot, boxShadow: `0 0 0 2px ${dot}20`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>{relativeTime(event.createdAt)}</div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
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
        const mins = Math.floor((Date.now() - new Date(brain.updatedAt).getTime()) / 60000)
        if (mins < 2) return 'live'
        if (mins < 60) return `${mins}m ago`
        return `${Math.floor(mins / 60)}h ago`
      })()
    : null

  const hour = new Date().getHours()
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
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>
            {todayLabel()}
          </div>
          <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0 }}>
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
        borderRadius: 10, marginBottom: 14, overflow: 'hidden',
      }}>
        <div style={{
          padding: '11px 18px', borderBottom: '1px solid var(--border-subtle)',
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
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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

        <div style={{ padding: '14px 18px' }}>
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
              {todayActions.map((item, i) => (
                <TodayActionCard key={item.dealId} item={item} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Pipeline Health Strip ── */}
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border-default)',
        borderRadius: 10, marginBottom: 14,
        padding: '12px 18px', display: 'flex', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 22, flexShrink: 0 }}>
          <Activity size={11} style={{ color: '#1DB86A' }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                {item.value}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.label}</div>
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

      {/* ── Revenue Forecast ── */}
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border-default)',
        borderRadius: 10, marginBottom: 14, padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={11} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Revenue Forecast
            </span>
          </div>
          <Link href="/deals" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
            Set forecast →
          </Link>
        </div>

        {!hasForecast ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', paddingBottom: 2 }}>
            Tag deals as <strong style={{ color: 'var(--text-secondary)', fontStyle: 'normal' }}>Commit</strong>, <strong style={{ color: 'var(--text-secondary)', fontStyle: 'normal' }}>Upside</strong> or <strong style={{ color: 'var(--text-secondary)', fontStyle: 'normal' }}>Pipeline</strong> on the deals board to unlock your forecast.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
            {/* Commit */}
            <div style={{ flex: 1, paddingRight: 20, borderRight: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 10, color: '#1DB86A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Commit</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1.1 }}>{fmtCurrency(commitValue)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{commitDeals.length} deal{commitDeals.length !== 1 ? 's' : ''} · 90% confidence</div>
            </div>
            {/* Upside */}
            <div style={{ flex: 1, padding: '0 20px', borderRight: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Upside</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1.1 }}>{fmtCurrency(upsideValue)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{upsideDeals.length} deal{upsideDeals.length !== 1 ? 's' : ''} · 50% confidence</div>
            </div>
            {/* Best case */}
            <div style={{ flex: 1, padding: '0 20px', borderRight: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Best Case</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1.1 }}>{fmtCurrency(bestCase)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Commit + Upside</div>
            </div>
            {/* Weighted */}
            <div style={{ flex: 1, paddingLeft: 20 }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Weighted</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1.1 }}>{fmtCurrency(weightedForecast)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Probability-adjusted</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Deal Monitor Mini ── */}
      <DealMonitorMini />

      {/* ── Focus Briefing ── */}
      <FocusBriefing />

      {/* ── Bottom: Intelligence + Activity ── */}
      <div className="dash-bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14 }}>
        <style>{`@media (max-width: 900px) { .dash-bottom-grid { grid-template-columns: 1fr !important; } }`}</style>

        {/* Intelligence / Patterns */}
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border-default)',
          borderRadius: 10, padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={11} style={{ color: '#1DB86A' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Intelligence
              </span>
            </div>
            <Link href="/intelligence" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>Signals →</Link>
          </div>

          {brainLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton h={52} /><Skeleton h={52} /><Skeleton h={52} />
            </div>
          ) : (brain.keyPatterns ?? []).length === 0 ? (
            <div style={{ padding: '16px 0', textAlign: 'center' }}>
              <Target size={18} style={{ color: 'var(--border-default)', display: 'block', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>Patterns emerge after AI analysis on deals.</div>
              <Link href="/deals" style={{ fontSize: 12, color: '#1DB86A', textDecoration: 'none', fontWeight: 500 }}>
                Analyse a deal →
              </Link>
            </div>
          ) : (
            <>
              {brain.dailyBriefing && (
                <div style={{
                  padding: '10px 14px', borderRadius: 7, marginBottom: 10,
                  background: 'rgba(29,184,106,0.05)', border: '1px solid rgba(29,184,106,0.12)',
                }}>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                    {brain.dailyBriefing}
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(brain.keyPatterns ?? []).slice(0, 5).map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '9px 12px', borderRadius: 7,
                    background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1DB86A', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                        {p.dealIds.length} deal{p.dealIds.length !== 1 ? 's' : ''}
                        {(p.dealNames ?? []).length > 0 && ` · ${p.dealNames!.slice(0, 2).join(', ')}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Activity Feed */}
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border-default)',
          borderRadius: 10, padding: '16px 18px', alignSelf: 'start',
        }}>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Activity
            </span>
          </div>

          {actLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...Array(6)].map((_, i) => <Skeleton key={i} h={30} />)}
            </div>
          ) : activity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Target size={18} style={{ color: 'var(--border-default)', display: 'block', margin: '0 auto 6px' }} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No activity yet</div>
            </div>
          ) : (
            <div>{activity.slice(0, 18).map(event => <ActivityRow key={event.id} event={event} />)}</div>
          )}
        </div>
      </div>
    </div>
  )
}
