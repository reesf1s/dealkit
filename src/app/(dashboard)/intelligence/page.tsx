'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  AlertTriangle, Clock, TrendingUp, Zap,
  CheckCircle2, Eye, X, Bell, Swords, Timer, MessageSquareWarning,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import type { DealLog } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────────────

type SignalType = 'risk' | 'stale' | 'pattern' | 'win' | 'loss'
type FilterTab = 'all' | 'risk' | 'stale' | 'pattern'

interface Signal {
  id: string
  type: SignalType
  title: string
  body: string
  dealId?: string
  company?: string
  action?: string
  read: boolean
  confidence?: 'high' | 'medium' | 'low'
  supportCount?: number
}

interface BrainData {
  urgentDeals?: Array<{ dealId: string; dealName?: string; company: string; reason: string; topAction?: string }>
  staleDeals?: Array<{ dealId: string; dealName?: string; company: string; daysSinceUpdate: number; stage?: string }>
  keyPatterns?: Array<{ label: string; dealIds: string[]; companies: string[]; dealNames?: string[] }>
  winLossIntel?: { winRate: number; winCount: number; lossCount: number; avgCloseTimeDays?: number }
  competitivePatterns?: Array<{ competitor: string; winRate: number; dealCount: number }>
  pipeline?: { totalValue: number; activeDeals: number }
  updatedAt?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function signalIcon(type: SignalType) {
  switch (type) {
    case 'risk':    return <AlertTriangle size={12} style={{ color: '#ef4444' }} />
    case 'stale':   return <Clock size={12} style={{ color: '#f59e0b' }} />
    case 'pattern': return <TrendingUp size={12} style={{ color: '#1DB86A' }} />
    case 'win':     return <CheckCircle2 size={12} style={{ color: '#1DB86A' }} />
    default:        return <Zap size={12} style={{ color: 'var(--text-tertiary)' }} />
  }
}

function signalColors(type: SignalType) {
  switch (type) {
    case 'risk':    return { border: 'rgba(248,113,113,0.30)',   bg: 'var(--color-red-bg)',   dot: '#ef4444' }
    case 'stale':   return { border: 'rgba(251,191,36,0.30)',    bg: 'var(--color-amber-bg)', dot: '#f59e0b' }
    case 'pattern': return { border: 'rgba(29,184,106,0.22)',    bg: 'var(--color-green-bg)', dot: '#1DB86A' }
    default:        return { border: 'var(--border-default)',    bg: 'var(--surface-2)',      dot: 'var(--text-tertiary)' }
  }
}

function fmtCurrency(n: number, sym = '£') {
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `${sym}${Math.round(n / 1_000)}k`
  return `${sym}${Math.round(n)}`
}

function Skeleton({ h = 80 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 8 }} className="skeleton" />
}

// ─── Signal Card ────────────────────────────────────────────────────────────

function ConfidenceBadge({ level, count }: { level: 'high' | 'medium' | 'low'; count?: number }) {
  const meta = {
    high:   { color: '#1DB86A', bg: 'rgba(29,184,106,0.10)', label: 'High' },
    medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  label: 'Med'  },
    low:    { color: 'var(--text-tertiary)', bg: 'var(--surface-2)', label: 'Low'  },
  }[level]
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, color: meta.color,
      background: meta.bg, borderRadius: 4, padding: '1px 5px',
      letterSpacing: '0.03em',
    }}>
      {count ? `${count}× signal` : meta.label}
    </span>
  )
}

function SignalCard({ signal, onDismiss }: { signal: Signal; onDismiss: (id: string) => void }) {
  const c = signalColors(signal.type)
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 8,
      border: `1px solid ${c.border}`, background: c.bg,
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ marginTop: 1 }}>{signalIcon(signal.type)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {signal.title}
            </span>
            {signal.confidence && (
              <ConfidenceBadge level={signal.confidence} count={signal.supportCount} />
            )}
          </div>
          {signal.company && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{signal.company}</div>
          )}
        </div>
        <button
          onClick={() => onDismiss(signal.id)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 2, borderRadius: 4,
            display: 'flex', alignItems: 'center', transition: 'color 80ms',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
        >
          <X size={11} />
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, paddingLeft: 20 }}>
        {signal.body}
      </p>
      {signal.action && (
        <div style={{ fontSize: 11.5, color: c.dot, fontWeight: 500, paddingLeft: 20 }}>
          → {signal.action}
        </div>
      )}
      {signal.dealId && (
        <div style={{ paddingLeft: 20, marginTop: 2 }}>
          <Link
            href={`/deals/${signal.dealId}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11.5, fontWeight: 500, color: '#1DB86A',
              textDecoration: 'none', padding: '3px 8px',
              background: 'var(--brand-bg)', borderRadius: 5,
              border: '1px solid var(--brand-border)',
            }}
          >
            <Eye size={10} /> View Deal
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [themeTab, setThemeTab] = useState<'objections' | 'insights' | 'competitors' | 'stages'>('objections')

  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 60000,
  })
  const brain: BrainData = brainRes?.data ?? {}

  const { data: dealsRes } = useSWR<{ data: DealLog[] }>('/api/deals', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 60000,
  })

  // ── AI Theme Spotter — extract categorised themes from all active deals ────
  const themeSpotter = useMemo(() => {
    const activeDeals = (dealsRes?.data ?? []).filter(
      d => d.stage !== 'closed_won' && d.stage !== 'closed_lost'
    )

    // Helper to aggregate strings into frequency-sorted array
    const aggregate = (strings: string[]) => {
      const counts = new Map<string, number>()
      for (const s of strings) {
        const key = s.trim().toLowerCase()
        if (key.length < 5) continue
        const canonical = s.trim().replace(/^\w/, c => c.toUpperCase())
        counts.set(canonical, (counts.get(canonical) ?? 0) + 1)
      }
      return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 7)
    }

    // Objections/Risks — from dealRisks
    const allRisks: string[] = []
    // Insights/Pain Points — from conversionInsights
    const allInsights: string[] = []
    // Competitors mentioned
    const allCompetitors: string[] = []
    // Stages — stage distribution
    const stageCounts = new Map<string, number>()

    for (const deal of activeDeals) {
      for (const risk of (deal.dealRisks ?? [])) allRisks.push(risk)
      for (const insight of ((deal.conversionInsights as string[]) ?? [])) allInsights.push(insight)
      for (const comp of ((deal.competitors as string[]) ?? [])) allCompetitors.push(comp)
      const stage = (deal.stage ?? 'unknown').replace(/_/g, ' ')
      stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1)
    }

    return {
      objections: aggregate(allRisks),
      insights: aggregate(allInsights),
      competitors: aggregate(allCompetitors),
      stageDistribution: Array.from(stageCounts.entries()).sort((a, b) => b[1] - a[1]),
      totalDeals: activeDeals.length,
    }
  }, [dealsRes?.data])

  // Build signals
  const allSignals: Signal[] = []

  for (const d of brain.urgentDeals ?? []) {
    allSignals.push({
      id: `risk-${d.dealId}`, type: 'risk',
      title: d.dealName ?? d.company,
      body: d.reason ?? 'This deal requires immediate attention.',
      dealId: d.dealId, company: d.company,
      action: d.topAction ?? 'Review and take action on this deal',
      read: false,
      confidence: 'high',
    })
  }
  for (const d of brain.staleDeals ?? []) {
    const days = d.daysSinceUpdate
    const stageFmt = d.stage ? d.stage.replace(/_/g, ' ') : null
    allSignals.push({
      id: `stale-${d.dealId}`, type: 'stale',
      title: d.dealName ?? d.company,
      body: `No activity for ${days} day${days !== 1 ? 's' : ''}${stageFmt ? ` · currently in ${stageFmt}` : ''}. Prospects disengage after 2 weeks of silence.`,
      dealId: d.dealId, company: d.company,
      action: `Send a follow-up to ${d.company ?? 'this prospect'} and re-establish momentum`,
      read: false,
      confidence: days > 14 ? 'high' : days > 7 ? 'medium' : 'low',
    })
  }
  for (const p of brain.keyPatterns ?? []) {
    const n = p.dealIds.length
    const dealNameList = (p.dealNames ?? p.companies ?? []).slice(0, 3).join(', ')
    allSignals.push({
      id: `pattern-${p.label}`, type: 'pattern',
      title: p.label,
      body: `Seen across ${n} deal${n !== 1 ? 's' : ''}${dealNameList ? `: ${dealNameList}` : ''}. Deals matching this pattern have a higher close rate when acted on early.`,
      action: `Apply this playbook to your active deals at the same stage`,
      read: false,
      confidence: n >= 4 ? 'high' : n >= 2 ? 'medium' : 'low',
      supportCount: n,
    })
  }

  const visibleSignals = allSignals
    .filter(s => !dismissed.has(s.id))
    .filter(s => filter === 'all' || s.type === filter)

  const filterTabs: Array<{ key: FilterTab; label: string }> = [
    { key: 'all',     label: `All (${visibleSignals.length})` },
    { key: 'risk',    label: `Deal Risk (${visibleSignals.filter(s => s.type === 'risk').length})` },
    { key: 'stale',   label: `Stale (${visibleSignals.filter(s => s.type === 'stale').length})` },
    { key: 'pattern', label: `Patterns (${visibleSignals.filter(s => s.type === 'pattern').length})` },
  ]

  const competitors = (brain.competitivePatterns ?? []).slice(0, 6)
  const winRate = brain.winLossIntel ? Math.round(brain.winLossIntel.winRate * 100) : null
  const totalClosed = (brain.winLossIntel?.winCount ?? 0) + (brain.winLossIntel?.lossCount ?? 0)

  return (
    <div style={{ paddingTop: 8 }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: '0 0 3px' }}>
          Signals
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
          AI-detected patterns, risks, and opportunities from your pipeline.
        </p>
      </div>

      {/* Stats strip */}
      {!isLoading && (brain.winLossIntel || (brain.pipeline?.activeDeals ?? 0) > 0) && (
        <div style={{
          display: 'flex', gap: 0,
          background: 'var(--surface-1)', border: '1px solid var(--border-default)', borderRadius: 10,
          overflow: 'hidden', marginBottom: 18,
        }}>
          {[
            { label: 'Win Rate', value: winRate != null ? `${winRate}%` : '—', sub: `${totalClosed} closed` },
            { label: 'Active Deals', value: String(brain.pipeline?.activeDeals ?? 0), sub: 'in pipeline' },
            { label: 'Signals', value: String(allSignals.length), sub: 'active signals' },
            { label: 'Patterns', value: String(brain.keyPatterns?.length ?? 0), sub: 'detected' },
          ].map((item, i) => (
            <div key={i} style={{
              flex: 1, padding: '12px 18px',
              borderRight: i < 3 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1 }}>
                {item.value}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="intel-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
        <style>{`@media (max-width: 1100px) { .intel-grid { grid-template-columns: 1fr !important; } }`}</style>

        {/* Signals feed */}
        <div>
          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: '5px 11px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer',
                  border: filter === tab.key ? '1px solid var(--border-default)' : '1px solid transparent',
                  background: filter === tab.key ? 'var(--surface-1)' : 'transparent',
                  color: filter === tab.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  transition: 'all 80ms',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} h={80} />)}
            </div>
          ) : visibleSignals.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '50px 0',
              border: '1px solid var(--border-default)', borderRadius: 10, background: 'var(--surface-2)',
            }}>
              <Bell size={22} style={{ color: 'var(--border-default)', display: 'block', margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No signals</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {filter === 'all'
                  ? 'Run AI analysis on deals to generate signals.'
                  : `No ${filter} signals right now.`}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleSignals.map(signal => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  onDismiss={id => setDismissed(prev => new Set([...prev, id]))}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar: Competitor Leaderboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Competitor Leaderboard */}
          <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{
              padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Swords size={11} style={{ color: '#8b5cf6' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                vs Competitors
              </span>
            </div>
            {isLoading ? (
              <div style={{ padding: 16 }}><Skeleton h={100} /></div>
            ) : competitors.length === 0 ? (
              <div style={{ padding: '18px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No competitor data yet.</div>
                <Link href="/competitors" style={{ fontSize: 12, color: '#1DB86A', textDecoration: 'none', fontWeight: 500, marginTop: 4, display: 'block' }}>
                  Add competitors →
                </Link>
              </div>
            ) : (
              <div>
                {competitors.map((c, i) => {
                  const wr = Math.round(c.winRate * 100)
                  const color = wr >= 60 ? '#1DB86A' : wr >= 40 ? '#f59e0b' : '#ef4444'
                  return (
                    <div key={i} style={{
                      padding: '9px 16px',
                      borderBottom: i < competitors.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.competitor}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 1 }}>{c.dealCount} deal{c.dealCount !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <div style={{ width: 48, height: 4, borderRadius: 2, background: 'var(--surface-3)', overflow: 'hidden' }}>
                          <div style={{ width: `${wr}%`, height: '100%', background: color, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 30, textAlign: 'right' }}>{wr}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pipeline Velocity */}
          {!isLoading && (brain.staleDeals ?? []).length > 0 && (
            <div style={{
              background: 'var(--surface-1)', border: '1px solid var(--border-default)',
              borderRadius: 10, overflow: 'hidden',
            }}>
              <div style={{
                padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Timer size={11} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Velocity
                </span>
              </div>
              <div>
                {(brain.staleDeals ?? []).slice(0, 5).map((d, i, arr) => {
                  const days = d.daysSinceUpdate
                  const color = days > 14 ? '#ef4444' : days > 7 ? '#f59e0b' : '#aaa'
                  return (
                    <Link key={d.dealId} href={`/deals/${d.dealId}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        padding: '9px 16px',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        transition: 'background 80ms',
                      }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {d.dealName ?? d.company}
                          </div>
                          {d.stage && (
                            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
                              {d.stage.replace(/_/g, ' ')}
                            </div>
                          )}
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color,
                          background: `${color}14`, borderRadius: 4, padding: '1px 6px',
                          flexShrink: 0,
                        }}>
                          {days}d
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
          {/* ── AI Theme Spotter ── */}
          <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{
              padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <MessageSquareWarning size={11} style={{ color: '#6366f1' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Theme Spotter
              </span>
              {themeSpotter.totalDeals > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{themeSpotter.totalDeals} deals</span>
              )}
            </div>
            {/* Theme tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
              {([
                { id: 'objections',  label: 'Objections',  color: '#ef4444' },
                { id: 'insights',    label: 'Insights',    color: '#3b82f6' },
                { id: 'competitors', label: 'Competitors', color: '#8b5cf6' },
                { id: 'stages',      label: 'Stages',      color: '#f59e0b' },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setThemeTab(t.id)}
                  style={{
                    flex: 1, padding: '7px 4px', fontSize: 10, fontWeight: 600,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: themeTab === t.id ? t.color : 'var(--text-muted)',
                    borderBottom: themeTab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
                    transition: 'color 80ms',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {!dealsRes ? (
              <div style={{ padding: 16 }}><Skeleton h={80} /></div>
            ) : (() => {
              const themeMeta: Record<string, { data: Array<[string, number]>; emptyText: string; barColor: (count: number) => string }> = {
                objections: {
                  data: themeSpotter.objections,
                  emptyText: 'No objections detected yet. Run AI analysis on deals.',
                  barColor: (c: number) => c >= 3 ? '#ef4444' : c >= 2 ? '#f59e0b' : '#9ca3af',
                },
                insights: {
                  data: themeSpotter.insights,
                  emptyText: 'No insights yet. Analyse deals to surface themes.',
                  barColor: (c: number) => c >= 3 ? '#3b82f6' : c >= 2 ? '#6366f1' : '#9ca3af',
                },
                competitors: {
                  data: themeSpotter.competitors,
                  emptyText: 'No competitor patterns yet. Add competitors to deals.',
                  barColor: (c: number) => c >= 3 ? '#8b5cf6' : c >= 2 ? '#a78bfa' : '#9ca3af',
                },
                stages: {
                  data: themeSpotter.stageDistribution,
                  emptyText: 'No stage data yet.',
                  barColor: () => '#f59e0b',
                },
              }
              const current = themeMeta[themeTab]
              if (current.data.length === 0) {
                return (
                  <div style={{ padding: '18px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{current.emptyText}</div>
                  </div>
                )
              }
              const maxCount = current.data[0][1]
              return (
                <div>
                  {current.data.map(([label, count], i) => {
                    const pct = Math.round((count / maxCount) * 100)
                    const color = current.barColor(count)
                    return (
                      <div key={i} style={{
                        padding: '8px 16px',
                        borderBottom: i < current.data.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{
                            fontSize: 11.5, fontWeight: 500, color: 'var(--text-primary)',
                            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {label}
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color,
                            background: `${color}18`, borderRadius: 4, padding: '1px 5px',
                            marginLeft: 6, flexShrink: 0,
                          }}>
                            {count}×
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 3, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 300ms ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* ── Market Insights ── */}
          {(() => {
            const activeDeals = (dealsRes?.data ?? []).filter(
              (d: DealLog) => d.stage !== 'closed_won' && d.stage !== 'closed_lost'
            )
            const wonDeals = (dealsRes?.data ?? []).filter((d: DealLog) => d.stage === 'closed_won')
            const avgDealSize = activeDeals.length > 0
              ? Math.round(activeDeals.reduce((s: number, d: DealLog) => s + (d.dealValue ?? 0), 0) / activeDeals.length)
              : 0
            const avgWonSize = wonDeals.length > 0
              ? Math.round(wonDeals.reduce((s: number, d: DealLog) => s + (d.dealValue ?? 0), 0) / wonDeals.length)
              : 0
            const avgScore = activeDeals.length > 0
              ? Math.round(activeDeals.reduce((s: number, d: DealLog) => s + (d.conversionScore ?? 50), 0) / activeDeals.length)
              : 0
            const highScoreDeals = activeDeals.filter((d: DealLog) => (d.conversionScore ?? 0) >= 70).length
            const atRiskDeals = activeDeals.filter((d: DealLog) => (d.conversionScore ?? 100) < 40).length

            if (!dealsRes || activeDeals.length === 0) return null

            return (
              <div style={{
                background: 'var(--surface-1)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <TrendingUp size={11} style={{ color: '#3b82f6' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Market Insights
                  </span>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Avg Deal Size', value: `£${avgDealSize >= 1000 ? `${Math.round(avgDealSize / 1000)}k` : avgDealSize}`, color: 'var(--text-primary)' },
                    { label: 'Avg Won Size', value: wonDeals.length > 0 ? `£${avgWonSize >= 1000 ? `${Math.round(avgWonSize / 1000)}k` : avgWonSize}` : '—', color: '#1DB86A' },
                    { label: 'Pipeline Health', value: `${avgScore}/100`, color: avgScore >= 60 ? '#1DB86A' : avgScore >= 40 ? '#f59e0b' : '#ef4444' },
                    { label: 'High Confidence', value: `${highScoreDeals} deal${highScoreDeals !== 1 ? 's' : ''}`, color: '#1DB86A' },
                    { label: 'At Risk', value: `${atRiskDeals} deal${atRiskDeals !== 1 ? 's' : ''}`, color: '#ef4444' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
