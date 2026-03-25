'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Zap, Brain, ExternalLink, Clock, AlertTriangle, ChevronRight, Filter,
} from 'lucide-react'
import type { LoopEntry, LoopStatus } from '@/app/api/loops/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'awaiting_approval' | 'in_cycle' | 'shipped'

interface BrainData {
  data?: {
    staleDeals?: Array<{
      dealId: string
      company: string
      dealValue?: number | null
      daysSinceUpdate: number
      score?: number | null
    }>
    productGapPriority?: Array<{
      gapId: string
      title: string
      priority: string
      status: string
      revenueAtRisk: number
      dealsBlocked: number
    }>
    keyPatterns?: Array<{
      label: string
      dealIds: string[]
      companies: string[]
      dealNames: string[]
    }>
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number | null | undefined): string {
  if (!n) return ''
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n)}`
}

function getRiskScore(dealId: string, brain: BrainData['data']): number {
  const stale = brain?.staleDeals?.find(d => d.dealId === dealId)
  if (!stale) return 0
  const score = stale.score ?? 0
  if (score <= 0) return 80
  if (score < 40) return 70
  if (score < 70) return 40
  return 10
}

function getRiskReason(dealId: string, brain: BrainData['data']): string | null {
  const stale = brain?.staleDeals?.find(d => d.dealId === dealId)
  if (!stale) return null
  return `No update in ${stale.daysSinceUpdate} days`
}

const STATUS_CONFIG: Record<LoopStatus, {
  label: string
  bg: string
  color: string
  border: string
}> = {
  awaiting_approval: {
    label: 'Waiting for PM',
    bg: 'rgba(245,158,11,0.2)',
    color: '#f59e0b',
    border: 'rgba(245,158,11,0.3)',
  },
  in_cycle: {
    label: 'Approved — In Cycle',
    bg: 'rgba(124,58,237,0.2)',
    color: '#7c3aed',
    border: 'rgba(124,58,237,0.3)',
  },
  shipped: {
    label: 'Shipped',
    bg: 'rgba(34,197,94,0.2)',
    color: '#22c55e',
    border: 'rgba(34,197,94,0.3)',
  },
}

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'awaiting_approval', label: 'Waiting for PM' },
  { id: 'in_cycle', label: 'In Cycle' },
  { id: 'shipped', label: 'Shipped' },
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '16px',
      padding: '20px',
      height: '120px',
      animation: 'pulse 2s ease-in-out infinite',
    }} />
  )
}

// ─── Intelligence Callout ─────────────────────────────────────────────────────

function IntelligenceCallout({ brain, totalDeals }: { brain: BrainData['data'] | undefined; totalDeals: number }) {
  if (!brain) return null

  const topGap = brain.productGapPriority?.[0]
  const topPattern = brain.keyPatterns?.[0]

  let text = `Your AI brain analysed ${totalDeals} deal${totalDeals !== 1 ? 's' : ''}.`
  if (topGap && topGap.revenueAtRisk > 0) {
    text += ` Top risk: "${topGap.title}" is stalling ${topGap.dealsBlocked} deal${topGap.dealsBlocked !== 1 ? 's' : ''} worth ${formatCurrency(topGap.revenueAtRisk)}.`
  } else if (topPattern) {
    text += ` Top pattern: "${topPattern.label}" appears across ${topPattern.dealIds.length} deal${topPattern.dealIds.length !== 1 ? 's' : ''}.`
  }

  return (
    <div style={{
      background: 'rgba(124,58,237,0.08)',
      backdropFilter: 'blur(18px)',
      border: '1px solid rgba(124,58,237,0.2)',
      borderRadius: '12px',
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <Brain size={15} color="#a78bfa" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5 }}>
          {text}
        </p>
      </div>
      <Link
        href="/intelligence"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '5px 10px',
          borderRadius: '6px',
          background: 'rgba(124,58,237,0.15)',
          border: '1px solid rgba(124,58,237,0.3)',
          color: '#a78bfa',
          textDecoration: 'none',
          fontSize: '11px',
          fontWeight: 600,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        View in Intelligence <ChevronRight size={10} />
      </Link>
    </div>
  )
}

// ─── Loop Card ────────────────────────────────────────────────────────────────

function LoopCard({ loop, riskReason }: { loop: LoopEntry; riskReason: string | null }) {
  const cfg = STATUS_CONFIG[loop.loopStatus]

  let actionButton: React.ReactNode = null
  if (loop.loopStatus === 'awaiting_approval') {
    actionButton = (
      <button
        style={{
          padding: '6px 12px',
          borderRadius: '7px',
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.25)',
          color: '#f59e0b',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Remind PM
      </button>
    )
  } else if (loop.loopStatus === 'in_cycle' && loop.linearIssueUrl) {
    actionButton = (
      <a
        href={loop.linearIssueUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          borderRadius: '7px',
          background: 'rgba(124,58,237,0.12)',
          border: '1px solid rgba(124,58,237,0.25)',
          color: '#a78bfa',
          textDecoration: 'none',
          fontSize: '11px',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        View in Linear <ExternalLink size={10} />
      </a>
    )
  } else if (loop.loopStatus === 'shipped') {
    actionButton = (
      <button
        style={{
          padding: '6px 12px',
          borderRadius: '7px',
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.25)',
          color: '#22c55e',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Send Follow-up to Rep
      </button>
    )
  }

  return (
    <Link href={`/deals/${loop.dealId}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderLeft: '3px solid #7c3aed',
          borderRadius: '16px',
          padding: '18px 20px',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = 'rgba(255,255,255,0.08)'
          el.style.borderColor = 'rgba(255,255,255,0.15)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = 'rgba(255,255,255,0.06)'
          el.style.borderColor = 'rgba(255,255,255,0.1)'
        }}
      >
        {/* Row 1: Company + Deal value + action */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
                {loop.company}
              </span>
              {loop.dealValue && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                  {formatCurrency(loop.dealValue)}
                </span>
              )}
            </div>
          </div>
          {/* Stop link propagation for action button */}
          <div onClick={e => e.preventDefault()}>
            {actionButton}
          </div>
        </div>

        {/* Row 2: Feature request */}
        {loop.featureRequest && (
          <p style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.65)',
            margin: '0 0 10px',
            lineHeight: 1.45,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {loop.featureRequest}
          </p>
        )}

        {/* Row 3: Status badge + Linear issue + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status badge */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 9px',
            borderRadius: '6px',
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            fontSize: '11px',
            fontWeight: 600,
            color: cfg.color,
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
            {cfg.label}
          </span>

          {/* Linear issue ID */}
          {loop.linearIssueId && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
              {loop.linearIssueId}
            </span>
          )}

          {/* Days in status */}
          {loop.daysInStatus !== null && loop.daysInStatus > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
              <Clock size={10} />
              {loop.daysInStatus}d
            </span>
          )}

          {/* Risk reason from brain */}
          {riskReason && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#f59e0b' }}>
              <AlertTriangle size={10} />
              {riskReason}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoopsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const { data: loopsRes, isLoading: loopsLoading } = useSWR<{ data: LoopEntry[] }>(
    '/api/loops',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  )

  const { data: brainRes } = useSWR<BrainData>(
    '/api/brain',
    fetcher,
    { revalidateOnFocus: false },
  )

  const loops: LoopEntry[] = loopsRes?.data ?? []
  const brain = brainRes?.data

  // Filter
  const filtered = loops.filter(l =>
    activeFilter === 'all' ? true : l.loopStatus === activeFilter,
  )

  // Sort by deal value × risk score descending
  const sorted = [...filtered].sort((a, b) => {
    const aRisk = getRiskScore(a.dealId, brain)
    const bRisk = getRiskScore(b.dealId, brain)
    const aVal = (a.dealValue ?? 0) * (aRisk / 100 + 0.1)
    const bVal = (b.dealValue ?? 0) * (bRisk / 100 + 0.1)
    return bVal - aVal
  })

  const counts: Record<FilterTab, number> = {
    all: loops.length,
    awaiting_approval: loops.filter(l => l.loopStatus === 'awaiting_approval').length,
    in_cycle: loops.filter(l => l.loopStatus === 'in_cycle').length,
    shipped: loops.filter(l => l.loopStatus === 'shipped').length,
  }

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.95)',
            margin: '0 0 3px',
            letterSpacing: '-0.02em',
          }}>
            Active Loops
          </h1>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            ranked by revenue at risk
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={12} color="rgba(255,255,255,0.35)" />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{sorted.length} loop{sorted.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Intelligence callout */}
      <IntelligenceCallout brain={brain} totalDeals={loops.length} />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '4px', padding: '3px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', width: 'fit-content' }}>
        {FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: activeFilter === tab.id ? 600 : 400,
              color: activeFilter === tab.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
              background: activeFilter === tab.id ? 'rgba(255,255,255,0.09)' : 'transparent',
              border: `1px solid ${activeFilter === tab.id ? 'rgba(255,255,255,0.12)' : 'transparent'}`,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {tab.label}
            {counts[tab.id] > 0 && (
              <span style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '100px',
                background: activeFilter === tab.id ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.08)',
                color: activeFilter === tab.id ? '#a78bfa' : 'rgba(255,255,255,0.35)',
                fontWeight: 700,
              }}>
                {counts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loop cards */}
      {loopsLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : sorted.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '48px 32px',
          textAlign: 'center',
        }}>
          <Zap size={24} color="#7c3aed" style={{ opacity: 0.4, marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', margin: '0 0 8px' }}>
            No {activeFilter === 'all' ? '' : FILTER_TABS.find(t => t.id === activeFilter)?.label + ' '}loops yet
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Loops start when a deal&apos;s feature request gets linked to a Linear issue.
          </p>
          <Link
            href="/deals"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '16px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.3)',
              color: '#a78bfa',
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Start a loop from Deals
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sorted.map(loop => (
            <LoopCard
              key={loop.dealId}
              loop={loop}
              riskReason={getRiskReason(loop.dealId, brain)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
