'use client'
export const dynamic = 'force-dynamic'

import { useState, useCallback, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import {
  RefreshCw, AlertTriangle, ArrowUpRight,
  GitBranch, MessageSquare, CheckCircle2,
  Plug, ChevronRight, Brain, Zap, Activity,
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
      background: 'rgba(255,255,255,0.07)',
      animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
    }} />
  )
}

// Luminous glass card — coloured gradient behind frosted glass
const glassCard: React.CSSProperties = {
  position: 'relative',
  background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(59,130,246,0.05) 50%, rgba(139,92,246,0.07) 100%)',
  backdropFilter: 'blur(24px) saturate(200%)',
  WebkitBackdropFilter: 'blur(24px) saturate(200%)',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.40), 0 1px 4px rgba(0,0,0,0.20)',
}

const surface: React.CSSProperties = {
  background: 'rgba(99,102,241,0.06)',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.07)',
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
  const { data: activityRes } = useSWR('/api/mcp/activity?hours=24', fetcher, { revalidateOnFocus: false })
  const { data: slackRes } = useSWR('/api/integrations/slack/status', fetcher, { revalidateOnFocus: false, dedupingInterval: 120000 })
  const { data: hubspotRes } = useSWR('/api/integrations/hubspot/status', fetcher, { revalidateOnFocus: false, dedupingInterval: 120000 })
  const { data: linearRes } = useSWR('/api/integrations/linear/status', fetcher, { revalidateOnFocus: false, dedupingInterval: 120000 })
  const [regenerating, setRegenerating] = useState(false)

  const overview = overviewRes?.data
  const brain = brainRes?.data
  const deals: any[] = dealsRes?.data ?? []
  const activityItems: any[] = activityRes?.data ?? []
  const activeDeals = deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  const slackConnected = slackRes ? slackRes?.data?.connected === true : null
  const linearConnected = linearRes ? linearRes?.data?.connected === true : null
  const hubspotConnected = hubspotRes ? hubspotRes?.data?.connected === true : null

  // Build priority list
  type PriorityItem = {
    id: string; dealId?: string; company?: string; dealName?: string
    text: string; urgency: 'high' | 'medium' | 'low'
    ctaLabel?: string; ctaHref?: string; ctaAsk?: string
  }
  const priorityItems: PriorityItem[] = []
  const seenDealIds = new Set<string>()

  for (const u of (brain?.urgentDeals ?? []).slice(0, 3)) {
    if (seenDealIds.has(u.dealId)) continue
    seenDealIds.add(u.dealId)
    const deal = deals.find((d: any) => d.id === u.dealId)
    priorityItems.push({ id: `urgent-${u.dealId}`, dealId: u.dealId, company: deal?.prospectCompany || u.dealName || 'Deal', dealName: deal?.dealName, text: u.reason, urgency: 'high', ctaLabel: 'Open deal', ctaHref: `/deals/${u.dealId}` })
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
      const name = (d.dealName || '').toLowerCase()
      const company = (d.prospectCompany || '').toLowerCase()
      const al = action.toLowerCase()
      return (name.length > 3 && al.includes(name)) || (company.length > 3 && al.includes(company))
    })
    priorityItems.push({ id: `action-${action.slice(0, 20)}`, dealId: matchedDeal?.id, company: matchedDeal?.prospectCompany, text: action, urgency: 'low', ctaLabel: matchedDeal ? 'Open deal' : 'Ask AI', ctaHref: matchedDeal ? `/deals/${matchedDeal.id}` : undefined, ctaAsk: !matchedDeal ? action : undefined })
  }

  const topPriorities = priorityItems.slice(0, 5)
  const attentionCount = priorityItems.filter(p => p.urgency === 'high').length
  const isLoading = overviewLoading && !brain

  const regenerate = async () => {
    setRegenerating(true)
    try {
      await fetch('/api/dashboard/ai-overview', { method: 'POST' })
      await mutate('/api/dashboard/ai-overview')
      track(Events.AI_BRIEFING_GENERATED, { dealCount: activeDeals.length })
    } finally { setRegenerating(false) }
  }

  const timeOfDay = (() => {
    const h = new Date().getHours()
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  })()

  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '820px' }}>

      {/* ══ MORNING BRIEFING HERO CARD ══ */}
      <div style={{
        position: 'relative',
        borderRadius: '20px',
        padding: isMobile ? '28px 22px' : '36px 40px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f1729 0%, #111827 50%, #0d1020 100%)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        {/* Ambient glow layers */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
          background: 'radial-gradient(ellipse at 20% 30%, rgba(30,41,110,0.75) 0%, rgba(99,102,241,0.25) 35%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
          background: 'radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.20) 0%, transparent 50%)',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Label */}
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'rgba(129,140,248,0.55)',
            marginBottom: '18px',
          }}>
            HALVEX · MORNING BRIEFING
          </div>

          {/* Hero headline */}
          {isLoading ? (
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SkeletonLine w="75%" h={isMobile ? '32px' : '42px'} />
              <SkeletonLine w="55%" h={isMobile ? '32px' : '42px'} />
            </div>
          ) : (
            <h1 style={{
              fontSize: isMobile ? '26px' : '36px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              letterSpacing: '-0.025em',
              lineHeight: 1.25,
              marginBottom: '20px',
            }}>
              Good {timeOfDay},{' '}
              <span style={{ color: '#818cf8', fontWeight: 700 }}>
                {user?.firstName || 'there'}
              </span>
              .{' '}
              {attentionCount > 0 ? (
                <>
                  <span style={{ color: '#f87171', fontWeight: 700 }}>
                    {attentionCount} deal{attentionCount > 1 ? 's' : ''}
                  </span>{' '}
                  need{attentionCount === 1 ? 's' : ''} your attention today.
                </>
              ) : topPriorities.length > 0 ? (
                <>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>
                    {topPriorities.length} thing{topPriorities.length !== 1 ? 's' : ''}
                  </span>{' '}
                  to action today.
                </>
              ) : (
                <span style={{ color: '#34d399' }}>Your pipeline looks healthy.</span>
              )}
            </h1>
          )}

          {/* AI briefing text */}
          {!isLoading && overview?.summary && (
            <p style={{
              fontSize: '15px', color: 'rgba(255,255,255,0.58)', lineHeight: 1.75,
              marginBottom: '24px', maxWidth: '620px',
            }}>
              {overview.summary}
            </p>
          )}
          {isLoading && (
            <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SkeletonLine w="90%" h="15px" />
              <SkeletonLine w="75%" h="15px" />
              <SkeletonLine w="60%" h="15px" />
            </div>
          )}

          {/* Bottom row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.28)' }}>{dateStr}</span>
            <button
              onClick={regenerate}
              disabled={regenerating}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 14px', borderRadius: '8px',
                background: 'rgba(99,102,241,0.14)',
                border: '1px solid rgba(99,102,241,0.25)',
                color: '#818cf8', fontSize: '11px', fontWeight: 600,
                cursor: regenerating ? 'not-allowed' : 'pointer',
                opacity: regenerating ? 0.6 : 1,
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!regenerating) { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.22)' }}}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.14)' }}
            >
              <RefreshCw size={10} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
              {regenerating ? 'Refreshing…' : 'Refresh briefing'}
            </button>
          </div>
        </div>
      </div>

      {/* ══ PRIORITY ACTIONS ══ */}
      <div style={{ ...glassCard, padding: '0', overflow: 'hidden' }}>
        <div style={{
          padding: '18px 22px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
              background: attentionCount > 0 ? 'rgba(248,113,113,0.14)' : 'rgba(99,102,241,0.14)',
              border: `1px solid ${attentionCount > 0 ? 'rgba(248,113,113,0.24)' : 'rgba(99,102,241,0.24)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {attentionCount > 0
                ? <AlertTriangle size={13} style={{ color: '#f87171' }} />
                : <Zap size={13} style={{ color: '#818cf8' }} />}
            </div>
            {isLoading ? <SkeletonLine w="160px" h="15px" /> : (
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.01em' }}>
                {attentionCount > 0
                  ? `${attentionCount} deal${attentionCount > 1 ? 's' : ''} need${attentionCount === 1 ? 's' : ''} your attention`
                  : topPriorities.length > 0 ? `${topPriorities.length} things to act on today`
                  : 'All caught up'}
              </div>
            )}
          </div>
          <Link href="/deals" style={{ fontSize: '11px', color: '#818cf8', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}>
            All deals <ChevronRight size={11} />
          </Link>
        </div>

        <div style={{ padding: '8px 12px 12px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '8px 0' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '10px', ...surface }}>
                  <SkeletonLine w="22px" h="22px" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <SkeletonLine w="40%" h="12px" />
                    <SkeletonLine w="70%" h="11px" />
                  </div>
                </div>
              ))}
            </div>
          ) : topPriorities.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', fontWeight: 500, marginBottom: '6px' }}>All caught up — no urgent deals right now</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.28)', marginBottom: '16px', lineHeight: 1.5 }}>
                Halvex will surface deal risks and actions here as they emerge.<br />Add meeting notes to deals to activate AI intelligence.
              </div>
              <Link href="/deals" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', color: '#818cf8', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                View all deals <ChevronRight size={12} />
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingTop: '6px' }}>
              {topPriorities.map((item, i) => (
                <div
                  key={item.id}
                  className="priority-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '11px 13px', borderRadius: '11px',
                    background: item.urgency === 'high' ? 'rgba(248,113,113,0.06)' : 'rgba(99,102,241,0.05)',
                    border: `1px solid ${item.urgency === 'high' ? 'rgba(248,113,113,0.16)' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.15s ease', cursor: item.ctaHref ? 'pointer' : 'default',
                  }}
                  onClick={() => { if (item.ctaHref) window.location.href = item.ctaHref }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = item.urgency === 'high' ? 'rgba(248,113,113,0.10)' : 'rgba(99,102,241,0.09)'
                    el.style.borderColor = item.urgency === 'high' ? 'rgba(248,113,113,0.24)' : 'rgba(99,102,241,0.18)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = item.urgency === 'high' ? 'rgba(248,113,113,0.06)' : 'rgba(99,102,241,0.05)'
                    el.style.borderColor = item.urgency === 'high' ? 'rgba(248,113,113,0.16)' : 'rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                    background: item.urgency === 'high' ? 'rgba(248,113,113,0.15)' : 'rgba(99,102,241,0.14)',
                    border: `1px solid ${item.urgency === 'high' ? 'rgba(248,113,113,0.28)' : 'rgba(99,102,241,0.24)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: item.urgency === 'high' ? '#f87171' : '#818cf8' }}>{i + 1}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {item.company && (
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.2, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.company}
                        {item.dealName && item.dealName !== item.company && (
                          <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.38)', marginLeft: '6px' }}>{item.dealName}</span>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {item.text}
                    </div>
                  </div>
                  <div className="priority-cta" style={{ flexShrink: 0 }}>
                    {item.ctaHref ? (
                      <Link href={item.ctaHref} onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 11px', borderRadius: '7px', background: item.urgency === 'high' ? 'rgba(248,113,113,0.12)' : 'rgba(99,102,241,0.12)', border: `1px solid ${item.urgency === 'high' ? 'rgba(248,113,113,0.22)' : 'rgba(99,102,241,0.22)'}`, color: item.urgency === 'high' ? '#f87171' : '#818cf8', fontSize: '11px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        {item.ctaLabel ?? 'Open'} <ArrowUpRight size={10} />
                      </Link>
                    ) : item.ctaAsk ? (
                      <button onClick={e => { e.stopPropagation(); sendToCopilot(item.ctaAsk!) }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 11px', borderRadius: '7px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', color: '#818cf8', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
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

      {/* ══ HALVEX ACTIVITY FEED ══ */}
      <div style={{ ...glassCard, padding: '18px 22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
            background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.24)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={12} style={{ color: '#818cf8' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>What Halvex did overnight</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.32)' }}>Automated actions in the last 24 hours</div>
          </div>
        </div>

        {activityItems.length === 0 ? (
          <div style={{ padding: '16px 0', fontSize: '13px', color: 'rgba(255,255,255,0.32)', lineHeight: 1.6 }}>
            Halvex is monitoring your pipeline. Activity will appear here as deals are analysed and actions are taken.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {activityItems.slice(0, 8).map((item: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 10px', borderRadius: '9px', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', flexShrink: 0, marginTop: '6px', boxShadow: '0 0 6px rgba(129,140,248,0.50)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{item.description}</span>
                </div>
                {item.timestamp && (
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>
                    {new Date(item.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ CONNECTIONS HEALTH STRIP ══ */}
      <div style={{ ...glassCard, padding: '14px 20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '12px' }}>
          Halvex is connected to
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'Slack',   icon: <MessageSquare size={12} />, connected: slackConnected,   href: '/connections' },
            { label: 'Linear',  icon: <GitBranch size={12} />,     connected: linearConnected,  href: '/connections' },
            { label: 'HubSpot', icon: <Brain size={12} />,         connected: hubspotConnected, href: '/connections' },
          ].map(({ label, icon, connected, href }) => (
            <Link
              key={label}
              href={href}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '7px 12px', borderRadius: '9px',
                background: connected === true ? 'rgba(52,211,153,0.08)' : connected === false ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${connected === true ? 'rgba(52,211,153,0.20)' : connected === false ? 'rgba(248,113,113,0.16)' : 'rgba(255,255,255,0.08)'}`,
                textDecoration: 'none', transition: 'all 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.75'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              <span style={{ color: connected === true ? '#34d399' : connected === false ? '#f87171' : 'rgba(255,255,255,0.30)' }}>{icon}</span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: connected === true ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.40)' }}>{label}</span>
              {connected === true && <CheckCircle2 size={11} style={{ color: '#34d399', flexShrink: 0 }} />}
              {connected === false && <span style={{ fontSize: '10px', color: '#f87171', fontWeight: 600 }}>Connect</span>}
              {connected === null && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>Set up</span>}
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes skeleton-shimmer {
          0%   { opacity: 1; }
          50%  { opacity: 0.45; }
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
