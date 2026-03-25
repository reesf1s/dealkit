'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ArrowUpRight, AlertCircle, Brain, Zap, Sparkles, Calendar, ChevronRight,
  CheckCircle2, Clock, Target,
} from 'lucide-react'
import type { LoopEntry } from '@/app/api/loops/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ─── Shared Types ─────────────────────────────────────────────────────────────

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
    winLossIntel?: {
      winRate: number
      winCount: number
      lossCount: number
    }
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

interface AIAction {
  dealId: string
  company: string
  action: string
  revenueAtRisk: number | null
  confidence: number
  type: 'stale' | 'objection' | 'feature' | 'urgent'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatCurrency(n: number | string | null | undefined): string {
  if (!n) return ''
  const v = Number(n)
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`
  return `$${Math.round(v)}`
}

function getRiskColor(score: number | null | undefined): string {
  if (!score || score <= 0) return '#ef4444'
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function buildAIActions(brain: BrainData['data'] | undefined): AIAction[] {
  if (!brain) return []
  const actions: AIAction[] = []

  // From urgent deals
  for (const ud of brain.urgentDeals?.slice(0, 2) ?? []) {
    actions.push({
      dealId: ud.dealId,
      company: ud.company,
      action: ud.topAction ?? ud.reason,
      revenueAtRisk: null,
      confidence: 75,
      type: 'urgent',
    })
  }

  // From stale deals: use objectionWinMap to generate smarter advice
  for (const sd of brain.staleDeals?.slice(0, 3) ?? []) {
    if (actions.find(a => a.dealId === sd.dealId)) continue
    const daysLeft = 14 - sd.daysSinceUpdate
    const winRateHint = brain.objectionWinMap?.[0]
    const confidence = winRateHint ? Math.round(winRateHint.winRateWithTheme) : 65
    const action = winRateHint
      ? `Contact ${sd.company} — ${winRateHint.theme} concerns, addressed within 7 days, win ${confidence}% of the time`
      : `Follow up with ${sd.company} — ${sd.daysSinceUpdate}d without contact. Avg stall before churn: 14d`

    actions.push({
      dealId: sd.dealId,
      company: sd.company,
      action,
      revenueAtRisk: sd.dealValue ? Number(sd.dealValue) : null,
      confidence,
      type: 'stale',
    })
  }

  // From key patterns
  for (const kp of brain.keyPatterns?.slice(0, 1) ?? []) {
    if (kp.dealIds.length === 0) continue
    const company = kp.companies[0] ?? kp.dealNames?.[0] ?? 'Deal'
    if (actions.find(a => a.dealId === kp.dealIds[0])) continue
    actions.push({
      dealId: kp.dealIds[0],
      company,
      action: `Pattern detected: "${kp.label}" across ${kp.dealIds.length} deal${kp.dealIds.length !== 1 ? 's' : ''}. Address proactively.`,
      revenueAtRisk: null,
      confidence: 70,
      type: 'objection',
    })
  }

  return actions.slice(0, 5)
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function SkeletonCard({ height = 100 }: { height?: number }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '16px',
        height,
        animation: 'pulse 2s ease-in-out infinite',
      }}
    />
  )
}

// ─── Section 0 (left): In-Flight Loops ───────────────────────────────────────

function InFlightLoopsSection() {
  const { data: loopData, isLoading } = useSWR<LoopSignalResponse>(
    '/api/dashboard/loop-signals',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )
  const { data: loopsRes } = useSWR<{ data: LoopEntry[] }>(
    '/api/loops',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  )
  const { data: brainData } = useSWR<BrainData>('/api/brain', fetcher, { revalidateOnFocus: false })

  const inFlight = loopData?.data?.inFlight ?? []
  const brain = brainData?.data
  const loopEntries = loopsRes?.data ?? []

  // Sort by brain risk: higher daysSinceUpdate = higher risk → show first
  const sorted = [...inFlight].sort((a, b) => {
    const aStale = brain?.staleDeals?.find(d => d.dealId === a.id)
    const bStale = brain?.staleDeals?.find(d => d.dealId === b.id)
    const aScore = aStale ? aStale.daysSinceUpdate : 0
    const bScore = bStale ? bStale.daysSinceUpdate : 0
    return bScore - aScore
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2].map(i => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (inFlight.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        <Zap size={20} style={{ color: '#7c3aed', marginBottom: '12px', opacity: 0.5 }} />
        <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
          Start your first loop
        </p>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
          Add a deal and meeting notes in the Deals tab. Halvex will automatically detect feature
          requests and connect them to your Linear backlog.
        </p>
        <Link
          href="/deals"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px',
            background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
            color: '#a78bfa', textDecoration: 'none', fontSize: '12px', fontWeight: 500,
          }}
        >
          View Deals <ArrowUpRight size={12} />
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {sorted.slice(0, 6).map((loop: InFlightLoop) => {
        const statusLabel = loop.loopStage === 'awaiting_approval' ? 'Waiting for PM' : 'Approved — In Cycle'
        const statusColor = loop.loopStage === 'awaiting_approval' ? '#f59e0b' : '#7c3aed'
        const stale = brain?.staleDeals?.find(d => d.dealId === loop.id)
        const riskReason = stale ? `Brain: No update in ${stale.daysSinceUpdate}d` : null
        // Feature request from loops
        const loopEntry = loopEntries.find(l => l.dealId === loop.id)

        return (
          <Link key={loop.id} href={`/deals/${loop.id}`} style={{ textDecoration: 'none' }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(18px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderLeft: '3px solid #7c3aed',
                borderRadius: '16px',
                padding: '16px',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.background = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.background = 'rgba(255,255,255,0.06)'
              }}
            >
              {/* Header: Company + Deal Value */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {loop.company}
                </div>
                {loop.dealValue && (
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
                    {formatCurrency(loop.dealValue)}
                  </div>
                )}
              </div>

              {/* Feature request */}
              {loopEntry?.featureRequest && (
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', margin: '0 0 8px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {loopEntry.featureRequest}
                </p>
              )}

              {/* Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '4px 10px', borderRadius: '6px',
                  background: `${statusColor}20`, border: `1px solid ${statusColor}40`,
                  fontSize: '11px', fontWeight: 600, color: statusColor,
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColor }} />
                  {statusLabel}
                </span>

                {/* Matched Linear issue */}
                {loop.inCycleIssues?.[0]?.linearIssueId && (
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                    {loop.inCycleIssues[0].linearIssueId}
                  </span>
                )}

                {/* Days in status */}
                {loopEntry?.daysInStatus != null && loopEntry.daysInStatus > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                    <Clock size={10} /> {loopEntry.daysInStatus}d
                  </span>
                )}

                {/* View Loop button */}
                <span style={{
                  marginLeft: 'auto',
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', color: '#a78bfa',
                }}>
                  View <ChevronRight size={10} />
                </span>
              </div>

              {/* Risk reason from brain */}
              {riskReason && (
                <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '8px' }}>
                  ⚠ {riskReason}
                </div>
              )}

              {/* Time */}
              {loop.pendingActionCreatedAt && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                  {timeAgo(loop.pendingActionCreatedAt)}
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ─── Section 1 (right-top): AI Actions ───────────────────────────────────────

function AIActionsSection() {
  const { data: brainData, isLoading } = useSWR<BrainData>('/api/brain', fetcher, {
    revalidateOnFocus: false,
  })
  const brain = brainData?.data
  const actions = buildAIActions(brain)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} height={72} />)}
      </div>
    )
  }

  if (actions.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
      }}>
        <CheckCircle2 size={16} color="#22c55e" style={{ marginBottom: '8px', opacity: 0.6 }} />
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          No urgent actions right now. Pipeline looks healthy.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {actions.map((action, i) => (
        <Link key={`${action.dealId}-${i}`} href={`/deals/${action.dealId}`} style={{ textDecoration: 'none' }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '12px',
              padding: '12px 14px',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ flexShrink: 0, marginTop: '1px' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '5px',
                  background: action.type === 'urgent' ? 'rgba(239,68,68,0.15)'
                    : action.type === 'stale' ? 'rgba(245,158,11,0.15)'
                    : 'rgba(124,58,237,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={10} color={
                    action.type === 'urgent' ? '#ef4444'
                    : action.type === 'stale' ? '#f59e0b'
                    : '#a78bfa'
                  } />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {action.company}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
                  {action.action}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  {action.revenueAtRisk && (
                    <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 600 }}>
                      {formatCurrency(action.revenueAtRisk)} at risk
                    </span>
                  )}
                  <span style={{
                    fontSize: '10px', color: 'rgba(255,255,255,0.35)',
                    padding: '1px 6px', borderRadius: '4px',
                    background: 'rgba(255,255,255,0.05)',
                  }}>
                    {action.confidence}% confidence
                  </span>
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '10px', fontWeight: 600,
                    color: '#7c3aed',
                    padding: '2px 8px', borderRadius: '5px',
                    background: 'rgba(124,58,237,0.12)',
                    border: '1px solid rgba(124,58,237,0.2)',
                  }}>
                    Do it →
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Section 2 (right-middle): Intent Matching ───────────────────────────────

interface DealWithActivity {
  id: string
  company: string
  stage: string
  dealValue: number | null
  lastActivityAt: string | null
  updatedAt: string | null
  intentSignal?: string | null
}

function IntentMatchingSection() {
  const { data: dealsRes, isLoading } = useSWR<{ data: DealWithActivity[] }>(
    '/api/deals',
    fetcher,
    { revalidateOnFocus: false },
  )

  const deals = dealsRes?.data ?? []
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  // Find deals with recent activity
  const recentDeals = deals
    .filter(d => {
      const at = d.lastActivityAt ?? d.updatedAt
      return at && new Date(at).getTime() > sevenDaysAgo
        && d.stage !== 'closed_won' && d.stage !== 'closed_lost'
    })
    .slice(0, 5)
    .map(d => ({
      ...d,
      lastAt: d.lastActivityAt ?? d.updatedAt,
    }))

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[1, 2].map(i => <SkeletonCard key={i} height={56} />)}
      </div>
    )
  }

  if (recentDeals.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '16px',
        textAlign: 'center',
      }}>
        <Calendar size={14} color="rgba(255,255,255,0.3)" style={{ marginBottom: '8px' }} />
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          No intent signals in the last 7 days.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {recentDeals.map(deal => {
        const stageFmt = (deal.stage ?? '').replace(/_/g, ' ')
        const signal = (deal as any).intentSignal ?? `Recent activity · ${stageFmt}`

        return (
          <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)' }}
            >
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(deal as any).prospectCompany ?? deal.company ?? 'Untitled'}
                  </span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                    {timeAgo(deal.lastAt!)}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {signal}
                </div>
              </div>
              {deal.dealValue && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                  {formatCurrency(deal.dealValue)}
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ─── Section 3 (right-bottom): Deals Needing Attention ───────────────────────

function DealsNeedingAttentionSection() {
  const { data: brainData } = useSWR<BrainData>('/api/brain', fetcher, {
    revalidateOnFocus: false,
  })
  const staleDeals = brainData?.data?.staleDeals ?? []
  const brain = brainData?.data

  if (!brain) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} height={56} />)}
      </div>
    )
  }

  const deals = staleDeals.slice(0, 5).map(deal => ({
    ...deal,
    riskColor: getRiskColor(deal.score ?? null),
    reason: deal.daysSinceUpdate > 14 ? `No update in ${deal.daysSinceUpdate} days` : `Last update ${deal.daysSinceUpdate}d ago`,
  }))

  if (deals.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '24px',
        textAlign: 'center',
      }}>
        <AlertCircle size={16} style={{ color: '#10b981', marginBottom: '8px', opacity: 0.5 }} />
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
          All deals are healthy
        </p>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          No deals need immediate attention.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {deals.map(deal => (
        <Link key={deal.dealId} href={`/deals/${deal.dealId}`} style={{ textDecoration: 'none' }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)' }}
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: deal.riskColor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.88)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                {deal.company}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deal.reason}
              </div>
            </div>
            {deal.dealValue && (
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                {formatCurrency(deal.dealValue)}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Section label component ──────────────────────────────────────────────────

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      {icon}
      <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', margin: 0 }}>
        {label}
      </h2>
      {count !== undefined && count > 0 && (
        <span style={{
          marginLeft: 'auto',
          fontSize: '11px', fontWeight: 600,
          padding: '2px 8px', borderRadius: '100px',
          background: 'rgba(124,58,237,0.2)', color: '#a78bfa',
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const { data: loopData } = useSWR<LoopSignalResponse>(
    '/api/dashboard/loop-signals',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )

  const inFlightCount = loopData?.data?.inFlight?.length ?? 0
  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  return (
    <div style={{
      padding: '32px',
      background: 'radial-gradient(ellipse 60% 50% at 20% 40%, rgba(124,58,237,0.08), transparent)',
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'rgba(255,255,255,0.95)', margin: 0, marginBottom: '4px' }}>
          Good {timeOfDay}
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          {inFlightCount > 0
            ? `${inFlightCount} loop${inFlightCount !== 1 ? 's' : ''} in flight`
            : 'No loops in flight yet. Start one today.'}
        </p>
      </div>

      {/* Two-column layout: 60% left / 40% right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>

        {/* ── Left column: In-Flight Loops ── */}
        <div>
          <SectionHeader
            icon={<Zap size={15} color="#7c3aed" />}
            label="In-Flight Loops"
            count={inFlightCount}
          />
          <InFlightLoopsSection />
        </div>

        {/* ── Right column: 3 stacked sections ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* Section 1: AI Actions */}
          <div>
            <SectionHeader
              icon={<Sparkles size={15} color="#f59e0b" />}
              label="AI Actions"
            />
            <AIActionsSection />
          </div>

          {/* Section 2: Intent Matching */}
          <div>
            <SectionHeader
              icon={<Calendar size={15} color="#60a5fa" />}
              label="Intent Matching"
            />
            <IntentMatchingSection />
          </div>

          {/* Section 3: Deals Needing Attention */}
          <div>
            <SectionHeader
              icon={<AlertCircle size={15} color="#ef4444" />}
              label="Deals Needing Attention"
            />
            <DealsNeedingAttentionSection />
          </div>

        </div>
      </div>
    </div>
  )
}
