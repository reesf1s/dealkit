'use client'
export const dynamic = 'force-dynamic'

import { useState, useRef, useCallback, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { Sparkles, TrendingUp, AlertTriangle, ArrowUpRight, RefreshCw, Brain, Target, CheckCircle, Clock, DollarSign, Zap, ChevronRight, ChevronDown, Thermometer, TrendingDown, AlertCircle, Calendar } from 'lucide-react'
import { useSidebar } from '@/components/layout/SidebarContext'
import { formatCurrency } from '@/lib/format'
import { generateAlerts } from '@/lib/alerts'
import { getScoreColor } from '@/lib/deal-context'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function SkeletonLine({ w = '100%', h = '14px' }: { w?: string; h?: string }) {
  return <div style={{ width: w, height: h, borderRadius: '6px', background: 'var(--skeleton-from)', animation: 'skeleton-shimmer 1.5s ease-in-out infinite' }} />
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
      wonDate: null,
      lostDate: null,
      lossReason: null,
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
      noteCount: 0,
      lastNoteDate: null,
      lastNoteSummary: null,
      openActionCount: 0,
      completedActionCount: 0,
      recentCompletedActions: [] as string[],
      upcomingEvents: [] as { type: string; title: string; date: string; time: string | null }[],
      contacts,
    }
  })
  const proactiveAlerts = generateAlerts(alertDeals as any)

  // Quick stats — prefer brain's pre-computed pipeline values as the source of truth
  const totalPipeline = brain?.pipeline?.totalValue ?? activeDeals.reduce((s: number, d: any) => s + (d.dealValue ?? 0), 0)

  // Weighted forecast: dealValue * (score / 100), sorted descending
  const forecastDeals = activeDeals
    .filter((d: any) => (d.dealValue ?? 0) > 0)
    .map((d: any) => {
      const effectiveCloseDate = closeDateOverrides[d.id] ?? d.closeDate ?? null
      return {
        id: d.id,
        dealName: d.dealName,
        company: d.prospectCompany,
        dealValue: d.dealValue ?? 0,
        score: d.conversionScore ?? 50,
        weightedValue: Math.round((d.dealValue ?? 0) * ((d.conversionScore ?? 50) / 100)),
        closeDate: effectiveCloseDate,
      }
    })
    .sort((a: any, b: any) => b.weightedValue - a.weightedValue)
  const weightedForecast = forecastDeals.reduce((s: number, d: any) => s + d.weightedValue, 0)

  // Monthly breakdown: group forecastDeals by month
  const monthlyBreakdown = (() => {
    const months: Record<string, { label: string; sortKey: string; weighted: number; count: number }> = {}
    for (const d of forecastDeals) {
      let key: string
      let label: string
      if (d.closeDate) {
        const dt = new Date(d.closeDate)
        key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
        label = dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      } else {
        key = '9999-99'
        label = 'No close date'
      }
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
      // Refresh deals data in background
      mutate('/api/deals')
    } catch {
      // Revert on failure
      setCloseDateOverrides(prev => {
        const next = { ...prev }
        delete next[dealId]
        return next
      })
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

  const healthColor = overview?.briefingHealth === 'green' ? 'var(--success)' : overview?.briefingHealth === 'red' ? 'var(--danger)' : 'var(--warning)'

  const regenerate = async () => {
    setRegenerating(true)
    try {
      await fetch('/api/dashboard/ai-overview', { method: 'POST' })
      await mutate('/api/dashboard/ai-overview')
    } finally {
      setRegenerating(false)
    }
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    border: 'none',
    borderRadius: '8px',
    padding: '20px 22px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1080px' }}>

      {/* ── Greeting header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: '500', color: 'var(--text-primary)', letterSpacing: '0.01em', lineHeight: 1.1, marginBottom: '4px' }} className="font-brand">
            {greeting}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={regenerate}
          disabled={regenerating}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', background: 'var(--surface)', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', cursor: regenerating ? 'not-allowed' : 'pointer', opacity: regenerating ? 0.6 : 1 }}
        >
          <RefreshCw size={12} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
          {regenerating ? 'Refreshing\u2026' : 'Refresh briefing'}
        </button>
      </div>

      {/* ── 2-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: '20px', alignItems: 'start' }}>

        {/* ── LEFT column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Morning briefing card */}
          <div style={{ ...cardStyle, background: overview?.briefingHealth === 'green' ? 'linear-gradient(135deg, rgba(5,150,105,0.04) 0%, var(--card-bg) 60%)' : overview?.briefingHealth === 'red' ? 'linear-gradient(135deg, rgba(220,38,38,0.04) 0%, var(--card-bg) 60%)' : 'var(--card-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
              <span className="font-brand-section" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Today&apos;s Briefing</span>
              {overview?.briefingHealth && (
                <div style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: healthColor, boxShadow: `0 0 6px ${healthColor}` }} />
              )}
            </div>
            {overviewLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <SkeletonLine w="95%" h="16px" />
                <SkeletonLine w="80%" h="16px" />
                <SkeletonLine w="70%" h="16px" />
              </div>
            ) : overview?.summary ? (
              <p style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>
                {overview.summary}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Your AI briefing hasn&apos;t been generated yet. Click refresh to get today&apos;s pipeline intelligence.
                </p>
                <button onClick={regenerate} disabled={regenerating} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none' }}>
                  <Sparkles size={11} /> Generate briefing
                </button>
              </div>
            )}
            {overview?.singleMostImportantAction && (
              <div style={{ marginTop: '14px', padding: '12px 14px', background: 'var(--accent-subtle)', border: 'none', borderRadius: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Most important action</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.5 }}>{overview.singleMostImportantAction}</div>
              </div>
            )}
          </div>

          {/* Action cards — top deals needing attention */}
          {(overviewLoading || (overview?.topAttentionDeals?.length ?? 0) > 0) && (
            <div style={cardStyle}>
              <div className="font-brand-section" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '12px' }}>Deals Needing Attention</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {overviewLoading ? [1,2,3].map(i => (
                  <div key={i} style={{ padding: '12px', borderRadius: '10px', background: 'var(--surface)', border: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <SkeletonLine w="50%" h="14px" />
                    <SkeletonLine w="80%" h="12px" />
                  </div>
                )) : overview?.topAttentionDeals?.map((item: any) => (
                  <div key={item.dealId} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', background: item.urgency === 'high' ? 'color-mix(in srgb, var(--danger) 4%, transparent)' : 'var(--surface)', border: `1px solid ${item.urgency === 'high' ? 'color-mix(in srgb, var(--danger) 15%, transparent)' : 'var(--border)'}`, borderRadius: '10px', cursor: 'pointer' }}
                    onClick={() => sendToCopilot(`Tell me about the ${item.dealName} deal and what I should do right now: ${item.reason}`)}>
                    <div style={{ flexShrink: 0, marginTop: '1px' }}>
                      {item.urgency === 'high' ? <AlertTriangle size={13} style={{ color: 'var(--danger)' }} /> : <Clock size={13} style={{ color: 'var(--warning)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.company}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>{item.reason}</div>
                    </div>
                    <Link href={`/deals/${item.dealId}`} onClick={e => e.stopPropagation()} style={{ flexShrink: 0, color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key actions from AI */}
          {overview?.keyActions?.length > 0 && (
            <div style={cardStyle}>
              <div className="font-brand-section" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '12px' }}>Today&apos;s Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {overview.keyActions.map((action: string, i: number) => {
                  // Try to match action text to a deal by dealName or prospectCompany
                  const matchedDeal = deals.find((d: any) => {
                    const name = (d.dealName || '').toLowerCase()
                    const company = (d.prospectCompany || '').toLowerCase()
                    const actionLower = action.toLowerCase()
                    return (name.length > 3 && actionLower.includes(name)) ||
                           (company.length > 3 && actionLower.includes(company))
                  })
                  return (
                    <div key={i} className="action-item-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: 'var(--surface)', borderRadius: '8px', border: 'none', cursor: 'pointer', position: 'relative' }}
                      onClick={() => sendToCopilot(`Help me with this: ${action}`)}>
                      <div style={{ flexShrink: 0, width: '18px', height: '18px', borderRadius: '5px', background: 'var(--accent-subtle)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px' }}>
                        <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--accent)' }}>{i + 1}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>{action}</div>
                      <div className="action-item-buttons" style={{ display: 'flex', gap: '4px', flexShrink: 0, alignSelf: 'center' }}>
                        {matchedDeal && (
                          <Link
                            href={`/deals/${matchedDeal.id}`}
                            onClick={e => e.stopPropagation()}
                            style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '600', color: 'var(--accent)', background: 'var(--accent-subtle)', border: 'none', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}
                          >
                            Open deal &rarr;
                          </Link>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); sendToCopilot(`Draft this for me: ${action}`) }}
                          style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)', background: 'var(--surface)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}
                        >
                          Draft with AI &rarr;
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Proactive Alerts ── */}
          {proactiveAlerts.length > 0 && (
            <div style={cardStyle}>
              <div className="font-brand-section" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '12px' }}>Proactive Alerts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {proactiveAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.dealId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--surface)', borderRadius: '10px', border: `1px solid ${alert.severity === 'critical' ? 'color-mix(in srgb, var(--danger) 20%, transparent)' : 'var(--border)'}` }}>
                    {alert.severity === 'critical'
                      ? <AlertCircle size={13} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                      : <AlertCircle size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>{alert.company}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                        &mdash; {alert.message} {alert.action}
                      </span>
                    </div>
                    <Link href={`/deals/${alert.dealId}`} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}>
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                ))}
                {proactiveAlerts.length > 5 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px' }}>
                    {proactiveAlerts.length - 5} more alert{proactiveAlerts.length - 5 > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Pipeline health */}
          <div style={cardStyle}>
            <div className="font-brand-section" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '14px' }}>Pipeline</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {totalPipeline > 0 && (
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {formatCurrency(totalPipeline, true)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>total pipeline value</div>
                  {weightedForecast > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={() => setForecastExpanded(f => !f)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface)', border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                      >
                        <DollarSign size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Weighted forecast</div>
                          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--accent)', lineHeight: 1.1 }}>{formatCurrency(weightedForecast, true)}</div>
                        </div>
                        <ChevronDown size={12} style={{ color: 'var(--text-tertiary)', transform: forecastExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.1s ease', flexShrink: 0 }} />
                      </button>
                      {forecastExpanded && (
                        <div style={{ marginTop: '8px', background: 'var(--surface)', border: 'none', borderRadius: '10px', overflow: 'hidden' }}>
                          {/* Summary header */}
                          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                              <span style={{ color: 'var(--text-tertiary)' }}>Total pipeline</span>
                              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(totalPipeline)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                              <span style={{ color: 'var(--text-tertiary)' }}>Weighted forecast</span>
                              <span style={{ fontWeight: '600', color: 'var(--accent)' }}>{formatCurrency(weightedForecast)} <span style={{ fontWeight: '400', color: 'var(--text-tertiary)' }}>(probability-adjusted)</span></span>
                            </div>
                          </div>

                          {/* Column headers */}
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 52px 32px 56px' : '1fr 58px 36px 62px 62px', gap: '4px', padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: '9px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <span>Deal</span>
                            <span style={{ textAlign: 'right' }}>Value</span>
                            <span style={{ textAlign: 'right' }}>Score</span>
                            <span style={{ textAlign: 'right' }}>Weighted</span>
                            {!isMobile && <span style={{ textAlign: 'right' }}>Close</span>}
                          </div>

                          {/* Deal rows */}
                          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                            {forecastDeals.map((d: any) => (
                              <div
                                key={d.id}
                                style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 52px 32px 56px' : '1fr 58px 36px 62px 62px', gap: '4px', padding: '6px 12px', borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)', alignItems: 'center', fontSize: '11px', transition: 'background 0.1s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 3%, transparent)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <Link
                                  href={`/deals/${d.id}`}
                                  style={{ color: 'var(--text-primary)', fontWeight: '600', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  title={d.dealName}
                                >
                                  {d.dealName}
                                </Link>
                                <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(d.dealValue, true)}</span>
                                <span style={{ textAlign: 'right', color: getScoreColor(d.score, false), fontWeight: '600' }}>{d.score}%</span>
                                <span style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: '600' }}>{formatCurrency(d.weightedValue, true)}</span>
                                {!isMobile && (
                                <button
                                  onClick={() => dateInputRefs.current[d.id]?.showPicker()}
                                  style={{ textAlign: 'right', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', position: 'relative' }}
                                  title="Change close date"
                                >
                                  <span>{d.closeDate ? new Date(d.closeDate).toLocaleDateString('en-GB', { month: 'short' }) : '--'}</span>
                                  <Calendar size={9} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                  <input
                                    ref={el => { dateInputRefs.current[d.id] = el }}
                                    type="date"
                                    value={d.closeDate ? new Date(d.closeDate).toISOString().split('T')[0] : ''}
                                    onChange={e => { if (e.target.value) handleCloseDateChange(d.id, e.target.value) }}
                                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                                    tabIndex={-1}
                                  />
                                </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Monthly breakdown */}
                          {monthlyBreakdown.length > 0 && (
                            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Monthly breakdown</div>
                              {monthlyBreakdown.map(m => (
                                <div key={m.sortKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                                  <span style={{ color: m.weighted > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: m.weighted > 0 ? '600' : '400' }}>
                                    {formatCurrency(m.weighted, true)}
                                    <span style={{ color: 'var(--text-tertiary)', fontWeight: '400', marginLeft: '4px' }}>
                                      ({m.count} {m.count === 1 ? 'deal' : 'deals'})
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, padding: '10px 12px', background: 'var(--surface)', borderRadius: '8px', border: 'none' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>{activeDeals.length}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '3px' }}>active deals</div>
                </div>
                {winRate != null && (
                  <div style={{ flex: 1, padding: '10px 12px', background: 'var(--surface)', borderRadius: '8px', border: 'none' }}>
                    {totalClosed >= 5 ? (
                      <>
                        <div style={{ fontSize: '18px', fontWeight: '600', color: winRate >= 50 ? 'var(--success)' : 'var(--warning)', lineHeight: 1 }}>{winRate}%</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '3px' }}>win rate</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>{winCount}W / {lossCount}L</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '3px' }}>closed</div>
                      </>
                    )}
                  </div>
                )}
              </div>
              {avgScore != null && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Avg deal score</div>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: getScoreColor(avgScore, false) }}>{avgScore}</div>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${avgScore}%`, background: getScoreColor(avgScore, false), borderRadius: '2px', transition: 'width 0.1s ease' }} />
                  </div>
                </div>
              )}
              {/* Pipeline signals — prefer rich score trend data from brain, fall back to AI momentum */}
              {(() => {
                const trendAlerts: any[] = brain?.scoreTrendAlerts ?? []
                const improving = trendAlerts.filter((t: any) => t.trend === 'improving')
                const declining = trendAlerts.filter((t: any) => t.trend === 'declining')
                const hasRichSignals = improving.length > 0 || declining.length > 0
                if (hasRichSignals) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {improving.slice(0, 2).map((t: any) => (
                        <div key={t.dealId} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', background: 'color-mix(in srgb, var(--success) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 15%, transparent)', borderRadius: '8px' }}>
                          <TrendingUp size={11} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '1px' }} />
                          <div style={{ fontSize: '11px', color: 'var(--success)', lineHeight: 1.4 }}>
                            {t.dealName} +{Math.abs(t.delta)}pts ({t.priorScore}%&rarr;{t.currentScore}%)
                            {t.message ? ` — ${t.message.replace(/^.*?(score|Score)\s*(rose|improved|increased)\s*/, '').replace(/^\d+\s*pts?\s*/, '').trim() || t.message}` : ''}
                          </div>
                        </div>
                      ))}
                      {declining.slice(0, 2).map((t: any) => (
                        <div key={t.dealId} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', background: 'color-mix(in srgb, var(--danger) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '8px' }}>
                          <TrendingDown size={11} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '1px' }} />
                          <div style={{ fontSize: '11px', color: 'var(--danger)', lineHeight: 1.4 }}>
                            {t.dealName} {t.delta}pts ({t.priorScore}%&rarr;{t.currentScore}%)
                            {t.message ? ` — ${t.message.replace(/^.*?(score|Score)\s*(dropped|declined|fell)\s*/, '').replace(/^\d+\s*pts?\s*/, '').trim() || t.message}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
                // Fall back to AI-generated momentum when no rich trend data
                if (overview?.momentum) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', background: 'color-mix(in srgb, var(--success) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 15%, transparent)', borderRadius: '8px' }}>
                      <TrendingUp size={11} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '1px' }} />
                      <div style={{ fontSize: '11px', color: 'var(--success)', lineHeight: 1.4 }}>{overview.momentum}</div>
                    </div>
                  )
                }
                return null
              })()}
              {overview?.topRisk && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', background: 'color-mix(in srgb, var(--danger) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '8px' }}>
                  <AlertTriangle size={11} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ fontSize: '11px', color: 'var(--danger)', lineHeight: 1.4 }}>{overview.topRisk}</div>
                </div>
              )}
              <Link href="/pipeline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: '8px', background: 'var(--surface)', border: 'none', textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>
                View pipeline <ChevronRight size={13} />
              </Link>
            </div>
          </div>

          {/* Model status */}
          <div style={cardStyle}>
            <div className="font-brand-section" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '12px' }}>ML Model</div>
            {brain?.mlModel ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--accent)', lineHeight: 1 }}>{Math.round(brain.mlModel.looAccuracy * 100)}%</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>prediction accuracy</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Trained on {brain.mlModel.trainingSize} closed deals
                </div>
                <Link href="/models" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'var(--accent-subtle)', border: 'none', textDecoration: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: '600' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Brain size={11} /> View model</span>
                  <ChevronRight size={12} />
                </Link>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
                  Close {Math.max(0, 10 - ((brain?.winLossIntel?.winCount ?? 0) + (brain?.winLossIntel?.lossCount ?? 0)))} more deals to activate ML predictions
                </div>
                <Link href="/models" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', fontWeight: '600' }}>
                  <Brain size={11} /> Model status <ChevronRight size={11} />
                </Link>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div style={cardStyle}>
            <div className="font-brand-section" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '10px' }}>Intelligence</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { href: '/playbook', icon: <Target size={12} />, label: 'Win Playbook' },
                { href: '/models', icon: <Brain size={12} />, label: 'ML Models' },
                { href: '/competitors', icon: <Zap size={12} />, label: 'Competitors' },
                { href: '/product-gaps', icon: <CheckCircle size={12} />, label: 'Product Gaps' },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '7px', textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
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
          0% { opacity: 1; }
          50% { opacity: 0.5; }
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
