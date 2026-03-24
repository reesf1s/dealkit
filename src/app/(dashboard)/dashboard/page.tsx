'use client'
export const dynamic = 'force-dynamic'

import { useState, useRef, useCallback, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import {
  Sparkles, TrendingUp, AlertTriangle, ArrowUpRight, RefreshCw,
  Brain, CheckCircle, DollarSign, ChevronRight, ChevronDown,
  TrendingDown, AlertCircle, Calendar, GitBranch, Target, Zap,
  Plug, MessageSquare, Clock,
} from 'lucide-react'
import { useSidebar } from '@/components/layout/SidebarContext'
import { formatCurrency } from '@/lib/format'
import { generateAlerts } from '@/lib/alerts'
import { getScoreColor } from '@/lib/deal-context'
import { track, Events } from '@/lib/analytics'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function SkeletonLine({ w = '100%', h = '14px' }: { w?: string; h?: string }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: '6px',
      background: 'rgba(255,255,255,0.06)',
      animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
    }} />
  )
}

// Card: frost-border glass surface
const card: React.CSSProperties = {
  position: 'relative',
  background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  borderRadius: '14px',
  boxShadow: '0 2px 20px rgba(0,0,0,0.40), 0 1px 4px rgba(0,0,0,0.20)',
  // Frost border via box-shadow inset (no pseudo-element needed for inline)
  outline: '1px solid rgba(255,255,255,0.08)',
  outlineOffset: '-1px',
}

const cardPad: React.CSSProperties = { ...card, padding: '20px 22px' }

// Subtle inner surface
const surface: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.06)',
}

export default function DashboardPage() {
  const { sendToCopilot } = useSidebar()
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const { data: overviewRes, isLoading: overviewLoading } = useSWR('/api/dashboard/ai-overview', fetcher, { revalidateOnFocus: false })
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: dealsRes } = useSWR('/api/deals', fetcher, { revalidateOnFocus: false })
  const [regenerating, setRegenerating] = useState(false)
  const [forecastExpanded, setForecastExpanded] = useState(false)
  const [closeDateOverrides, setCloseDateOverrides] = useState<Record<string, string>>({})
  const dateInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const overview = overviewRes?.data
  const brain = brainRes?.data
  const deals: any[] = dealsRes?.data ?? []
  const activeDeals = deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  // Build deal contexts for alerts
  const alertDeals = (deals || []).map((d: any) => {
    const isClosed = d.stage === 'closed_won' || d.stage === 'closed_lost'
    const intentSignals = d.intentSignals as any || {}
    const contacts = ((d.contacts as any[]) || []).map((c: any) => ({ name: c.name || 'Unknown', role: c.role || '' }))
    return {
      id: d.id,
      name: d.dealName || 'Untitled',
      company: d.prospectCompany || '',
      stage: d.stage || 'prospecting',
      dealValue: d.dealValue ?? 0,
      dealType: null,
      currency: 'GBP',
      isClosed,
      outcome: d.stage === 'closed_won' ? 'won' as const : d.stage === 'closed_lost' ? 'lost' as const : null,
      closeDate: d.closeDate ? new Date(d.closeDate).toISOString() : null,
      wonDate: null, lostDate: null, lossReason: null,
      dealAgeDays: d.createdAt ? Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 86400000) : 0,
      daysSinceLastNote: d.updatedAt ? Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / 86400000) : 999,
      championIdentified: intentSignals.championStatus === 'confirmed',
      budgetConfirmed: intentSignals.budgetStatus === 'confirmed' || intentSignals.budgetStatus === 'approved',
      nextStepDefined: false,
      competitorsPresent: [] as string[],
      sentimentRecent: 0.5,
      momentum: 0.5,
      compositeScore: d.conversionScore ?? 0,
      scoreColor: getScoreColor(d.conversionScore ?? 0, isClosed),
      noteCount: 0, lastNoteDate: null, lastNoteSummary: null,
      openActionCount: 0, completedActionCount: 0, recentCompletedActions: [] as string[],
      upcomingEvents: [] as { type: string; title: string; date: string; time: string | null }[],
      contacts,
    }
  })
  const proactiveAlerts = generateAlerts(alertDeals as any)

  const totalPipeline = brain?.pipeline?.totalValue ?? activeDeals.reduce((s: number, d: any) => s + (d.dealValue ?? 0), 0)

  const forecastDeals = activeDeals
    .filter((d: any) => (d.dealValue ?? 0) > 0)
    .map((d: any) => {
      const effectiveCloseDate = closeDateOverrides[d.id] ?? d.closeDate ?? null
      return {
        id: d.id, dealName: d.dealName, company: d.prospectCompany,
        dealValue: d.dealValue ?? 0, score: d.conversionScore ?? 50,
        weightedValue: Math.round((d.dealValue ?? 0) * ((d.conversionScore ?? 50) / 100)),
        closeDate: effectiveCloseDate,
      }
    })
    .sort((a: any, b: any) => b.weightedValue - a.weightedValue)
  const weightedForecast = forecastDeals.reduce((s: number, d: any) => s + d.weightedValue, 0)

  const monthlyBreakdown = (() => {
    const months: Record<string, { label: string; sortKey: string; weighted: number; count: number }> = {}
    for (const d of forecastDeals) {
      let key: string, label: string
      if (d.closeDate) {
        const dt = new Date(d.closeDate)
        key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
        label = dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      } else { key = '9999-99'; label = 'No close date' }
      if (!months[key]) months[key] = { label, sortKey: key, weighted: 0, count: 0 }
      months[key].weighted += d.weightedValue
      months[key].count += 1
    }
    return Object.values(months).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  })()

  const handleCloseDateChange = useCallback(async (dealId: string, newDate: string) => {
    setCloseDateOverrides(prev => ({ ...prev, [dealId]: newDate }))
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closeDate: newDate }),
      })
      mutate('/api/deals')
    } catch {
      setCloseDateOverrides(prev => { const next = { ...prev }; delete next[dealId]; return next })
    }
  }, [])

  const winRate = brain?.winLossIntel?.winRate
  const winCount = brain?.winLossIntel?.winCount ?? 0
  const lossCount = brain?.winLossIntel?.lossCount ?? 0
  const totalClosed = winCount + lossCount
  const avgScore = brain?.pipeline?.avgConversionScore != null
    ? Math.round(brain.pipeline.avgConversionScore)
    : activeDeals.length > 0
      ? Math.round(activeDeals.reduce((s: number, d: any) => s + (d.conversionScore ?? 0), 0) / activeDeals.length)
      : null

  const regenerate = async () => {
    setRegenerating(true)
    try {
      await fetch('/api/dashboard/ai-overview', { method: 'POST' })
      await mutate('/api/dashboard/ai-overview')
      track(Events.AI_BRIEFING_GENERATED, { dealCount: activeDeals.length })
    } finally { setRegenerating(false) }
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const trendAlerts: any[] = brain?.scoreTrendAlerts ?? []
  const improving = trendAlerts.filter((t: any) => t.trend === 'improving')
  const declining = trendAlerts.filter((t: any) => t.trend === 'declining')
  const urgentCount = (brain?.urgentDeals?.length ?? 0)

  // Score health colour
  const healthColor = overview?.briefingHealth === 'green'
    ? '#34d399' : overview?.briefingHealth === 'red'
    ? '#f87171' : '#fbbf24'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1120px' }}>

      {/* ══ HERO: Greeting + Quick Stats ══ */}
      <div style={{
        ...card,
        padding: isMobile ? '20px' : '24px 28px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(139,92,246,0.04) 50%, rgba(255,255,255,0.03) 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{
              fontSize: isMobile ? '22px' : '28px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.90)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: '4px',
            }}>
              {greeting}
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          <button
            onClick={regenerate}
            disabled={regenerating}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.45)', fontSize: '12px', fontWeight: 500,
              cursor: regenerating ? 'not-allowed' : 'pointer',
              opacity: regenerating ? 0.6 : 1,
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { if (!regenerating) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.70)' }}}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' }}
          >
            <RefreshCw size={12} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
            {regenerating ? 'Refreshing…' : 'Refresh briefing'}
          </button>
        </div>

        {/* Quick stats row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: '10px',
          marginTop: '20px',
        }}>
          {/* Pipeline value */}
          <div style={{ ...surface, padding: '14px 16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Pipeline</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {totalPipeline > 0 ? formatCurrency(totalPipeline, true) : '—'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '3px' }}>total value</div>
          </div>

          {/* Weighted forecast */}
          <div style={{ ...surface, padding: '14px 16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Forecast</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#818cf8', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {weightedForecast > 0 ? formatCurrency(weightedForecast, true) : '—'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '3px' }}>probability-weighted</div>
          </div>

          {/* Active deals */}
          <div style={{ ...surface, padding: '14px 16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Deals</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {activeDeals.length}
              </div>
              {urgentCount > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#f87171', background: 'rgba(248,113,113,0.12)', padding: '1px 7px', borderRadius: '100px' }}>
                  {urgentCount} urgent
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '3px' }}>active</div>
          </div>

          {/* Win rate */}
          <div style={{ ...surface, padding: '14px 16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Win Rate</div>
            <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: winRate != null && totalClosed >= 5 ? (winRate >= 50 ? '#34d399' : '#fbbf24') : 'rgba(255,255,255,0.90)' }}>
              {winRate != null && totalClosed >= 5 ? `${winRate}%` : totalClosed > 0 ? `${winCount}W / ${lossCount}L` : '—'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '3px' }}>
              {totalClosed >= 5 ? `${totalClosed} closed` : 'closed deals'}
            </div>
          </div>
        </div>
      </div>

      {/* ══ MAIN 2-COL LAYOUT ══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 300px',
        gap: '16px',
        alignItems: 'start',
      }}>

        {/* ── LEFT: AI Briefing + Actions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* AI Morning Briefing */}
          <div style={{
            ...card,
            padding: '22px 24px',
            background: overview?.briefingHealth === 'green'
              ? 'linear-gradient(135deg, rgba(52,211,153,0.06) 0%, rgba(255,255,255,0.03) 60%)'
              : overview?.briefingHealth === 'red'
              ? 'linear-gradient(135deg, rgba(248,113,113,0.06) 0%, rgba(255,255,255,0.03) 60%)'
              : 'rgba(255,255,255,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={13} style={{ color: '#818cf8' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.80)', letterSpacing: '-0.01em' }}>
                  AI Briefing
                </div>
                {overview?.generatedAt && (
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)' }}>
                    Updated {Math.floor((Date.now() - new Date(overview.generatedAt).getTime()) / 60000)}m ago
                  </div>
                )}
              </div>
              {overview?.briefingHealth && (
                <div style={{
                  marginLeft: 'auto',
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: healthColor,
                  boxShadow: `0 0 8px ${healthColor}`,
                }} />
              )}
            </div>

            {overviewLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <SkeletonLine w="95%" h="16px" />
                <SkeletonLine w="85%" h="16px" />
                <SkeletonLine w="75%" h="16px" />
              </div>
            ) : overview?.summary ? (
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.75, margin: 0 }}>
                {overview.summary}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', lineHeight: 1.6 }}>
                  Your AI briefing hasn&apos;t been generated yet. Generate today&apos;s pipeline intelligence.
                </p>
                <button
                  onClick={regenerate}
                  disabled={regenerating}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '8px',
                    background: 'rgba(99,102,241,0.18)',
                    border: '1px solid rgba(99,102,241,0.30)',
                    color: '#818cf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Sparkles size={11} /> Generate briefing
                </button>
              </div>
            )}

            {/* Most important action */}
            {overview?.singleMostImportantAction && (
              <div style={{
                marginTop: '16px', padding: '12px 14px',
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.18)',
                borderRadius: '10px',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>
                  Top priority
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                  {overview.singleMostImportantAction}
                </div>
              </div>
            )}
          </div>

          {/* Today's Actions */}
          {(overviewLoading || (overview?.keyActions?.length ?? 0) > 0) && (
            <div style={{ ...cardPad }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
                Today&apos;s Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {overviewLoading ? [1,2,3].map(i => (
                  <div key={i} style={{ padding: '12px', borderRadius: '10px', ...surface, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <SkeletonLine w="50%" h="13px" />
                    <SkeletonLine w="80%" h="11px" />
                  </div>
                )) : overview?.keyActions?.map((action: string, i: number) => {
                  const matchedDeal = deals.find((d: any) => {
                    const name = (d.dealName || '').toLowerCase()
                    const company = (d.prospectCompany || '').toLowerCase()
                    const al = action.toLowerCase()
                    return (name.length > 3 && al.includes(name)) || (company.length > 3 && al.includes(company))
                  })
                  return (
                    <div
                      key={i}
                      className="action-item-row"
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '11px 13px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => sendToCopilot(`Help me with this: ${action}`)}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'rgba(255,255,255,0.05)'
                        el.style.borderColor = 'rgba(255,255,255,0.10)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'rgba(255,255,255,0.03)'
                        el.style.borderColor = 'rgba(255,255,255,0.06)'
                      }}
                    >
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, marginTop: '1px',
                        background: 'rgba(99,102,241,0.12)',
                        border: '1px solid rgba(99,102,241,0.18)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#818cf8' }}>{i + 1}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, flex: 1 }}>
                        {action}
                      </div>
                      <div className="action-item-buttons" style={{ display: 'flex', gap: '4px', flexShrink: 0, alignSelf: 'center' }}>
                        {matchedDeal && (
                          <Link
                            href={`/deals/${matchedDeal.id}`}
                            onClick={e => e.stopPropagation()}
                            style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 600, color: '#818cf8', background: 'rgba(99,102,241,0.12)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                          >
                            Open deal →
                          </Link>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); sendToCopilot(`Draft this for me: ${action}`) }}
                          style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.40)', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Draft with AI →
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Attention Deals */}
          {(overviewLoading || (overview?.topAttentionDeals?.length ?? 0) > 0) && (
            <div style={{ ...cardPad }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
                Deals Needing Attention
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {overviewLoading ? [1,2,3].map(i => (
                  <div key={i} style={{ padding: '12px', borderRadius: '10px', ...surface, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <SkeletonLine w="50%" h="13px" />
                    <SkeletonLine w="80%" h="11px" />
                  </div>
                )) : overview?.topAttentionDeals?.map((item: any) => (
                  <div
                    key={item.dealId}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '12px 14px',
                      background: item.urgency === 'high' ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${item.urgency === 'high' ? 'rgba(248,113,113,0.18)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                    onClick={() => sendToCopilot(`Tell me about the ${item.dealName} deal and what I should do right now: ${item.reason}`)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = item.urgency === 'high' ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = item.urgency === 'high' ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.03)' }}
                  >
                    <div style={{ flexShrink: 0, marginTop: '1px' }}>
                      {item.urgency === 'high'
                        ? <AlertTriangle size={13} style={{ color: '#f87171' }} />
                        : <Clock size={13} style={{ color: '#fbbf24' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{item.company}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.42)', marginTop: '2px', lineHeight: 1.5 }}>{item.reason}</div>
                    </div>
                    <Link href={`/deals/${item.dealId}`} onClick={e => e.stopPropagation()} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proactive Alerts */}
          {proactiveAlerts.length > 0 && (
            <div style={{ ...cardPad }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
                Proactive Alerts
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {proactiveAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.dealId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px',
                      background: alert.severity === 'critical' ? 'rgba(248,113,113,0.05)' : 'rgba(251,191,36,0.04)',
                      border: `1px solid ${alert.severity === 'critical' ? 'rgba(248,113,113,0.18)' : 'rgba(251,191,36,0.14)'}`,
                      borderRadius: '10px', transition: 'all 0.15s ease',
                    }}
                  >
                    <AlertCircle size={13} style={{ color: alert.severity === 'critical' ? '#f87171' : '#fbbf24', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>{alert.company}</span>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', marginLeft: '6px' }}>
                        — {alert.message} {alert.action}
                      </span>
                    </div>
                    <Link href={`/deals/${alert.dealId}`} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.25)' }}>
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                ))}
                {proactiveAlerts.length > 5 && (
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.28)', textAlign: 'center', padding: '8px' }}>
                    +{proactiveAlerts.length - 5} more alerts
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Pipeline + Signals + Intelligence Layer ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Pipeline detail */}
          <div style={{ ...cardPad }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Pipeline
              </div>
              <Link href="/pipeline" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>
                View all <ChevronRight size={11} />
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Weighted forecast row */}
              {weightedForecast > 0 && (
                <div>
                  <button
                    onClick={() => setForecastExpanded(f => !f)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      width: '100%', padding: '10px 12px', borderRadius: '10px',
                      ...surface,
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                  >
                    <DollarSign size={11} style={{ color: '#818cf8', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.32)' }}>Weighted forecast</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#818cf8', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                        {formatCurrency(weightedForecast, true)}
                      </div>
                    </div>
                    <ChevronDown size={11} style={{ color: 'rgba(255,255,255,0.25)', transform: forecastExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s', flexShrink: 0 }} />
                  </button>

                  {forecastExpanded && (
                    <div style={{ marginTop: '8px', ...surface, overflow: 'hidden', borderRadius: '10px' }}>
                      {/* Column headers */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 30px 52px', gap: '4px', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <span>Deal</span>
                        <span style={{ textAlign: 'right' }}>Value</span>
                        <span style={{ textAlign: 'right' }}>%</span>
                        <span style={{ textAlign: 'right' }}>Wtd</span>
                      </div>
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {forecastDeals.map((d: any) => (
                          <div
                            key={d.id}
                            style={{ display: 'grid', gridTemplateColumns: '1fr 48px 30px 52px', gap: '4px', padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', fontSize: '11px', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.05)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                          >
                            <Link href={`/deals/${d.id}`} style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 600, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.dealName}>
                              {d.dealName}
                            </Link>
                            <span style={{ textAlign: 'right', color: 'rgba(255,255,255,0.42)' }}>{formatCurrency(d.dealValue, true)}</span>
                            <span style={{ textAlign: 'right', color: getScoreColor(d.score, false), fontWeight: 600 }}>{d.score}</span>
                            <span style={{ textAlign: 'right', color: '#818cf8', fontWeight: 600 }}>{formatCurrency(d.weightedValue, true)}</span>
                          </div>
                        ))}
                      </div>
                      {monthlyBreakdown.length > 0 && (
                        <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Monthly</div>
                          {monthlyBreakdown.map(m => (
                            <div key={m.sortKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.42)' }}>{m.label}</span>
                              <span style={{ color: m.weighted > 0 ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.25)', fontWeight: m.weighted > 0 ? 600 : 400 }}>
                                {formatCurrency(m.weighted, true)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Avg score bar */}
              {avgScore != null && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)' }}>Avg deal score</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: getScoreColor(avgScore, false) }}>{avgScore}</div>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${avgScore}%`, background: getScoreColor(avgScore, false), borderRadius: '2px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Score trend signals */}
          {(improving.length > 0 || declining.length > 0 || overview?.momentum || overview?.topRisk) && (
            <div style={{ ...cardPad }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
                Signals
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {improving.slice(0, 2).map((t: any) => (
                  <div key={t.dealId} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '8px 10px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.14)', borderRadius: '8px' }}>
                    <TrendingUp size={11} style={{ color: '#34d399', flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ fontSize: '11px', color: '#34d399', lineHeight: 1.4 }}>
                      <strong>{t.dealName}</strong> +{Math.abs(t.delta)}pts ({t.priorScore}%→{t.currentScore}%)
                    </div>
                  </div>
                ))}
                {declining.slice(0, 2).map((t: any) => (
                  <div key={t.dealId} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '8px 10px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.14)', borderRadius: '8px' }}>
                    <TrendingDown size={11} style={{ color: '#f87171', flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ fontSize: '11px', color: '#f87171', lineHeight: 1.4 }}>
                      <strong>{t.dealName}</strong> {t.delta}pts ({t.priorScore}%→{t.currentScore}%)
                    </div>
                  </div>
                ))}
                {improving.length === 0 && declining.length === 0 && overview?.momentum && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '8px 10px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.14)', borderRadius: '8px' }}>
                    <TrendingUp size={11} style={{ color: '#34d399', flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ fontSize: '11px', color: '#34d399', lineHeight: 1.4 }}>{overview.momentum}</div>
                  </div>
                )}
                {overview?.topRisk && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '8px 10px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.14)', borderRadius: '8px' }}>
                    <AlertTriangle size={11} style={{ color: '#f87171', flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ fontSize: '11px', color: '#f87171', lineHeight: 1.4 }}>{overview.topRisk}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ML Model status */}
          <div style={{ ...cardPad }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
              ML Model
            </div>
            {brain?.mlModel ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '26px', fontWeight: 700, color: '#818cf8', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {Math.round(brain.mlModel.looAccuracy * 100)}%
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '3px' }}>prediction accuracy</div>
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.42)' }}>
                  Trained on {brain.mlModel.trainingSize} closed deals
                </div>
                <Link href="/models" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', ...surface, textDecoration: 'none', color: '#818cf8', fontSize: '12px', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Brain size={11} /> View model</span>
                  <ChevronRight size={12} />
                </Link>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.42)', marginBottom: '10px', lineHeight: 1.5 }}>
                  Close {Math.max(0, 10 - ((brain?.winLossIntel?.winCount ?? 0) + (brain?.winLossIntel?.lossCount ?? 0)))} more deals to activate ML predictions
                </div>
                <Link href="/models" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>
                  <Brain size={11} /> Model status <ChevronRight size={11} />
                </Link>
              </div>
            )}
          </div>

          {/* Intelligence Layer — MCP connections overview */}
          <div style={{ ...cardPad, background: 'rgba(255,255,255,0.025)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.60)', flexShrink: 0 }} />
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Intelligence Layer
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                { icon: <MessageSquare size={11} />, label: 'Slack', desc: 'Deal signals via MCP' },
                { icon: <GitBranch size={11} />, label: 'Linear', desc: 'Product gap tracking' },
                { icon: <Zap size={11} />, label: 'HubSpot', desc: 'CRM sync' },
              ].map(({ icon, label, desc }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '8px', ...surface }}>
                  <div style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{label}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)' }}>{desc}</div>
                  </div>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.20)', flexShrink: 0 }} />
                </div>
              ))}
              <Link href="/company" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px', borderRadius: '8px', textDecoration: 'none', fontSize: '11px', fontWeight: 500, color: '#818cf8', marginTop: '2px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)' }}>
                <Plug size={10} /> Manage connections <ChevronRight size={10} />
              </Link>
            </div>
          </div>

          {/* Quick Intel links */}
          <div style={{ ...cardPad }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
              Intelligence
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {[
                { href: '/playbook', icon: <Target size={12} />, label: 'Win Playbook' },
                { href: '/models', icon: <Brain size={12} />, label: 'ML Models' },
                { href: '/competitors', icon: <Zap size={12} />, label: 'Competitors' },
                { href: '/product-gaps', icon: <CheckCircle size={12} />, label: 'Product Gaps' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', textDecoration: 'none', color: 'rgba(255,255,255,0.45)', fontSize: '12px', fontWeight: 500, transition: 'background 0.1s', }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.72)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' }}
                >
                  {item.icon} {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes skeleton-shimmer {
          0%   { opacity: 1; }
          50%  { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .action-item-buttons { opacity: 0; transition: opacity 0.15s ease; }
        .action-item-row:hover .action-item-buttons { opacity: 1; }
        @media (max-width: 768px) {
          .action-item-buttons { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
