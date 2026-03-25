'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
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
    productGapPriority?: Array<{
      gap: string
      openRevenue: number
      dealCount: number
    }>
    updatedAt?: string
  }
  meta?: {
    lastRebuilt: string | null
    isStale: boolean
  }
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

function fmtCurrency(n: number | string | null | undefined, sym = '£'): string {
  if (!n && n !== 0) return ''
  const v = Number(n)
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `${sym}${Math.round(v / 1_000)}k`
  return `${sym}${Math.round(v)}`
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
    borderRadius: '12px',
  } as React.CSSProperties,
}

const cardHeader: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: '10px',
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

// ─── Revenue Impact Strip ───────────────────────────────────────────────────

function RevenueImpactStrip({ currency }: { currency: string }) {
  const { data: dealsRes } = useSWR<{ data: DealRow[] }>(
    '/api/deals', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const { data: loopsRes } = useSWR<{ data: LoopEntry[] }>(
    '/api/loops', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  )
  const { data: brainData } = useSWR<BrainData>(
    '/api/brain', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )

  const deals = (dealsRes?.data ?? []).filter(
    (d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost'
  )
  const loops = loopsRes?.data ?? []
  const brain = brainData?.data

  const totalPipeline = deals.reduce((acc: number, d: any) => acc + (Number(d.dealValue) || 0), 0)
  const issuesLinked = loops.length
  const uniqueDealsWithLoops = new Set(loops.map(l => l.dealId)).size

  // Revenue blocked = value of deals that have loops with status != shipped
  const blockedDealIds = new Set(loops.filter(l => l.loopStatus !== 'shipped').map(l => l.dealId))
  const revenueBlocked = deals
    .filter((d: any) => blockedDealIds.has(d.id))
    .reduce((acc: number, d: any) => acc + (Number(d.dealValue) || 0), 0)

  // Revenue unlocked = value of deals where all linked loops are shipped
  const shippedDealIds = new Set(loops.filter(l => l.loopStatus === 'shipped').map(l => l.dealId))
  const revenueUnlocked = deals
    .filter((d: any) => shippedDealIds.has(d.id) && !blockedDealIds.has(d.id))
    .reduce((acc: number, d: any) => acc + (Number(d.dealValue) || 0), 0)

  const atRiskCount = (brain?.urgentDeals?.length ?? 0) + (brain?.staleDeals?.length ?? 0)

  // Pipeline stats
  const scores = deals.map((d: any) => Number(d.conversionScore) || 0).filter((s: number) => s > 0)
  const avgScore = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0

  const metrics = [
    { label: 'Open deals', value: `${deals.length}`, color: 'rgba(255,255,255,0.9)' },
    { label: 'Pipeline', value: fmtCurrency(totalPipeline, currency), color: 'rgba(255,255,255,0.9)' },
    { label: 'Avg score', value: `${avgScore}%`, color: avgScore >= 50 ? '#22c55e' : avgScore >= 30 ? '#f59e0b' : '#ef4444' },
    { label: 'Issues linked', value: `${issuesLinked}`, color: 'rgba(255,255,255,0.9)' },
    { label: 'At risk', value: `${atRiskCount}`, color: atRiskCount > 0 ? '#f59e0b' : '#22c55e' },
  ]

  return (
    <div style={{
      ...glass.card,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      flexWrap: 'wrap',
    }}>
      {metrics.map((m, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
            {m.label}
          </span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: m.color, letterSpacing: '-0.02em' }}>
            {m.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Core Loop Status ───────────────────────────────────────────────────────

function CoreLoopCard({ currency }: { currency: string }) {
  const { data: loopsRes, isLoading } = useSWR<{ data: LoopEntry[] }>(
    '/api/loops', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  )
  const { data: brainData } = useSWR<BrainData>(
    '/api/brain', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )

  const loops = loopsRes?.data ?? []
  const brain = brainData?.data

  if (isLoading) return <Skeleton h={120} />

  if (loops.length === 0) {
    return (
      <div style={{ ...glass.card, padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>
          No active loops yet
        </p>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          Log a deal and Halvex will match it to Linear issues automatically.
        </p>
      </div>
    )
  }

  // Group loops by status
  const awaitingPM = loops.filter(l => l.loopStatus === 'awaiting_approval')
  const inCycle = loops.filter(l => l.loopStatus === 'in_cycle')
  const shipped = loops.filter(l => l.loopStatus === 'shipped')

  // Revenue by status
  const revenueByStatus = (items: LoopEntry[]) => {
    const dealIds = new Set(items.map(l => l.dealId))
    return items.reduce((acc, l) => acc + (l.dealValue || 0), 0)
  }

  const statuses = [
    { label: 'Awaiting PM', count: awaitingPM.length, revenue: revenueByStatus(awaitingPM), color: '#f59e0b', dotPulse: true },
    { label: 'In cycle', count: inCycle.length, revenue: revenueByStatus(inCycle), color: '#3b82f6', dotPulse: false },
    { label: 'Shipped', count: shipped.length, revenue: revenueByStatus(shipped), color: '#22c55e', dotPulse: false },
  ]

  // Nudges from brain
  const productGaps = brain?.productGapPriority?.slice(0, 3) ?? []

  return (
    <div style={{ ...glass.card, overflow: 'hidden' }}>
      {/* Status flow */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {statuses.map((s, i) => (
          <div key={i} style={{
            flex: 1,
            padding: '14px 16px',
            borderRight: i < statuses.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', background: s.color,
                animation: s.dotPulse && s.count > 0 ? 'pulse-dot 2s ease infinite' : 'none',
              }} />
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                {s.label}
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: s.count > 0 ? s.color : 'rgba(255,255,255,0.2)', letterSpacing: '-0.02em' }}>
              {s.count}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
              {fmtCurrency(s.revenue, currency)} revenue
            </div>
          </div>
        ))}
      </div>

      {/* PM Nudge: top product gaps by revenue */}
      {productGaps.length > 0 && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: '6px' }}>
            PM: Prioritize to unblock revenue
          </span>
          {productGaps.map((gap, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', flex: 1 }}>
                {gap.gap}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#ef4444', flexShrink: 0 }}>
                {fmtCurrency(gap.openRevenue, currency)} at risk
              </span>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                {gap.dealCount} deal{gap.dealCount !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Flow diagram: Deal → Issue → Ship → Close */}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
        {['Deal logged', 'Issues matched', 'PM prioritizes', 'Issue shipped', 'Deal closes'].map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '9px', fontWeight: 500, color: 'rgba(255,255,255,0.45)',
              padding: '3px 8px', borderRadius: '4px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {step}
            </span>
            {i < 4 && (
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px' }}>{'\u2192'}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sales Actions ──────────────────────────────────────────────────────────

function SalesActionsCard({ currency }: { currency: string }) {
  const { data: summaryRes, isLoading } = useSWR<SummaryData>(
    '/api/dashboard/summary', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const { data: brainData } = useSWR<BrainData>(
    '/api/brain', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const { data: loopsRes } = useSWR<{ data: LoopEntry[] }>(
    '/api/loops', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  )

  const topDeals = summaryRes?.data?.topDeals ?? []
  const brain = brainData?.data
  const loops = loopsRes?.data ?? []

  if (isLoading) return <Skeleton h={200} />

  if (topDeals.length === 0) {
    return (
      <div style={{ ...glass.card, padding: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>No deals need attention right now.</p>
      </div>
    )
  }

  return (
    <div style={{ ...glass.card, overflow: 'hidden' }}>
      {topDeals.slice(0, 6).map((deal, idx) => {
        // Get linked issues
        const dealLoops = loops.filter(l => l.dealId === deal.id)
        const issueCount = dealLoops.length
        const nearestShip = dealLoops.find(l => l.loopStatus === 'in_cycle')

        const dotColor = deal.riskLevel === 'high' ? '#ef4444'
          : deal.riskLevel === 'medium' ? '#f59e0b' : '#22c55e'

        return (
          <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: idx < topDeals.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                transition: 'background 0.12s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              {/* Row 1: Company + value + stage */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.9)', flex: 1 }}>
                  {deal.company}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                  {fmtCurrency(deal.value, currency)}
                </span>
                <span style={{
                  fontSize: '9px', padding: '1px 6px', borderRadius: '3px',
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {stageFmt(deal.stage)}
                </span>
              </div>

              {/* Row 2: What to do */}
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', paddingLeft: '14px', marginBottom: '2px' }}>
                {'\u2192'} {deal.topAction}
              </div>

              {/* Row 3: Issue status + risk */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '14px' }}>
                {issueCount > 0 && (
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>
                    {issueCount} issue{issueCount !== 1 ? 's' : ''} linked
                    {nearestShip && ' \u00b7 in cycle'}
                  </span>
                )}
                {deal.primaryBlocker && (
                  <span style={{ fontSize: '9px', color: '#f59e0b' }}>
                    {deal.primaryBlocker}
                  </span>
                )}
              </div>
            </div>
          </Link>
        )
      })}
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

  if (isLoading) return <Skeleton h={100} />

  if (loops.length === 0) {
    return (
      <div style={{ ...glass.card, padding: '14px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>No active loops yet.</p>
      </div>
    )
  }

  const thStyle: React.CSSProperties = {
    fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    padding: '8px 12px',
    textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.7)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '200px',
  }

  return (
    <div style={{ ...glass.card, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Deal</th>
            <th style={thStyle}>Linear issue</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Days</th>
          </tr>
        </thead>
        <tbody>
          {loops.slice(0, 12).map(loop => {
            const statusColor = loop.loopStatus === 'in_cycle' ? '#3b82f6'
              : loop.loopStatus === 'awaiting_approval' ? '#f59e0b'
              : loop.loopStatus === 'shipped' ? '#22c55e'
              : 'rgba(255,255,255,0.3)'
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
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                onClick={() => { window.location.href = `/deals/${loop.dealId}` }}
              >
                <td style={{ ...tdStyle, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                  {loop.company}
                </td>
                <td style={tdStyle}>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
                    {loop.linearIssueId}
                  </span>
                  {loop.linearTitle && (
                    <span style={{ marginLeft: '6px', color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>
                      {loop.linearTitle.length > 35 ? loop.linearTitle.slice(0, 35) + '...' : loop.linearTitle}
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
                <td style={{ ...tdStyle, textAlign: 'right', color: warn ? '#f59e0b' : tdStyle.color }}>
                  {days !== null ? `${days}d` : '–'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Card 1: AI Focus Briefing ──────────────────────────────────────────────

function AIFocusBriefingCard() {
  const [briefing, setBriefing] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Load CACHED briefing on mount (GET = zero API cost)
  useEffect(() => {
    fetch('/api/dashboard/focus-briefing')
      .then(r => r.json())
      .then(data => {
        if (data?.text) {
          setBriefing(data.text)
          setGeneratedAt(data.generatedAt ?? null)
        }
        setHasLoaded(true)
      })
      .catch(() => setHasLoaded(true))
  }, [])

  // Regenerate on explicit refresh (POST = Haiku API call)
  async function regenerate() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/focus-briefing', { method: 'POST' })
      const data = await res.json()
      if (data?.text) {
        setBriefing(data.text)
        setGeneratedAt(data.generatedAt ?? null)
      }
      setHasLoaded(true)
    } catch (e) {
      console.error('Failed to generate briefing:', e)
    } finally {
      setLoading(false)
    }
  }

  // Simple markdown-like rendering
  function renderBriefing(text: string) {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim()
      if (!trimmed) return <div key={i} style={{ height: '6px' }} />

      // Section headers with emoji
      if (trimmed.startsWith('🔴') || trimmed.startsWith('🟡') || trimmed.startsWith('🟢')) {
        return (
          <div key={i} style={{
            fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.85)',
            marginTop: i > 0 ? '10px' : '0', marginBottom: '4px',
          }}>
            {trimmed.replace(/\*\*/g, '')}
          </div>
        )
      }

      // Numbered items
      if (/^\d+\./.test(trimmed)) {
        const [num, ...rest] = trimmed.split('.')
        const content = rest.join('.').trim()
        // Bold deal names
        const formatted = content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        return (
          <div key={i} style={{
            display: 'flex', gap: '6px', marginBottom: '4px', paddingLeft: '2px',
          }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, width: '14px', flexShrink: 0 }}>
              {num}.
            </span>
            <span
              style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}
              dangerouslySetInnerHTML={{ __html: formatted }}
            />
          </div>
        )
      }

      // Bullet points
      if (trimmed.startsWith('►') || trimmed.startsWith('•') || trimmed.startsWith('-')) {
        const content = trimmed.slice(1).trim().replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        return (
          <div key={i} style={{
            display: 'flex', gap: '6px', marginBottom: '3px', paddingLeft: '2px',
          }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>►</span>
            <span
              style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5' }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        )
      }

      // Separator
      if (trimmed === '---') {
        return <div key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '6px 0' }} />
      }

      // Regular text (summary line)
      const formatted = trimmed.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      return (
        <span
          key={i}
          style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.5', display: 'block' }}
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      )
    })
  }

  return (
    <div style={{ ...glass.card, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ ...cardHeader, marginBottom: 0 }}>🧠 What to focus on today</span>
          {generatedAt && (
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>
              {new Date(generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button
          onClick={regenerate}
          disabled={loading}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '6px', padding: '3px 8px', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: '4px',
            opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s',
          }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          {loading ? 'Thinking...' : 'Refresh'}
        </button>
      </div>

      {loading && !briefing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px 0' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            Analysing your pipeline...
          </span>
        </div>
      )}

      {briefing && (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {renderBriefing(briefing)}
        </div>
      )}

      {!briefing && hasLoaded && !loading && (
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          Click refresh to generate your daily focus briefing.
        </p>
      )}
    </div>
  )
}

// ─── Card 2: Top 3 Sales Actions ────────────────────────────────────────────

function TopSalesActionsCard({ currency }: { currency: string }) {
  const { data: summaryRes } = useSWR<SummaryData>(
    '/api/dashboard/summary', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const topDeals = summaryRes?.data?.topDeals ?? []

  return (
    <div style={{ ...glass.card, padding: '14px 16px' }}>
      <div style={{ ...cardHeader }}>🎯 Do now — 3 actions to move the needle</div>
      {topDeals.length === 0 ? (
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>No urgent actions right now.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {topDeals.slice(0, 3).map((deal, i) => (
            <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', gap: '8px', alignItems: 'flex-start',
                padding: '6px 8px', borderRadius: '6px',
                transition: 'background 0.12s', cursor: 'pointer',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <span style={{
                  fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.25)',
                  width: '16px', flexShrink: 0, marginTop: '1px',
                }}>
                  {i + 1}.
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                    {deal.company} <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>({fmtCurrency(deal.value, currency)})</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>
                    → {deal.topAction}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Card 3: Top 3 Deals At Risk ────────────────────────────────────────────

function DealsAtRiskCard({ currency }: { currency: string }) {
  const { data: brainData } = useSWR<BrainData>(
    '/api/brain', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const { data: summaryRes } = useSWR<SummaryData>(
    '/api/dashboard/summary', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )

  const brain = brainData?.data
  const topDeals = summaryRes?.data?.topDeals ?? []

  // Merge brain urgentDeals + staleDeals with summary risk data
  const atRisk = topDeals
    .filter(d => d.riskLevel === 'high' || d.riskLevel === 'medium')
    .slice(0, 3)

  // Enrich with brain reasons
  const urgentMap = new Map((brain?.urgentDeals ?? []).map(u => [u.dealId, u]))
  const staleMap = new Map((brain?.staleDeals ?? []).map(s => [s.dealId, s]))

  return (
    <div style={{ ...glass.card, padding: '14px 16px' }}>
      <div style={{ ...cardHeader }}>⚠️ Deals at risk — needs attention</div>
      {atRisk.length === 0 ? (
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>No deals at risk right now.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {atRisk.map((deal) => {
            const urgent = urgentMap.get(deal.id)
            const stale = staleMap.get(deal.id)
            const reason = deal.primaryBlocker
              || urgent?.reason
              || (stale ? `No activity in ${stale.daysSinceUpdate} days` : null)
              || 'Score declining'

            const dotColor = deal.riskLevel === 'high' ? '#ef4444' : '#f59e0b'

            return (
              <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '6px 8px', borderRadius: '6px',
                  transition: 'background 0.12s', cursor: 'pointer',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', flex: 1 }}>
                      {deal.company}
                    </span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                      {fmtCurrency(deal.value, currency)}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: dotColor, paddingLeft: '12px' }}>
                    {reason}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Card 4: Top 3 Linear Issues to Unlock Revenue ─────────────────────────

function IssuesUnlockRevenueCard({ currency }: { currency: string }) {
  const { data: brainData } = useSWR<BrainData>(
    '/api/brain', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const { data: loopsRes } = useSWR<{ data: LoopEntry[] }>(
    '/api/loops', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  )

  const brain = brainData?.data
  const loops = loopsRes?.data ?? []

  // Use productGapPriority if available, otherwise derive from loops
  const productGaps = brain?.productGapPriority?.slice(0, 3) ?? []

  // Group loops by issue, sum revenue, track companies
  const issueRevenue = new Map<string, { id: string; title: string | null; revenue: number; dealCount: number; status: string | null; company: string | null }>()
  for (const loop of loops) {
    if (loop.loopStatus === 'shipped') continue // already done
    const existing = issueRevenue.get(loop.linearIssueId)
    if (existing) {
      existing.revenue += loop.dealValue || 0
      existing.dealCount++
    } else {
      issueRevenue.set(loop.linearIssueId, {
        id: loop.linearIssueId,
        title: loop.linearTitle,
        revenue: loop.dealValue || 0,
        dealCount: 1,
        status: loop.loopStatus,
        company: loop.company,
      })
    }
  }
  const topIssues = Array.from(issueRevenue.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)

  const hasLoopIssues = topIssues.length > 0

  return (
    <div style={{ ...glass.card, padding: '14px 16px' }}>
      <div style={{ ...cardHeader }}>🔧 PM — ship these to unlock revenue</div>
      {!hasLoopIssues ? (
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          Rematch deals to Linear issues to see which features unlock the most revenue.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {topIssues.map((issue) => {
            const statusColor = issue.status === 'in_cycle' ? '#3b82f6'
              : issue.status === 'awaiting_approval' ? '#f59e0b'
              : issue.status === 'suggested' ? 'rgba(255,255,255,0.3)'
              : 'rgba(255,255,255,0.3)'
            const statusLabel = issue.status === 'in_cycle' ? 'In cycle'
              : issue.status === 'awaiting_approval' ? 'Awaiting PM'
              : issue.status === 'suggested' ? 'Suggested'
              : issue.status === 'confirmed' ? 'Confirmed'
              : stageFmt(issue.status ?? '')

            return (
              <div key={issue.id} style={{ padding: '6px 8px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
                    {issue.id}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#ef4444', flexShrink: 0 }}>
                    {fmtCurrency(issue.revenue, currency)}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginBottom: '3px', lineHeight: '1.4' }}>
                  {issue.title ?? issue.id}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: statusColor }} />
                    {statusLabel}
                  </span>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
                    · {issue.dealCount} deal{issue.dealCount !== 1 ? 's' : ''} blocked
                  </span>
                  {issue.company && (
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
                      · {issue.company}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.35)', marginBottom: '8px',
    }}>
      {label}
    </div>
  )
}

// ─── Brain Status ────────────────────────────────────────────────────────────

function BrainStatus() {
  const { data: brainData } = useSWR<BrainData>(
    '/api/brain', fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )

  const isStale = brainData?.meta?.isStale ?? true
  const lastRebuilt = brainData?.meta?.lastRebuilt
  const color = !brainData?.data ? 'rgba(255,255,255,0.2)' : isStale ? '#f59e0b' : '#22c55e'

  let label = 'Brain offline'
  if (brainData?.data && lastRebuilt) {
    const mins = Math.floor((Date.now() - new Date(lastRebuilt).getTime()) / 60000)
    if (mins < 2) label = 'Brain live'
    else if (mins < 60) label = `Brain ${mins}m ago`
    else if (mins < 1440) label = `Brain ${Math.floor(mins / 60)}h ago`
    else label = `Brain ${Math.floor(mins / 1440)}d ago`
  } else if (brainData?.data) {
    label = 'Brain active'
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%', background: color,
        animation: !isStale ? 'pulse-dot 3s ease infinite' : 'none',
      }} />
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

  const currency = (configRes?.data?.currency as string) || '£'

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1100px' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>

      {/* Header + pipeline strip */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: 0, letterSpacing: '-0.02em' }}>
            Today <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.3)', marginLeft: '8px' }}>{dateStr}</span>
          </h1>
          <BrainStatus />
        </div>
        <RevenueImpactStrip currency={currency} />
      </div>

      {/* AI Focus Briefing — full width */}
      <div style={{ marginBottom: '16px' }}>
        <AIFocusBriefingCard />
      </div>

      {/* 3 cards: Sales actions | Deals at risk | PM issues */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        marginBottom: '24px',
      }}>
        <TopSalesActionsCard currency={currency} />
        <DealsAtRiskCard currency={currency} />
        <IssuesUnlockRevenueCard currency={currency} />
      </div>

      {/* Active Loops — detail view below the fold */}
      <SectionLabel label="Active loops" />
      <ActiveLoopsTable currency={currency} />
    </div>
  )
}
