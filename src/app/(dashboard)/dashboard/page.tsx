'use client'
export const dynamic = 'force-dynamic'

import { useState, useCallback, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import {
  Sparkles, RefreshCw, AlertTriangle, ArrowUpRight,
  TrendingDown, GitBranch, MessageSquare, CheckCircle2,
  Plug, Clock, ChevronRight, Brain,
} from 'lucide-react'
import { useSidebar } from '@/components/layout/SidebarContext'
import { formatCurrency } from '@/lib/format'
import { generateAlerts } from '@/lib/alerts'
import { getScoreColor } from '@/lib/deal-context'
import { track, Events } from '@/lib/analytics'
import { useUser } from '@clerk/nextjs'

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

const card: React.CSSProperties = {
  position: 'relative',
  background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  borderRadius: '14px',
  boxShadow: '0 2px 20px rgba(0,0,0,0.40), 0 1px 4px rgba(0,0,0,0.20)',
  outline: '1px solid rgba(255,255,255,0.08)',
  outlineOffset: '-1px',
}

const surface: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.06)',
}

export default function DashboardPage() {
  const { sendToCopilot } = useSidebar()
  const { user } = useUser()
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
  const { data: slackRes } = useSWR('/api/integrations/slack/status', fetcher, { revalidateOnFocus: false, dedupingInterval: 120000 })
  const { data: hubspotRes } = useSWR('/api/integrations/hubspot/status', fetcher, { revalidateOnFocus: false, dedupingInterval: 120000 })
  // Integration status MUST always be scoped to workspace_id. Never expose cross-workspace data.
  const { data: linearRes } = useSWR('/api/integrations/linear/status', fetcher, { revalidateOnFocus: false, dedupingInterval: 120000 })
  const { data: mcpActionsRes } = useSWR('/api/mcp-actions/recent?limit=5', fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 })
  const { data: inCycleRes } = useSWR('/api/deals/in-cycle', fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 })
  const [regenerating, setRegenerating] = useState(false)

  const overview = overviewRes?.data
  const brain = brainRes?.data
  const deals: any[] = dealsRes?.data ?? []
  const activeDeals = deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  // Connection status — each flag is null (loading/unknown) until the API responds.
  // Integration status MUST always be scoped to workspace_id. Never expose cross-workspace data.
  const slackConnected = slackRes ? slackRes?.data?.connected === true : null
  const linearConnected = linearRes ? linearRes?.data?.connected === true : null
  const hubspotConnected = hubspotRes ? hubspotRes?.data?.connected === true : null

  // Build alert contexts
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

  // Build merged priority list
  type PriorityItem = {
    id: string
    dealId?: string
    company?: string
    dealName?: string
    text: string
    urgency: 'high' | 'medium' | 'low'
    ctaLabel?: string
    ctaHref?: string
    ctaAsk?: string
  }

  const priorityItems: PriorityItem[] = []
  const seenDealIds = new Set<string>()

  // 1. Urgent deals from brain (highest priority)
  for (const u of (brain?.urgentDeals ?? []).slice(0, 3)) {
    if (seenDealIds.has(u.dealId)) continue
    seenDealIds.add(u.dealId)
    const deal = deals.find((d: any) => d.id === u.dealId)
    priorityItems.push({
      id: `urgent-${u.dealId}`,
      dealId: u.dealId,
      company: deal?.prospectCompany || u.dealName || 'Deal',
      dealName: deal?.dealName,
      text: u.reason,
      urgency: 'high',
      ctaLabel: 'Open deal',
      ctaHref: `/deals/${u.dealId}`,
    })
  }

  // 2. AI overview attention deals
  for (const item of (overview?.topAttentionDeals ?? []).slice(0, 3)) {
    if (item.dealId && seenDealIds.has(item.dealId)) continue
    if (item.dealId) seenDealIds.add(item.dealId)
    priorityItems.push({
      id: `attention-${item.dealId || item.company}`,
      dealId: item.dealId,
      company: item.company,
      dealName: item.dealName,
      text: item.reason,
      urgency: item.urgency === 'high' ? 'high' : 'medium',
      ctaLabel: item.dealId ? 'Open deal' : undefined,
      ctaHref: item.dealId ? `/deals/${item.dealId}` : undefined,
    })
  }

  // 3. Declining score deals from brain
  for (const t of (brain?.scoreTrendAlerts ?? []).filter((t: any) => t.trend === 'declining').slice(0, 2)) {
    if (seenDealIds.has(t.dealId)) continue
    seenDealIds.add(t.dealId)
    priorityItems.push({
      id: `decline-${t.dealId}`,
      dealId: t.dealId,
      company: t.dealName,
      text: `Health score dropped ${Math.abs(t.delta)} points (${t.priorScore}% → ${t.currentScore}%)`,
      urgency: 'medium',
      ctaLabel: 'Open deal',
      ctaHref: `/deals/${t.dealId}`,
    })
  }

  // 4. AI key actions (non-deal specific)
  for (const action of (overview?.keyActions ?? []).slice(0, 2)) {
    const matchedDeal = deals.find((d: any) => {
      const name = (d.dealName || '').toLowerCase()
      const company = (d.prospectCompany || '').toLowerCase()
      const al = action.toLowerCase()
      return (name.length > 3 && al.includes(name)) || (company.length > 3 && al.includes(company))
    })
    priorityItems.push({
      id: `action-${action.slice(0, 20)}`,
      dealId: matchedDeal?.id,
      company: matchedDeal?.prospectCompany,
      text: action,
      urgency: 'low',
      ctaLabel: matchedDeal ? 'Open deal' : 'Ask AI',
      ctaHref: matchedDeal ? `/deals/${matchedDeal.id}` : undefined,
      ctaAsk: !matchedDeal ? action : undefined,
    })
  }

  const topPriorities = priorityItems.slice(0, 5)
  const attentionCount = priorityItems.filter(p => p.urgency === 'high').length

  // Product gap signals — features blocking deals
  const productGapSignals: any[] = brain?.productGapSignals ?? brain?.dealRiskPatterns ?? []
  const topProductGaps = productGapSignals.slice(0, 3)

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
    const name = user?.firstName || ''
    const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
    return name ? `${base}, ${name}.` : `${base}.`
  })()

  const isLoading = overviewLoading && !brain

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>

      {/* ══ HEADER ══ */}
      <div>
        <h1 style={{
          fontSize: isMobile ? '26px' : '34px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.92)',
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
          marginBottom: '6px',
        }}>
          {greeting}
        </h1>
        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.38)', letterSpacing: '-0.01em' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}
          <span style={{ color: 'rgba(255,255,255,0.28)' }}>here&apos;s what matters today</span>
        </p>
      </div>

      {/* ══ PRIORITY ACTIONS ══ */}
      <div style={{ ...card, padding: '0', overflow: 'hidden' }}>

        {/* Card header */}
        <div style={{
          padding: '18px 22px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
              background: attentionCount > 0
                ? 'rgba(248,113,113,0.12)'
                : 'rgba(99,102,241,0.12)',
              border: `1px solid ${attentionCount > 0 ? 'rgba(248,113,113,0.22)' : 'rgba(99,102,241,0.22)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {attentionCount > 0
                ? <AlertTriangle size={14} style={{ color: '#f87171' }} />
                : <Sparkles size={14} style={{ color: '#818cf8' }} />}
            </div>
            <div>
              {isLoading ? (
                <SkeletonLine w="180px" h="16px" />
              ) : topPriorities.length > 0 ? (
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.01em' }}>
                  {attentionCount > 0
                    ? `${attentionCount} deal${attentionCount > 1 ? 's' : ''} need${attentionCount === 1 ? 's' : ''} your attention`
                    : `${topPriorities.length} thing${topPriorities.length !== 1 ? 's' : ''} to act on today`}
                </div>
              ) : (
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.90)' }}>
                  Pipeline looks healthy
                </div>
              )}
            </div>
          </div>
          <button
            onClick={regenerate}
            disabled={regenerating}
            title="Refresh AI briefing"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 500,
              cursor: regenerating ? 'not-allowed' : 'pointer',
              opacity: regenerating ? 0.6 : 1,
              transition: 'all 0.12s', flexShrink: 0,
            }}
            onMouseEnter={e => { if (!regenerating) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)' }}}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)' }}
          >
            <RefreshCw size={11} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
            {regenerating ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* AI Briefing — natural language overview */}
        {(overview?.summary || isLoading) && (
          <div style={{
            padding: '14px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(99,102,241,0.03)',
          }}>
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <SkeletonLine w="95%" h="13px" />
                <SkeletonLine w="80%" h="13px" />
              </div>
            ) : (
              <p style={{
                fontSize: '13px',
                color: 'rgba(255,255,255,0.58)',
                lineHeight: 1.65,
                margin: 0,
                letterSpacing: '-0.005em',
              }}>
                {overview.summary}
              </p>
            )}
          </div>
        )}

        {/* Priority list */}
        <div style={{ padding: '8px 12px 12px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 12px', borderRadius: '10px', ...surface }}>
                  <SkeletonLine w="24px" h="24px" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <SkeletonLine w="40%" h="13px" />
                    <SkeletonLine w="75%" h="11px" />
                  </div>
                </div>
              ))}
            </div>
          ) : topPriorities.length === 0 ? (
            <div style={{ padding: '28px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', fontWeight: 500, marginBottom: '6px' }}>
                All caught up — no urgent deals right now
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.28)', marginBottom: '16px', lineHeight: 1.5 }}>
                Halvex will surface deal risks and actions here as they emerge.<br />
                Add meeting notes to deals to activate AI intelligence.
              </div>
              <Link href="/deals" style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '8px 16px', borderRadius: '8px',
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.20)',
                color: '#818cf8', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
              }}>
                View all deals <ChevronRight size={12} />
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '6px' }}>
              {topPriorities.map((item, i) => (
                <div
                  key={item.id}
                  className="priority-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '11px',
                    background: item.urgency === 'high'
                      ? 'rgba(248,113,113,0.05)'
                      : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${item.urgency === 'high' ? 'rgba(248,113,113,0.16)' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.15s ease',
                    cursor: item.ctaHref ? 'pointer' : 'default',
                  }}
                  onClick={() => { if (item.ctaHref) window.location.href = item.ctaHref }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = item.urgency === 'high' ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.05)'
                    el.style.borderColor = item.urgency === 'high' ? 'rgba(248,113,113,0.24)' : 'rgba(255,255,255,0.09)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = item.urgency === 'high' ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.025)'
                    el.style.borderColor = item.urgency === 'high' ? 'rgba(248,113,113,0.16)' : 'rgba(255,255,255,0.05)'
                  }}
                >
                  {/* Number badge */}
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                    background: item.urgency === 'high' ? 'rgba(248,113,113,0.15)' : 'rgba(99,102,241,0.12)',
                    border: `1px solid ${item.urgency === 'high' ? 'rgba(248,113,113,0.25)' : 'rgba(99,102,241,0.20)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: item.urgency === 'high' ? '#f87171' : '#818cf8' }}>
                      {i + 1}
                    </span>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {item.company && (
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.2, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.company}
                        {item.dealName && item.dealName !== item.company && (
                          <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.40)', marginLeft: '6px' }}>{item.dealName}</span>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.52)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {item.text}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="priority-cta" style={{ flexShrink: 0 }}>
                    {item.ctaHref ? (
                      <Link
                        href={item.ctaHref}
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '6px 12px', borderRadius: '7px',
                          background: item.urgency === 'high' ? 'rgba(248,113,113,0.12)' : 'rgba(99,102,241,0.12)',
                          border: `1px solid ${item.urgency === 'high' ? 'rgba(248,113,113,0.22)' : 'rgba(99,102,241,0.22)'}`,
                          color: item.urgency === 'high' ? '#f87171' : '#818cf8',
                          fontSize: '11px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
                        }}
                      >
                        {item.ctaLabel ?? 'Open'} <ArrowUpRight size={10} />
                      </Link>
                    ) : item.ctaAsk ? (
                      <button
                        onClick={e => { e.stopPropagation(); sendToCopilot(item.ctaAsk!) }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '6px 12px', borderRadius: '7px',
                          background: 'rgba(99,102,241,0.12)',
                          border: '1px solid rgba(99,102,241,0.22)',
                          color: '#818cf8',
                          fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        Ask AI <ArrowUpRight size={10} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}

              {/* Show more link */}
              {(brain?.urgentDeals?.length ?? 0) > 5 && (
                <Link href="/deals" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  padding: '9px', borderRadius: '9px', textDecoration: 'none',
                  fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.35)',
                  border: '1px dashed rgba(255,255,255,0.08)',
                  transition: 'all 0.12s',
                }}>
                  View all deals <ChevronRight size={11} />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ PRODUCT SIGNALS (for PMs) ══ */}
      {topProductGaps.length > 0 && (
        <div style={{ ...card, padding: '18px 22px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
              background: 'rgba(251,191,36,0.10)',
              border: '1px solid rgba(251,191,36,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GitBranch size={12} style={{ color: '#fbbf24' }} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>
                Product signals — features blocking deals
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)' }}>
                Halvex matched these automatically from deal notes
              </div>
            </div>
            <Link href="/product-gaps" style={{ marginLeft: 'auto', fontSize: '11px', color: '#818cf8', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}>
              All signals <ChevronRight size={11} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {topProductGaps.map((gap: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '9px', ...surface }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.10)', padding: '2px 7px', borderRadius: '100px', flexShrink: 0 }}>
                  {gap.dealCount ?? gap.count ?? '?'}× blocked
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.70)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {gap.feature || gap.title || gap.pattern || 'Feature gap'}
                </span>
                {gap.linearIssue || gap.linkedIssues ? (
                  <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 600, flexShrink: 0 }}>
                    ✓ Linear linked
                  </span>
                ) : (
                  <Link href="/product-gaps" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', textDecoration: 'none', flexShrink: 0 }}>
                    Link issue →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ IN-CYCLE LINEAR ISSUES ══ */}
      {(() => {
        const inCycleItems: any[] = inCycleRes?.data ?? []
        if (inCycleItems.length === 0) return null
        const dealGroups = inCycleItems.reduce((acc: Record<string, any[]>, item: any) => {
          const key = item.dealId ?? 'unknown'
          if (!acc[key]) acc[key] = []
          acc[key].push(item)
          return acc
        }, {})
        const dealCount = Object.keys(dealGroups).length
        return (
          <div style={{ ...card, padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitBranch size={13} style={{ color: '#818cf8' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>
                  In-cycle issues linked to your deals
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)' }}>
                {inCycleItems.length} issue{inCycleItems.length !== 1 ? 's' : ''} across {dealCount} deal{dealCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ padding: '8px 12px 12px' }}>
              {inCycleItems.slice(0, 6).map((item: any) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '8px 10px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.02)', marginBottom: '4px',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', marginTop: '5px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
                        {item.linearTitle ?? item.linearIssueId}
                      </span>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.30)' }}>{item.linearIssueId}</span>
                      {item.daysInCycle !== null && (
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>· {item.daysInCycle}d in sprint</span>
                      )}
                    </div>
                    {item.dealName && (
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>
                        {item.dealName} {item.prospectCompany ? `(${item.prospectCompany})` : ''}
                      </div>
                    )}
                    {item.addressesRisk && (
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '1px', fontStyle: 'italic' }}>
                        → &ldquo;{item.addressesRisk.slice(0, 80)}&rdquo;
                      </div>
                    )}
                  </div>
                  {item.linearIssueUrl && (
                    <a href={item.linearIssueUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0, marginTop: '2px' }}>
                      <ArrowUpRight size={11} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ══ RECENT AI ACTIONS ══ */}
      {(() => {
        const recentActions: any[] = mcpActionsRes?.data ?? []
        if (recentActions.length === 0) return null
        const actionEmoji: Record<string, string> = {
          issue_scoped_to_cycle: '🔄',
          release_email_generated: '✉️',
          all_issues_deployed_notification: '🚀',
          hubspot_email_logged: '📤',
          follow_up_reminder: '⏰',
          link_dismissed: '✕',
        }
        return (
          <div style={{ ...card, padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={13} style={{ color: '#a78bfa' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>
                  Recent AI actions
                </span>
              </div>
            </div>
            <div style={{ padding: '8px 12px 12px' }}>
              {recentActions.map((action: any) => {
                const emoji = actionEmoji[action.actionType] ?? '🤖'
                const timeAgo = action.createdAt ? (() => {
                  const diff = Date.now() - new Date(action.createdAt).getTime()
                  const mins = Math.floor(diff / 60000)
                  if (mins < 60) return `${mins}m ago`
                  const hrs = Math.floor(mins / 60)
                  if (hrs < 24) return `${hrs}h ago`
                  return `${Math.floor(hrs / 24)}d ago`
                })() : ''
                return (
                  <div key={action.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 10px', borderRadius: '8px',
                    marginBottom: '3px',
                  }}>
                    <span style={{ fontSize: '13px', flexShrink: 0 }}>{emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>{action.label}</span>
                      {action.dealName && (
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginLeft: '6px' }}>
                          · {action.dealName}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.20)', flexShrink: 0 }}>{timeAgo}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ══ CONNECTED STATUS ══ */}
      <div style={{ ...card, padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Halvex is connected to
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'Slack', icon: <MessageSquare size={12} />, connected: slackConnected, href: '/settings' },
            { label: 'Linear', icon: <GitBranch size={12} />, connected: linearConnected, href: '/settings' },
            { label: 'HubSpot', icon: <Brain size={12} />, connected: hubspotConnected, href: '/settings' },
          ].map(({ label, icon, connected, href }) => (
            <Link
              key={label}
              href={href}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '7px 12px', borderRadius: '9px',
                background: connected === true
                  ? 'rgba(52,211,153,0.06)'
                  : connected === false
                  ? 'rgba(248,113,113,0.05)'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${connected === true ? 'rgba(52,211,153,0.18)' : connected === false ? 'rgba(248,113,113,0.14)' : 'rgba(255,255,255,0.07)'}`,
                textDecoration: 'none',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.75'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              <span style={{ color: connected === true ? '#34d399' : connected === false ? '#f87171' : 'rgba(255,255,255,0.30)' }}>
                {icon}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: connected === true ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.38)' }}>
                {label}
              </span>
              {connected === true && (
                <CheckCircle2 size={11} style={{ color: '#34d399', flexShrink: 0 }} />
              )}
              {connected === false && (
                <span style={{ fontSize: '10px', color: '#f87171', fontWeight: 600 }}>Connect</span>
              )}
              {connected === null && (
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>Set up</span>
              )}
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes skeleton-shimmer {
          0%   { opacity: 1; }
          50%  { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .priority-cta { opacity: 0; transition: opacity 0.15s ease; }
        .priority-row:hover .priority-cta { opacity: 1; }
        @media (max-width: 768px) {
          .priority-cta { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
