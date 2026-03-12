'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Users, BookOpen, ClipboardList, FileText, Plus, RefreshCw, AlertTriangle, CheckCircle, Circle, ArrowUpRight, Zap, Target, BarChart3, Sparkles, Copy, Check, Map } from 'lucide-react'
import ROIWidget from '@/components/dashboard/ROIWidget'
import AIOverviewCard from '@/components/dashboard/AIOverviewCard'
import { SetupAlert } from '@/components/shared/SetupBanner'
import { useUser } from '@clerk/nextjs'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'
import { useToast } from '@/components/shared/Toast'

function StatCard({ label, value, icon: Icon, color, trend, featured }: { label: string; value: string | number; icon: React.ElementType; color: string; trend?: string; featured?: boolean }) {
  return (
    <div
      style={{
        position: 'relative',
        background: 'rgba(18,12,32,0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: featured
          ? '1px solid rgba(139,92,246,0.45)'
          : '1px solid rgba(124,58,237,0.18)',
        borderRadius: '14px',
        padding: '20px',
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.15s',
        cursor: 'default',
        boxShadow: featured
          ? '0 0 30px rgba(99,102,241,0.2), inset 0 1px 0 rgba(139,92,246,0.2)'
          : 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = featured ? 'rgba(139,92,246,0.65)' : `${color}55`
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = featured ? 'rgba(139,92,246,0.45)' : 'rgba(124,58,237,0.18)'
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
      }}
    >
      {/* Corner radial gradient */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', background: `radial-gradient(circle at top right, ${color}18, transparent 65%)`, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
        {/* Icon in glass container */}
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: `rgba(18,12,32,0.8)`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 12px ${color}18`,
        }}>
          <Icon size={16} color={color} />
        </div>
        {trend && (
          <span style={{ fontSize: '11px', color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.18)', padding: '2px 8px', borderRadius: '100px', fontWeight: '600' }}>
            {trend}
          </span>
        )}
      </div>
      {/* Large number value */}
      <div style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.04em', color: '#F0EEFF', lineHeight: 1, marginBottom: '6px' }}>{value}</div>
      {/* Small label */}
      <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: '500', letterSpacing: '0.01em' }}>{label}</div>
    </div>
  )
}

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

  const dbNotConnected = isDbNotConfigured(companyErr)

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

  // KB intelligence counters
  const meetingsLogged = dealList.filter(d => d.todos && (d.todos as unknown[]).length > 0).length
  const totalObjections = (companyData?.commonObjections as string[] | null)?.length ?? 0

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: '4px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.04em', color: '#F0EEFF', marginBottom: '4px', background: 'linear-gradient(135deg, #F0EEFF, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {greeting}
          </h1>
          <p style={{ fontSize: '13px', color: '#9CA3AF' }}>AI-powered deal conversion · {openDeals} open deal{openDeals !== 1 ? 's' : ''} in pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/pipeline" style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(124,58,237,0.18)',
            borderRadius: '9px', color: '#F0EEFF', fontSize: '13px', fontWeight: '500', textDecoration: 'none',
          }}>
            <Target size={13} /> Pipeline
          </Link>
          <Link href="/deals" style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(124,58,237,0.18)',
            borderRadius: '9px', color: '#F0EEFF', fontSize: '13px', fontWeight: '500', textDecoration: 'none',
          }}>
            <Plus size={13} /> Log Deal
          </Link>
          <Link href="/collateral" style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
            boxShadow: '0 0 24px rgba(99,102,241,0.35)',
            borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none',
          }}>
            <Sparkles size={13} /> Generate
          </Link>
        </div>
      </div>

      {/* AI Overview — refreshes daily, summarises pipeline + key actions */}
      <AIOverviewCard />

      {/* Setup progress banner — shown until all steps complete */}
      {healthPct < 100 && !dbNotConnected && (
        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={13} color="#818CF8" />
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#F0EEFF' }}>Get DealKit set up</span>
              <span style={{ fontSize: '11px', color: '#6366F1', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '1px 7px', borderRadius: '100px', fontWeight: '600' }}>{completedSteps}/{steps.length} done</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '80px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${healthPct}%`, height: '100%', background: 'linear-gradient(90deg, #6366F1, #818CF8)', borderRadius: '2px' }} />
              </div>
              <span style={{ fontSize: '11px', color: '#555', fontWeight: '600' }}>{healthPct}%</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {steps.map((step, i) => (
              step.done ? (
                <div key={step.href} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', fontSize: '12px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', color: '#22C55E', opacity: 0.6 }}>
                  <CheckCircle size={11} /> {step.label}
                </div>
              ) : (
                <Link key={step.href} href={step.href} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '7px 11px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.3)', color: '#EBEBEB', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#818CF8', fontWeight: '700', flexShrink: 0 }}>{i + 1}</span>
                    {step.label} →
                  </div>
                  <div style={{ fontSize: '10px', color: '#818CF8', paddingLeft: '22px', lineHeight: '1.3' }}>{step.unlock}</div>
                </Link>
              )
            ))}
          </div>
        </div>
      )}

      {/* Smart AI nudges — contextual suggestions based on current data */}
      {smartNudges.length > 0 && !dbNotConnected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {smartNudges.slice(0, 2).map((nudge, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: 'rgba(18,12,32,0.6)', border: `1px solid ${nudge.color}22`, borderRadius: '10px', borderLeft: `3px solid ${nudge.color}` }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{nudge.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '13px', color: '#EBEBEB', lineHeight: '1.5' }}>{nudge.message}</span>
              </div>
              <Link href={nudge.href} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', color: nudge.color, background: `${nudge.color}14`, border: `1px solid ${nudge.color}30`, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                {nudge.cta} <ArrowUpRight size={11} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {dbNotConnected && <SetupAlert />}
      {staleItems.length > 0 && (
        <div style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.15)', borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
        const bg = isRed ? 'rgba(239,68,68,0.05)' : alert.type === 'recurring_risk' ? 'rgba(168,85,247,0.05)' : 'rgba(234,179,8,0.05)'
        const border = isRed ? 'rgba(239,68,68,0.15)' : alert.type === 'recurring_risk' ? 'rgba(168,85,247,0.15)' : 'rgba(234,179,8,0.15)'
        const href = alert.type === 'recurring_risk' ? '/product-gaps' : '/collateral'
        const cta = alert.type === 'recurring_risk' ? 'View gaps' : 'Update battlecard'
        return (
          <div key={i} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
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

      {/* KPI stats — outcome-focused, shown first */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard label="Open deals" value={openDeals} icon={Target} color="#8B5CF6" featured />
        <StatCard label="Deals won" value={wonDeals} icon={TrendingUp} color="#22C55E" />
        <StatCard label="Win rate" value={`${winRate}%`} icon={BarChart3} color="#6366F1" />
        <StatCard label="AI collateral" value={collateralList.length} icon={FileText} color="#F59E0B" />
      </div>

      {/* ROI strip — full width, right below KPIs */}
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

      {/* Priority actions — sorted by deal stage */}
      {urgentTodos.length > 0 && (
        <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid rgba(124,58,237,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', background: 'rgba(99,102,241,0.12)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={12} color="#818CF8" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>Priority Actions</span>
              <span style={{ fontSize: '11px', color: '#818CF8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '1px 7px', borderRadius: '100px', fontWeight: '600' }}>{urgentTodos.length}</span>
              <span style={{ fontSize: '11px', color: '#444' }}>· sorted by deal stage</span>
            </div>
            <Link href="/pipeline" style={{ fontSize: '12px', color: '#6366F1', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
              View pipeline <ArrowUpRight size={11} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {urgentTodos.map((todo, i) => {
              const stageInfo = STAGE_STYLE[todo.stage] ?? { color: '#6B7280', label: todo.stage }
              return (
                <Link key={todo.id} href={`/deals/${todo.dealId}`} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px',
                  borderBottom: i < urgentTodos.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  textDecoration: 'none', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: stageInfo.color, flexShrink: 0, boxShadow: `0 0 6px ${stageInfo.color}80` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: '#EBEBEB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.text}</div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{todo.company}</div>
                  </div>
                  <span style={{
                    fontSize: '10px', padding: '2px 7px', borderRadius: '100px', fontWeight: '600', flexShrink: 0,
                    color: stageInfo.color, background: `${stageInfo.color}14`, border: `1px solid ${stageInfo.color}30`,
                  }}>
                    {stageInfo.label}
                  </span>
                  <ArrowUpRight size={11} color="#333" style={{ flexShrink: 0 }} />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 288px', gap: '14px', alignItems: 'start' }}>

        {/* Left: Collateral Library + Roadmap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', background: 'rgba(99,102,241,0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={12} color="#818CF8" />
                </div>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>Recent Collateral</span>
                {collateralList.length > 0 && (
                  <span style={{ fontSize: '11px', color: '#555', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.06)' }}>{collateralList.length}</span>
                )}
              </div>
              <Link href="/collateral" style={{ fontSize: '12px', color: '#6366F1', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
                View all <ArrowUpRight size={11} />
              </Link>
            </div>

            {recentCollateral.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ width: '44px', height: '44px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Sparkles size={18} color="#6366F1" />
                </div>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '4px', fontWeight: '600' }}>No collateral yet</div>
                <div style={{ fontSize: '12px', color: '#444', marginBottom: '4px', lineHeight: '1.6' }}>Battlecards, one-pagers, email sequences — personalised to your deals</div>
                <div style={{ fontSize: '11px', color: '#6366F1', marginBottom: '16px' }}>Takes 30 seconds vs. 2+ hours manually</div>
                <Link href="/collateral" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', color: '#818CF8', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
                  <Plus size={13} /> Generate first
                </Link>
              </div>
            ) : (
              <div>
                {recentCollateral.map((item: { id: string; title: string; type: string; status: string }, i: number) => {
                  const typeStyle = TYPE_COLORS[item.type] ?? TYPE_COLORS['battlecard']
                  return (
                    <Link key={item.id} href={`/collateral/${item.id}`} style={{
                      display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 20px',
                      borderBottom: i < recentCollateral.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                      textDecoration: 'none', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0, background: typeStyle.bg, border: `1px solid ${typeStyle.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={13} color={typeStyle.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#F0EEFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>{item.title}</div>
                        <span style={{ fontSize: '11px', color: typeStyle.color, background: typeStyle.bg, border: `1px solid ${typeStyle.border}`, padding: '1px 6px', borderRadius: '100px', fontWeight: '500' }}>
                          {TYPE_LABELS[item.type] ?? item.type.replace('_', ' ')}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '11px', padding: '3px 9px', borderRadius: '100px', fontWeight: '500', flexShrink: 0,
                        background: item.status === 'ready' ? 'rgba(34,197,94,0.08)' : item.status === 'stale' ? 'rgba(234,179,8,0.08)' : 'rgba(99,102,241,0.08)',
                        color: item.status === 'ready' ? '#22C55E' : item.status === 'stale' ? '#EAB308' : '#818CF8',
                        border: `1px solid ${item.status === 'ready' ? 'rgba(34,197,94,0.18)' : item.status === 'stale' ? 'rgba(234,179,8,0.18)' : 'rgba(99,102,241,0.18)'}`,
                      }}>
                        {item.status === 'generating' ? '⟳ generating' : item.status}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Roadmap — Now / Next / Later */}
          {(roadmapNow.length > 0 || roadmapNext.length > 0 || roadmapLater.length > 0) && (
            <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '24px', height: '24px', background: 'rgba(99,102,241,0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Map size={12} color="#818CF8" />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>Product Roadmap</span>
                </div>
                <Link href="/product-gaps" style={{ fontSize: '12px', color: '#6366F1', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  Manage <ArrowUpRight size={11} />
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', borderBottom: 'none' }}>
                {[
                  { label: 'Now', items: roadmapNow, color: '#22C55E', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.15)', dot: '#22C55E' },
                  { label: 'Next', items: roadmapNext, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', dot: '#F59E0B' },
                  { label: 'Later', items: roadmapLater, color: '#6366F1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.15)', dot: '#818CF8' },
                ].map(({ label, items, color, bg, border, dot }, colIdx) => (
                  <div key={label} style={{ padding: '14px 16px', borderRight: colIdx < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
                      {items.length > 0 && (
                        <span style={{ fontSize: '10px', color, background: bg, border: `1px solid ${border}`, padding: '1px 6px', borderRadius: '100px', fontWeight: '600' }}>{items.length}</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* KB Health */}
          <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '24px', height: '24px', background: 'rgba(99,102,241,0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={12} color="#818CF8" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>AI Setup</span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: healthPct === 100 ? '#22C55E' : '#555', fontWeight: '600', background: healthPct === 100 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${healthPct === 100 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`, padding: '1px 7px', borderRadius: '100px' }}>{healthPct}%</span>
            </div>
            <div style={{ height: '3px', background: '#1A1A1A', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${healthPct}%`, background: healthPct === 100 ? 'linear-gradient(90deg, #22C55E, #16A34A)' : 'linear-gradient(90deg, #6366F1, #818CF8)', borderRadius: '2px', transition: 'width 1s cubic-bezier(0.4,0,0.2,1)', boxShadow: healthPct > 0 ? `0 0 8px ${healthPct === 100 ? 'rgba(34,197,94,0.4)' : 'rgba(99,102,241,0.4)'}` : 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {steps.map(s => <HealthItem key={s.href} {...s} />)}
            </div>
            {completedSteps < steps.length && (
              <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: '7px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <Zap size={10} color="#818CF8" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#818CF8', lineHeight: '1.5' }}>
                  {steps.find(s => !s.done)?.unlock ?? 'Complete your setup for the best AI outputs'}
                </span>
              </div>
            )}
          </div>

          {/* Team card */}
          <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '14px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '24px', height: '24px', background: 'rgba(99,102,241,0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={12} color="#818CF8" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF', flex: 1 }}>Team</span>
              <Link href="/settings" style={{ fontSize: '11px', color: '#555', textDecoration: 'none' }}>Settings →</Link>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' }}>Your invite code</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <code style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: '#818CF8', background: 'rgba(99,102,241,0.1)', padding: '5px 9px', borderRadius: '7px', border: '1px solid rgba(99,102,241,0.25)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dbUser?.workspaceSlug ?? '…'}
                </code>
                <button onClick={handleCopyCode} title="Copy code" style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '7px', background: codeCopied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', border: codeCopied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: codeCopied ? '#22C55E' : '#888', transition: 'all 150ms' }}>
                  {codeCopied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
              <p style={{ fontSize: '10px', color: '#444', margin: '4px 0 0', lineHeight: 1.5 }}>Share with teammates to invite them</p>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
              <p style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' }}>Join a workspace</p>
              <form onSubmit={handleJoinWorkspace} style={{ display: 'flex', gap: '6px' }}>
                <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter code (e.g. crane-47)" style={{ flex: 1, height: '28px', padding: '0 9px', borderRadius: '7px', fontSize: '11px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#F1F1F3', outline: 'none', fontFamily: 'inherit', minWidth: 0 }} onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')} />
                <button type="submit" disabled={joining || !joinCode.trim()} style={{ height: '28px', padding: '0 10px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', border: 'none', cursor: joining || !joinCode.trim() ? 'not-allowed' : 'pointer', opacity: joining || !joinCode.trim() ? 0.5 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {joining ? '…' : 'Join'}
                </button>
              </form>
            </div>
          </div>

          {/* Sales Brain — KB intelligence */}
          <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: '14px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '24px', height: '24px', background: 'rgba(99,102,241,0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={12} color="#818CF8" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>Sales Brain</span>
              <span style={{ fontSize: '10px', color: '#444', marginLeft: '2px' }}>what the KB knows</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                { href: '/competitors', label: 'Competitors mapped', value: competitorCount, color: '#6366F1', icon: Users, empty: 'Add competitor →', hint: 'Powers battlecards' },
                { href: '/deals', label: 'Deals in pipeline', value: dealCount, color: '#8B5CF6', icon: TrendingUp, empty: 'Log first deal →', hint: 'Tracks win rate' },
                { href: '/case-studies', label: 'Win stories', value: caseStudyCount, color: '#22C55E', icon: BookOpen, empty: 'Add case study →', hint: 'Strengthens pitches' },
                { href: '/collateral', label: 'Collateral generated', value: collateralList.length, color: '#F59E0B', icon: FileText, empty: 'Generate first →', hint: 'AI sales docs' },
                { href: '/product-gaps', label: 'Feature gaps tracked', value: gapList.length, color: '#EF4444', icon: AlertTriangle, empty: 'None logged yet', hint: 'Blocked revenue' },
              ].map(({ href, label, value, color, icon: Icon, empty, hint }) => (
                <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '7px', textDecoration: 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                >
                  <div style={{ width: '24px', height: '24px', background: `${color}12`, border: `1px solid ${color}20`, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={11} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: '#888' }}>{label}</div>
                    <div style={{ fontSize: '10px', color: '#444', marginTop: '1px' }}>{hint}</div>
                  </div>
                  {value > 0
                    ? <span style={{ fontSize: '14px', fontWeight: '700', color, letterSpacing: '-0.02em' }}>{value}</span>
                    : <span style={{ fontSize: '11px', color: '#444' }}>{empty}</span>
                  }
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Value chain explainer — shown for early-stage users */}
      {dealCount < 5 && !dbNotConnected && (
        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(124,58,237,0.09) 100%)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '14px', padding: '14px 18px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div style={{ width: '26px', height: '26px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(99,102,241,0.3)' }}>
              <Zap size={12} color="#fff" />
            </div>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#F0EEFF', letterSpacing: '-0.01em' }}>How DealKit saves you time</span>
            <span style={{ fontSize: '11px', color: '#A78BFA', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', padding: '2px 8px', borderRadius: '100px', fontWeight: '600' }}>fastest path to ROI</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[
              {
                icon: '⚔️',
                title: 'Competitive call comes up',
                body: 'Pull up a battlecard in seconds. Exact talk tracks, objection responses, and win angles — all AI-generated from your competitor data.',
                href: '/competitors',
                cta: 'Add a competitor',
                color: '#6366F1',
              },
              {
                icon: '📋',
                title: 'Just finished a sales call',
                body: 'Paste your notes into any deal. AI extracts action items, updates the deal score, and flags risks — no manual logging required.',
                href: '/deals',
                cta: 'Open a deal',
                color: '#F59E0B',
              },
              {
                icon: '📄',
                title: 'Prospect wants a one-pager',
                body: 'Generate a personalised, branded sales doc in 30 seconds. Pulls in your case studies, product strengths, and competitive position automatically.',
                href: '/collateral',
                cta: 'Generate collateral',
                color: '#22C55E',
              },
            ].map(item => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'rgba(9,6,18,0.4)', border: '1px solid rgba(124,58,237,0.12)', borderRadius: '10px', padding: '14px', transition: 'border-color 0.15s', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${item.color}33`}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.12)'}
                >
                  <div style={{ fontSize: '18px' }}>{item.icon}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#F0EEFF', lineHeight: '1.4' }}>{item.title}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1.6', flex: 1 }}>{item.body}</div>
                  <div style={{ fontSize: '11px', color: item.color, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>{item.cta} <ArrowUpRight size={10} /></div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
