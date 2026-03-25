'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ExternalLink, Clock, AlertTriangle, ChevronRight, ArrowUpRight,
  Zap, Settings2, Sparkles, Check, Circle, Timer, Truck,
} from 'lucide-react'
import type { LoopEntry, LoopStatus } from '@/app/api/loops/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ─── Types ───────────────────────────────────────────────────────────────────

type PageTab = 'core' | 'custom'
type FilterTab = 'all' | 'identified' | 'in_progress' | 'in_cycle' | 'shipped'

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

function fmt(n: number | null | undefined): string {
  if (!n) return ''
  if (n >= 1_000_000) return `\u00a3${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `\u00a3${Math.round(n / 1_000)}k`
  return `\u00a3${Math.round(n)}`
}

function fmtFull(n: number): string {
  if (n >= 1_000_000) return `\u00a3${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `\u00a3${Math.round(n / 1_000)}k`
  return `\u00a3${Math.round(n)}`
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

function daysSuffix(d: number | null): string {
  if (d === null || d === 0) return ''
  return `${d}d`
}

const STATUS_CONFIG: Record<LoopStatus, {
  label: string
  dotColor: string
  textColor: string
}> = {
  identified: {
    label: 'Identified',
    dotColor: '#f59e0b',
    textColor: '#f59e0b',
  },
  in_progress: {
    label: 'In Progress',
    dotColor: '#3b82f6',
    textColor: '#3b82f6',
  },
  in_review: {
    label: 'In Review',
    dotColor: '#8b5cf6',
    textColor: '#8b5cf6',
  },
  in_cycle: {
    label: 'In Cycle',
    dotColor: '#3b82f6',
    textColor: '#3b82f6',
  },
  shipped: {
    label: 'Shipped',
    dotColor: '#22c55e',
    textColor: '#22c55e',
  },
}

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'identified', label: 'Identified' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_cycle', label: 'In Cycle' },
  { id: 'shipped', label: 'Shipped' },
]

const FLOW_STEPS = ['Identified', 'In Progress', 'In Review', 'Shipped']

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} style={{ padding: '14px 12px' }}>
          <div style={{
            height: '12px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.06)',
            animation: 'pulse 2s ease-in-out infinite',
            width: i === 0 ? '12px' : i === 7 ? '70px' : '80px',
          }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Summary Strip ───────────────────────────────────────────────────────────

function SummaryStrip({ loops }: { loops: LoopEntry[] }) {
  // Deduplicate revenue by deal (don't count same deal multiple times)
  const uniqueDealRevenue = new Map<string, number>()
  for (const l of loops) { if (!uniqueDealRevenue.has(l.dealId)) uniqueDealRevenue.set(l.dealId, l.dealValue ?? 0) }
  const totalRevenue = Array.from(uniqueDealRevenue.values()).reduce((sum, v) => sum + v, 0)
  const identified = loops.filter(l => l.loopStatus === 'identified').length
  const inProgress = loops.filter(l => l.loopStatus === 'in_progress' || l.loopStatus === 'in_review' || l.loopStatus === 'in_cycle').length
  const shipped = loops.filter(l => l.loopStatus === 'shipped').length

  const items: { label: string; value: string; icon: React.ReactNode; color?: string }[] = [
    { label: 'Total Loops', value: String(loops.length), icon: <Zap size={13} /> },
    { label: 'Revenue at risk', value: fmtFull(totalRevenue), icon: <AlertTriangle size={13} />, color: totalRevenue > 0 ? '#f59e0b' : undefined },
    { label: 'Identified', value: String(identified), icon: <Timer size={13} />, color: identified > 0 ? '#f59e0b' : undefined },
    { label: 'In Progress', value: String(inProgress), icon: <Circle size={13} />, color: inProgress > 0 ? '#3b82f6' : undefined },
    { label: 'Shipped', value: String(shipped), icon: <Truck size={13} />, color: shipped > 0 ? '#22c55e' : undefined },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      gap: '1px',
      background: 'rgba(255,255,255,0.06)',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: item.color ?? 'rgba(255,255,255,0.35)' }}>{item.icon}</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{item.label}</span>
          </div>
          <span style={{
            fontSize: '18px',
            fontWeight: 700,
            color: item.color ?? 'rgba(255,255,255,0.9)',
            letterSpacing: '-0.02em',
          }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Revenue Blocked Banner ──────────────────────────────────────────────────

function RevenueBlockedBanner({ loops }: { loops: LoopEntry[] }) {
  const nonShipped = loops.filter(l => l.loopStatus !== 'shipped')
  // Deduplicate revenue by deal — don't count same deal multiple times
  const uniqueDeals = new Map<string, number>()
  for (const l of nonShipped) {
    if (!uniqueDeals.has(l.dealId)) uniqueDeals.set(l.dealId, l.dealValue ?? 0)
  }
  const blockedRevenue = Array.from(uniqueDeals.values()).reduce((sum, v) => sum + v, 0)
  const issueCount = nonShipped.length

  if (blockedRevenue === 0) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <span style={{
          fontSize: '16px',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.92)',
          letterSpacing: '-0.02em',
        }}>
          {fmtFull(blockedRevenue)}
        </span>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginLeft: '8px' }}>
          revenue blocked by {issueCount} issue{issueCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{
        fontSize: '11px',
        color: 'rgba(255,255,255,0.35)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        {FLOW_STEPS.map((step, i) => (
          <span key={step} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {step}
            {i < FLOW_STEPS.length - 1 && <ChevronRight size={10} style={{ opacity: 0.4 }} />}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Status Dot ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: LoopStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: cfg.dotColor,
      display: 'inline-block',
      flexShrink: 0,
      boxShadow: `0 0 6px ${cfg.dotColor}40`,
    }} />
  )
}

// ─── Core Loop Table ─────────────────────────────────────────────────────────

function CoreLoopTable({
  loops,
  brain,
  activeFilter,
  setActiveFilter,
  isLoading,
}: {
  loops: LoopEntry[]
  brain: BrainData['data'] | undefined
  activeFilter: FilterTab
  setActiveFilter: (f: FilterTab) => void
  isLoading: boolean
}) {
  const filtered = loops.filter(l =>
    activeFilter === 'all' ? true : l.loopStatus === activeFilter,
  )

  const sorted = [...filtered].sort((a, b) => {
    const aRisk = getRiskScore(a.dealId, brain)
    const bRisk = getRiskScore(b.dealId, brain)
    const aVal = (a.dealValue ?? 0) * (aRisk / 100 + 0.1)
    const bVal = (b.dealValue ?? 0) * (bRisk / 100 + 0.1)
    return bVal - aVal
  })

  const counts: Record<FilterTab, number> = {
    all: loops.length,
    identified: loops.filter(l => l.loopStatus === 'identified').length,
    in_progress: loops.filter(l => l.loopStatus === 'in_progress' || l.loopStatus === 'in_review').length,
    in_cycle: loops.filter(l => l.loopStatus === 'in_cycle').length,
    shipped: loops.filter(l => l.loopStatus === 'shipped').length,
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: '10px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '13px 12px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.7)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    verticalAlign: 'middle',
  }

  return (
    <>
      {/* Filter bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '3px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '10px',
        width: 'fit-content',
      }}>
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
              background: activeFilter === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: `1px solid ${activeFilter === tab.id ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
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
                background: activeFilter === tab.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
                color: activeFilter === tab.id ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                fontWeight: 700,
              }}>
                {counts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '32px', paddingRight: '0' }}></th>
              <th style={thStyle}>Deal</th>
              <th style={thStyle}>Revenue</th>
              <th style={thStyle}>Issue</th>
              <th style={thStyle}>Why matched</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Days</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <Zap size={20} color="rgba(255,255,255,0.2)" style={{ marginBottom: '10px' }} />
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 6px' }}>
                    No {activeFilter === 'all' ? '' : FILTER_TABS.find(t => t.id === activeFilter)?.label + ' '}loops yet
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                    Loops start when a deal&apos;s feature request gets linked to a Linear issue.
                  </p>
                </td>
              </tr>
            ) : (
              sorted.map(loop => {
                const cfg = STATUS_CONFIG[loop.loopStatus]
                return (
                  <tr
                    key={`${loop.dealId}-${loop.linearIssueId}`}
                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.04)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                    }}
                  >
                    {/* Status dot */}
                    <td style={{ ...tdStyle, paddingRight: '0', width: '32px' }}>
                      <StatusDot status={loop.loopStatus} />
                    </td>

                    {/* Deal */}
                    <td style={tdStyle}>
                      <Link
                        href={`/deals/${loop.dealId}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontSize: '12px' }}>
                            {loop.company}
                          </span>
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                            {loop.dealName}
                          </span>
                        </div>
                      </Link>
                    </td>

                    {/* Revenue */}
                    <td style={{ ...tdStyle, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {loop.dealValue ? (
                        <span style={{ color: 'rgba(255,255,255,0.85)' }}>{fmt(loop.dealValue)}</span>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>&mdash;</span>
                      )}
                    </td>

                    {/* Issue */}
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {loop.linearIssueId && (
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.5)',
                            fontWeight: 500,
                          }}>
                            {loop.linearIssueId}
                          </span>
                        )}
                        {loop.linearTitle && (
                          <span style={{
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.6)',
                            lineHeight: '1.4',
                            display: 'block',
                          }}>
                            {loop.linearTitle}
                          </span>
                        )}
                        {loop.linearIssueUrl && (
                          <a
                            href={loop.linearIssueUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}
                          >
                            Open in Linear ↗
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Why matched */}
                    <td style={tdStyle}>
                      {loop.addressesRisk ? (
                        <span style={{
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.55)',
                          lineHeight: '1.4',
                          display: 'block',
                        }}>
                          {loop.addressesRisk}
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.15)' }}>&mdash;</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: `${cfg.dotColor}15`,
                        border: `1px solid ${cfg.dotColor}25`,
                        fontSize: '11px',
                        fontWeight: 600,
                        color: cfg.textColor,
                        whiteSpace: 'nowrap',
                      }}>
                        {cfg.label}
                      </span>
                    </td>

                    {/* Days */}
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {loop.daysInStatus !== null && loop.daysInStatus > 0 ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          color: loop.daysInStatus > 14 ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                        }}>
                          <Clock size={10} />
                          {daysSuffix(loop.daysInStatus)}
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.15)' }}>&mdash;</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        {loop.loopStatus === 'identified' && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation() }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Check size={10} /> Approve
                            </button>
                            <button
                              onClick={e => { e.stopPropagation() }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: `${STATUS_CONFIG.identified.dotColor}12`,
                                border: `1px solid ${STATUS_CONFIG.identified.dotColor}25`,
                                color: STATUS_CONFIG.identified.textColor,
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Nudge PM
                            </button>
                          </>
                        )}
                        {loop.loopStatus === 'in_cycle' && loop.linearIssueUrl && (
                          <a
                            href={loop.linearIssueUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: `${STATUS_CONFIG.in_cycle.dotColor}12`,
                              border: `1px solid ${STATUS_CONFIG.in_cycle.dotColor}25`,
                              color: STATUS_CONFIG.in_cycle.textColor,
                              textDecoration: 'none',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            Linear <ExternalLink size={10} />
                          </a>
                        )}
                        {loop.loopStatus === 'shipped' && (
                          <button
                            onClick={e => { e.stopPropagation() }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: `${STATUS_CONFIG.shipped.dotColor}12`,
                              border: `1px solid ${STATUS_CONFIG.shipped.dotColor}25`,
                              color: STATUS_CONFIG.shipped.textColor,
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Follow up
                          </button>
                        )}
                        <Link
                          href={`/deals/${loop.dealId}`}
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.45)',
                            textDecoration: 'none',
                            fontSize: '11px',
                            fontWeight: 500,
                          }}
                        >
                          <ArrowUpRight size={10} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── Custom Loops Placeholder ────────────────────────────────────────────────

function CustomLoopsPlaceholder() {
  const examples = [
    { name: 'Linear activity digest', desc: 'Check issues worked on in the last 24h and notify Slack', icon: <Sparkles size={14} /> },
    { name: 'Daily deal score alerts', desc: 'Flag deals where score drops below threshold', icon: <AlertTriangle size={14} /> },
    { name: 'Stale deal nudge', desc: 'Auto-nudge reps when a deal has no update for 7 days', icon: <Timer size={14} /> },
    { name: 'Shipped feature broadcaster', desc: 'Notify all blocked reps when a Linear issue ships', icon: <Truck size={14} /> },
  ]

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      padding: '32px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <Settings2 size={24} color="rgba(255,255,255,0.2)" style={{ marginBottom: '12px' }} />
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', margin: '0 0 6px' }}>
          Custom Loops
        </h3>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0, maxWidth: '400px', marginInline: 'auto', lineHeight: 1.5 }}>
          Automate recurring checks and notifications. Custom loops run on a schedule and trigger actions based on your deal and engineering data.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
      }}>
        {examples.map(ex => (
          <div key={ex.name} style={{
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            transition: 'all 0.15s',
            cursor: 'default',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>{ex.icon}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
                {ex.name}
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.45 }}>
              {ex.desc}
            </p>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '12px',
          fontWeight: 500,
        }}>
          Coming soon
        </span>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LoopsPage() {
  const [pageTab, setPageTab] = useState<PageTab>('core')
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

  return (
    <div style={{ maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.95)',
            margin: '0 0 3px',
            letterSpacing: '-0.02em',
          }}>
            Loops
          </h1>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Deal risk &rarr; Issue discovery &rarr; PM scoping &rarr; Ship &rarr; Deal unblocked
          </p>
        </div>

        {/* Core / Custom tab toggle */}
        <div style={{
          display: 'flex',
          gap: '2px',
          padding: '3px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
        }}>
          {([
            { id: 'core' as PageTab, label: 'Core Loops' },
            { id: 'custom' as PageTab, label: 'Custom Loops' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setPageTab(tab.id)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: pageTab === tab.id ? 600 : 400,
                color: pageTab === tab.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                background: pageTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1px solid ${pageTab === tab.id ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <SummaryStrip loops={loops} />

      {/* Revenue blocked banner */}
      <RevenueBlockedBanner loops={loops} />

      {/* Content based on tab */}
      {pageTab === 'core' ? (
        <CoreLoopTable
          loops={loops}
          brain={brain}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          isLoading={loopsLoading}
        />
      ) : (
        <CustomLoopsPlaceholder />
      )}
    </div>
  )
}
