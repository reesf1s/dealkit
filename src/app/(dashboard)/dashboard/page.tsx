'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, AlertTriangle, CheckCircle, Circle, ArrowUpRight,
  Sparkles, Zap, FileText, TrendingUp, Activity, RefreshCw,
} from 'lucide-react'
import AIOverviewCard from '@/components/dashboard/AIOverviewCard'
import { SetupAlert } from '@/components/shared/SetupBanner'
import { useUser } from '@clerk/nextjs'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'
import { annualizedValue } from '@/components/dashboard/ROIWidget'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

const STAGE_ORDER = ['prospecting', 'qualification', 'discovery', 'proposal', 'negotiation']
const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prospecting', qualification: 'Qualification', discovery: 'Discovery',
  proposal: 'Proposal', negotiation: 'Negotiation',
}
const STAGE_COLOR: Record<string, string> = {
  prospecting: '#6B7280', qualification: '#3B82F6', discovery: '#8B5CF6',
  proposal: '#F59E0B', negotiation: '#EF4444',
}

function SetupItem({ done, label, href }: { done: boolean; label: string; href: string }) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', padding: '6px 10px', borderRadius: '7px', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      {done
        ? <CheckCircle size={13} color="#22C55E" style={{ flexShrink: 0 }} />
        : <Circle size={13} color="#2A2A2A" style={{ flexShrink: 0 }} />}
      <span style={{ fontSize: '12px', color: done ? '#444' : '#EBEBEB', textDecoration: done ? 'line-through' : 'none', flex: 1 }}>{label}</span>
      {!done && <ArrowUpRight size={11} color="#444" />}
    </Link>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useUser()
  const router = useRouter()

  const { data: company, error: companyErr } = useSWR('/api/company', fetcher)
  const { data: competitors } = useSWR('/api/competitors', fetcher)
  const { data: caseStudies } = useSWR('/api/case-studies', fetcher)
  const { data: deals } = useSWR('/api/deals', fetcher)
  const { data: collateral } = useSWR('/api/collateral', fetcher)
  const { data: insights } = useSWR('/api/insights', fetcher)
  const { data: brainRes, mutate: mutateBrain } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })

  const dbNotConnected = isDbNotConfigured(companyErr)
  const [refreshingBrain, setRefreshingBrain] = useState(false)
  const brainRebuildAttempted = useRef(false)

  async function rebuildBrain() {
    setRefreshingBrain(true)
    try {
      await fetch('/api/brain', { method: 'POST' })
      await mutateBrain()
    } catch { /* non-fatal */ }
    finally { setRefreshingBrain(false) }
  }

  // Auto-rebuild brain if: never built, old schema (missing pipelineRecommendations),
  // or patterns stored in old string[] format
  useEffect(() => {
    if (brainRebuildAttempted.current) return
    const brain = brainRes?.data
    // brainRes loaded but brain is null → never built yet
    if (brainRes && !brain) {
      brainRebuildAttempted.current = true
      rebuildBrain()
      return
    }
    if (!brain) return
    // Old snapshot missing newer fields, or patterns in legacy string format
    const hasOldSchema = !brain.pipelineRecommendations
    const hasOldPatterns = (brain.keyPatterns ?? []).some((p: any) => typeof p === 'string')
    // Patterns exist but none have riskSnippets — rebuild after new feature deployed
    const missingSnippets = (brain.keyPatterns ?? []).length > 0 &&
      !(brain.keyPatterns ?? []).some((p: any) => p.riskSnippets?.length > 0)
    if (hasOldSchema || hasOldPatterns || missingSnippets) {
      brainRebuildAttempted.current = true
      rebuildBrain()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brainRes])

  // Redirect new users to onboarding if no company profile
  useEffect(() => {
    if (company === undefined) return
    if (dbNotConnected) return
    if (!company?.data?.companyName) router.replace('/onboarding')
  }, [company, dbNotConnected, router])

  // ── Unwrap data ────────────────────────────────────────────────────────────
  const companyData = company?.data
  const dealList: any[] = deals?.data ?? []
  const collateralList: any[] = collateral?.data ?? []
  const insightsData = insights?.data
  const brain = brainRes?.data

  const openDeals = dealList.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const wonDeals  = dealList.filter(d => d.stage === 'closed_won')
  const winRate   = insightsData?.winRate ?? 0

  // Revenue KPIs
  const pipeline   = openDeals.reduce((s, d) => s + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0)
  const wonRevenue = wonDeals.reduce((s, d) => s + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0)
  const allWithVal = dealList.filter(d => d.dealValue && d.dealValue > 0)
  const avgDeal    = allWithVal.length ? allWithVal.reduce((s, d) => s + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0) / allWithVal.length : 0

  // ── Pipeline by stage ─────────────────────────────────────────────────────
  const stageMap: Record<string, number> = {}
  for (const d of openDeals) stageMap[d.stage] = (stageMap[d.stage] ?? 0) + 1

  // ── Needs Attention list (urgent + stale + top todos) ─────────────────────
  const STAGE_PRIORITY: Record<string, number> = { negotiation: 5, proposal: 4, discovery: 3, qualification: 2, prospecting: 1 }

  const urgentItems: { dealId: string; company: string; label: string; sublabel: string; color: string }[] = [
    ...(brain?.urgentDeals ?? []).map((u: any) => ({
      dealId: u.dealId, company: u.company,
      label: u.company, sublabel: u.reason,
      color: '#EF4444',
    })),
    ...(brain?.staleDeals ?? []).slice(0, 3).map((s: any) => ({
      dealId: s.dealId, company: s.company,
      label: s.company, sublabel: `${s.daysSinceUpdate}d since last update`,
      color: '#F59E0B',
    })),
  ]

  const priorityTodos = dealList
    .filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .flatMap(d => (d.todos ?? []).filter((t: any) => !t.done).map((t: any) => ({
      ...t, dealName: d.dealName, dealId: d.id, company: d.prospectCompany,
      stage: d.stage, stagePriority: STAGE_PRIORITY[d.stage] ?? 0,
    })))
    .sort((a, b) => b.stagePriority - a.stagePriority)
    .slice(0, 5)

  const staleCollateral = collateralList.filter(c => c.status === 'stale')

  // ── Setup health ──────────────────────────────────────────────────────────
  const hasCompany = !!companyData?.id
  const setupSteps = [
    { done: hasCompany,                          label: 'Complete company profile',   href: '/company' },
    { done: (competitors?.data?.length ?? 0) > 0, label: 'Add a competitor',           href: '/competitors' },
    { done: (caseStudies?.data?.length ?? 0) > 0, label: 'Add a case study',           href: '/case-studies' },
    { done: dealList.length > 0,                 label: 'Log a deal',                 href: '/pipeline' },
    { done: collateralList.length > 0,           label: 'Generate collateral',         href: '/collateral' },
  ]
  const completedSteps = setupSteps.filter(s => s.done).length
  const healthPct = Math.round((completedSteps / setupSteps.length) * 100)

  // ── Greeting ──────────────────────────────────────────────────────────────
  const firstName = user?.firstName
  const hour = new Date().getHours()
  const greeting = firstName
    ? `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${firstName}`
    : 'Dashboard'

  const recentCollateral = collateralList.slice(0, 4)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* ── Zone 1: Header + KPI strip ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', letterSpacing: '-0.03em', color: '#F1F1F3', margin: '0 0 2px' }}>
            {greeting}
          </h1>
          <p style={{ fontSize: '12px', color: '#4B5563', margin: 0 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {openDeals.length > 0 && (
              <span style={{ color: '#374151' }}> · {openDeals.length} active deal{openDeals.length !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Link href="/pipeline" style={quickBtn(false)}>
            <Zap size={11} /> Pipeline
          </Link>
          <Link href="/pipeline" style={quickBtn(false)}>
            <Plus size={11} /> Log Deal
          </Link>
          <Link href="/collateral" style={quickBtn(true)}>
            <Sparkles size={11} /> Generate
          </Link>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Active Pipeline', value: pipeline > 0 ? fmt(pipeline) : '—', sub: `${openDeals.length} deal${openDeals.length !== 1 ? 's' : ''}`, color: '#6366F1', glow: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.15)' },
          { label: 'Revenue Won',     value: wonRevenue > 0 ? fmt(wonRevenue) : '—', sub: `${wonDeals.length} closed`, color: '#22C55E', glow: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.15)' },
          { label: 'Win Rate',        value: dealList.length > 0 ? `${winRate}%` : '—', sub: `${dealList.length} tracked`, color: '#10B981', glow: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
          { label: 'Avg Deal Size',   value: avgDeal > 0 ? fmt(avgDeal) : '—', sub: allWithVal.length > 0 ? `${allWithVal.length} deals` : 'Log deal values', color: '#F59E0B', glow: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.glow, border: `1px solid ${kpi.border}`, borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{kpi.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.04em', color: kpi.color, lineHeight: 1, marginBottom: '4px', textShadow: `0 0 20px ${kpi.color}40` }}>{kpi.value}</div>
            <div style={{ fontSize: '11px', color: '#4B5563' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Setup alert */}
      {dbNotConnected && <SetupAlert />}

      {/* ── Zone 2: AI Intelligence + Needs Attention ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '12px', alignItems: 'start' }}>

        {/* AI Intelligence — full AI Overview */}
        <AIOverviewCard />

        {/* Needs Attention */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Urgent + stale deals */}
          {urgentItems.length > 0 && (
            <div style={card}>
              <SectionHeader label="Needs Attention" count={urgentItems.length} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {urgentItems.slice(0, 5).map((item, i) => (
                  <Link key={`${item.dealId}-${i}`} href={`/deals/${item.dealId}`} style={listRow(i < Math.min(urgentItems.length, 5) - 1)}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: '#E5E7EB', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sublabel}</div>
                    </div>
                    <ArrowUpRight size={11} color="#333" style={{ flexShrink: 0 }} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Priority todos */}
          {priorityTodos.length > 0 && (
            <div style={card}>
              <SectionHeader label="Priority Actions" count={priorityTodos.length} href="/pipeline" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {priorityTodos.map((todo, i) => {
                  const c = STAGE_COLOR[todo.stage] ?? '#6B7280'
                  return (
                    <Link key={todo.id} href={`/deals/${todo.dealId}`} style={listRow(i < priorityTodos.length - 1)}>
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: c, flexShrink: 0, marginTop: '1px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: '#E5E7EB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.text}</div>
                        <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>{todo.company}</div>
                      </div>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0, color: c, background: `${c}14`, whiteSpace: 'nowrap' }}>
                        {STAGE_LABELS[todo.stage] ?? todo.stage}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stale collateral alert */}
          {staleCollateral.length > 0 && (
            <Link href="/collateral?status=stale" style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', textDecoration: 'none', transition: 'border-color 0.1s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(234,179,8,0.3)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'}
            >
              <AlertTriangle size={13} color="#EAB308" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '12px', color: '#E5E7EB' }}>
                  <strong style={{ color: '#EAB308' }}>{staleCollateral.length}</strong> collateral {staleCollateral.length === 1 ? 'item needs' : 'items need'} refresh
                </span>
              </div>
              <ArrowUpRight size={11} color="#EAB308" style={{ flexShrink: 0 }} />
            </Link>
          )}

          {/* Nothing to show */}
          {urgentItems.length === 0 && priorityTodos.length === 0 && staleCollateral.length === 0 && dealList.length > 0 && (
            <div style={{ ...card, padding: '20px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>✓</div>
              <div style={{ fontSize: '13px', color: '#4B5563', fontWeight: 500 }}>All caught up</div>
              <div style={{ fontSize: '11px', color: '#374151', marginTop: '4px' }}>No urgent deals or open actions</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Zone 2.5: Deal Trends & Intelligence ──────────────────────────── */}
      {(refreshingBrain || (brain && (brain.keyPatterns?.length > 0 || brain.pipelineRecommendations?.length > 0))) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

          {/* Key patterns — left column */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <Activity size={12} color="#A855F7" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Deal Patterns</span>
              <span style={{ fontSize: '11px', color: '#374151', marginLeft: 'auto' }}>{brain?.keyPatterns?.length ?? 0} trend{(brain?.keyPatterns?.length ?? 0) !== 1 ? 's' : ''}</span>
              <button onClick={rebuildBrain} disabled={refreshingBrain} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: refreshingBrain ? 'default' : 'pointer', padding: '2px 4px', borderRadius: '4px', color: '#374151' }}
                title="Refresh intelligence">
                <RefreshCw size={10} style={{ animation: refreshingBrain ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>

            {refreshingBrain && !brain?.keyPatterns?.length ? (
              <div style={{ padding: '20px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '12px' }}>
                <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Analysing deal patterns…
              </div>
            ) : (brain?.keyPatterns ?? []).length === 0 ? (
              <div style={{ padding: '20px 14px', fontSize: '12px', color: '#374151', textAlign: 'center' }}>
                No recurring patterns yet — patterns surface when 2+ deals share the same risk theme.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {((brain?.keyPatterns ?? []) as any[]).map((p: any, i: number) => {
                  const allPatterns = brain?.keyPatterns ?? []
                  const dealIds: string[] = p.dealIds ?? []
                  const companies: string[] = p.companies ?? []
                  const dealNames: string[] = p.dealNames ?? []
                  const competitorNames: string[] = p.competitorNames ?? []
                  const isCompetitor = p.label === 'competitor pressure'
                  const isLast = i === allPatterns.length - 1
                  return (
                    <div key={i} style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
                      {/* Pattern header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px 4px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#A855F7', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: '#E5E7EB', fontWeight: 600, textTransform: 'capitalize', flex: 1 }}>{p.label}</span>
                        {/* Competitor pills */}
                        {isCompetitor && competitorNames.length > 0 && competitorNames.map((name: string) => (
                          <Link key={name} href="/competitors" style={{
                            fontSize: '10px', fontWeight: 600, color: '#F87171',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                            padding: '1px 7px', borderRadius: '100px', textDecoration: 'none', flexShrink: 0,
                          }}>{name}</Link>
                        ))}
                        {isCompetitor && competitorNames.length === 0 && (
                          <span style={{ fontSize: '10px', color: '#6B7280', fontStyle: 'italic' }}>no competitors named</span>
                        )}
                      </div>
                      {/* Affected deals — each as its own link row */}
                      <div style={{ paddingLeft: '28px', paddingBottom: '8px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        {dealIds.map((id: string, j: number) => {
                          const riskSnippets: string[] = (p.riskSnippets ?? []).find((r: any) => r.dealId === id)?.snippets ?? []
                          return (
                            <Link key={id} href={`/deals/${id}`} style={{
                              display: 'flex', flexDirection: 'column', gap: '1px',
                              padding: '4px 14px 4px 0', textDecoration: 'none',
                              borderRadius: '4px', transition: 'background 100ms',
                            }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ArrowUpRight size={10} color="#4B5563" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>{companies[j] ?? ''}</span>
                                {dealNames[j] && companies[j] !== dealNames[j] && (
                                  <span style={{ fontSize: '10px', color: '#4B5563' }}> · {dealNames[j]}</span>
                                )}
                              </div>
                              {riskSnippets.slice(0, 1).map((snippet: string, si: number) => (
                                <div key={si} style={{ fontSize: '10px', color: '#374151', paddingLeft: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                                  &quot;{snippet}&quot;
                                </div>
                              ))}
                            </Link>
                          )
                        })}
                        {isCompetitor && competitorNames.length === 0 && dealIds.length > 0 && (
                          <Link href={`/deals/${dealIds[0]}`} style={{ fontSize: '10px', color: '#F87171', textDecoration: 'none', padding: '2px 0', opacity: 0.8 }}>
                            + add competitor names to these deals →
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pipeline recommendations — right column */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <TrendingUp size={12} color="#10B981" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recommendations</span>
              <span style={{ fontSize: '11px', color: '#374151', marginLeft: 'auto' }}>
                {(brain?.pipelineRecommendations ?? []).filter((r: any) => r.priority === 'high').length} high priority
              </span>
            </div>

            {refreshingBrain && !(brain?.pipelineRecommendations?.length) ? (
              <div style={{ padding: '20px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '12px' }}>
                <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Building recommendations…
              </div>
            ) : (brain?.pipelineRecommendations ?? []).length === 0 ? (
              <div style={{ padding: '20px 14px', fontSize: '12px', color: '#374151', textAlign: 'center' }}>
                No recommendations yet — add more deals and meeting notes to get personalised suggestions.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {((brain?.pipelineRecommendations ?? []) as any[]).map((rec: any, i: number) => {
                  const recs = brain?.pipelineRecommendations ?? []
                  const priorityColor = rec.priority === 'high' ? '#EF4444' : rec.priority === 'medium' ? '#F59E0B' : '#6B7280'
                  const isLast = i === recs.length - 1
                  return (
                    <Link key={i} href={`/deals/${rec.dealId}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 14px', borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)', textDecoration: 'none', transition: 'background 120ms' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '10px', fontWeight: 700, color: priorityColor, background: `${priorityColor}14`, padding: '2px 5px', borderRadius: '4px', flexShrink: 0, marginTop: '1px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {rec.priority}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: '#E5E7EB' }}>{rec.recommendation}</div>
                        <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                          {rec.company}{rec.dealName && rec.dealName !== rec.company ? ` · ${rec.dealName}` : ''}
                        </div>
                      </div>
                      <ArrowUpRight size={11} color="#333" style={{ flexShrink: 0, marginTop: '2px' }} />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Zone 3: Pipeline by stage ────────────────────────────────────── */}
      {openDeals.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <SectionHeaderInline label="Pipeline" />
            <Link href="/pipeline" style={{ fontSize: '11px', color: '#4B5563', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
              View board <ArrowUpRight size={10} />
            </Link>
          </div>
          <div style={{ display: 'flex', padding: '12px 14px', gap: '8px', flexWrap: 'wrap' }}>
            {STAGE_ORDER.filter(s => (stageMap[s] ?? 0) > 0).map(stage => {
              const count = stageMap[stage] ?? 0
              const color = STAGE_COLOR[stage]
              const stageDeals = openDeals.filter(d => d.stage === stage)
              const stagePipeline = stageDeals.reduce((s: number, d: any) => s + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0)
              return (
                <Link key={stage} href="/pipeline" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 14px', borderRadius: '9px', background: `${color}0d`, border: `1px solid ${color}20`, minWidth: '100px', flex: 1, transition: 'border-color 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${color}40`}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = `${color}20`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: '11px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{STAGE_LABELS[stage]}</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#F1F1F3', letterSpacing: '-0.03em' }}>{count}</div>
                  {stagePipeline > 0 && <div style={{ fontSize: '11px', color: color }}>{fmt(stagePipeline)}</div>}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Zone 4: Recent Collateral + Setup health ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: healthPct < 100 ? '1fr 280px' : '1fr', gap: '12px', alignItems: 'start' }}>

        {/* Recent Collateral */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <SectionHeaderInline label="Recent Collateral" />
            <Link href="/collateral" style={{ fontSize: '11px', color: '#4B5563', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
              View all <ArrowUpRight size={10} />
            </Link>
          </div>
          {recentCollateral.length === 0 ? (
            <div style={{ padding: '28px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px' }}>No collateral yet</div>
              <Link href="/collateral" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px', color: '#818CF8', fontSize: '12px', textDecoration: 'none' }}>
                <Plus size={11} /> Generate your first
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0' }}>
              {recentCollateral.map((item: any, i: number) => (
                <Link key={item.id} href={`/collateral/${item.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                  borderBottom: i < recentCollateral.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  textDecoration: 'none', transition: 'background 120ms',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={13} color="#818CF8" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: '#E5E7EB', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: item.status === 'ready' ? '#22C55E' : item.status === 'stale' ? '#EAB308' : '#818CF8', marginTop: '1px' }}>
                      {item.status === 'generating' ? 'Generating…' : item.status}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Setup health — only show if incomplete */}
        {healthPct < 100 && (
          <div style={card}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <SectionHeaderInline label="Setup" />
                <span style={{ fontSize: '11px', color: '#4B5563' }}>{healthPct}%</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${healthPct}%`, background: '#6366F1', borderRadius: '2px', transition: 'width 1s ease' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {setupSteps.map(s => <SetupItem key={s.href} {...s} />)}
            </div>
            {setupSteps.find(s => !s.done) && (
              <div style={{ margin: '0 10px 10px', padding: '6px 10px', background: 'rgba(99,102,241,0.05)', borderRadius: '6px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <Zap size={10} color="#6366F1" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#6366F1', lineHeight: '1.5' }}>
                  Complete setup for the best AI outputs
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cross-deal pattern alerts (kept compact at bottom) ─────────────── */}
      {(insightsData?.crossDealAlerts ?? []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {(insightsData.crossDealAlerts as any[]).slice(0, 2).map((alert: any, i: number) => {
            const isRed = alert.type === 'losing_streak'
            const color = isRed ? '#EF4444' : alert.type === 'recurring_risk' ? '#A855F7' : '#F59E0B'
            const href  = alert.type === 'recurring_risk' ? '/product-gaps' : '/collateral'
            const cta   = alert.type === 'recurring_risk' ? 'View gaps' : 'Update'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `2px solid ${color}`, borderRadius: '8px' }}>
                <AlertTriangle size={12} color={color} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#D1D5DB', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.message}</span>
                <Link href={href} style={{ fontSize: '11px', color, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                  {cta} <ArrowUpRight size={10} />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Shared style helpers ────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '12px',
  overflow: 'hidden',
}

function listRow(hasBorder: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 14px',
    borderBottom: hasBorder ? '1px solid rgba(255,255,255,0.04)' : 'none',
    textDecoration: 'none',
    transition: 'background 120ms',
    cursor: 'pointer',
  }
}

function quickBtn(primary: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '6px 12px', borderRadius: '7px',
    fontSize: '12px', fontWeight: primary ? '600' : '500',
    textDecoration: 'none',
    color: primary ? '#fff' : '#9CA3AF',
    background: primary ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : 'transparent',
    border: primary ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
    boxShadow: primary ? '0 0 16px rgba(99,102,241,0.3)' : 'none',
  }
}

function SectionHeader({ label, count, href }: { label: string; count?: number; href?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1' }} />
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: '11px', color: '#374151', marginLeft: 'auto' }}>{count}</span>}
      {href && (
        <Link href={href} style={{ fontSize: '11px', color: '#4B5563', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <ArrowUpRight size={10} />
        </Link>
      )}
    </div>
  )
}

function SectionHeaderInline({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1' }} />
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
    </div>
  )
}
