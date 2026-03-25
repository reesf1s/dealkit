'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Brain, TrendingUp, BarChart2, ChevronRight, Target, Clock,
  DollarSign, Shield, AlertTriangle, Layers, Cpu, BookOpen,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import { formatCurrency, formatPct } from '@/lib/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Tab = 'overview' | 'playbook' | 'models'

// ─── Shared styles ──────────────────────────────────────────────────────────
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
}

const th: React.CSSProperties = {
  fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.35)',
  textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left',
  padding: '0 8px 6px 0', whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '7px 8px 7px 0', fontSize: '12px', color: 'rgba(255,255,255,0.7)',
  borderTop: '1px solid rgba(255,255,255,0.06)', fontVariantNumeric: 'tabular-nums',
}

const mono: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' }

function Skel({ w = '100%', h = '12px' }: { w?: string; h?: string }) {
  return <div style={{ width: w, height: h, borderRadius: '4px' }} className="skeleton" />
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px 0', textAlign: 'center' }}>
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>{text}</p>
    </div>
  )
}

function SectionHeader({ icon, label, right }: { icon: React.ReactNode; label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {icon}
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
      </div>
      {right}
    </div>
  )
}

function wrColor(wr: number | null): string {
  if (wr == null) return 'rgba(255,255,255,0.4)'
  if (wr >= 60) return '#10b981'
  if (wr >= 40) return '#f59e0b'
  return '#ef4444'
}

// ─── Main ───────────────────────────────────────────────────────────────────
export default function IntelligencePage() {
  const [tab, setTab] = useState<Tab>('overview')
  const { data: brainRes, isLoading: brainLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: dealsRes, isLoading: dealsLoading } = useSWR('/api/deals', fetcher, { revalidateOnFocus: false })

  const brain = brainRes?.brain ?? brainRes?.data
  const deals: any[] = dealsRes?.data ?? []
  const isLoading = brainLoading || dealsLoading

  // ── Derived metrics ──
  const computed = useMemo(() => {
    const closed = deals.filter((d: any) => d.stage === 'closed_won' || d.stage === 'closed_lost')
    const won = deals.filter((d: any) => d.stage === 'closed_won')
    const open = deals.filter((d: any) => !['closed_won', 'closed_lost'].includes(d.stage))
    const winRate = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : null
    const avgClose = brain?.winLossIntel?.avgDaysToClose ? Math.round(brain.winLossIntel.avgDaysToClose) : null
    const totalPipeline = open.reduce((s: number, d: any) => s + (d.dealValue ?? 0), 0)
    const forecast = brain?.dealVelocity?.weightedForecast ?? open.reduce((s: number, d: any) => {
      const p = d.conversionScore ? d.conversionScore / 100 : 0.5
      return s + p * (d.dealValue ?? 0)
    }, 0)
    return { closed, won, open, winRate, avgClose, totalPipeline, forecast }
  }, [deals, brain])

  // ── Tab bar ──
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'playbook', label: 'Playbook' },
    { key: 'models', label: 'Models' },
  ]

  return (
    <div style={{ maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '2px', ...glass, padding: '3px', borderRadius: '8px', width: 'fit-content' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: tab === t.key ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === t.key ? 'white' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab brain={brain} computed={computed} deals={deals} isLoading={isLoading} />}
      {tab === 'playbook' && <PlaybookTab brain={brain} computed={computed} isLoading={isLoading} />}
      {tab === 'models' && <ModelsTab brain={brain} isLoading={isLoading} />}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function OverviewTab({ brain, computed, deals, isLoading }: { brain: any; computed: any; deals: any[]; isLoading: boolean }) {
  const { winRate, avgClose, totalPipeline, forecast, won, closed, open } = computed

  const topRisks: any[] = (brain?.keyPatterns ?? [])
    .map((p: any) => ({ label: typeof p === 'string' ? p : p.label, count: p.dealIds?.length ?? 0, companies: p.companies ?? [] }))
    .slice(0, 8)

  const competitorRecord: any[] = brain?.winLossIntel?.competitorRecord ?? []
  const productGaps: any[] = (brain?.productGapPriority ?? []).slice(0, 8)

  return (
    <>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Win Rate', value: winRate != null ? `${winRate}%` : '--', sub: `${won.length}W / ${closed.length - won.length}L`, color: wrColor(winRate) },
          { label: 'Avg Close Time', value: avgClose != null ? `${avgClose}d` : '--', sub: 'Days to close (won)', color: 'rgba(255,255,255,0.85)' },
          { label: 'Revenue Forecast', value: forecast > 0 ? formatCurrency(Math.round(forecast), true) : '--', sub: 'Probability-weighted', color: '#10b981' },
          { label: 'Total Pipeline', value: totalPipeline > 0 ? formatCurrency(Math.round(totalPipeline), true) : '--', sub: `${open.length} active deals`, color: 'rgba(255,255,255,0.85)' },
        ].map((s, i) => (
          <div key={i} style={{ ...glass, padding: '14px 16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              {s.label}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: s.color, letterSpacing: '-0.03em', lineHeight: 1, ...mono }}>
              {isLoading ? <Skel w="60px" h="22px" /> : s.value}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column: Risk Patterns + Competitor Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        {/* Risk patterns */}
        <div style={{ ...glass, padding: '16px' }}>
          <SectionHeader
            icon={<AlertTriangle size={13} style={{ color: '#ef4444' }} />}
            label="Top Risk Patterns"
          />
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{[1,2,3].map(i => <Skel key={i} h="28px" />)}</div>
          ) : topRisks.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Pattern</th>
                  <th style={{ ...th, textAlign: 'right' }}>Deals</th>
                  <th style={th}>Companies</th>
                </tr>
              </thead>
              <tbody>
                {topRisks.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 500, color: 'rgba(255,255,255,0.85)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.label}
                    </td>
                    <td style={{ ...td, textAlign: 'right', ...mono }}>{r.count}</td>
                    <td style={{ ...td, fontSize: '11px', color: 'rgba(255,255,255,0.4)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.companies.slice(0, 3).join(', ') || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState text="Risk patterns appear after logging deals with notes." />}
        </div>

        {/* Competitor leaderboard */}
        <div style={{ ...glass, padding: '16px' }}>
          <SectionHeader
            icon={<Shield size={13} style={{ color: '#f59e0b' }} />}
            label="Competitor Leaderboard"
          />
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{[1,2,3].map(i => <Skel key={i} h="28px" />)}</div>
          ) : competitorRecord.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Competitor</th>
                  <th style={{ ...th, textAlign: 'right' }}>W</th>
                  <th style={{ ...th, textAlign: 'right' }}>L</th>
                  <th style={{ ...th, textAlign: 'right' }}>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {competitorRecord.map((c: any, i: number) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                      {c.name}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: '#10b981', ...mono }}>{c.wins}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#ef4444', ...mono }}>{c.losses}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: wrColor(c.winRate), ...mono }}>
                      {c.winRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState text="Competitor data appears from closed deals with named competitors." />}
        </div>
      </div>

      {/* Product gaps by revenue impact */}
      <div style={{ ...glass, padding: '16px' }}>
        <SectionHeader
          icon={<DollarSign size={13} style={{ color: '#f59e0b' }} />}
          label="Product Gaps by Revenue Impact"
        />
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{[1,2,3].map(i => <Skel key={i} h="28px" />)}</div>
        ) : productGaps.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Feature Gap</th>
                <th style={{ ...th, textAlign: 'right' }}>Deals Blocked</th>
                <th style={{ ...th, textAlign: 'right' }}>Revenue at Risk</th>
                <th style={{ ...th, textAlign: 'right' }}>Win Rate Impact</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {productGaps.map((g: any, i: number) => {
                const delta = g.winRateDelta
                return (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                      {g.title ?? g.feature ?? 'Gap'}
                    </td>
                    <td style={{ ...td, textAlign: 'right', ...mono }}>{g.dealsBlocked ?? '--'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#ef4444', ...mono }}>
                      {g.revenueAtRisk ? formatCurrency(Math.round(g.revenueAtRisk), true) : '--'}
                    </td>
                    <td style={{ ...td, textAlign: 'right', ...mono }}>
                      {delta != null ? (
                        <span style={{ color: delta < 0 ? '#ef4444' : '#10b981', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          {delta < 0 ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                          {Math.abs(Math.round(delta))}pp
                        </span>
                      ) : '--'}
                    </td>
                    <td style={td}>
                      {g.status === 'on_roadmap' || g.status === 'shipped' || g.linkedIssues ? (
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                          Tracked
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Untracked</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : <EmptyState text="Product gap signals appear from deal notes analysis." />}
      </div>
    </>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: PLAYBOOK
// ═══════════════════════════════════════════════════════════════════════════════
function PlaybookTab({ brain, computed, isLoading }: { brain: any; computed: any; isLoading: boolean }) {
  const objectionMap: any[] = (brain?.objectionWinMap ?? []).slice(0, 12)
  const conditionalWins: any[] = (brain?.objectionConditionalWins ?? []).slice(0, 8)
  const collateralEff: any[] = (brain?.collateralEffectiveness ?? []).slice(0, 8)
  const winPlaybook = brain?.winPlaybook
  const competitivePatterns: any[] = (brain?.competitivePatterns ?? []).slice(0, 8)

  return (
    <>
      {/* Objection Win Map */}
      <div style={{ ...glass, padding: '16px' }}>
        <SectionHeader
          icon={<Target size={13} style={{ color: '#10b981' }} />}
          label="Objection Win Map"
          right={<span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>From closed-won deals</span>}
        />
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{[1,2,3,4].map(i => <Skel key={i} h="28px" />)}</div>
        ) : objectionMap.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Objection Theme</th>
                <th style={{ ...th, textAlign: 'right' }}>Deals Faced</th>
                <th style={{ ...th, textAlign: 'right' }}>Wins</th>
                <th style={{ ...th, textAlign: 'right' }}>Win Rate</th>
                <th style={{ ...th, textAlign: 'right' }}>Global Benchmark</th>
              </tr>
            </thead>
            <tbody>
              {objectionMap.map((o: any, i: number) => {
                const wr = typeof o.winRateWithTheme === 'number' ? o.winRateWithTheme : (o.winRate ?? 0)
                const globalWr = o.globalWinRate
                return (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                      {o.theme}
                    </td>
                    <td style={{ ...td, textAlign: 'right', ...mono }}>{o.dealsWithTheme}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#10b981', ...mono }}>{o.winsWithTheme}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: wrColor(wr), ...mono }}>
                      {Math.round(wr)}%
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'rgba(255,255,255,0.35)', ...mono }}>
                      {globalWr != null ? `${Math.round(globalWr)}%` : '--'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : <EmptyState text="Objection win map builds as you close deals with noted objections." />}
      </div>

      {/* Stage-Specific Guidance: Conditional wins (champion lift) */}
      {conditionalWins.length > 0 && (
        <div style={{ ...glass, padding: '16px' }}>
          <SectionHeader
            icon={<Layers size={13} style={{ color: '#3b82f6' }} />}
            label="Stage-Specific Guidance (Champion Lift)"
            right={<span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Win rate impact of champion engagement per stage</span>}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Objection</th>
                <th style={{ ...th, textAlign: 'right' }}>Deals</th>
                <th style={{ ...th, textAlign: 'right' }}>Avg Champion Lift</th>
                <th style={th}>Best Stage</th>
              </tr>
            </thead>
            <tbody>
              {conditionalWins.map((cw: any, i: number) => {
                const best = (cw.stageBreakdown ?? [])
                  .filter((sb: any) => sb.championLift != null)
                  .sort((a: any, b: any) => (b.championLift ?? 0) - (a.championLift ?? 0))[0]
                return (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{cw.theme}</td>
                    <td style={{ ...td, textAlign: 'right', ...mono }}>{cw.dealsWithTheme}</td>
                    <td style={{ ...td, textAlign: 'right', ...mono }}>
                      {cw.championLiftAvg != null ? (
                        <span style={{ color: cw.championLiftAvg > 0 ? '#10b981' : '#ef4444' }}>
                          {cw.championLiftAvg > 0 ? '+' : ''}{Math.round(cw.championLiftAvg)}pp
                        </span>
                      ) : '--'}
                    </td>
                    <td style={{ ...td, fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                      {best ? `${best.stage} (+${Math.round(best.championLift)}pp)` : '--'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Two-column: Competitive Intel + Collateral Effectiveness */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Competitive playbook */}
        <div style={{ ...glass, padding: '16px' }}>
          <SectionHeader
            icon={<Shield size={13} style={{ color: '#f59e0b' }} />}
            label="Competitive Playbook"
            right={
              <Link href="/competitors" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                All <ChevronRight size={10} />
              </Link>
            }
          />
          {competitivePatterns.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Competitor</th>
                  <th style={{ ...th, textAlign: 'right' }}>WR</th>
                  <th style={th}>Win Condition</th>
                </tr>
              </thead>
              <tbody>
                {competitivePatterns.map((cp: any, i: number) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{cp.competitor}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: wrColor(cp.winRate), ...mono }}>{Math.round(cp.winRate)}%</td>
                    <td style={{ ...td, fontSize: '11px', color: 'rgba(255,255,255,0.5)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cp.topWinCondition || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState text="Competitive patterns emerge from closed deals with named competitors." />}
        </div>

        {/* Collateral effectiveness */}
        <div style={{ ...glass, padding: '16px' }}>
          <SectionHeader
            icon={<BookOpen size={13} style={{ color: '#3b82f6' }} />}
            label="Collateral Effectiveness"
            right={
              <Link href="/case-studies" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                Library <ChevronRight size={10} />
              </Link>
            }
          />
          {collateralEff.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Type</th>
                  <th style={{ ...th, textAlign: 'right' }}>Used</th>
                  <th style={{ ...th, textAlign: 'right' }}>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {collateralEff.map((c: any, i: number) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 500, color: 'rgba(255,255,255,0.85)', textTransform: 'capitalize' }}>
                      {c.type.replace(/_/g, ' ')}
                    </td>
                    <td style={{ ...td, textAlign: 'right', ...mono }}>{c.totalUsed}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: wrColor(c.winRate), ...mono }}>{c.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState text="Collateral stats appear after attaching collateral to deals." />}
        </div>
      </div>

      {/* Fastest close pattern */}
      {winPlaybook?.fastestClosePattern && (
        <div style={{ ...glass, padding: '16px' }}>
          <SectionHeader
            icon={<Clock size={13} style={{ color: '#10b981' }} />}
            label="Fastest Close Pattern"
          />
          <div style={{ display: 'flex', gap: '24px', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981', ...mono }}>
                {Math.round(winPlaybook.fastestClosePattern.avgDaysToClose)}d
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                avg close ({winPlaybook.fastestClosePattern.sampleSize} deals)
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {(winPlaybook.fastestClosePattern.commonSignals ?? []).map((sig: string, i: number) => (
                <span key={i} style={{
                  padding: '3px 8px', borderRadius: '4px', fontSize: '11px',
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                  color: 'rgba(255,255,255,0.6)',
                }}>
                  {sig}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: MODELS (power user)
// ═══════════════════════════════════════════════════════════════════════════════
function ModelsTab({ brain, isLoading }: { brain: any; isLoading: boolean }) {
  const ml = brain?.mlModel
  const archetypes: any[] = brain?.dealArchetypes ?? []
  const calibration: any[] = brain?.calibrationTimeline ?? []
  const featureImportance: any[] = ml?.featureImportance ?? []

  return (
    <>
      {/* Model Health */}
      <div style={{ ...glass, padding: '16px' }}>
        <SectionHeader
          icon={<Cpu size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />}
          label="ML Model Health"
        />
        {isLoading ? (
          <div style={{ display: 'flex', gap: '12px' }}>{[1,2,3,4].map(i => <Skel key={i} w="120px" h="50px" />)}</div>
        ) : ml ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {[
              { label: 'LOO Accuracy', value: `${Math.round(ml.looAccuracy * 100)}%`, color: ml.looAccuracy >= 0.7 ? '#10b981' : ml.looAccuracy >= 0.5 ? '#f59e0b' : '#ef4444' },
              { label: 'Training Size', value: `${ml.trainingSize}`, color: 'rgba(255,255,255,0.85)' },
              { label: 'Features', value: `${ml.featureNames?.length ?? 0}`, color: 'rgba(255,255,255,0.85)' },
              { label: 'Global Prior', value: ml.usingGlobalPrior ? 'Active' : 'Off', color: ml.usingGlobalPrior ? '#10b981' : 'rgba(255,255,255,0.4)' },
              { label: 'Last Trained', value: ml.lastTrained ? new Date(ml.lastTrained).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '--', color: 'rgba(255,255,255,0.6)' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: s.color, ...mono }}>{s.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="ML model trains after 5+ closed deals. Keep logging deals to activate predictive scoring." />
        )}
      </div>

      {/* Feature Importance */}
      {featureImportance.length > 0 && (
        <div style={{ ...glass, padding: '16px' }}>
          <SectionHeader
            icon={<BarChart2 size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />}
            label="Feature Importance"
            right={<span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Logistic regression weights</span>}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Feature</th>
                <th style={{ ...th, textAlign: 'right' }}>Importance</th>
                <th style={th}>Direction</th>
                <th style={{ ...th, width: '40%' }}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {featureImportance.slice(0, 15).map((f: any, i: number) => {
                const maxImp = featureImportance[0]?.importance ?? 1
                const pct = maxImp > 0 ? (f.importance / maxImp) * 100 : 0
                return (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 500, color: 'rgba(255,255,255,0.85)', fontSize: '11px' }}>
                      {f.name.replace(/_/g, ' ')}
                    </td>
                    <td style={{ ...td, textAlign: 'right', ...mono, fontSize: '11px' }}>
                      {f.importance.toFixed(3)}
                    </td>
                    <td style={td}>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '3px',
                        background: f.direction === 'helps' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: f.direction === 'helps' ? '#10b981' : '#ef4444',
                        border: `1px solid ${f.direction === 'helps' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                        {f.direction === 'helps' ? 'Helps' : 'Hurts'}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                          <div style={{
                            width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: '2px',
                            background: f.direction === 'helps' ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
                          }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Deal Archetypes */}
      {archetypes.length > 0 && (
        <div style={{ ...glass, padding: '16px' }}>
          <SectionHeader
            icon={<Layers size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />}
            label="Deal Archetypes"
            right={<span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>K-means clustering</span>}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Archetype</th>
                <th style={{ ...th, textAlign: 'right' }}>Deals</th>
                <th style={{ ...th, textAlign: 'right' }}>Win Rate</th>
                <th style={{ ...th, textAlign: 'right' }}>Avg Value</th>
                <th style={{ ...th, textAlign: 'right' }}>Open</th>
                <th style={th}>Winning Characteristic</th>
              </tr>
            </thead>
            <tbody>
              {archetypes.map((a: any, i: number) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{a.label}</td>
                  <td style={{ ...td, textAlign: 'right', ...mono }}>{a.dealCount}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: wrColor(a.winRate), ...mono }}>{Math.round(a.winRate)}%</td>
                  <td style={{ ...td, textAlign: 'right', ...mono }}>{formatCurrency(Math.round(a.avgDealValue), true)}</td>
                  <td style={{ ...td, textAlign: 'right', ...mono }}>{a.openDealIds?.length ?? 0}</td>
                  <td style={{ ...td, fontSize: '11px', color: 'rgba(255,255,255,0.5)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.winningCharacteristic || '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Calibration Timeline */}
      {calibration.length > 0 && (
        <div style={{ ...glass, padding: '16px' }}>
          <SectionHeader
            icon={<TrendingUp size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />}
            label="Score Calibration Timeline"
            right={<span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Monthly ML discrimination tracking</span>}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Month</th>
                <th style={{ ...th, textAlign: 'right' }}>Deals</th>
                <th style={{ ...th, textAlign: 'right' }}>Actual WR</th>
                <th style={{ ...th, textAlign: 'right' }}>Avg ML (Wins)</th>
                <th style={{ ...th, textAlign: 'right' }}>Avg ML (Losses)</th>
                <th style={{ ...th, textAlign: 'right' }}>Discrimination</th>
              </tr>
            </thead>
            <tbody>
              {calibration.map((c: any, i: number) => {
                const disc = c.discrimination ?? (c.avgMlOnWins - c.avgMlOnLoss)
                return (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 500, color: 'rgba(255,255,255,0.85)', ...mono }}>{c.month}</td>
                    <td style={{ ...td, textAlign: 'right', ...mono }}>{c.n}</td>
                    <td style={{ ...td, textAlign: 'right', ...mono }}>{Math.round(c.actualWinRate)}%</td>
                    <td style={{ ...td, textAlign: 'right', color: '#10b981', ...mono }}>{Math.round(c.avgMlOnWins)}%</td>
                    <td style={{ ...td, textAlign: 'right', color: '#ef4444', ...mono }}>{Math.round(c.avgMlOnLoss)}%</td>
                    <td style={{ ...td, textAlign: 'right', ...mono }}>
                      <span style={{
                        color: disc >= 20 ? '#10b981' : disc >= 10 ? '#f59e0b' : '#ef4444',
                        fontWeight: 600,
                      }}>
                        {disc > 0 ? '+' : ''}{Math.round(disc)}pp
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Model weights raw (collapsible) */}
      {ml && (
        <details style={{ ...glass, padding: '16px' }}>
          <summary style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', userSelect: 'none' }}>
            Raw Model Weights ({ml.featureNames?.length ?? 0} features, bias: {ml.bias?.toFixed(4)})
          </summary>
          <div style={{ marginTop: '10px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Feature</th>
                  <th style={{ ...th, textAlign: 'right' }}>Weight</th>
                </tr>
              </thead>
              <tbody>
                {(ml.featureNames ?? []).map((name: string, i: number) => (
                  <tr key={i}>
                    <td style={{ ...td, fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{name}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontSize: '11px', color: (ml.weights?.[i] ?? 0) >= 0 ? '#10b981' : '#ef4444', ...mono }}>
                      {(ml.weights?.[i] ?? 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  )
}
