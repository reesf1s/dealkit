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
import { BRAIN_VERSION } from '@/lib/brain-constants'
import { toDisplayAmount, type ValueDisplay } from '@/lib/currency'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(v: number, sym = '$') {
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `${sym}${(v / 1_000).toFixed(0)}k`
  return `${sym}${Math.round(v)}`
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
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      {done
        ? <CheckCircle size={13} color="var(--success)" style={{ flexShrink: 0 }} />
        : <Circle size={13} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />}
      <span style={{ fontSize: '12px', color: done ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', flex: 1 }}>{label}</span>
      {!done && <ArrowUpRight size={11} color="var(--text-tertiary)" />}
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
  const { data: configData } = useSWR('/api/pipeline-config', fetcher, { revalidateOnFocus: false })

  const dbNotConnected = isDbNotConfigured(companyErr)
  const [refreshingBrain, setRefreshingBrain] = useState(false)
  const [intelTab, setIntelTab] = useState<'overview' | 'ml' | 'trends' | 'competitors'>('overview')
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
    // Missing win/loss intelligence or deal velocity — new feature
    const missingIntel = !brain.dealVelocity
    // Missing ML model when enough training data exists
    const closedCount = (deals?.data ?? []).filter((d: any) => d.stage === 'closed_won' || d.stage === 'closed_lost').length
    const missingMl = closedCount >= 6 && !brain.mlModel
    // Stale brain: flagged deals are actually closed in fresh deals data → brain needs rebuild
    const closedIds = new Set((deals?.data ?? []).filter((d: any) => d.stage === 'closed_won' || d.stage === 'closed_lost').map((d: any) => d.id))
    const brainHasStaleClosedDeals = deals?.data &&
      ([...(brain.urgentDeals ?? []), ...(brain.staleDeals ?? [])].some((u: any) => closedIds.has(u.dealId)))
    // Version-based cache-bust: force rebuild when brain was built before a critical calculation fix
    const brainOutdated = !brain.brainVersion || brain.brainVersion < BRAIN_VERSION
    if (hasOldSchema || hasOldPatterns || missingSnippets || missingIntel || missingMl || brainHasStaleClosedDeals || brainOutdated) {
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
  const currencySymbol: string = configData?.data?.currency ?? '$'
  const valueDisplay: ValueDisplay = configData?.data?.valueDisplay ?? 'arr'
  const companyData = company?.data
  const dealList: any[] = deals?.data ?? []
  const collateralList: any[] = collateral?.data ?? []
  const insightsData = insights?.data
  const brain = brainRes?.data

  const openDeals = dealList.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const wonDeals  = dealList.filter(d => d.stage === 'closed_won')
  const winRate   = insightsData?.winRate ?? 0

  // Revenue KPIs — converted to ARR or MRR based on workspace preference
  const pipeline   = openDeals.reduce((s, d) => s + toDisplayAmount(d.dealValue ?? 0, d.dealType, d.recurringInterval, valueDisplay), 0)
  const wonRevenue = wonDeals.reduce((s, d) => s + toDisplayAmount(d.dealValue ?? 0, d.dealType, d.recurringInterval, valueDisplay), 0)
  const allWithVal = dealList.filter(d => d.dealValue && d.dealValue > 0)
  const avgDeal    = allWithVal.length ? allWithVal.reduce((s, d) => s + toDisplayAmount(d.dealValue ?? 0, d.dealType, d.recurringInterval, valueDisplay), 0) / allWithVal.length : 0
  // Labels for recurring values
  const openHasRecurring = openDeals.some(d => d.dealType === 'recurring')
  const valueLabel = openHasRecurring ? (valueDisplay === 'mrr' ? ' · MRR' : ' · ARR') : ''
  // Weighted forecast from brain is always ARR-based; convert to MRR if needed
  const brainForecastARR = brain?.dealVelocity?.weightedForecast ?? 0
  const displayForecast = valueDisplay === 'mrr' ? Math.round(brainForecastARR / 12) : brainForecastARR
  const displayPipelineForForecast = valueDisplay === 'mrr' ? Math.round(pipeline * 1) : pipeline // pipeline already in right mode

  // ── Pipeline by stage ─────────────────────────────────────────────────────
  const stageMap: Record<string, number> = {}
  for (const d of openDeals) stageMap[d.stage] = (stageMap[d.stage] ?? 0) + 1

  // ── Needs Attention list (urgent + stale + top todos) ─────────────────────
  const STAGE_PRIORITY: Record<string, number> = { negotiation: 5, proposal: 4, discovery: 3, qualification: 2, prospecting: 1 }

  const urgentItems: { dealId: string; company: string; label: string; sublabel: string; color: string }[] = [
    ...(brain?.urgentDeals ?? []).map((u: any) => ({
      dealId: u.dealId, company: u.company,
      label: u.company, sublabel: u.reason,
      color: 'var(--danger)',
    })),
    ...(brain?.staleDeals ?? []).slice(0, 3).map((s: any) => ({
      dealId: s.dealId, company: s.company,
      label: s.company, sublabel: `${s.daysSinceUpdate}d since last update`,
      color: 'var(--warning)',
    })),
  ]

  // Declining score trend alerts — deals losing momentum (score dropped 8+ pts)
  const decliningDealIds = new Set(urgentItems.map(u => u.dealId))
  const decliningScoreAlerts: typeof urgentItems = (brain?.scoreTrendAlerts ?? [])
    .filter((a: any) => a.trend === 'declining' && !decliningDealIds.has(a.dealId))
    .slice(0, 3)
    .map((a: any) => ({
      dealId: a.dealId, company: a.company,
      label: a.company, sublabel: `Score dropped ${Math.abs(a.delta)}pts (${a.priorScore}% → ${a.currentScore}%)`,
      color: '#F97316',
    }))
  urgentItems.push(...decliningScoreAlerts)

  // Follow-up cadence alerts from brain (critical + alert only)
  const followUpAlerts: any[] = (brain?.followUpIntel?.followUpAlerts ?? [])
    .filter((a: any) => a.urgency === 'critical' || a.urgency === 'alert')
    .slice(0, 4)

  // Churn risk deals: open deals where the survival model signals ≥65% P(go silent)
  // Excludes deals already in followUpAlerts to avoid double-listing the same issue
  const followUpAlertDealIds = new Set(followUpAlerts.map((a: any) => a.dealId))
  const churnRiskDeals: any[] = (brain?.mlPredictions ?? [])
    .filter((p: any) => typeof p.churnRisk === 'number' && p.churnRisk >= 65 && !followUpAlertDealIds.has(p.dealId))
    .sort((a: any, b: any) => b.churnRisk - a.churnRisk)
    .slice(0, 4)
    .map((p: any) => {
      const snap = (brain?.deals ?? []).find((d: any) => d.id === p.dealId)
      return snap ? { ...p, dealName: snap.name, company: snap.company, stage: snap.stage } : null
    })
    .filter(Boolean)

  const priorityTodos = dealList
    .filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .flatMap(d => (d.todos ?? []).filter((t: any) => !t.done).map((t: any) => ({
      ...t, dealName: d.dealName, dealId: d.id, company: d.prospectCompany,
      stage: d.stage, stagePriority: STAGE_PRIORITY[d.stage] ?? 0,
    })))
    .sort((a, b) => b.stagePriority - a.stagePriority)
    .slice(0, 5)

  const staleCollateral = collateralList.filter(c => c.status === 'stale')

  // collateral counts for KPI strip
  const readyBattlecards = collateralList.filter(c => c.type === 'battlecard' && c.status === 'ready')

  // ── Setup health ──────────────────────────────────────────────────────────
  const hasCompany = !!companyData?.id
  const setupSteps = [
    { done: hasCompany,                          label: 'Teach brain your company',    href: '/company' },
    { done: (competitors?.data?.length ?? 0) > 0, label: 'Add a competitor to track',   href: '/competitors' },
    { done: (caseStudies?.data?.length ?? 0) > 0, label: 'Add a success story',         href: '/case-studies' },
    { done: dealList.length > 0,                 label: 'Log a deal for analysis',     href: '/pipeline' },
    { done: collateralList.length > 0,           label: 'Generate AI collateral',      href: '/collateral' },
  ]
  const completedSteps = setupSteps.filter(s => s.done).length
  const healthPct = Math.round((completedSteps / setupSteps.length) * 100)

  // ── Greeting ──────────────────────────────────────────────────────────────
  const firstName = user?.firstName
  const hour = new Date().getHours()
  const greeting = firstName
    ? `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${firstName}`
    : 'Brain Dashboard'

  const recentCollateral = collateralList.slice(0, 4)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* ── Zone 1: Header + KPI strip ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: '0 0 2px' }}>
            {greeting}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {openDeals.length > 0 && (
              <span style={{ color: 'var(--text-tertiary)' }}> · {openDeals.length} active deal{openDeals.length !== 1 ? 's' : ''}</span>
            )}
          </p>
          {brain?.updatedAt && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap',
              padding: '6px 12px', borderRadius: '8px',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px rgba(34,197,94,0.6)' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Brain Active · {(() => {
                    const diff = Date.now() - new Date(brain.updatedAt).getTime()
                    const mins = Math.floor(diff / 60000)
                    if (mins < 1) return 'just now'
                    if (mins < 60) return `${mins}m ago`
                    const hrs = Math.floor(mins / 60)
                    if (hrs < 24) return `${hrs}h ago`
                    return `${Math.floor(hrs / 24)}d ago`
                  })()}
                </span>
              </div>
              <div style={{ width: '1px', height: '12px', background: 'var(--border)' }} />
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{dealList.length} analyzed</span>
              {brain?.mlModel && (
                <>
                  <div style={{ width: '1px', height: '12px', background: 'var(--border)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: brain.mlModel.looAccuracy >= 0.7 ? 'var(--success)' : 'var(--warning)' }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>ML {Math.round(brain.mlModel.looAccuracy * 100)}%</span>
                  </div>
                </>
              )}
              {(brain?.keyPatterns?.length ?? 0) > 0 && (
                <>
                  <div style={{ width: '1px', height: '12px', background: 'var(--border)' }} />
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{brain.keyPatterns.length} patterns</span>
                </>
              )}
              <button onClick={rebuildBrain} disabled={refreshingBrain}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '5px', background: 'var(--accent-subtle)', border: '1px solid var(--border)', color: 'var(--accent)', fontSize: '10px', fontWeight: 600, cursor: refreshingBrain ? 'not-allowed' : 'pointer' }}>
                <RefreshCw size={9} style={{ animation: refreshingBrain ? 'spin 1s linear infinite' : 'none' }} />
                {refreshingBrain ? 'Rebuilding…' : 'Rebuild'}
              </button>
            </div>
          )}
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
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {[
          { label: 'Pipeline', value: pipeline > 0 ? fmt(pipeline, currencySymbol) : '—', sub: `${openDeals.length} deal${openDeals.length !== 1 ? 's' : ''}${valueLabel}`, color: 'var(--accent)' },
          { label: 'Won', value: wonRevenue > 0 ? fmt(wonRevenue, currencySymbol) : '—', sub: wonRevenue === 0 && wonDeals.length > 0 ? 'Add values →' : `${wonDeals.length} closed`, color: 'var(--success)' },
          { label: 'Win Rate', value: dealList.length > 0 ? `${winRate}%` : '—', sub: `${dealList.length} tracked`, color: '#10B981' },
          { label: 'Avg Deal', value: avgDeal > 0 ? fmt(avgDeal, currencySymbol) : '—', sub: allWithVal.length > 0 ? `${allWithVal.length} deals` : 'Log values', color: 'var(--warning)' },
        ].map(kpi => (
          <div key={kpi.label} style={{ flex: '1 1 0', minWidth: '120px', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{kpi.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.04em', color: kpi.color, lineHeight: 1 }}>{kpi.value}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Setup alert */}
      {dbNotConnected && <SetupAlert />}

      {/* ── Zone 2: Brain Briefing (Hero) ─────────────────────────────── */}
      <AIOverviewCard />

      {/* ── Attention + Actions ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>

        {/* What the Brain Detected */}
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
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sublabel}</div>
                    </div>
                    <ArrowUpRight size={11} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up cadence alerts */}
          {followUpAlerts.length > 0 && (
            <div style={card}>
              <SectionHeader label="Follow-up Overdue" count={followUpAlerts.length} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {followUpAlerts.map((alert: any, i: number) => {
                  const color = alert.urgency === 'critical' ? 'var(--danger)' : '#F97316'
                  const urgencyLabel = alert.urgency === 'critical' ? 'Critical' : 'Overdue'
                  return (
                    <Link key={alert.dealId} href={`/deals/${alert.dealId}`} style={listRow(i < followUpAlerts.length - 1)}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.company}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>{alert.daysSinceLastNote}d since last note · typical {alert.typicalMaxGapDays}d</div>
                      </div>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, color, background: `${color}14`, flexShrink: 0 }}>{urgencyLabel}</span>
                      <ArrowUpRight size={11} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Deal churn survival model — deals at risk of going silent */}
          {churnRiskDeals.length > 0 && (
            <div style={card}>
              <SectionHeader label="At Risk of Going Silent" count={churnRiskDeals.length} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {churnRiskDeals.map((deal: any, i: number) => {
                  const risk = deal.churnRisk as number
                  const color = risk >= 80 ? 'var(--danger)' : '#F97316'
                  return (
                    <Link key={deal.dealId} href={`/deals/${deal.dealId}`} style={listRow(i < churnRiskDeals.length - 1)}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.company}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>{deal.stage} · {deal.churnDaysOverdue > 0 ? `${deal.churnDaysOverdue}d past safe window` : 'approaching silence threshold'}</div>
                      </div>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, color, background: `${color}14`, flexShrink: 0 }}>{risk}%</span>
                      <ArrowUpRight size={11} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stale collateral alert */}
          {staleCollateral.length > 0 && (
            <Link href="/collateral?status=stale" style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', textDecoration: 'none', transition: 'border-color 0.1s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--warning)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
            >
              <AlertTriangle size={13} color="var(--warning)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                  <strong style={{ color: 'var(--warning)' }}>{staleCollateral.length}</strong> collateral {staleCollateral.length === 1 ? 'item needs' : 'items need'} refresh
                </span>
              </div>
              <ArrowUpRight size={11} color="var(--warning)" style={{ flexShrink: 0 }} />
            </Link>
          )}

          {/* All clear state */}
          {urgentItems.length === 0 && followUpAlerts.length === 0 && churnRiskDeals.length === 0 && staleCollateral.length === 0 && dealList.length > 0 && (
            <div style={{ ...card, padding: '20px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>✓</div>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>All clear</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>No risks detected by the brain</div>
            </div>
          )}
        </div>

        {/* Right: What to Do */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

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
                        <div style={{ fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.text}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>{todo.company}</div>
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

          {/* Recent collateral — quick access */}
          {recentCollateral.length > 0 && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <SectionHeaderInline label="Brain Output" />
                <Link href="/collateral" style={{ fontSize: '11px', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  View all <ArrowUpRight size={10} />
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentCollateral.slice(0, 3).map((item: any, i: number) => (
                  <Link key={item.id} href={`/collateral/${item.id}`} style={listRow(i < Math.min(recentCollateral.length, 3) - 1)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--accent-subtle)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={11} color="var(--accent)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize: '10px', color: item.status === 'ready' ? 'var(--success)' : item.status === 'stale' ? 'var(--warning)' : 'var(--accent)', marginTop: '1px' }}>
                        {item.status === 'generating' ? 'Generating…' : item.status}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty right column state */}
          {priorityTodos.length === 0 && recentCollateral.length === 0 && dealList.length > 0 && (
            <div style={{ ...card, padding: '20px 14px', textAlign: 'center' }}>
              <Sparkles size={16} color="var(--accent)" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>No pending actions</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>The brain will surface actions as your deals evolve</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Zone 2.5: Deal Trends & Intelligence ──────────────────────────── */}
      {(refreshingBrain || (brain && (brain.keyPatterns?.length > 0 || brain.pipelineRecommendations?.length > 0))) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

          {/* Key patterns — left column */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <Activity size={12} color="#A855F7" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Autonomous Signals</span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{brain?.keyPatterns?.length ?? 0} detected</span>
              <button onClick={rebuildBrain} disabled={refreshingBrain} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: refreshingBrain ? 'default' : 'pointer', padding: '2px 4px', borderRadius: '4px', color: 'var(--text-tertiary)' }}
                title="Refresh intelligence">
                <RefreshCw size={10} style={{ animation: refreshingBrain ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>

            {refreshingBrain && !brain?.keyPatterns?.length ? (
              <div style={{ padding: '20px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Analysing deal patterns…
              </div>
            ) : (brain?.keyPatterns ?? []).length === 0 ? (
              <div style={{ padding: '20px 14px', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                The brain is learning your patterns — signals surface autonomously when 2+ deals share themes.
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
                    <div key={i} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                      {/* Pattern header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px 4px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#A855F7', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize', flex: 1 }}>{p.label}</span>
                        {/* Competitor pills */}
                        {isCompetitor && competitorNames.length > 0 && competitorNames.map((name: string) => (
                          <Link key={name} href="/competitors" style={{
                            fontSize: '10px', fontWeight: 600, color: '#F87171',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                            padding: '1px 7px', borderRadius: '100px', textDecoration: 'none', flexShrink: 0,
                          }}>{name}</Link>
                        ))}
                        {isCompetitor && competitorNames.length === 0 && (
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>no competitors named</span>
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
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ArrowUpRight size={10} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{companies[j] ?? ''}</span>
                                {dealNames[j] && companies[j] !== dealNames[j] && (
                                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}> · {dealNames[j]}</span>
                                )}
                              </div>
                              {riskSnippets.slice(0, 1).map((snippet: string, si: number) => (
                                <div key={si} style={{ fontSize: '10px', color: 'var(--text-tertiary)', paddingLeft: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <TrendingUp size={12} color="#10B981" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Brain Actions</span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                {(brain?.pipelineRecommendations ?? []).filter((r: any) => r.priority === 'high').length} high priority
              </span>
              <button onClick={rebuildBrain} disabled={refreshingBrain} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: refreshingBrain ? 'default' : 'pointer', padding: '2px 4px', borderRadius: '4px', color: 'var(--text-tertiary)' }}
                title="Rebuild Brain">
                <RefreshCw size={10} style={{ animation: refreshingBrain ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>

            {refreshingBrain && !(brain?.pipelineRecommendations?.length) ? (
              <div style={{ padding: '20px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Building recommendations…
              </div>
            ) : (brain?.pipelineRecommendations ?? []).length === 0 ? (
              <div style={{ padding: '20px 14px', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                Brain is learning — add more deals and meeting notes and it will autonomously surface actions.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {((brain?.pipelineRecommendations ?? []) as any[]).map((rec: any, i: number) => {
                  const recs = brain?.pipelineRecommendations ?? []
                  const priorityColor = rec.priority === 'high' ? 'var(--danger)' : rec.priority === 'medium' ? 'var(--warning)' : 'var(--text-tertiary)'
                  const isLast = i === recs.length - 1
                  return (
                    <Link key={i} href={`/deals/${rec.dealId}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 14px', borderBottom: isLast ? 'none' : '1px solid var(--border)', textDecoration: 'none', transition: 'background 120ms' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '10px', fontWeight: 700, color: priorityColor, background: `${priorityColor}14`, padding: '2px 5px', borderRadius: '4px', flexShrink: 0, marginTop: '1px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {rec.priority}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{rec.recommendation}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          {rec.company}{rec.dealName && rec.dealName !== rec.company ? ` · ${rec.dealName}` : ''}
                        </div>
                      </div>
                      <ArrowUpRight size={11} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Zone 2.8: Compounding Intelligence ──────────────────────────── */}
      {(() => {
        const wl  = brain?.winLossIntel
        const dv  = brain?.dealVelocity
        const hasClosed   = (wl?.winCount ?? 0) + (wl?.lossCount ?? 0) > 0
        const hasForecast = (dv?.weightedForecast ?? 0) > 0 && (dv?.forecastDealCount ?? 0) > 0
        if (!hasClosed && !hasForecast) return null
        const calColor = (wl?.scoreCalibration.highScoreWinRate ?? 0) >= 60 ? 'var(--success)' : (wl?.scoreCalibration.highScoreWinRate ?? 0) >= 40 ? 'var(--warning)' : 'var(--danger)'
        return (
          <div>
            {/* Tabbed Intelligence Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <Sparkles size={11} color="var(--accent)" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: '4px' }}>Intelligence Engine</span>
              {(['overview', 'ml', 'trends', 'competitors'] as const).map(tab => (
                <button key={tab} onClick={() => setIntelTab(tab)}
                  style={{
                    padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                    background: intelTab === tab ? 'var(--accent-subtle)' : 'transparent',
                    border: intelTab === tab ? '1px solid var(--border-strong)' : '1px solid transparent',
                    color: intelTab === tab ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    cursor: 'pointer', transition: 'all 0.12s', textTransform: 'capitalize',
                  }}
                  onMouseEnter={e => { if (intelTab !== tab) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { if (intelTab !== tab) (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)' }}
                >{tab}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>

              {/* Weighted forecast */}
              {hasForecast && (
                <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Weighted Forecast</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--accent)', lineHeight: 1, marginBottom: '4px' }}>{fmt(displayForecast, currencySymbol)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>probability-adjusted {valueDisplay.toUpperCase()} · {dv!.forecastDealCount} scored deal{dv!.forecastDealCount !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                    vs {fmt(displayPipelineForForecast, currencySymbol)} full pipeline ({valueDisplay.toUpperCase()})
                  </div>
                </div>
              )}

              {/* Win rate */}
              {hasClosed && (
                <div style={{ background: wl!.winRate >= 50 ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${wl!.winRate >= 50 ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.14)'}`, borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Win Rate</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em', color: wl!.winRate >= 50 ? 'var(--success)' : 'var(--warning)', lineHeight: 1, marginBottom: '4px' }}>{wl!.winRate}%</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{wl!.winCount}W · {wl!.lossCount}L · {wl!.winCount + wl!.lossCount} closed</div>
                  {wl!.avgDaysToClose > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                      avg {wl!.avgDaysToClose}d to close
                    </div>
                  )}
                </div>
              )}

              {/* Industry benchmark comparison */}
              {brain?.globalPrior && brain.globalPrior.usingPrior && hasClosed && (() => {
                const gp = brain.globalPrior!
                const localWR  = wl?.winRate ?? 0
                const globalWR = gp.globalWinRate
                const delta    = localWR - globalWR
                const deltaColor = delta >= 5 ? 'var(--success)' : delta <= -5 ? 'var(--danger)' : 'var(--warning)'
                return (
                  <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>vs Industry</div>
                    {/* Win rate comparison bar */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Your win rate</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 600 }}>{localWR}%</span>
                      </div>
                      <div style={{ height: '5px', background: 'var(--surface)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
                        <div style={{ height: '100%', width: `${localWR}%`, background: 'var(--success)', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Industry median</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{globalWR}%</span>
                      </div>
                      <div style={{ height: '5px', background: 'var(--surface)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${globalWR}%`, background: 'var(--accent)', borderRadius: '3px' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: deltaColor, fontWeight: 600 }}>
                      {delta >= 5 ? `▲ ${delta}pts above industry median`
                        : delta <= -5 ? `▼ ${Math.abs(delta)}pts below industry median`
                        : `≈ In line with industry median`}
                    </div>
                    {gp.stageVelocityP50 > 0 && wl?.avgDaysToClose != null && wl.avgDaysToClose > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                        Close speed: {wl.avgDaysToClose}d avg vs {gp.stageVelocityP50}d industry median
                        {wl.avgDaysToClose > gp.stageVelocityP75
                          ? <span style={{ color: 'var(--danger)' }}> — slower than 75th pct</span>
                          : wl.avgDaysToClose < gp.stageVelocityP50
                            ? <span style={{ color: 'var(--success)' }}> — faster than median</span>
                            : null}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                      Based on {gp.trainingSize.toLocaleString()} industry deals
                    </div>
                  </div>
                )
              })()}

              {/* Score calibration */}
              {hasClosed && wl!.scoreCalibration.avgScoreOnWins != null && (
                <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.14)', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Brain Accuracy</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--success)' }}>Wins</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success)' }}>{wl!.scoreCalibration.avgScoreOnWins}% avg score</span>
                    </div>
                    {wl!.scoreCalibration.avgScoreOnLosses != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--danger)' }}>Losses</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--danger)' }}>{wl!.scoreCalibration.avgScoreOnLosses}% avg score</span>
                      </div>
                    )}
                    {wl!.scoreCalibration.highScoreWinRate != null && (
                      <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--border)', fontSize: '10px', color: calColor }}>
                        70%+ scored deals won at {wl!.scoreCalibration.highScoreWinRate}%
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Competitor record */}
              {hasClosed && (wl?.competitorRecord ?? []).length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Competitor Record</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(wl!.competitorRecord ?? []).slice(0, 4).map((c: { name: string; wins: number; losses: number; winRate: number }, ci: number) => (
                      <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{c.wins}W-{c.losses}L</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: c.winRate >= 60 ? 'var(--success)' : c.winRate >= 40 ? 'var(--warning)' : 'var(--danger)', minWidth: '28px', textAlign: 'right' }}>{c.winRate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top loss reasons */}
              {hasClosed && (wl?.topLossReasons ?? []).length > 0 && (
                <div style={{ background: 'rgba(107,114,128,0.05)', border: '1px solid rgba(107,114,128,0.12)', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Loss Patterns</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(wl!.topLossReasons ?? []).slice(0, 4).map((r: string, ri: number) => (
                      <div key={ri} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, marginTop: '4px' }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Teaser when no closed data yet */}
              {!hasClosed && hasForecast && (
                <div style={{ background: 'var(--accent-subtle)', border: '1px dashed var(--border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Win/Loss intelligence unlocks after your first close</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Win rate · Avg deal cycle · AI score calibration · Competitor record</div>
                </div>
              )}

              {/* ML Predictive Model card */}
              {brain?.mlModel && (() => {
                const ml = brain.mlModel!
                const gp = brain.globalPrior
                const topFeature = ml.featureImportance[0]
                const accColor = ml.looAccuracy >= 0.7 ? 'var(--success)' : ml.looAccuracy >= 0.55 ? 'var(--warning)' : 'var(--danger)'
                const isColdStart = ml.trainingSize === 0 && ml.usingGlobalPrior
                return (
                  <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.14)', borderRadius: '12px', padding: '14px 16px', gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Autonomous ML Model</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: accColor }} />
                        <span style={{ fontSize: '10px', color: accColor, fontWeight: 600 }}>
                          {isColdStart ? 'Global prior' : `${Math.round(ml.looAccuracy * 100)}% accurate`}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                          {isColdStart
                            ? `based on ${(gp?.trainingSize ?? 0).toLocaleString()} industry deals`
                            : gp?.usingPrior
                              ? `${ml.trainingSize} local + ${(gp.trainingSize).toLocaleString()} industry`
                              : `trained on ${ml.trainingSize} deals`}
                        </span>
                      </div>
                    </div>
                    {/* Cold start / blend badge */}
                    {gp?.usingPrior && (
                      <div style={{ padding: '7px 10px', borderRadius: '8px', background: 'var(--accent-subtle)', border: '1px solid var(--border)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ fontSize: '13px' }}>🧠</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {isColdStart
                            ? <>Predictions based on <strong style={{ color: 'var(--text-primary)' }}>{(gp.trainingSize).toLocaleString()} industry deals</strong>. Accuracy will improve as you close more deals.</>
                            : <>Model blends your {ml.trainingSize} closed deals ({gp.localWeight}%) with {(gp.trainingSize).toLocaleString()} industry deals ({100 - gp.localWeight}%).</>
                          }
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {/* Feature importances */}
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '6px', fontWeight: 500 }}>Brain-identified win factors</div>
                        {ml.featureImportance.slice(0, 4).map((f: { name: string; importance: number; direction: 'helps' | 'hurts' }, fi: number) => (
                          <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <div style={{ flex: 1, height: '4px', background: 'var(--surface)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(100, Math.round(f.importance / (ml.featureImportance[0]?.importance || 1) * 100))}%`, background: f.direction === 'helps' ? 'var(--success)' : 'var(--danger)', borderRadius: '2px' }} />
                            </div>
                            <span style={{ fontSize: '10px', color: f.direction === 'helps' ? 'var(--success)' : 'var(--danger)', width: '8px', flexShrink: 0 }}>{f.direction === 'helps' ? '+' : '−'}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{f.name.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                      {/* ML win probabilities for open deals */}
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '6px', fontWeight: 500 }}>ML win probability — open deals</div>
                        {(brain.mlPredictions ?? []).slice(0, 4).map((p: { dealId: string; winProbability: number; confidence: string; riskFlags: string[] }, pi: number) => {
                          const deal = (brain.deals ?? []).find((d: { id: string }) => d.id === p.dealId)
                          if (!deal) return null
                          const pct = Math.round(p.winProbability * 100)
                          const pColor = pct >= 65 ? 'var(--success)' : pct >= 45 ? 'var(--warning)' : 'var(--danger)'
                          return (
                            <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.company}</span>
                              <div style={{ width: '32px', height: '4px', background: 'var(--surface)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: pColor, borderRadius: '2px' }} />
                              </div>
                              <span style={{ fontSize: '11px', color: pColor, fontWeight: 600, width: '28px', textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                            </div>
                          )
                        })}
                        {topFeature && (
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                            Biggest factor: {topFeature.name.replace(/_/g, ' ')} ({topFeature.direction === 'helps' ? 'positive' : 'negative'})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Rep coaching intelligence */}
              {(brain?.repIntel ?? []).length > 0 && (() => {
                const reps: any[] = brain!.repIntel!
                const isSolo = reps.length === 1
                const rep0 = reps[0]
                const winColor = (r: any) => r.winRate >= 50 ? 'var(--success)' : r.winRate >= 30 ? 'var(--warning)' : 'var(--danger)'
                const todoColor = (r: any) => r.avgTodoCompletionRate >= 70 ? 'var(--success)' : r.avgTodoCompletionRate >= 40 ? 'var(--warning)' : 'var(--danger)'
                const statBox = (label: string, value: string, sub: string, color: string) => (
                  <div style={{ padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color }}>{value}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{sub}</div>
                  </div>
                )
                return (
                  <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', gridColumn: isSolo ? 'auto' : 'span 2' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
                      {isSolo ? 'Your Coaching Stats' : 'Rep Performance'}
                    </div>
                    {isSolo ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                        {statBox('Win Rate', `${rep0.winRate}%`, `${rep0.wonDeals}/${rep0.closedDeals} closed`, winColor(rep0))}
                        {statBox('To-Do Completion', `${rep0.avgTodoCompletionRate}%`, 'of tasks completed', todoColor(rep0))}
                        {statBox('Deals with Next Step', `${rep0.dealsWithNextStepPct}%`, 'open deals covered', rep0.dealsWithNextStepPct >= 60 ? 'var(--success)' : 'var(--warning)')}
                        {statBox('Avg Days Since Note', `${rep0.avgDaysSinceLastNote}d`, 'across open deals', rep0.avgDaysSinceLastNote <= 7 ? 'var(--success)' : rep0.avgDaysSinceLastNote <= 14 ? 'var(--warning)' : 'var(--danger)')}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {reps.map((rep: any, ri: number) => (
                          <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Rep {ri + 1}</span>
                            <span style={{ fontSize: '11px', color: winColor(rep), fontWeight: 700, width: '36px', textAlign: 'right' }}>{rep.winRate}%</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>win rate</span>
                            <span style={{ fontSize: '11px', color: todoColor(rep), fontWeight: 700, width: '36px', textAlign: 'right' }}>{rep.avgTodoCompletionRate}%</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>to-dos</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Trend alerts */}
              {brain?.mlTrends && (() => {
                const tr = brain.mlTrends!
                const alerts: { text: string; color: string }[] = []
                if (tr.winRate.direction === 'declining')
                  alerts.push({ text: `Win rate declining — ${tr.winRate.priorPct}% → ${tr.winRate.recentPct}% (${tr.winRate.slopePctPerMonth}pp/mo)`, color: 'var(--danger)' })
                if (tr.winRate.direction === 'improving')
                  alerts.push({ text: `Win rate improving — ${tr.winRate.priorPct}% → ${tr.winRate.recentPct}% (+${tr.winRate.slopePctPerMonth}pp/mo)`, color: 'var(--success)' })
                if (tr.dealVelocity.direction === 'slower')
                  alerts.push({ text: `Deals taking longer — ${tr.dealVelocity.priorAvgDays}d → ${tr.dealVelocity.recentAvgDays}d avg`, color: 'var(--warning)' })
                if (tr.dealVelocity.direction === 'faster')
                  alerts.push({ text: `Deals closing faster — ${tr.dealVelocity.priorAvgDays}d → ${tr.dealVelocity.recentAvgDays}d avg`, color: 'var(--success)' })
                const threats = (tr.competitorThreats as { name: string; recentWinRatePct: number; allTimeWinRatePct: number; direction: string }[]).filter(c => c.direction === 'more_competitive')
                threats.forEach(c => alerts.push({ text: `${c.name} more competitive recently — win rate ${c.allTimeWinRatePct}% → ${c.recentWinRatePct}%`, color: 'var(--danger)' }))
                if (alerts.length === 0) return null
                return (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {alerts.map((a, ai) => (
                      <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: `${a.color}08`, border: `1px solid ${a.color}20`, borderLeft: `2px solid ${a.color}`, borderRadius: '8px' }}>
                        <TrendingUp size={11} color={a.color} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{a.text}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* Product gap revenue priority */}
              {(brain?.productGapPriority ?? []).some((g: any) => g.revenueAtRisk > 0 || g.dealsBlocked > 0) && (
                <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Revenue at Risk by Gap</div>
                    <Link href="/product-gaps" style={{ fontSize: '10px', color: 'var(--danger)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      View all <ArrowUpRight size={9} />
                    </Link>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(brain!.productGapPriority!).filter((g: any) => g.revenueAtRisk > 0 || g.dealsBlocked > 0).slice(0, 4).map((g: any, gi: number) => (
                      <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
                          {g.revenueAtRisk > 0 && (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger)', flexShrink: 0 }}>{fmt(g.revenueAtRisk, currencySymbol)}</span>
                          )}
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{g.dealsBlocked} deal{g.dealsBlocked !== 1 ? 's' : ''}</span>
                        </div>
                        {typeof g.winRateDelta === 'number' && (
                          <div style={{ fontSize: '10px', color: g.winRateDelta <= -10 ? 'var(--danger)' : g.winRateDelta <= -5 ? '#F97316' : 'var(--text-secondary)', paddingLeft: '0', fontWeight: 500 }}>
                            {g.winRateWithGap}% win rate with gap vs {g.winRateWithoutGap}% without
                            {g.winRateDelta <= -5 ? ` · ▼ ${Math.abs(g.winRateDelta)}pts impact` : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Collateral effectiveness */}
              {(brain?.collateralEffectiveness ?? []).length >= 2 && (
                <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Collateral Win Rates</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {(brain!.collateralEffectiveness!).slice(0, 5).map((c: any, ci: number) => {
                      const color = c.winRate >= 60 ? 'var(--success)' : c.winRate >= 40 ? 'var(--warning)' : 'var(--danger)'
                      return (
                        <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.type.replace(/_/g, ' ')}
                          </span>
                          <div style={{ width: '40px', height: '4px', background: 'var(--surface)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ height: '100%', width: `${c.winRate}%`, background: color, borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontSize: '11px', color, fontWeight: 700, width: '30px', textAlign: 'right', flexShrink: 0 }}>{c.winRate}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Objection Win Map — with global benchmark deltas when prior is active */}
              {(brain?.objectionWinMap ?? []).filter((o: any) => o.winsWithTheme > 0).length > 0 && (() => {
                const owm = brain!.objectionWinMap!.filter((o: any) => o.winsWithTheme > 0).slice(0, 5)
                const hasGlobal = owm.some((o: any) => typeof o.globalWinRate === 'number')
                return (
                  <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: '12px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Objection Win Map</div>
                      {hasGlobal && (
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>vs industry avg</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {owm.map((o: any, oi: number) => {
                        const color = o.winRateWithTheme >= 60 ? 'var(--success)' : o.winRateWithTheme >= 40 ? 'var(--warning)' : 'var(--danger)'
                        const hasG = typeof o.globalWinRate === 'number'
                        const delta = hasG ? o.winRateWithTheme - o.globalWinRate : 0
                        const deltaColor = delta >= 5 ? 'var(--success)' : delta <= -5 ? 'var(--danger)' : 'var(--text-secondary)'
                        return (
                          <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                              {o.theme}
                            </span>
                            <div style={{ width: '40px', height: '4px', background: 'var(--surface)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                              <div style={{ height: '100%', width: `${o.winRateWithTheme}%`, background: color, borderRadius: '2px' }} />
                            </div>
                            <span style={{ fontSize: '11px', color, fontWeight: 700, width: '30px', textAlign: 'right', flexShrink: 0 }}>{o.winRateWithTheme}%</span>
                            {hasG && (
                              <span style={{ fontSize: '10px', color: deltaColor, fontWeight: 600, width: '52px', textAlign: 'right', flexShrink: 0 }}>
                                {delta >= 5 ? `▲ +${delta}` : delta <= -5 ? `▼ ${delta}` : `≈ ${o.globalWinRate}%`}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

            </div>
          </div>
        )
      })()}

      {/* ── Zone 3: Setup health ──────────────────────────────────────── */}
      {healthPct < 100 && (
        <div style={{ maxWidth: '400px' }}>
          <div style={card}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <SectionHeaderInline label="Brain Setup" />
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{healthPct}%</span>
              </div>
              <div style={{ height: '3px', background: 'var(--surface-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${healthPct}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 1s ease' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {setupSteps.map(s => <SetupItem key={s.href} {...s} />)}
            </div>
            {setupSteps.find(s => !s.done) && (
              <div style={{ margin: '0 10px 10px', padding: '6px 10px', background: 'var(--accent-subtle)', borderRadius: '6px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <Zap size={10} color="var(--accent)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: 'var(--accent)', lineHeight: '1.5' }}>
                  Complete setup so the brain can work autonomously
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Cross-deal pattern alerts (kept compact at bottom) ─────────────── */}
      {(insightsData?.crossDealAlerts ?? []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {(insightsData.crossDealAlerts as any[]).slice(0, 2).map((alert: any, i: number) => {
            const isRed = alert.type === 'losing_streak'
            const color = isRed ? 'var(--danger)' : alert.type === 'recurring_risk' ? '#A855F7' : 'var(--warning)'
            const href  = alert.type === 'recurring_risk' ? '/product-gaps' : '/collateral'
            const cta   = alert.type === 'recurring_risk' ? 'View gaps' : 'Update'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `2px solid ${color}`, borderRadius: '8px' }}>
                <AlertTriangle size={12} color={color} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.message}</span>
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
  background: 'var(--card-bg)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--card-border)',
  borderRadius: '14px',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-sm)',
}

function listRow(hasBorder: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 14px',
    borderBottom: hasBorder ? '1px solid var(--border)' : 'none',
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
    color: primary ? '#fff' : 'var(--text-secondary)',
    background: primary ? 'linear-gradient(135deg, var(--accent-hover), #7C3AED)' : 'var(--surface)',
    border: primary ? '1px solid var(--border-strong)' : '1px solid var(--border)',
    boxShadow: primary ? 'var(--shadow)' : 'var(--shadow-sm)',
  }
}

function SectionHeader({ label, count, href }: { label: string; count?: number; href?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)' }} />
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{count}</span>}
      {href && (
        <Link href={href} style={{ fontSize: '11px', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <ArrowUpRight size={10} />
        </Link>
      )}
    </div>
  )
}

function SectionHeaderInline({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)' }} />
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
    </div>
  )
}
