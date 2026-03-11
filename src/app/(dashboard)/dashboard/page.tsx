'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import Link from 'next/link'
import { TrendingUp, Users, BookOpen, ClipboardList, FileText, Plus, RefreshCw, AlertTriangle, CheckCircle, Circle, ArrowUpRight, Zap, Target, BarChart3, Sparkles } from 'lucide-react'
import ROIWidget from '@/components/dashboard/ROIWidget'
import { SetupAlert } from '@/components/shared/SetupBanner'
import { useUser } from '@clerk/nextjs'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'

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
  const { data: company, error: companyErr } = useSWR('/api/company', fetcher)
  const { data: competitors } = useSWR('/api/competitors', fetcher)
  const { data: caseStudies } = useSWR('/api/case-studies', fetcher)
  const { data: deals } = useSWR('/api/deals', fetcher)
  const { data: collateral } = useSWR('/api/collateral', fetcher)
  const { data: insights } = useSWR('/api/insights', fetcher)

  const dbNotConnected = isDbNotConfigured(companyErr)

  const hasCompany = !!company?.id
  const competitorCount = competitors?.length ?? 0
  const caseStudyCount = caseStudies?.length ?? 0
  const dealCount = deals?.length ?? 0
  const staleItems = (collateral ?? []).filter((c: { status: string }) => c.status === 'stale')
  const winRate = insights?.winRate ?? 0

  const steps = [
    { done: hasCompany, label: 'Complete company profile', href: '/company' },
    { done: competitorCount > 0, label: 'Add your first competitor', href: '/competitors' },
    { done: caseStudyCount > 0, label: 'Add a case study', href: '/case-studies' },
    { done: dealCount > 0, label: 'Log your first deal', href: '/deals' },
    { done: (collateral?.length ?? 0) > 0, label: 'Generate first collateral', href: '/collateral' },
  ]
  const completedSteps = steps.filter(s => s.done).length
  const healthPct = Math.round((completedSteps / steps.length) * 100)
  const recentCollateral = (collateral ?? []).slice(0, 5)

  const firstName = user?.firstName
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greeting = firstName ? `${timeGreeting}, ${firstName}` : 'Dashboard'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: '4px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.04em', color: '#F0EEFF', marginBottom: '4px', background: 'linear-gradient(135deg, #F0EEFF, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {greeting}
          </h1>
          <p style={{ fontSize: '13px', color: '#9CA3AF' }}>Your sales intelligence hub</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/deals" style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px',
            background: 'rgba(18,12,32,0.7)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(124,58,237,0.18)',
            borderRadius: '9px', color: '#F0EEFF', fontSize: '13px', fontWeight: '500', textDecoration: 'none',
          }}>
            <Plus size={13} /> Log Deal
          </Link>
          <Link href="/collateral" style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px',
            background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
            boxShadow: '0 0 24px rgba(99,102,241,0.35)',
            borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none',
          }}>
            <Sparkles size={13} /> Generate
          </Link>
        </div>
      </div>

      {/* DB setup alert */}
      {dbNotConnected && <SetupAlert />}

      {/* Stale alert */}
      {staleItems.length > 0 && (
        <div style={{
          background: 'rgba(234,179,8,0.05)',
          border: '1px solid rgba(234,179,8,0.15)',
          borderRadius: '10px', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '30px', height: '30px', background: 'rgba(234,179,8,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={13} color="#EAB308" />
            </div>
            <span style={{ fontSize: '13px', color: '#F0EEFF' }}>
              <strong style={{ color: '#EAB308' }}>{staleItems.length}</strong> collateral {staleItems.length === 1 ? 'item needs' : 'items need'} regenerating
            </span>
          </div>
          <Link href="/collateral?status=stale" style={{ fontSize: '12px', color: '#EAB308', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
            View all <ArrowUpRight size={11} />
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard label="Competitors tracked" value={competitorCount} icon={Users} color="#8B5CF6" featured />
        <StatCard label="Case studies" value={caseStudyCount} icon={BookOpen} color="#22C55E" />
        <StatCard label="Deals logged" value={dealCount} icon={ClipboardList} color="#F59E0B" />
        <StatCard label="Win rate" value={`${winRate}%`} icon={TrendingUp} color="#22C55E" />
      </div>

      {/* ROI Widget */}
      <ROIWidget
        deals={(deals ?? []).map((d: { outcome: 'won' | 'lost' | 'open'; dealValue?: number | null; competitors?: string[] }) => ({
          outcome: d.outcome,
          dealValue: d.dealValue,
          competitors: d.competitors,
        }))}
        collateralCount={collateral?.length ?? 0}
      />

      {/* Main content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 288px', gap: '14px', alignItems: 'start' }}>

        {/* Collateral table */}
        <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', background: 'rgba(99,102,241,0.1)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={13} color="#818CF8" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>Collateral Library</span>
              {(collateral?.length ?? 0) > 0 && (
                <span style={{ fontSize: '11px', color: '#555', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.06)' }}>{collateral?.length}</span>
              )}
            </div>
            <Link href="/collateral" style={{ fontSize: '12px', color: '#6366F1', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
              View all <ArrowUpRight size={11} />
            </Link>
          </div>

          {recentCollateral.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 24px' }}>
              <div style={{ width: '52px', height: '52px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Sparkles size={22} color="#6366F1" />
              </div>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '6px', fontWeight: '600' }}>No collateral yet</div>
              <div style={{ fontSize: '12px', color: '#444', marginBottom: '20px', lineHeight: '1.6' }}>Generate AI-powered battlecards, one-pagers,<br />email sequences and more</div>
              <Link href="/collateral" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', color: '#818CF8', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
                <Plus size={13} /> Generate first
              </Link>
            </div>
          ) : (
            <div>
              {recentCollateral.map((item: { id: string; title: string; type: string; status: string }, i: number) => {
                const typeStyle = TYPE_COLORS[item.type] ?? TYPE_COLORS['battlecard']
                return (
                  <Link key={item.id} href={`/collateral/${item.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '13px 20px',
                    borderBottom: i < recentCollateral.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                    textDecoration: 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                      background: typeStyle.bg, border: `1px solid ${typeStyle.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <FileText size={14} color={typeStyle.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#F0EEFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>{item.title}</div>
                      <span style={{ fontSize: '11px', color: typeStyle.color, background: typeStyle.bg, border: `1px solid ${typeStyle.border}`, padding: '1px 7px', borderRadius: '100px', fontWeight: '500' }}>
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

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* KB Health */}
          <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: '14px', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{ width: '26px', height: '26px', background: 'rgba(99,102,241,0.1)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={12} color="#818CF8" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>Knowledge Base</span>
              <span style={{ marginLeft: 'auto', fontSize: '13px', color: healthPct === 100 ? '#22C55E' : '#6366F1', fontWeight: '700' }}>{healthPct}%</span>
            </div>
            <div style={{ height: '3px', background: '#1A1A1A', borderRadius: '2px', marginBottom: '14px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${healthPct}%`,
                background: healthPct === 100 ? 'linear-gradient(90deg, #22C55E, #16A34A)' : 'linear-gradient(90deg, #6366F1, #818CF8)',
                borderRadius: '2px', transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: healthPct > 0 ? `0 0 8px ${healthPct === 100 ? 'rgba(34,197,94,0.4)' : 'rgba(99,102,241,0.4)'}` : 'none',
              }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {steps.map(s => <HealthItem key={s.href} {...s} />)}
            </div>
            {completedSteps < steps.length && (
              <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <Zap size={11} color="#818CF8" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#818CF8', lineHeight: '1.6' }}>Complete your KB for significantly better AI outputs</span>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: '14px', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{ width: '26px', height: '26px', background: 'rgba(99,102,241,0.1)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={12} color="#818CF8" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>Quick Actions</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { href: '/deals', label: 'Log a Deal', icon: ClipboardList, color: '#F59E0B', desc: 'Record a win or loss' },
                { href: '/competitors', label: 'Track Competitor', icon: Users, color: '#6366F1', desc: 'Add competitive intel' },
                { href: '/collateral', label: 'Generate Collateral', icon: RefreshCw, color: '#22C55E', desc: 'AI battlecards & more' },
              ].map(({ href, label, icon: Icon, color, desc }) => (
                <Link key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '9px', textDecoration: 'none',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.045)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'
                }}
                >
                  <div style={{ width: '30px', height: '30px', background: `${color}12`, border: `1px solid ${color}22`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={13} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#F0EEFF' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{desc}</div>
                  </div>
                  <ArrowUpRight size={12} color="#333" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
