'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import Link from 'next/link'
import type { LoopEntry } from '@/app/api/loops/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ─── Types ───────────────────────────────────────────────────────────────────

interface BrainData {
  data?: {
    staleDeals?: Array<{
      dealId: string
      dealName?: string
      company: string
      dealValue?: number | null
      daysSinceUpdate: number
      daysSinceActivity?: number
      score?: number | null
      stage?: string
    }>
    keyPatterns?: Array<{
      label: string
      dealIds: string[]
      companies: string[]
      dealNames?: string[]
    }>
    urgentDeals?: Array<{
      dealId: string
      dealName?: string
      company: string
      reason: string
      topAction?: string
    }>
    objectionWinMap?: Array<{
      theme: string
      dealsWithTheme: number
      winsWithTheme: number
      winRateWithTheme: number
    }>
    topRisks?: string[]
    dailyBriefing?: string
    dailyBriefingGeneratedAt?: string
    winLossIntel?: {
      winRate: number
      winCount: number
      lossCount: number
    }
    updatedAt?: string
  }
  meta?: {
    lastRebuilt: string | null
    isStale: boolean
  }
}

interface LoopSignalResponse {
  data: {
    signals: Signal[]
    inFlight: InFlightLoop[]
    closedLoops: ClosedLoop[]
    closedCount: number
  }
}

interface Signal {
  id: string
  company: string
  dealValue: number | null
  stage: string
  suggestedCount: number
  conversionScore: number | null
}

interface InFlightLoop {
  id: string
  company: string
  dealValue: number | null
  stage: string
  loopStage: 'awaiting_approval' | 'in_cycle'
  pendingActionCreatedAt: string | null
  inCycleIssues: Array<{ linearIssueId: string; linearTitle?: string }>
}

interface ClosedLoop {
  id: string
  company: string
  dealValue: number | null
  deployedAt: string | null
  issueCount: number
}

interface SummaryData {
  data: {
    revenueAtRisk: number
    dealsAtRisk: number
    topDeals: Array<{
      id: string
      name: string
      company: string
      value: number
      stage: string
      urgencyScore: number
      primaryBlocker: string | null
      topAction: string
      riskLevel: 'high' | 'medium' | 'low'
      daysStale: number
    }>
    focusBullets: string[]
  }
}

interface DealRow {
  id: string
  dealName: string
  prospectCompany: string
  stage: string
  dealValue: number | null
  conversionScore: number | null
  closeDate: string | null
  updatedAt: string
  dealRisks: string[]
}

interface PipelineConfig {
  data?: {
    currency?: string
    stages?: Array<{ id: string; label: string; color: string }>
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(n: number | string | null | undefined, sym = '\u00a3'): string {
  if (!n) return ''
  const v = Number(n)
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `${sym}${Math.round(v / 1_000)}k`
  return `${sym}${Math.round(v)}`
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}

function riskDot(level: 'high' | 'medium' | 'low' | null | undefined): string {
  if (level === 'high') return '#ef4444'
  if (level === 'medium') return '#f59e0b'
  return '#22c55e'
}

function scoreColor(score: number | null | undefined): string {
  if (!score || score <= 0) return '#ef4444'
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function stageFmt(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Glass style tokens ──────────────────────────────────────────────────────

const glass = {
  card: {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
  } as React.CSSProperties,
  cardHover: {
    background: 'rgba(255,255,255,0.08)',
  } as React.CSSProperties,
}

const text = {
  label: { fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.4)' },
  data: { fontSize: '12px', color: 'rgba(255,255,255,0.85)' },
  muted: { fontSize: '11px', color: 'rgba(255,255,255,0.45)' },
  heading: { fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' },
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ h = 60 }: { h?: number }) {
  return (
    <div style={{
      ...glass.card,
      height: h,
      animation: 'pulse 2s ease-in-out infinite',
    }} />
  )
}

// ─── DO NOW Section ──────────────────────────────────────────────────────────

function DoNowSection({ currency }: { currency: string }) {
  const { data: summaryRes, isLoading: sumLoading } = useSWR<SummaryData>(
    '/api/dashboard/summary', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const { data: brainData, isLoading: brainLoading } = useSWR<BrainData>(
    '/api/brain', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const { data: loopData } = useSWR<LoopSignalResponse>(
    '/api/dashboard/loop-signals', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const { data: loopsRes } = useSWR<{ data: LoopEntry[] }>(
    '/api/loops', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  )

  const loading = sumLoading || brainLoading
  const topDeals = summaryRes?.data?.topDeals ?? []
  const brain = brainData?.data
  const inFlight = loopData?.data?.inFlight ?? []
  const loopEntries = loopsRes?.data ?? []

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {[1, 2, 3].map(i => <Skeleton key={i} h={80} />)}
      </div>
    )
  }

  if (topDeals.length === 0) {
    return (
      <div style={{ ...glass.card, padding: '20px', textAlign: 'center' }}>
        <p style={{ ...text.muted, margin: 0 }}>No urgent deals. Pipeline is clear.</p>
      </div>
    )
  }

  return (
    <div style={{
      ...glass.card,
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {topDeals.slice(0, 6).map((deal, idx) => {
        const urgentEntry = brain?.urgentDeals?.find(u => u.dealId === deal.id)
        const staleEntry = brain?.staleDeals?.find(s => s.dealId === deal.id)
        const score = staleEntry?.score ?? null
        const scoreDelta = staleEntry?.daysSinceUpdate && staleEntry.daysSinceUpdate > 7
          ? Math.min(staleEntry.daysSinceUpdate, 20)
          : null

        // Find linked loops/linear issues
        const dealLoops = loopEntries.filter(l => l.dealId === deal.id)
        const dealInFlight = inFlight.filter(f => f.id === deal.id)
        const allIssues = [
          ...dealLoops.map(l => ({ id: l.linearIssueId, title: l.linearTitle })),
          ...dealInFlight.flatMap(f => f.inCycleIssues.map(i => ({ id: i.linearIssueId, title: i.linearTitle ?? null }))),
        ]
        // Dedupe
        const issueMap = new Map<string, string | null>()
        allIssues.forEach(i => { if (!issueMap.has(i.id)) issueMap.set(i.id, i.title ?? null) })
        const uniqueIssues = Array.from(issueMap.entries()).map(([id, title]) => ({ id, title }))

        // Loop status
        const loopStatus = dealInFlight[0]?.loopStage
        const loopLabel = loopStatus === 'awaiting_approval' ? 'Awaiting PM'
          : loopStatus === 'in_cycle' ? 'In cycle'
          : dealLoops.length > 0 ? (dealLoops[0].loopStatus === 'shipped' ? 'Shipped' : dealLoops[0].loopStatus?.replace(/_/g, ' '))
          : null

        // Risk
        const topRisk = deal.primaryBlocker
          || (urgentEntry?.reason)
          || (staleEntry ? `No update in ${staleEntry.daysSinceUpdate}d` : null)

        // Close date
        const closeDays = deal.daysStale !== undefined ? null : null // not available in summary, we show daysStale

        const dotColor = deal.riskLevel === 'high' ? '#ef4444'
          : deal.riskLevel === 'medium' ? '#f59e0b'
          : '#22c55e'

        return (
          <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div
              style={{
                padding: '10px 14px',
                borderBottom: idx < topDeals.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                transition: 'background 0.12s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              {/* Row 1: Company, value, closing */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: dotColor, flexShrink: 0,
                }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.9)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {deal.company}
                </span>
                {deal.value > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
                    {fmtCurrency(deal.value, currency)}
                  </span>
                )}
                {deal.daysStale > 0 && (
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                    {deal.daysStale}d stale
                  </span>
                )}
              </div>

              {/* Row 2: Score, stage, risk */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', paddingLeft: '14px' }}>
                {score !== null && score !== undefined && (
                  <span style={{ fontSize: '10px', color: scoreColor(score), fontWeight: 600 }}>
                    Score: {score}
                    {scoreDelta ? ` (dropped ${scoreDelta}pts)` : ''}
                  </span>
                )}
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
                  {stageFmt(deal.stage)}
                </span>
                {loopLabel && (
                  <span style={{
                    fontSize: '9px', fontWeight: 600,
                    padding: '1px 6px', borderRadius: '3px',
                    background: loopStatus === 'in_cycle' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                    color: loopStatus === 'in_cycle' ? '#22c55e' : '#f59e0b',
                    border: `1px solid ${loopStatus === 'in_cycle' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  }}>
                    Loop: {loopLabel}
                  </span>
                )}
              </div>

              {/* Row 3: Risk reason */}
              {topRisk && (
                <div style={{ fontSize: '10px', color: '#f59e0b', paddingLeft: '14px', marginBottom: '3px' }}>
                  Risk: {topRisk}
                </div>
              )}

              {/* Row 4: Top action */}
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', paddingLeft: '14px', marginBottom: uniqueIssues.length > 0 ? '3px' : '0' }}>
                {'\u2192'} {deal.topAction}
              </div>

              {/* Row 5: Linked Linear issues */}
              {uniqueIssues.length > 0 && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', paddingLeft: '14px' }}>
                  {'\u2192'} {uniqueIssues.length} Linear issue{uniqueIssues.length !== 1 ? 's' : ''} linked
                  <span style={{ fontFamily: 'monospace', marginLeft: '4px' }}>
                    ({uniqueIssues.slice(0, 3).map(i => i.id).join(', ')}{uniqueIssues.length > 3 ? ', ...' : ''})
                  </span>
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ─── Pipeline Health Strip ───────────────────────────────────────────────────

function PipelineHealthStrip({ currency }: { currency: string }) {
  const { data: dealsRes } = useSWR<{ data: DealRow[] }>(
    '/api/deals', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const { data: brainData } = useSWR<BrainData>(
    '/api/brain', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )

  const deals = (dealsRes?.data ?? []).filter(
    (d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost'
  )
  const brain = brainData?.data
  const totalDeals = deals.length
  const totalPipeline = deals.reduce((acc: number, d: any) => acc + (Number(d.dealValue) || 0), 0)
  const scores = deals.map((d: any) => Number(d.conversionScore) || 0).filter((s: number) => s > 0)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0

  // Forecast = sum of value * probability
  const forecast = deals.reduce((acc: number, d: any) => {
    const prob = (Number(d.conversionScore) || 50) / 100
    return acc + (Number(d.dealValue) || 0) * prob
  }, 0)

  // Risk categories
  const staleIds = new Set((brain?.staleDeals ?? []).map(s => s.dealId))
  const urgentIds = new Set((brain?.urgentDeals ?? []).map(u => u.dealId))
  const atRisk = deals.filter((d: any) => staleIds.has(d.id) || urgentIds.has(d.id)).length
  const stale = deals.filter((d: any) => {
    const days = Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / 86400000)
    return days > 14 && !staleIds.has(d.id) && !urgentIds.has(d.id)
  }).length
  const onTrack = totalDeals - atRisk - stale

  const stats = [
    { label: `${totalDeals} deals`, value: null },
    { label: `${fmtCurrency(totalPipeline, currency)} pipeline`, value: null },
    { label: `${avgScore} avg score`, value: null },
    { label: `${fmtCurrency(forecast, currency)} forecast`, value: null },
  ]

  const buckets = [
    { count: atRisk, label: 'at risk', color: '#ef4444' },
    { count: onTrack, label: 'on track', color: '#22c55e' },
    { count: stale, label: 'stale', color: '#f59e0b' },
  ]

  return (
    <div style={{
      ...glass.card,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
    }}>
      {stats.map((s, i) => (
        <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
          {s.label}
          {i < stats.length - 1 && (
            <span style={{ color: 'rgba(255,255,255,0.15)', marginLeft: '16px' }}>|</span>
          )}
        </span>
      ))}
      <span style={{ flex: 1 }} />
      {buckets.map((b, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: b.color }} />
          {b.count} {b.label}
        </span>
      ))}
    </div>
  )
}

// ─── Active Loops Table ──────────────────────────────────────────────────────

function ActiveLoopsTable({ currency }: { currency: string }) {
  const { data: loopsRes, isLoading } = useSWR<{ data: LoopEntry[] }>(
    '/api/loops', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  )
  const loops = loopsRes?.data ?? []

  if (isLoading) {
    return <Skeleton h={100} />
  }

  if (loops.length === 0) {
    return (
      <div style={{ ...glass.card, padding: '14px', textAlign: 'center' }}>
        <p style={{ ...text.muted, margin: 0 }}>No active loops. Link a deal to a Linear issue to start one.</p>
      </div>
    )
  }

  const thStyle: React.CSSProperties = {
    ...text.label,
    padding: '6px 10px',
    textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '7px 10px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.75)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '180px',
  }

  return (
    <div style={{ ...glass.card, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Deal</th>
            <th style={thStyle}>Issue</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Days</th>
          </tr>
        </thead>
        <tbody>
          {loops.slice(0, 10).map(loop => {
            const statusColor = loop.loopStatus === 'in_cycle' ? '#22c55e'
              : loop.loopStatus === 'awaiting_approval' ? '#f59e0b'
              : loop.loopStatus === 'shipped' ? '#3b82f6'
              : 'rgba(255,255,255,0.4)'
            const statusLabel = loop.loopStatus === 'in_cycle' ? 'In cycle'
              : loop.loopStatus === 'awaiting_approval' ? 'Awaiting PM'
              : loop.loopStatus === 'shipped' ? 'Shipped'
              : stageFmt(loop.loopStatus ?? '')

            const days = loop.daysInStatus
            const warn = days !== null && days > 5

            return (
              <tr
                key={`${loop.dealId}-${loop.linearIssueId}`}
                style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                onClick={() => { window.location.href = `/deals/${loop.dealId}` }}
              >
                <td style={{ ...tdStyle, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                  {loop.company}
                </td>
                <td style={tdStyle}>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                    {loop.linearIssueId}
                  </span>
                  {loop.linearTitle && (
                    <span style={{ marginLeft: '6px', color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
                      ({loop.linearTitle.length > 30 ? loop.linearTitle.slice(0, 30) + '...' : loop.linearTitle})
                    </span>
                  )}
                </td>
                <td style={tdStyle}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColor }} />
                    {statusLabel}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                  {fmtCurrency(loop.dealValue, currency)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {days !== null ? `${days}d` : '-'}
                  {warn && <span style={{ marginLeft: '3px', color: '#f59e0b' }}>{'\u26a0\ufe0f'}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Intelligence Section ────────────────────────────────────────────────────

function IntelligenceSection() {
  const { data: brainData } = useSWR<BrainData>(
    '/api/brain', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const brain = brainData?.data

  const insights: string[] = []

  // Key patterns
  for (const kp of brain?.keyPatterns ?? []) {
    if (kp.dealIds.length > 1) {
      insights.push(`${kp.dealIds.length} deals mention "${kp.label}" as a pattern.`)
    }
  }

  // Win/loss intel
  if (brain?.winLossIntel) {
    const wl = brain.winLossIntel
    if (wl.winRate > 0) {
      insights.push(`Win rate: ${Math.round(wl.winRate * 100)}% (${wl.winCount}W / ${wl.lossCount}L).`)
    }
  }

  // Top risks
  for (const risk of (brain?.topRisks ?? []).slice(0, 2)) {
    insights.push(risk)
  }

  // Daily briefing snippet
  if (brain?.dailyBriefing) {
    const brief = brain.dailyBriefing.length > 120 ? brain.dailyBriefing.slice(0, 120) + '...' : brain.dailyBriefing
    insights.unshift(brief)
  }

  if (insights.length === 0) {
    return (
      <div style={{ ...glass.card, padding: '12px 14px' }}>
        <p style={{ ...text.muted, margin: 0 }}>Brain is learning. Insights will appear after a few deals.</p>
      </div>
    )
  }

  return (
    <div style={{ ...glass.card, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {insights.slice(0, 4).map((insight, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', marginTop: '2px', flexShrink: 0 }}>{'\u2022'}</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.4' }}>
            {insight}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionLabel({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
      <span style={{ fontSize: '12px' }}>{emoji}</span>
      <span style={{ ...text.label, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
    </div>
  )
}

// ─── Brain Status Dot ────────────────────────────────────────────────────────

function BrainDot() {
  const { data: brainData } = useSWR<BrainData>(
    '/api/brain', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )

  const isStale = brainData?.meta?.isStale ?? true
  const lastRebuilt = brainData?.meta?.lastRebuilt
  const color = !brainData?.data ? 'rgba(255,255,255,0.2)' : isStale ? '#f59e0b' : '#22c55e'

  let label = 'Brain: offline'
  if (brainData?.data && lastRebuilt) {
    const mins = Math.floor((Date.now() - new Date(lastRebuilt).getTime()) / 60000)
    if (mins < 60) label = `Brain: ${mins}m ago`
    else if (mins < 1440) label = `Brain: ${Math.floor(mins / 60)}h ago`
    else label = `Brain: ${Math.floor(mins / 1440)}d ago`
  } else if (brainData?.data) {
    label = 'Brain: active'
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
      {label}
    </span>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TodayPage() {
  const { data: configRes } = useSWR<PipelineConfig>(
    '/api/pipeline-config', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 120000 },
  )

  const currency = (configRes?.data?.currency as string) || '\u00a3'

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1100px' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: '20px',
      }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', margin: '0 0 2px' }}>
            TODAY
            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.35)', marginLeft: '10px', fontSize: '13px' }}>
              {dateStr}
            </span>
          </h1>
        </div>
        <BrainDot />
      </div>

      {/* DO NOW */}
      <SectionLabel emoji={'\u26a1'} label="DO NOW" />
      <div style={{ marginBottom: '20px' }}>
        <DoNowSection currency={currency} />
      </div>

      {/* PIPELINE HEALTH */}
      <SectionLabel emoji={'\ud83d\udcca'} label="PIPELINE HEALTH" />
      <div style={{ marginBottom: '20px' }}>
        <PipelineHealthStrip currency={currency} />
      </div>

      {/* ACTIVE LOOPS */}
      <SectionLabel emoji={'\ud83d\udd04'} label="ACTIVE LOOPS" />
      <div style={{ marginBottom: '20px' }}>
        <ActiveLoopsTable currency={currency} />
      </div>

      {/* INTELLIGENCE */}
      <SectionLabel emoji={'\ud83d\udca1'} label="INTELLIGENCE" />
      <div style={{ marginBottom: '20px' }}>
        <IntelligenceSection />
      </div>
    </div>
  )
}
