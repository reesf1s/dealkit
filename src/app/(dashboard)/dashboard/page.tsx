'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import Link from 'next/link'
import { useState } from 'react'
import { TrendingUp, Users, BookOpen, ClipboardList, FileText, Plus, RefreshCw, AlertTriangle, CheckCircle, Circle, ArrowUpRight, Zap, Target, BarChart3, Sparkles, Copy, Check } from 'lucide-react'
import ROIWidget from '@/components/dashboard/ROIWidget'
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

  const dbNotConnected = isDbNotConfigured(companyErr)

  // APIs return { data: ... } — unwrap correctly
  const companyData = company?.data
  const competitorList: { id: string }[] = competitors?.data ?? []
  const caseStudyList: { id: string }[] = caseStudies?.data ?? []
  const dealList: { id: string; stage: string; dealName: string; prospectCompany: string; todos: { id: string; text: string; done: boolean }[] }[] = deals?.data ?? []
  const collateralList: { id: string; title: string; type: string; status: string }[] = collateral?.data ?? []
  const insightsData = insights?.data

  const hasCompany = !!companyData?.id
  const competitorCount = competitorList.length
  const caseStudyCount = caseStudyList.length
  const dealCount = dealList.length
  const staleItems = collateralList.filter(c => c.status === 'stale')
  const winRate = insightsData?.winRate ?? 0

  // Outcome stats
  const openDeals = dealList.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length
  const wonDeals = dealList.filter(d => d.stage === 'closed_won').length

  // Urgent todos: undone todos from open deals
  const urgentTodos = dealList
    .filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .flatMap(d => (d.todos ?? []).filter(t => !t.done).map(t => ({ ...t, dealName: d.dealName, dealId: d.id, company: d.prospectCompany })))
    .slice(0, 6)

  const steps = [
    { done: hasCompany, label: 'Complete company profile', href: '/company' },
    { done: competitorCount > 0, label: 'Add your first competitor', href: '/competitors' },
    { done: caseStudyCount > 0, label: 'Add a case study', href: '/case-studies' },
    { done: dealCount > 0, label: 'Log your first deal', href: '/deals' },
    { done: collateralList.length > 0, label: 'Generate first collateral', href: '/collateral' },
  ]
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

      {/* KPI stats — outcome-focused, shown first */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard label="Open deals" value={openDeals} icon={Target} color="#8B5CF6" featured />
        <StatCard label="Deals won" value={wonDeals} icon={TrendingUp} color="#22C55E" />
        <StatCard label="Win rate" value={`${winRate}%`} icon={BarChart3} color="#6366F1" />
        <StatCard label="AI collateral" value={collateralList.length} icon={FileText} color="#F59E0B" />
      </div>

      {/* Urgent todos — most actionable */}
      {urgentTodos.length > 0 && (
        <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={12} color="#EF4444" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>Open Action Items</span>
              <span style={{ fontSize: '11px', color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '1px 7px', borderRadius: '100px', fontWeight: '600' }}>{urgentTodos.length}</span>
            </div>
            <Link href="/pipeline" style={{ fontSize: '12px', color: '#EF4444', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
              View pipeline <ArrowUpRight size={11} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {urgentTodos.map((todo, i) => (
              <Link key={todo.id} href={`/deals/${todo.dealId}`} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 18px',
                borderBottom: i < urgentTodos.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                textDecoration: 'none', transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.03)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#EF4444', flexShrink: 0, marginTop: '6px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: '#EBEBEB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.text}</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{todo.company}</div>
                </div>
                <ArrowUpRight size={11} color="#333" style={{ flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 288px', gap: '14px', alignItems: 'start' }}>

        {/* Left: Collateral Library + ROI */}
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
                <div style={{ fontSize: '12px', color: '#444', marginBottom: '16px', lineHeight: '1.6' }}>AI-powered battlecards, one-pagers, email sequences and more</div>
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

          {/* ROI Widget */}
          <ROIWidget
            deals={dealList.map((d: { stage: string; dealValue?: number | null; competitors?: string[] }) => ({
              outcome: d.stage === 'closed_won' ? 'won' : d.stage === 'closed_lost' ? 'lost' : 'open',
              dealValue: d.dealValue,
              competitors: d.competitors ?? [],
            }))}
            collateralCount={collateralList.length}
          />
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
              <span style={{ marginLeft: 'auto', fontSize: '13px', color: healthPct === 100 ? '#22C55E' : '#6366F1', fontWeight: '700' }}>{healthPct}%</span>
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
                <span style={{ fontSize: '11px', color: '#818CF8', lineHeight: '1.5' }}>Complete your setup for better AI outputs</span>
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

          {/* Quick actions */}
          <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: '14px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '24px', height: '24px', background: 'rgba(99,102,241,0.1)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={12} color="#818CF8" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>Quick Actions</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                { href: '/deals', label: 'Log a Deal', icon: ClipboardList, color: '#F59E0B', desc: 'Paste notes, AI scores it' },
                { href: '/competitors', label: 'Track Competitor', icon: Users, color: '#6366F1', desc: 'Generate battlecard' },
                { href: '/collateral', label: 'Generate Collateral', icon: RefreshCw, color: '#22C55E', desc: 'AI battlecards & more' },
              ].map(({ href, label, icon: Icon, color, desc }) => (
                <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', textDecoration: 'none', transition: 'background 0.1s, border-color 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.045)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)' }}
                >
                  <div style={{ width: '28px', height: '28px', background: `${color}12`, border: `1px solid ${color}22`, borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={12} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#F0EEFF' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{desc}</div>
                  </div>
                  <ArrowUpRight size={11} color="#333" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI How-to callout — compact, shown at bottom for new users only */}
      {dealCount < 5 && (
        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(124,58,237,0.09) 100%)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '14px', padding: '14px 18px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '26px', height: '26px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(99,102,241,0.3)' }}>
              <Zap size={12} color="#fff" />
            </div>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#F0EEFF', letterSpacing: '-0.01em' }}>Getting started with DealKit</span>
            <span style={{ fontSize: '11px', color: '#A78BFA', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', padding: '2px 8px', borderRadius: '100px', fontWeight: '600' }}>3 key workflows</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[
              { icon: '📋', title: 'Paste meeting notes → AI action plan', href: '/deals', cta: 'Open a deal →', color: '#F59E0B' },
              { icon: '⚔️', title: 'AI battlecards for every competitor', href: '/competitors', cta: 'Add competitor →', color: '#6366F1' },
              { icon: '🎯', title: 'AI conversion score + next steps', href: '/pipeline', cta: 'View pipeline →', color: '#22C55E' },
            ].map(item => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'rgba(9,6,18,0.4)', border: '1px solid rgba(124,58,237,0.12)', borderRadius: '10px', padding: '12px', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${item.color}33`}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.12)'}
                >
                  <div style={{ fontSize: '18px', marginBottom: '6px' }}>{item.icon}</div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#F0EEFF', marginBottom: '8px', lineHeight: '1.4' }}>{item.title}</div>
                  <div style={{ fontSize: '11px', color: item.color, fontWeight: '600' }}>{item.cta}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
