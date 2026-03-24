'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import {
  Sparkles, RefreshCw, AlertTriangle, ArrowUpRight,
  GitBranch, MessageSquare, CheckCircle2, Send,
  Plug, ChevronRight, Brain, TrendingUp, Zap, Target,
} from 'lucide-react'
import { useSidebar } from '@/components/layout/SidebarContext'
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const card: React.CSSProperties = {
  position: 'relative',
  background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(59,130,246,0.05), transparent)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: '1rem',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 2px 20px rgba(0,0,0,0.40), 0 1px 4px rgba(0,0,0,0.20)',
}

const heroCard: React.CSSProperties = {
  position: 'relative',
  background: 'linear-gradient(135deg, rgba(79,70,229,0.55) 0%, rgba(99,102,241,0.35) 40%, rgba(59,130,246,0.20) 100%)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  borderRadius: '1.25rem',
  border: '1px solid rgba(129,140,248,0.25)',
  boxShadow: '0 8px 40px rgba(79,70,229,0.25), 0 2px 8px rgba(0,0,0,0.40)',
}

const surface: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.06)',
}

export default function DashboardPage() {
  const { sendToCopilot } = useSidebar()
  const { user } = useUser()
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
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
  const { data: linearRes } = useSWR('/api/integrations/linear/status', fetcher, { revalidateOnFocus: false, dedupingInterval: 120000 })
  const { data: mcpActionsRes } = useSWR('/api/mcp-actions/recent?limit=8', fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 })
  const { data: inCycleRes } = useSWR('/api/deals/in-cycle', fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 })
  const [regenerating, setRegenerating] = useState(false)

  // Ask Halvex inline chat
  const [askText, setAskText] = useState('')
  const [askLoading, setAskLoading] = useState(false)
  const [askResponse, setAskResponse] = useState<string | null>(null)
  const askInputRef = useRef<HTMLTextAreaElement>(null)

  const overview = overviewRes?.data
  const brain = brainRes?.data
  const deals: any[] = dealsRes?.data ?? []
  const activeDeals = deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const closedDeals = deals.filter((d: any) => d.stage === 'closed_won' || d.stage === 'closed_lost')
  const wonDeals = deals.filter((d: any) => d.stage === 'closed_won')
  const winRate = closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : null

  const slackConnected = slackRes ? slackRes?.data?.connected === true : null
  const linearConnected = linearRes ? linearRes?.data?.connected === true : null
  const hubspotConnected = hubspotRes ? hubspotRes?.data?.connected === true : null

  // Build alert contexts
  const alertDeals = (deals || []).map((d: any) => {
    const isClosed = d.stage === 'closed_won' || d.stage === 'closed_lost'
    const intentSignals = d.intentSignals as any || {}
    const contacts = ((d.contacts as any[]) || []).map((c: any) => ({ name: c.name || 'Unknown', role: c.role || '' }))
    return {
      id: d.id, name: d.dealName || 'Untitled', company: d.prospectCompany || '',
      stage: d.stage || 'prospecting', dealValue: d.dealValue ?? 0, dealType: null, currency: 'GBP',
      isClosed, outcome: d.stage === 'closed_won' ? 'won' as const : d.stage === 'closed_lost' ? 'lost' as const : null,
      closeDate: d.closeDate ? new Date(d.closeDate).toISOString() : null,
      wonDate: null, lostDate: null, lossReason: null,
      dealAgeDays: d.createdAt ? Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 86400000) : 0,
      daysSinceLastNote: d.updatedAt ? Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / 86400000) : 999,
      championIdentified: intentSignals.championStatus === 'confirmed',
      budgetConfirmed: intentSignals.budgetStatus === 'confirmed' || intentSignals.budgetStatus === 'approved',
      nextStepDefined: false, competitorsPresent: [] as string[], sentimentRecent: 0.5, momentum: 0.5,
      compositeScore: d.conversionScore ?? 0, scoreColor: getScoreColor(d.conversionScore ?? 0, isClosed),
      noteCount: 0, lastNoteDate: null, lastNoteSummary: null, openActionCount: 0, completedActionCount: 0,
      recentCompletedActions: [] as string[], upcomingEvents: [] as { type: string; title: string; date: string; time: string | null }[],
      contacts,
    }
  })
  const proactiveAlerts = generateAlerts(alertDeals as any)

  // Priority items
  type PriorityItem = {
    id: string; dealId?: string; company?: string; dealName?: string; text: string
    urgency: 'high' | 'medium' | 'low'; ctaLabel?: string; ctaHref?: string; ctaAsk?: string
  }
  const priorityItems: PriorityItem[] = []
  const seenDealIds = new Set<string>()

  for (const u of (brain?.urgentDeals ?? []).slice(0, 3)) {
    if (seenDealIds.has(u.dealId)) continue
    seenDealIds.add(u.dealId)
    const deal = deals.find((d: any) => d.id === u.dealId)
    priorityItems.push({ id: `urgent-${u.dealId}`, dealId: u.dealId, company: deal?.prospectCompany || u.dealName || 'Deal', dealName: deal?.dealName, text: u.reason, urgency: 'high', ctaLabel: 'Review deal', ctaHref: `/deals/${u.dealId}` })
  }
  for (const item of (overview?.topAttentionDeals ?? []).slice(0, 3)) {
    if (item.dealId && seenDealIds.has(item.dealId)) continue
    if (item.dealId) seenDealIds.add(item.dealId)
    priorityItems.push({ id: `attention-${item.dealId || item.company}`, dealId: item.dealId, company: item.company, dealName: item.dealName, text: item.reason, urgency: item.urgency === 'high' ? 'high' : 'medium', ctaLabel: item.dealId ? 'Open deal' : undefined, ctaHref: item.dealId ? `/deals/${item.dealId}` : undefined })
  }
  for (const t of (brain?.scoreTrendAlerts ?? []).filter((t: any) => t.trend === 'declining').slice(0, 2)) {
    if (seenDealIds.has(t.dealId)) continue
    seenDealIds.add(t.dealId)
    priorityItems.push({ id: `decline-${t.dealId}`, dealId: t.dealId, company: t.dealName, text: `Health score dropped ${Math.abs(t.delta)} points (${t.priorScore}% → ${t.currentScore}%)`, urgency: 'medium', ctaLabel: 'Open deal', ctaHref: `/deals/${t.dealId}` })
  }
  for (const action of (overview?.keyActions ?? []).slice(0, 2)) {
    const matchedDeal = deals.find((d: any) => {
      const name = (d.dealName || '').toLowerCase(); const company = (d.prospectCompany || '').toLowerCase(); const al = action.toLowerCase()
      return (name.length > 3 && al.includes(name)) || (company.length > 3 && al.includes(company))
    })
    priorityItems.push({ id: `action-${action.slice(0, 20)}`, dealId: matchedDeal?.id, company: matchedDeal?.prospectCompany, text: action, urgency: 'low', ctaLabel: matchedDeal ? 'Open deal' : 'Ask AI', ctaHref: matchedDeal ? `/deals/${matchedDeal.id}` : undefined, ctaAsk: !matchedDeal ? action : undefined })
  }
  const topPriorities = priorityItems.slice(0, 6)
  const attentionCount = priorityItems.filter(p => p.urgency === 'high').length

  // Stat tiles data
  const dealsAtRisk = attentionCount + (brain?.urgentDeals?.length ?? 0)
  const inCycleCount = (inCycleRes?.data ?? []).length
  const recentActions: any[] = mcpActionsRes?.data ?? []

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
    return name ? `${base}, ${name}` : base
  })()

  const isLoading = overviewLoading && !brain

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault()
    const q = askText.trim()
    if (!q || askLoading) return
    setAskLoading(true)
    setAskResponse(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      })
      const json = await res.json()
      setAskResponse(json.reply ?? json.message ?? json.data?.reply ?? 'No response')
      setAskText('')
    } catch {
      setAskResponse('Failed to get a response. Try again.')
    } finally {
      setAskLoading(false)
    }
  }

  const actionEmoji: Record<string, string> = {
    issue_scoped_to_cycle: '🔄', release_email_generated: '✉️',
    all_issues_deployed_notification: '🚀', hubspot_email_logged: '📤',
    follow_up_reminder: '⏰', link_dismissed: '✕',
  }

  const inCycleItems: any[] = inCycleRes?.data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px' }}>

      {/* ══ HERO ══ */}
      <div style={{ ...heroCard, padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: '6px' }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <h1 style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.025em', lineHeight: 1.15, margin: '0 0 6px' }}>
              {greeting}.{' '}
              {attentionCount > 0
                ? <span style={{ color: '#fca5a5' }}>{attentionCount} deal{attentionCount !== 1 ? 's' : ''} need attention.</span>
                : <span style={{ color: 'rgba(255,255,255,0.60)' }}>Pipeline looks healthy.</span>}
            </h1>
            {!isLoading && overview?.summary && (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', margin: '0', lineHeight: 1.65, maxWidth: '540px' }}>
                {overview.summary}
              </p>
            )}
          </div>
          <button
            onClick={regenerate}
            disabled={regenerating}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)',
              color: 'rgba(255,255,255,0.70)', fontSize: '11px', fontWeight: 500,
              cursor: regenerating ? 'not-allowed' : 'pointer', opacity: regenerating ? 0.6 : 1,
              flexShrink: 0, transition: 'all 0.12s', alignSelf: 'flex-start',
            }}
          >
            <RefreshCw size={10} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
            {regenerating ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '20px' }}>
          {[
            { icon: <AlertTriangle size={13} />, label: 'Deals at risk', value: dealsAtRisk > 0 ? String(dealsAtRisk) : '0', color: dealsAtRisk > 0 ? '#f87171' : '#34d399', bg: dealsAtRisk > 0 ? 'rgba(248,113,113,0.10)' : 'rgba(52,211,153,0.10)', href: '/deals' },
            { icon: <Target size={13} />, label: 'Active deals', value: String(activeDeals.length), color: '#818cf8', bg: 'rgba(99,102,241,0.10)', href: '/deals' },
            { icon: <GitBranch size={13} />, label: 'In-cycle issues', value: String(inCycleCount), color: '#a78bfa', bg: 'rgba(139,92,246,0.10)', href: '/deals' },
            { icon: <TrendingUp size={13} />, label: 'Win rate', value: winRate != null ? `${winRate}%` : '—', color: '#34d399', bg: 'rgba(52,211,153,0.10)', href: '/intelligence' },
          ].map((tile, i) => (
            <Link key={i} href={tile.href} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '12px 14px', borderRadius: '12px',
                background: tile.bg, border: `1px solid ${tile.color}28`,
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'opacity 0.12s',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.80'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              >
                <span style={{ color: tile.color }}>{tile.icon}</span>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>{tile.value}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.50)', marginTop: '2px' }}>{tile.label}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ══ MAIN 2-COL LAYOUT ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr', gap: '20px', alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Priority actions */}
          <div style={{ ...card, padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0, background: attentionCount > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(99,102,241,0.12)', border: `1px solid ${attentionCount > 0 ? 'rgba(248,113,113,0.22)' : 'rgba(99,102,241,0.22)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {attentionCount > 0 ? <AlertTriangle size={12} style={{ color: '#f87171' }} /> : <Sparkles size={12} style={{ color: '#818cf8' }} />}
              </div>
              {isLoading ? <SkeletonLine w="140px" h="14px" /> : (
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                  Priority actions {topPriorities.length > 0 && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 400, marginLeft: '4px' }}>({topPriorities.length})</span>}
                </span>
              )}
            </div>
            <div style={{ padding: '8px 10px 10px' }}>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
                  {[1, 2, 3].map(i => <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '10px', ...surface }}><SkeletonLine w="24px" h="24px" /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}><SkeletonLine w="40%" h="12px" /><SkeletonLine w="75%" h="10px" /></div></div>)}
                </div>
              ) : topPriorities.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.50)', fontWeight: 500, marginBottom: '6px' }}>All caught up — no urgent deals right now</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.28)', marginBottom: '14px' }}>Add meeting notes to deals to activate AI intelligence.</div>
                  <Link href="/deals" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.20)', color: '#818cf8', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                    View all deals <ChevronRight size={11} />
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {topPriorities.map((item, i) => (
                    <div
                      key={item.id}
                      className="priority-row"
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: item.urgency === 'high' ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${item.urgency === 'high' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)'}`, transition: 'all 0.12s', cursor: item.ctaHref ? 'pointer' : 'default' }}
                      onClick={() => { if (item.ctaHref) window.location.href = item.ctaHref }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = item.urgency === 'high' ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.05)' }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = item.urgency === 'high' ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.02)' }}
                    >
                      <div style={{ width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0, background: item.urgency === 'high' ? 'rgba(248,113,113,0.15)' : 'rgba(99,102,241,0.12)', border: `1px solid ${item.urgency === 'high' ? 'rgba(248,113,113,0.25)' : 'rgba(99,102,241,0.20)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: item.urgency === 'high' ? '#f87171' : '#818cf8' }}>{i + 1}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {item.company && (
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.2, marginBottom: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.company}{item.dealName && item.dealName !== item.company && <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.38)', marginLeft: '5px' }}>{item.dealName}</span>}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.50)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.text}</div>
                      </div>
                      <div className="priority-cta" style={{ flexShrink: 0 }}>
                        {item.ctaHref ? (
                          <Link href={item.ctaHref} onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '5px 10px', borderRadius: '7px', background: item.urgency === 'high' ? 'rgba(248,113,113,0.12)' : 'rgba(99,102,241,0.12)', border: `1px solid ${item.urgency === 'high' ? 'rgba(248,113,113,0.22)' : 'rgba(99,102,241,0.22)'}`, color: item.urgency === 'high' ? '#f87171' : '#818cf8', fontSize: '11px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            {item.ctaLabel ?? 'Open'} <ArrowUpRight size={10} />
                          </Link>
                        ) : item.ctaAsk ? (
                          <button onClick={e => { e.stopPropagation(); sendToCopilot(item.ctaAsk!) }} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '5px 10px', borderRadius: '7px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', color: '#818cf8', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Ask AI <ArrowUpRight size={10} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ask Halvex inline chat */}
          <div style={{ ...card, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={12} color="#818cf8" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>Ask Halvex</span>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)' }}>— ask anything about your pipeline</span>
            </div>

            {askResponse && (
              <div style={{ marginBottom: '12px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', fontSize: '13px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {askResponse}
              </div>
            )}

            <form onSubmit={handleAsk} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={askInputRef}
                value={askText}
                onChange={e => setAskText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(e as any) } }}
                placeholder="e.g. What's happening with Miro? Which deals are at risk this week?"
                rows={2}
                disabled={askLoading}
                style={{
                  flex: 1, resize: 'none', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.5,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.80)', outline: 'none', caretColor: '#818cf8', fontFamily: 'inherit',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.35)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
              <button
                type="submit"
                disabled={askLoading || !askText.trim()}
                style={{
                  width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  border: '1px solid rgba(99,102,241,0.50)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: askLoading || !askText.trim() ? 'not-allowed' : 'pointer',
                  opacity: askLoading || !askText.trim() ? 0.5 : 1,
                  transition: 'all 0.12s',
                }}
              >
                {askLoading
                  ? <RefreshCw size={14} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                  : <Send size={14} color="#fff" />}
              </button>
            </form>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Workflow outputs */}
          <div style={{ ...card, padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={12} color="#a78bfa" />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>Workflow Outputs</span>
              </div>
              <Link href="/workflows" style={{ fontSize: '11px', color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                Manage <ChevronRight size={10} />
              </Link>
            </div>

            <div style={{ padding: '10px 14px 14px' }}>
              {/* Daily sprint briefing output — in-cycle issues */}
              {inCycleItems.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', background: 'rgba(139,92,246,0.12)', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Daily sprint briefing
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {inCycleItems.slice(0, 5).map((item: any) => (
                      <div key={item.id} style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.80)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.linearTitle ?? item.linearIssueId}
                        </div>
                        {item.dealName && (
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)' }}>
                            → {item.dealName} {item.prospectCompany ? `(${item.prospectCompany})` : ''}
                          </div>
                        )}
                        {item.linearIssueUrl && (
                          <a href={item.linearIssueUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: '#818cf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px', marginTop: '2px' }}>
                            View in Linear <ArrowUpRight size={9} />
                          </a>
                        )}
                      </div>
                    ))}
                    {inCycleItems.length > 5 && (
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', padding: '4px 0', textAlign: 'center' }}>
                        +{inCycleItems.length - 5} more in sprint
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>No workflow outputs yet</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)', marginBottom: '12px', lineHeight: 1.5 }}>
                    Activate a workflow and set it to<br />"Show in Today tab" to see outputs here.
                  </div>
                  <Link href="/workflows" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '7px', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.20)', color: '#a78bfa', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
                    <Zap size={10} /> Go to Workflows
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Recent AI actions */}
          {recentActions.length > 0 && (
            <div style={{ ...card, padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Sparkles size={12} style={{ color: '#a78bfa' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.70)' }}>Recent AI actions</span>
              </div>
              <div style={{ padding: '6px 10px 10px' }}>
                {recentActions.map((action: any) => {
                  const emoji = actionEmoji[action.actionType] ?? '🤖'
                  const ago = action.createdAt ? timeAgo(action.createdAt) : ''
                  return (
                    <div
                      key={action.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', marginBottom: '2px', cursor: action.dealId ? 'pointer' : 'default', transition: 'background 0.12s' }}
                      onClick={() => { if (action.dealId) window.location.href = `/deals/${action.dealId}` }}
                      onMouseEnter={e => { if (action.dealId) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <span style={{ fontSize: '12px', flexShrink: 0 }}>{emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.60)' }}>{action.label}</span>
                        {action.dealName && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginLeft: '5px' }}>· {action.dealName}</span>}
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.20)' }}>{ago}</span>
                        {action.dealId && <ArrowUpRight size={9} style={{ color: 'rgba(255,255,255,0.20)' }} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Connection status strip */}
          <div style={{ ...card, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
              <Plug size={10} style={{ color: '#475569' }} />
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Connections</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { label: 'Slack', icon: <MessageSquare size={11} />, connected: slackConnected },
                { label: 'Linear', icon: <GitBranch size={11} />, connected: linearConnected },
                { label: 'HubSpot', icon: <Brain size={11} />, connected: hubspotConnected },
              ].map(({ label, icon, connected }) => (
                <Link key={label} href="/connections" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', background: connected === true ? 'rgba(52,211,153,0.06)' : connected === false ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${connected === true ? 'rgba(52,211,153,0.18)' : connected === false ? 'rgba(248,113,113,0.14)' : 'rgba(255,255,255,0.07)'}`, textDecoration: 'none', transition: 'opacity 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.75'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                >
                  <span style={{ color: connected === true ? '#34d399' : connected === false ? '#f87171' : 'rgba(255,255,255,0.30)' }}>{icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: connected === true ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.35)' }}>{label}</span>
                  {connected === true && <CheckCircle2 size={10} style={{ color: '#34d399' }} />}
                  {connected === false && <span style={{ fontSize: '9px', color: '#f87171', fontWeight: 600 }}>Connect</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes skeleton-shimmer { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .priority-cta { opacity: 0; transition: opacity 0.15s ease; }
        .priority-row:hover .priority-cta { opacity: 1; }
        @media (max-width: 768px) { .priority-cta { opacity: 1; } }
      `}</style>
    </div>
  )
}
