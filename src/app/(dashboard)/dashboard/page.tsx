'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Users, BookOpen, FileText, Plus, AlertTriangle, CheckCircle, Circle, ArrowUpRight, Zap, Target, Sparkles, Copy, Check, Clock } from 'lucide-react'
import ROIWidget from '@/components/dashboard/ROIWidget'
import AIOverviewCard from '@/components/dashboard/AIOverviewCard'
import { SetupAlert } from '@/components/shared/SetupBanner'
import { useUser } from '@clerk/nextjs'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'
import { useToast } from '@/components/shared/Toast'

function HealthItem({ done, label, href }: { done: boolean; label: string; href: string }) {
  return (
    <Link
      href={href}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', padding: '7px 10px', borderRadius: '7px', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      {done
        ? <CheckCircle size={13} color="#22C55E" style={{ flexShrink: 0 }} />
        : <Circle size={13} color="#2A2A2A" style={{ flexShrink: 0 }} />
      }
      <span style={{ fontSize: '12px', color: done ? '#444' : '#EBEBEB', textDecoration: done ? 'line-through' : 'none', flex: 1 }}>{label}</span>
      {!done && <ArrowUpRight size={11} color="#444" />}
    </Link>
  )
}

const TYPE_LABELS: Record<string, string> = {
  battlecard: 'Battlecard',
  one_pager: 'One-Pager',
  email_sequence: 'Email',
  objection_handler: 'Objections',
  executive_brief: 'Exec Brief',
}

const TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  battlecard: { bg: 'rgba(99,102,241,0.1)', color: '#818CF8', border: 'rgba(99,102,241,0.2)' },
  one_pager: { bg: 'rgba(34,197,94,0.1)', color: '#22C55E', border: 'rgba(34,197,94,0.2)' },
  email_sequence: { bg: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: 'rgba(245,158,11,0.2)' },
  objection_handler: { bg: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'rgba(239,68,68,0.2)' },
  executive_brief: { bg: 'rgba(168,85,247,0.1)', color: '#A855F7', border: 'rgba(168,85,247,0.2)' },
}

export default function DashboardPage() {
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const { data: company, error: companyErr } = useSWR('/api/company', fetcher)
  const { data: userRes } = useSWR('/api/user', fetcher)
  const dbUser = userRes?.data
  const { data: competitors } = useSWR('/api/competitors', fetcher)
  const { data: caseStudies } = useSWR('/api/case-studies', fetcher)
  const { data: deals } = useSWR('/api/deals', fetcher)
  const { data: collateral } = useSWR('/api/collateral', fetcher)
  const { data: insights } = useSWR('/api/insights', fetcher)
  const { data: productGapsData } = useSWR('/api/product-gaps', fetcher)
  const { data: brainRes, mutate: mutateBrain } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })

  const dbNotConnected = isDbNotConfigured(companyErr)

  // Auto-rebuild brain if stored snapshot is missing new fields (e.g. dealNames in patterns)
  useEffect(() => {
    const brain = brainRes?.data
    if (!brain) return
    const patterns = brain.keyPatterns ?? []
    const needsRebuild = patterns.length > 0 && patterns.some((p: any) => typeof p !== 'string' && !p.dealNames)
    if (needsRebuild) {
      fetch('/api/brain', { method: 'POST' }).then(() => mutateBrain()).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brainRes])

  // Redirect new users to onboarding if they haven't set up a company profile
  useEffect(() => {
    if (company === undefined) return // still loading
    if (dbNotConnected) return // don't redirect on DB error
    if (!company?.data?.companyName) {
      router.replace('/onboarding')
    }
  }, [company, dbNotConnected, router])

  // APIs return { data: ... } — unwrap correctly
  const companyData = company?.data
  const competitorList: { id: string }[] = competitors?.data ?? []
  const caseStudyList: { id: string }[] = caseStudies?.data ?? []
  const dealList: { id: string; stage: string; dealName: string; prospectCompany: string; dealValue?: number | null; dealType?: string | null; recurringInterval?: string | null; competitors?: string[]; todos: { id: string; text: string; done: boolean }[] }[] = deals?.data ?? []
  const collateralList: { id: string; title: string; type: string; status: string }[] = collateral?.data ?? []
  const insightsData = insights?.data
  const gapList: { id: string; title: string; description?: string; priority: string; status: string; roadmap?: string | null; requestCount?: number; blockedRevenue?: number }[] = productGapsData?.data ?? []
  const roadmapNow = gapList.filter(g => g.roadmap === 'now')
  const roadmapNext = gapList.filter(g => g.roadmap === 'next')
  const roadmapLater = gapList.filter(g => g.roadmap === 'later').slice(0, 6)

  const hasCompany = !!companyData?.id
  const competitorCount = competitorList.length
  const caseStudyCount = caseStudyList.length
  const dealCount = dealList.length
  const staleItems = collateralList.filter(c => c.status === 'stale')
  const winRate = insightsData?.winRate ?? 0

  // Outcome stats
  const openDeals = dealList.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length
  const wonDeals = dealList.filter(d => d.stage === 'closed_won').length

  // Stage priority: later stage = higher urgency
  const STAGE_PRIORITY: Record<string, number> = { negotiation: 5, proposal: 4, discovery: 3, qualification: 2, prospecting: 1 }
  const STAGE_STYLE: Record<string, { color: string; label: string }> = {
    negotiation: { color: '#EF4444', label: 'Negotiation' },
    proposal:    { color: '#F59E0B', label: 'Proposal' },
    discovery:   { color: '#8B5CF6', label: 'Discovery' },
    qualification: { color: '#3B82F6', label: 'Qualification' },
    prospecting:  { color: '#6B7280', label: 'Prospecting' },
  }

  // Priority todos — sorted by deal stage (negotiation first)
  const urgentTodos = dealList
    .filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .flatMap(d => (d.todos ?? []).filter(t => !t.done).map(t => ({
      ...t, dealName: d.dealName, dealId: d.id, company: d.prospectCompany,
      stage: d.stage, stagePriority: STAGE_PRIORITY[d.stage] ?? 0,
    })))
    .sort((a, b) => b.stagePriority - a.stagePriority)
    .slice(0, 8)

  const steps = [
    { done: hasCompany, label: 'Complete company profile', unlock: 'Personalises every AI output', href: '/company' },
    { done: competitorCount > 0, label: 'Add a competitor', unlock: 'Get instant AI battlecard + objection responses', href: '/competitors' },
    { done: caseStudyCount > 0, label: 'Add a case study', unlock: 'AI uses win stories to strengthen pitches', href: '/case-studies' },
    { done: dealCount > 0, label: 'Log a deal', unlock: 'Unlock meeting prep + AI win probability scoring', href: '/deals' },
    { done: collateralList.length > 0, label: 'Generate collateral', unlock: 'Battlecards & one-pagers in seconds', href: '/collateral' },
  ]

  // Smart contextual nudges derived from current data
  const smartNudges: { icon: string; message: string; cta: string; href: string; color: string }[] = []
  if (hasCompany && competitorCount === 0)
    smartNudges.push({ icon: '⚔️', message: 'Add a competitor to get an AI battlecard — know exactly what to say when they come up on a call.', cta: 'Add competitor', href: '/competitors', color: '#6366F1' })
  if (dealCount > 1 && caseStudyCount === 0)
    smartNudges.push({ icon: '🏆', message: `You have ${dealCount} deals logged but no win stories. Case studies power your AI proof points and email sequences.`, cta: 'Add case study', href: '/case-studies', color: '#22C55E' })
  if (dealCount > 2 && collateralList.length === 0)
    smartNudges.push({ icon: '📄', message: 'You\'re tracking deals but haven\'t generated any collateral yet. A personalised battlecard or one-pager takes 30 seconds.', cta: 'Generate now', href: '/collateral', color: '#F59E0B' })
  if (wonDeals > 0 && caseStudyCount === 0)
    smartNudges.push({ icon: '🎯', message: `You've won ${wonDeals} deal${wonDeals > 1 ? 's' : ''} — turn ${wonDeals > 1 ? 'them' : 'it'} into a case study so your AI can use this proof in future pitches.`, cta: 'Log case study', href: '/case-studies', color: '#A855F7' })
  if (dealCount > 3 && gapList.length === 0)
    smartNudges.push({ icon: '🔍', message: 'Log product gaps from your deals to track blocked revenue and spot patterns across your pipeline.', cta: 'Log gaps', href: '/product-gaps', color: '#EF4444' })
  const completedSteps = steps.filter(s => s.done).length
  const healthPct = Math.round((completedSteps / steps.length) * 100)
  const recentCollateral = collateralList.slice(0, 5)

  async function handleJoinWorkspace(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    try {
      const res = await fetch('/api/workspaces/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Invalid join code', 'error'); return }
      toast('Joined workspace! Reloading…', 'success')
      setTimeout(() => window.location.reload(), 1000)
    } catch { toast('Failed to join workspace', 'error') }
    finally { setJoining(false) }
  }

  function handleCopyCode() {
    if (!dbUser?.workspaceSlug) return
    navigator.clipboard.writeText(dbUser.workspaceSlug)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const firstName = user?.firstName
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greeting = firstName ? `${timeGreeting}, ${firstName}` : 'Dashboard'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', letterSpacing: '-0.03em', color: '#F1F1F3', marginBottom: '2px' }}>
            {greeting}
          </h1>
          <p style={{ fontSize: '12px', color: '#4B5563' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {openDeals > 0 && <span style={{ color: '#374151' }}> · {openDeals} deal{openDeals !== 1 ? 's' : ''} in pipeline</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Link href="/pipeline" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#9CA3AF', fontSize: '12px', fontWeight: '500', textDecoration: 'none', transition: 'color 0.1s, border-color 0.1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F1F1F3'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
          >
            <Target size={11} /> Pipeline
          </Link>
          <Link href="/deals" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#9CA3AF', fontSize: '12px', fontWeight: '500', textDecoration: 'none', transition: 'color 0.1s, border-color 0.1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F1F1F3'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
          >
            <Plus size={11} /> Log Deal
          </Link>
          <Link href="/collateral" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '7px', color: '#fff', fontSize: '12px', fontWeight: '600', textDecoration: 'none', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}>
            <Sparkles size={11} /> Generate
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
        {[
          { label: 'Open Deals', value: openDeals },
          { label: 'Deals Won', value: wonDeals },
          { label: 'Win Rate', value: `${winRate}%` },
          { label: 'Collateral', value: collateralList.length },
          { label: 'Competitors', value: competitorCount },
        ].map((stat, i, arr) => (
          <div key={stat.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 8px', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.03em', color: '#F1F1F3', lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: '#555', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Pipeline Focus — brain-sourced, proactive, no AI cost */}
      {(() => {
        const brain = brainRes?.data
        if (!brain) return null
        const urgent: { dealId: string; dealName: string; company: string; reason: string }[] = brain.urgentDeals ?? []
        const stale: { dealId: string; dealName: string; company: string; daysSinceUpdate: number }[] = (brain.staleDeals ?? []).slice(0, 3)
        const patterns: { label: string; dealIds: string[]; companies: string[]; dealNames: string[] }[] = (brain.keyPatterns ?? []).map((raw: unknown) => {
          if (typeof raw === 'string') return { label: raw, dealIds: [], companies: [], dealNames: [] }
          const p = raw as Record<string, unknown>
          return {
            label: String(p.label ?? ''),
            dealIds: Array.isArray(p.dealIds) ? p.dealIds : [],
            companies: Array.isArray(p.companies) ? p.companies : [],
            dealNames: Array.isArray(p.dealNames) ? p.dealNames : [],
          }
        })
        if (urgent.length === 0 && stale.length === 0 && patterns.length === 0) return null
        return (
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pipeline Focus</span>
              <span style={{ fontSize: '11px', color: '#333', marginLeft: 'auto' }}>
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {urgent.map((u, i) => (
                <Link key={u.dealId} href={`/deals/${u.dealId}`} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                  borderBottom: (i < urgent.length - 1 || stale.length > 0 || patterns.length > 0) ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  textDecoration: 'none', transition: 'background 120ms',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13px', color: '#E5E7EB', fontWeight: 500 }}>{u.company}</span>
                    <span style={{ fontSize: '12px', color: '#555', marginLeft: '8px' }}>{u.reason}</span>
                  </div>
                  <ArrowUpRight size={12} color="#333" />
                </Link>
              ))}
              {stale.map((s, i) => (
                <Link key={s.dealId} href={`/deals/${s.dealId}`} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                  borderBottom: (i < stale.length - 1 || patterns.length > 0) ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  textDecoration: 'none', transition: 'background 120ms',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <Clock size={10} color="#F59E0B" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13px', color: '#D1D5DB', fontWeight: 500 }}>{s.company}</span>
                    <span style={{ fontSize: '12px', color: '#555', marginLeft: '8px' }}>{s.daysSinceUpdate}d since last update</span>
                  </div>
                  <ArrowUpRight size={12} color="#333" />
                </Link>
              ))}
              {patterns.length > 0 && (
                <div style={{ borderTop: (urgent.length > 0 || stale.length > 0) ? '1px solid rgba(255,255,255,0.04)' : 'none', padding: '10px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Recurring Patterns</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {patterns.slice(0, 3).map((p, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#818CF8', flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', color: '#A78BFA', fontWeight: 500 }}>{p.label}</span>
                          <span style={{ fontSize: '10px', color: '#4B5563' }}>· {p.dealIds.length} deal{p.dealIds.length !== 1 ? 's' : ''}</span>
                        </div>
                        {p.dealIds.length > 0 && (
                          <div style={{ display: 'flex', gap: '5px', paddingLeft: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {p.dealIds.slice(0, 4).map((dealId, di) => {
                              const dealName = p.dealNames[di] || ''
                              const company = p.companies[di] || 'Deal'
                              return (
                                <Link key={dealId} href={`/deals/${dealId}`} style={{
                                  fontSize: '11px', color: '#9CA3AF',
                                  background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)',
                                  borderRadius: '5px', padding: '2px 8px', textDecoration: 'none',
                                  transition: 'all 0.12s', lineHeight: '1.4',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#C4B5FD'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.3)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.12)' }}
                                title={dealName ? `${dealName} — ${company}` : company}
                                >{dealName || company}</Link>
                              )
                            })}
                            {p.dealIds.length > 4 && (
                              <span style={{ fontSize: '10px', color: '#4B5563' }}>+{p.dealIds.length - 4} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* AI Overview — refreshes daily, summarises pipeline + key actions */}
      <AIOverviewCard />

      {/* Alerts — show immediately below AI Overview */}
      {dbNotConnected && <SetupAlert />}
      {staleItems.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '2px solid #EAB308', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={13} color="#EAB308" />
            <span style={{ fontSize: '13px', color: '#F0EEFF' }}>
              <strong style={{ color: '#EAB308' }}>{staleItems.length}</strong> collateral {staleItems.length === 1 ? 'item needs' : 'items need'} regenerating
            </span>
          </div>
          <Link href="/collateral?status=stale" style={{ fontSize: '12px', color: '#EAB308', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
            View all <ArrowUpRight size={11} />
          </Link>
        </div>
      )}

      {/* Cross-deal pattern alerts */}
      {(insightsData?.crossDealAlerts ?? []).slice(0, 3).map((alert: { type: string; message: string; count: number }, i: number) => {
        const isRed = alert.type === 'losing_streak'
        const color = isRed ? '#EF4444' : alert.type === 'recurring_risk' ? '#A855F7' : '#F59E0B'
        const href = alert.type === 'recurring_risk' ? '/product-gaps' : '/collateral'
        const cta = alert.type === 'recurring_risk' ? 'View gaps' : 'Update battlecard'
        return (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `2px solid ${color}`, borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              <AlertTriangle size={13} color={color} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#F0EEFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.message}</span>
            </div>
            <Link href={href} style={{ fontSize: '12px', color, textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {cta} <ArrowUpRight size={11} />
            </Link>
          </div>
        )
      })}

      {/* Priority actions — sorted by deal stage (most urgent first) */}
      {urgentTodos.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Priority Actions</span>
            <span style={{ fontSize: '11px', color: '#333', marginLeft: 'auto' }}>{urgentTodos.length}</span>
            <Link href="/pipeline" style={{ fontSize: '11px', color: '#4B5563', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
              Pipeline <ArrowUpRight size={10} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {urgentTodos.map((todo, i) => {
              const stageInfo = STAGE_STYLE[todo.stage] ?? { color: '#6B7280', label: todo.stage }
              return (
                <Link key={todo.id} href={`/deals/${todo.dealId}`} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px',
                  borderBottom: i < urgentTodos.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  textDecoration: 'none', transition: 'background 120ms',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: stageInfo.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: '#E5E7EB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.text}</div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>{todo.company}</div>
                  </div>
                  <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: '600', flexShrink: 0, color: stageInfo.color, background: `${stageInfo.color}12` }}>
                    {stageInfo.label}
                  </span>
                  <ArrowUpRight size={11} color="#333" style={{ flexShrink: 0 }} />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ROI strip */}
      <ROIWidget
        deals={dealList.map(d => ({
          outcome: d.stage === 'closed_won' ? 'won' : d.stage === 'closed_lost' ? 'lost' : 'open',
          dealValue: d.dealValue,
          dealType: d.dealType,
          recurringInterval: d.recurringInterval,
          competitors: d.competitors ?? [],
        }))}
        collateralCount={collateralList.length}
      />

      {/* Smart AI nudges — contextual suggestions based on current data */}
      {smartNudges.length > 0 && !dbNotConnected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {smartNudges.slice(0, 2).map((nudge, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `2px solid ${nudge.color}`, borderRadius: '8px' }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{nudge.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '12px', color: '#D1D5DB', lineHeight: '1.5' }}>{nudge.message}</span>
              </div>
              <Link href={nudge.href} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: nudge.color, background: `${nudge.color}10`, border: `1px solid ${nudge.color}25`, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                {nudge.cta} <ArrowUpRight size={10} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 272px', gap: '12px', alignItems: 'start' }}>

        {/* Left: Collateral Library + Roadmap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recent Collateral</span>
              {collateralList.length > 0 && (
                <span style={{ fontSize: '11px', color: '#333' }}>{collateralList.length}</span>
              )}
              <Link href="/collateral" style={{ fontSize: '11px', color: '#4B5563', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto' }}>
                View all <ArrowUpRight size={10} />
              </Link>
            </div>

            {recentCollateral.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 24px', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: '#555', fontWeight: '500' }}>No collateral yet</div>
                <div style={{ fontSize: '11px', color: '#374151', textAlign: 'center', lineHeight: '1.5' }}>Battlecards, one-pagers, email sequences — 30 seconds each</div>
                <Link href="/collateral" style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px', color: '#818CF8', fontSize: '12px', fontWeight: '500', textDecoration: 'none' }}>
                  <Plus size={11} /> Generate first
                </Link>
              </div>
            ) : (
              <div>
                {recentCollateral.map((item: { id: string; title: string; type: string; status: string }, i: number) => {
                  const typeStyle = TYPE_COLORS[item.type] ?? TYPE_COLORS['battlecard']
                  return (
                    <Link key={item.id} href={`/collateral/${item.id}`} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px',
                      borderBottom: i < recentCollateral.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      textDecoration: 'none', transition: 'background 120ms',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: '#E5E7EB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <span style={{ fontSize: '10px', color: typeStyle.color, fontWeight: '500' }}>
                          {TYPE_LABELS[item.type] ?? item.type.replace('_', ' ')}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: '500', flexShrink: 0,
                        color: item.status === 'ready' ? '#22C55E' : item.status === 'stale' ? '#EAB308' : '#818CF8',
                        background: item.status === 'ready' ? 'rgba(34,197,94,0.08)' : item.status === 'stale' ? 'rgba(234,179,8,0.08)' : 'rgba(99,102,241,0.08)',
                      }}>
                        {item.status === 'generating' ? '⟳' : item.status}
                      </span>
                      <ArrowUpRight size={11} color="#333" style={{ flexShrink: 0 }} />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Roadmap — Now / Next / Later */}
          {(roadmapNow.length > 0 || roadmapNext.length > 0 || roadmapLater.length > 0) && (
            <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Product Roadmap</span>
                <Link href="/product-gaps" style={{ fontSize: '11px', color: '#4B5563', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto' }}>
                  Manage <ArrowUpRight size={10} />
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', borderBottom: 'none' }}>
                {[
                  { label: 'Now', items: roadmapNow, color: '#22C55E', bg: 'rgba(34,197,94,0.08)', dot: '#22C55E' },
                  { label: 'Next', items: roadmapNext, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', dot: '#F59E0B' },
                  { label: 'Later', items: roadmapLater, color: '#6366F1', bg: 'rgba(99,102,241,0.08)', dot: '#818CF8' },
                ].map(({ label, items, color, bg, dot }, colIdx) => (
                  <div key={label} style={{ padding: '14px 16px', borderRight: colIdx < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#555', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</span>
                      {items.length > 0 && (
                        <span style={{ fontSize: '10px', color, background: bg, padding: '1px 5px', borderRadius: '3px', fontWeight: '600' }}>{items.length}</span>
                      )}
                    </div>
                    {items.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#333', fontStyle: 'italic' }}>Nothing here yet</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {items.slice(0, 4).map(gap => (
                          <div key={gap.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: dot, flexShrink: 0, marginTop: '5px' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: '12px', color: '#EBEBEB', lineHeight: '1.4' }}>{gap.title}</span>
                              {(gap.blockedRevenue ?? 0) > 0 && (
                                <div style={{ fontSize: '10px', color: '#EF4444', fontWeight: '600', marginTop: '1px' }}>
                                  £{gap.blockedRevenue!.toLocaleString()} blocked
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {items.length > 4 && (
                          <span style={{ fontSize: '11px', color: '#444', paddingLeft: '12px' }}>+{items.length - 4} more</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* AI Setup health */}
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: healthPct === 100 ? '#22C55E' : '#6366F1' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>AI Setup</span>
              <span style={{ fontSize: '11px', color: healthPct === 100 ? '#22C55E' : '#374151', marginLeft: 'auto' }}>{healthPct}%</span>
            </div>
            <div style={{ height: '2px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${healthPct}%`, background: healthPct === 100 ? '#22C55E' : '#6366F1', transition: 'width 1s ease' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {steps.map(s => <HealthItem key={s.href} {...s} />)}
            </div>
            {completedSteps < steps.length && (
              <div style={{ margin: '0 10px 10px', padding: '7px 10px', background: 'rgba(99,102,241,0.05)', borderRadius: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <Zap size={10} color="#6366F1" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#6366F1', lineHeight: '1.5' }}>
                  {steps.find(s => !s.done)?.unlock ?? 'Complete setup for best AI outputs'}
                </span>
              </div>
            )}
          </div>

          {/* Sales Brain */}
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8B5CF6' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Knowledge Base</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { href: '/competitors', label: 'Competitors', value: competitorCount, color: '#6366F1', icon: Users, hint: 'Powers battlecards' },
                { href: '/deals', label: 'Pipeline deals', value: dealCount, color: '#8B5CF6', icon: TrendingUp, hint: 'Tracks win rate' },
                { href: '/case-studies', label: 'Win stories', value: caseStudyCount, color: '#22C55E', icon: BookOpen, hint: 'Strengthens pitches' },
                { href: '/collateral', label: 'Sales docs', value: collateralList.length, color: '#F59E0B', icon: FileText, hint: 'Generated collateral' },
                { href: '/product-gaps', label: 'Feature gaps', value: gapList.length, color: '#EF4444', icon: AlertTriangle, hint: 'Blocked revenue' },
              ].map(({ href, label, value, color, icon: Icon, hint }, i, arr) => (
                <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', textDecoration: 'none', transition: 'background 120ms' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <Icon size={11} color={value > 0 ? color : '#374151'} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{label}</div>
                    <div style={{ fontSize: '10px', color: '#374151' }}>{hint}</div>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: value > 0 ? color : '#333', letterSpacing: '-0.02em' }}>{value}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Team */}
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em', flex: 1 }}>Team</span>
              <Link href="/settings" style={{ fontSize: '11px', color: '#374151', textDecoration: 'none' }}>Settings →</Link>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '10px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 5px', fontWeight: 600 }}>Invite code</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <code style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: '#818CF8', background: 'rgba(99,102,241,0.08)', padding: '5px 9px', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.15)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dbUser?.workspaceSlug ?? '…'}
                </code>
                <button onClick={handleCopyCode} title="Copy code" style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '6px', background: codeCopied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)', border: codeCopied ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: codeCopied ? '#22C55E' : '#555', transition: 'all 150ms' }}>
                  {codeCopied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
              <p style={{ fontSize: '10px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 5px', fontWeight: 600 }}>Join a workspace</p>
              <form onSubmit={handleJoinWorkspace} style={{ display: 'flex', gap: '5px' }}>
                <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="code (e.g. crane-47)" style={{ flex: 1, height: '28px', padding: '0 9px', borderRadius: '6px', fontSize: '11px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F1F3', outline: 'none', fontFamily: 'inherit', minWidth: 0 }} onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
                <button type="submit" disabled={joining || !joinCode.trim()} style={{ height: '28px', padding: '0 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: '#fff', background: '#6366F1', border: 'none', cursor: joining || !joinCode.trim() ? 'not-allowed' : 'pointer', opacity: joining || !joinCode.trim() ? 0.4 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {joining ? '…' : 'Join'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Value chain explainer — shown for early-stage users */}
      {dealCount < 5 && !dbNotConnected && (
        <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>How DealKit Works</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { icon: '⚔️', title: 'Competitive call comes up', body: 'Pull up a battlecard in seconds. Exact talk tracks, objection responses, and win angles — generated from your competitor data.', href: '/competitors', cta: 'Add a competitor', color: '#6366F1' },
              { icon: '📋', title: 'Just finished a sales call', body: 'Paste your notes into any deal. AI extracts action items, updates the deal score, and flags risks.', href: '/deals', cta: 'Open a deal', color: '#F59E0B' },
              { icon: '📄', title: 'Prospect wants a one-pager', body: 'Generate a personalised sales doc in 30 seconds. Pulls in your case studies, product strengths, and competitive position.', href: '/collateral', cta: 'Generate collateral', color: '#22C55E' },
            ].map((item, i, arr) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', boxSizing: 'border-box', transition: 'background 120ms' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{ fontSize: '16px' }}>{item.icon}</div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#E5E7EB', lineHeight: '1.4' }}>{item.title}</div>
                  <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.6', flex: 1 }}>{item.body}</div>
                  <div style={{ fontSize: '11px', color: item.color, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>{item.cta} <ArrowUpRight size={10} /></div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
