'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import {
  Activity, TrendingDown, Award, Loader2,
  AlertTriangle, Users, Swords, BarChart2, Clock,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(n: number | null | undefined, sym = '£'): string {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `${sym}${Math.round(n / 1_000)}k`
  return `${sym}${Math.round(n)}`
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${Math.round(n)}%`
}

/** Truncate a string to maxLen characters, adding ellipsis */
function trunc(s: string, maxLen: number): string {
  if (!s) return ''
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen).trimEnd() + '…'
}

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prospecting', qualification: 'Qualification', discovery: 'Discovery',
  proposal: 'Proposal', negotiation: 'Negotiation', closed_won: 'Closed Won', closed_lost: 'Closed Lost',
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: '#6b7280', qualification: '#3b82f6', discovery: '#8b5cf6',
  proposal: '#f59e0b', negotiation: '#f97316', closed_won: '#1DB86A', closed_lost: '#ef4444',
}

const card: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.07em',
  textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '10px',
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: '9.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: color ?? 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', marginTop: '3px' }}>{sub}</div>}
    </div>
  )
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function SkeletonCard({ h = 200 }: { h?: number }) {
  return (
    <div style={{ ...card, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <Loader2 size={14} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading analytics…</span>
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div style={{
      ...card, padding: '32px 24px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
    }}>
      <BarChart2 size={24} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', maxWidth: '380px', lineHeight: 1.5 }}>{message}</div>
    </div>
  )
}

// ─── Pipeline Velocity Section ──────────────────────────────────────────────

function PipelineVelocitySection() {
  const { data, isLoading, error } = useSWR<{ data: any }>('/api/analytics/pipeline-velocity', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 60000,
  })

  if (isLoading) return <SkeletonCard h={260} />
  if (error) return <EmptyState title="Couldn't load velocity data" message="There was an error loading pipeline analytics. Try refreshing." />

  const vel = data?.data
  if (!vel || vel.totalDeals === 0) {
    return <EmptyState title="No pipeline data yet" message="Add deals to your pipeline to see velocity metrics, conversion rates, and bottleneck analysis." />
  }

  const stages = vel.stageMetrics?.filter((s: any) => !['closed_won', 'closed_lost'].includes(s.stage)) ?? []
  const maxDays = Math.max(...stages.map((s: any) => s.avgDays || 0), 1)
  const hasStageData = stages.some((s: any) => s.dealCount > 0 || s.avgDays > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) { .analytics-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 900px) { .analytics-two-col { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* KPI row */}
      <div className="analytics-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <StatCard
          label="Pipeline Velocity"
          value={vel.velocity?.value > 0 ? fmtCurrency(vel.velocity.value) : '—'}
          sub={vel.velocity?.value > 0 ? 'deals × size × win% / cycle' : 'Close deals to calculate'}
          color={vel.velocity?.value > 0 ? '#1DB86A' : 'var(--text-muted)'}
        />
        <StatCard
          label="Avg Cycle Length"
          value={vel.avgCycleLength > 0 ? `${vel.avgCycleLength}d` : '—'}
          sub={vel.avgCycleLength > 0 ? 'Created → Closed Won' : 'No won deals yet'}
        />
        <StatCard
          label="Win Rate"
          value={vel.winRate > 0 ? fmtPct(vel.winRate) : '—'}
          sub={`${vel.totalDeals ?? 0} total deals`}
          color={vel.winRate >= 30 ? '#1DB86A' : vel.winRate > 0 ? '#f59e0b' : 'var(--text-muted)'}
        />
        <StatCard label="Avg Deal Size" value={vel.avgDealSize > 0 ? fmtCurrency(vel.avgDealSize) : '—'} sub="Active pipeline" />
      </div>

      {/* Stage funnel */}
      {hasStageData && (
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Activity size={13} style={{ color: '#1DB86A' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Stage Conversion Funnel</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stages.map((s: any) => {
              const color = STAGE_COLORS[s.stage] ?? '#6b7280'
              const barWidth = s.avgDays > 0 && maxDays > 0 ? Math.max(12, (s.avgDays / maxDays) * 100) : (s.dealCount > 0 ? 12 : 4)
              const hasData = s.dealCount > 0 || s.avgDays > 0
              return (
                <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: hasData ? 1 : 0.4 }}>
                  <div style={{ width: '90px', flexShrink: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {STAGE_LABELS[s.stage] ?? s.stage}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '22px', borderRadius: '5px', background: 'var(--surface-2)', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        height: '100%', borderRadius: '5px',
                        width: `${barWidth}%`,
                        background: `color-mix(in srgb, ${color} 65%, transparent)`,
                        transition: 'width 0.4s ease',
                        display: 'flex', alignItems: 'center', paddingLeft: '8px',
                        minWidth: '40px',
                      }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                          {s.avgDays > 0 ? `${s.avgDays}d` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ width: '52px', textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: s.conversionRate > 0 ? (s.conversionRate >= 50 ? '#1DB86A' : '#f59e0b') : 'var(--text-muted)' }}>
                      {s.conversionRate > 0 ? fmtPct(s.conversionRate) : '—'}
                    </span>
                    <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>convert</div>
                  </div>
                  <div style={{ width: '32px', textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{s.dealCount}</span>
                    <div style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>now</div>
                  </div>
                </div>
              )
            })}
          </div>

          {vel.bottleneck && (
            <div style={{
              marginTop: '14px', padding: '10px 14px', borderRadius: '8px',
              background: 'var(--color-amber-bg)', border: '1px solid rgba(245,158,11,0.20)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                <strong>Bottleneck:</strong>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>
                  {STAGE_LABELS[vel.bottleneck.stage] ?? vel.bottleneck.stage} — {vel.bottleneck.reason}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Reason/Factor Row ──────────────────────────────────────────────────────

function ReasonRow({ text, count, max, color }: { text: string; count: number; max: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          title={text}
          style={{
            fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {trunc(text, 120)}
        </div>
      </div>
      <div style={{ width: '60px', flexShrink: 0 }}>
        <div style={{ height: '5px', borderRadius: '3px', background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: '3px', width: `${(count / max) * 100}%`, background: color, transition: 'width 0.3s' }} />
        </div>
      </div>
      <span style={{ fontSize: '11px', fontWeight: 700, color, width: '20px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
    </div>
  )
}

// ─── Win/Loss Section ───────────────────────────────────────────────────────

function WinLossSection() {
  const { data, isLoading, error } = useSWR<{ data: any }>('/api/analytics/win-loss', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 60000,
  })

  if (isLoading) return <SkeletonCard h={260} />
  if (error) return <EmptyState title="Couldn't load win/loss data" message="There was an error loading analysis. Try refreshing." />

  const wl = data?.data
  if (!wl) return null

  const overall = wl.overall ?? {}
  const hasClosed = (overall.won ?? 0) + (overall.lost ?? 0) > 0

  if (!hasClosed) {
    return <EmptyState title="No closed deals yet" message="Win/loss analysis will appear once you have closed (won or lost) deals in your pipeline." />
  }

  const monthlyTrend = wl.monthlyTrend ?? []
  const lossReasons = wl.lossReasons?.slice(0, 6) ?? []
  const winFactors = wl.winFactors?.slice(0, 6) ?? []
  const competitors = wl.competitorImpact?.slice(0, 6) ?? []
  const maxLossCount = Math.max(...lossReasons.map((r: any) => r.count), 1)
  const maxWinCount = Math.max(...winFactors.map((f: any) => f.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top stats */}
      <div className="analytics-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <StatCard
          label="Win Rate"
          value={fmtPct(overall.winRate)}
          sub={`${overall.won ?? 0}W / ${overall.lost ?? 0}L`}
          color={overall.winRate >= 30 ? '#1DB86A' : '#ef4444'}
        />
        <StatCard
          label="Avg Won Deal"
          value={overall.avgWonValue > 0 ? fmtCurrency(overall.avgWonValue) : '—'}
          sub={overall.avgLostValue > 0 ? `vs ${fmtCurrency(overall.avgLostValue)} lost` : undefined}
          color="#1DB86A"
        />
        <StatCard
          label="Won Cycle"
          value={overall.avgWonCycle > 0 ? `${overall.avgWonCycle}d` : '—'}
          sub={overall.avgLostCycle > 0 ? `vs ${overall.avgLostCycle}d lost` : undefined}
        />
        <StatCard
          label="Score Correlation"
          value={wl.scoreCorrelation?.avgWonScore > 0 ? `${wl.scoreCorrelation.avgWonScore}` : '—'}
          sub={wl.scoreCorrelation?.avgLostScore > 0 ? `Won avg vs ${wl.scoreCorrelation.avgLostScore} lost` : 'AI score of won deals'}
          color="#3b82f6"
        />
      </div>

      <div className="analytics-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Loss reasons */}
        <div style={{ ...card, padding: '16px 18px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <TrendingDown size={13} color="#ef4444" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Top Loss Reasons</span>
            {lossReasons.length > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{lossReasons.length} patterns</span>
            )}
          </div>
          {lossReasons.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '8px 0' }}>
              No loss patterns detected yet. Loss reasons are extracted from deal risks when deals are marked as lost.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {lossReasons.map((r: any, i: number) => (
                <ReasonRow key={i} text={r.reason} count={r.count} max={maxLossCount} color="#ef4444" />
              ))}
            </div>
          )}
        </div>

        {/* Win factors */}
        <div style={{ ...card, padding: '16px 18px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <Award size={13} color="#1DB86A" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Top Win Factors</span>
            {winFactors.length > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{winFactors.length} patterns</span>
            )}
          </div>
          {winFactors.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '8px 0' }}>
              No win patterns detected yet. Win factors are extracted from conversion insights on won deals.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {winFactors.map((f: any, i: number) => (
                <ReasonRow key={i} text={f.factor} count={f.count} max={maxWinCount} color="#1DB86A" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Competitor impact + Correlations */}
      <div className="analytics-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Competitor impact */}
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <Swords size={13} color="#6366f1" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Competitor Impact</span>
          </div>
          {competitors.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '8px 0' }}>
              Add competitors to deals to see head-to-head win/loss records.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {competitors.map((c: any, i: number) => {
                const total = (c.wonAgainst ?? 0) + (c.lostTo ?? 0)
                const winPct = total > 0 ? Math.round(((c.wonAgainst ?? 0) / total) * 100) : 0
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.competitor}
                    </span>
                    {/* Mini win rate bar */}
                    <div style={{ width: '50px', height: '5px', borderRadius: '3px', background: 'var(--color-red-bg)', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ height: '100%', width: `${winPct}%`, background: '#1DB86A', borderRadius: '3px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '100px',
                        background: 'var(--color-green-bg)', color: '#1DB86A',
                      }}>{c.wonAgainst ?? 0}W</span>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '100px',
                        background: 'var(--color-red-bg)', color: 'var(--color-red)',
                      }}>{c.lostTo ?? 0}L</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Win Correlations */}
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <Users size={13} color="#0ea5e9" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Win Correlations</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Avg contacts (won)', value: wl.contactCorrelation?.avgWonContacts, color: '#1DB86A' },
              { label: 'Avg contacts (lost)', value: wl.contactCorrelation?.avgLostContacts, color: '#ef4444' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: row.value > 0 ? row.color : 'var(--text-muted)' }}>
                  {row.value > 0 ? row.value.toFixed(1) : '—'}
                </span>
              </div>
            ))}
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />
            {[
              { label: 'Avg AI score (won)', value: wl.scoreCorrelation?.avgWonScore, color: '#1DB86A' },
              { label: 'Avg AI score (lost)', value: wl.scoreCorrelation?.avgLostScore, color: '#ef4444' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: row.value > 0 ? row.color : 'var(--text-muted)' }}>
                  {row.value > 0 ? row.value : '—'}
                </span>
              </div>
            ))}
            {/* Insight callout */}
            {wl.contactCorrelation?.avgWonContacts > 0 && wl.contactCorrelation?.avgLostContacts > 0 && (
              <>
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  {wl.contactCorrelation.avgWonContacts > wl.contactCorrelation.avgLostContacts
                    ? `Won deals average ${(wl.contactCorrelation.avgWonContacts - wl.contactCorrelation.avgLostContacts).toFixed(1)} more contacts — multi-threading correlates with wins.`
                    : 'Contact count shows no strong correlation with outcomes.'}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Monthly trend */}
      {monthlyTrend.length > 0 && monthlyTrend.some((m: any) => (m.won ?? 0) + (m.lost ?? 0) > 0) && (
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
            <BarChart2 size={13} color="#3b82f6" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Monthly Win Rate Trend</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', paddingTop: '20px' }}>
            {monthlyTrend.map((m: any, i: number) => {
              const maxTotal = Math.max(...monthlyTrend.map((t: any) => (t.won ?? 0) + (t.lost ?? 0)), 1)
              const total = (m.won ?? 0) + (m.lost ?? 0)
              const barH = total > 0 ? Math.max(12, (total / maxTotal) * 100) : 0
              const wonPct = total > 0 ? ((m.won ?? 0) / total) * 100 : 0
              const monthLabel = m.month?.slice(5) ?? ''
              const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
              const monthName = monthNames[parseInt(monthLabel)] ?? monthLabel
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  {total > 0 && (
                    <div style={{ fontSize: '10px', fontWeight: 700, color: wonPct >= 40 ? '#1DB86A' : wonPct > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                      {Math.round(wonPct)}%
                    </div>
                  )}
                  <div style={{
                    width: '100%', maxWidth: '42px', height: `${barH}px`, borderRadius: '5px',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    opacity: total > 0 ? 1 : 0.15,
                    minHeight: total > 0 ? undefined : '4px',
                    background: total === 0 ? 'var(--surface-2)' : undefined,
                  }}>
                    {total > 0 && (
                      <>
                        <div style={{ height: `${wonPct}%`, background: '#1DB86A', minHeight: m.won > 0 ? 3 : 0, borderRadius: '5px 5px 0 0' }} />
                        <div style={{ flex: 1, background: '#ef4444', minHeight: m.lost > 0 ? 3 : 0, borderRadius: '0 0 5px 5px' }} />
                      </>
                    )}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>{monthName}</span>
                </div>
              )
            })}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#1DB86A' }} />
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Won</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }} />
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Lost</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Deal Aging Section ────────────────────────────────────────────────────

interface Deal {
  id: string
  dealName: string
  prospectCompany: string
  stage: string
  dealValue: number
  conversionScore: number
  createdAt: string
  updatedAt: string
}

const AGING_STAGES = ['prospecting', 'qualification', 'discovery', 'proposal', 'negotiation'] as const

function getAgingColor(days: number): { bg: string; border: string } {
  if (days < 7) return { bg: 'rgba(29,184,106,0.15)', border: 'rgba(29,184,106,0.30)' }
  if (days < 14) return { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.30)' }
  if (days < 30) return { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.30)' }
  if (days < 60) return { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.30)' }
  return { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.30)' }
}

function daysSince(dateStr: string): number {
  const created = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
}

function DealAgingSection() {
  const { data, isLoading, error } = useSWR<{ data: Deal[] }>('/api/deals', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 60000,
  })

  if (isLoading) return <SkeletonCard h={300} />
  if (error) return <EmptyState title="Couldn't load deal data" message="There was an error loading deals. Try refreshing." />

  const allDeals = data?.data ?? []
  const activeDeals = allDeals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  if (activeDeals.length === 0) {
    return <EmptyState title="No active deals to analyze" message="Deal aging analysis will appear once you have active deals in your pipeline." />
  }

  // Group by stage
  const grouped: Record<string, (Deal & { days: number })[]> = {}
  for (const stage of AGING_STAGES) grouped[stage] = []

  for (const deal of activeDeals) {
    const days = daysSince(deal.createdAt)
    const stage = AGING_STAGES.includes(deal.stage as any) ? deal.stage : 'prospecting'
    if (!grouped[stage]) grouped[stage] = []
    grouped[stage].push({ ...deal, days })
  }

  // Summary stats
  const allAges = activeDeals.map(d => daysSince(d.createdAt))
  const avgAge = Math.round(allAges.reduce((a, b) => a + b, 0) / allAges.length)
  const oldestDeal = activeDeals.reduce((oldest, d) => {
    const days = daysSince(d.createdAt)
    return days > daysSince(oldest.createdAt) ? d : oldest
  }, activeDeals[0])
  const oldestDays = daysSince(oldestDeal.createdAt)
  const staleCount = allAges.filter(d => d > 30).length

  return (
    <div style={{ ...card, padding: '20px 22px' }}>
      {/* Header with legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={13} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Deal Aging Heatmap</span>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{activeDeals.length} active</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: '<7d', color: 'rgba(29,184,106,0.30)' },
            { label: '7-14d', color: 'rgba(59,130,246,0.30)' },
            { label: '14-30d', color: 'rgba(245,158,11,0.30)' },
            { label: '30-60d', color: 'rgba(249,115,22,0.30)' },
            { label: '60d+', color: 'rgba(239,68,68,0.30)' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color }} />
              <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 500 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stage rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {AGING_STAGES.map(stage => {
          const deals = grouped[stage] ?? []
          const stageColor = STAGE_COLORS[stage] ?? '#6b7280'
          return (
            <div key={stage} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minHeight: '40px' }}>
              {/* Stage label */}
              <div style={{ width: '120px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: stageColor, flexShrink: 0 }} />
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {STAGE_LABELS[stage] ?? stage}
                </span>
                <span style={{
                  fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)',
                  background: 'var(--surface-2)', padding: '1px 5px', borderRadius: '100px', flexShrink: 0,
                }}>
                  {deals.length}
                </span>
              </div>

              {/* Deal cells */}
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '5px', minHeight: '36px', alignItems: 'center' }}>
                {deals.length === 0 && (
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic', paddingTop: '8px' }}>No deals</span>
                )}
                {deals
                  .sort((a, b) => b.days - a.days)
                  .map(deal => {
                    const aging = getAgingColor(deal.days)
                    return (
                      <div
                        key={deal.id}
                        title={`${deal.dealName}\n${deal.prospectCompany}\n${deal.days} days old\n${fmtCurrency(deal.dealValue)}`}
                        style={{
                          width: '80px', height: '36px', borderRadius: '6px',
                          background: aging.bg, border: `1px solid ${aging.border}`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          cursor: 'default', transition: 'transform 0.1s',
                          overflow: 'hidden', padding: '2px 4px',
                        }}
                      >
                        <span style={{ fontSize: '9.5px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                          {deal.dealName.length > 8 ? deal.dealName.slice(0, 8) + '...' : deal.dealName}
                        </span>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-tertiary)', lineHeight: 1.2 }}>
                          {deal.days}d
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
        marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '2px' }}>
            Avg Deal Age
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: avgAge > 30 ? '#f59e0b' : 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            {avgAge}d
          </div>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '2px' }}>
            Oldest Deal
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: oldestDays > 60 ? '#ef4444' : oldestDays > 30 ? '#f59e0b' : 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            {oldestDays}d
          </div>
          <div style={{ fontSize: '9.5px', color: 'var(--text-tertiary)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {trunc(oldestDeal.dealName, 20)}
          </div>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '2px' }}>
            Deals &gt; 30 Days
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: staleCount > 0 ? '#f97316' : '#1DB86A', letterSpacing: '-0.03em' }}>
            {staleCount}
          </div>
          <div style={{ fontSize: '9.5px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
            {staleCount > 0 ? 'needs attention' : 'all healthy'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  return (
    <div style={{ maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.04em' }}>
          Analytics
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>
          Pipeline velocity, win/loss patterns, and deal intelligence — powered by your data.
        </p>
      </div>

      {/* Pipeline Velocity */}
      <div>
        <div style={sectionLabel}>Pipeline Velocity</div>
        <PipelineVelocitySection />
      </div>

      {/* Win/Loss Analysis */}
      <div>
        <div style={sectionLabel}>Win / Loss Analysis</div>
        <WinLossSection />
      </div>

      {/* Deal Aging */}
      <div>
        <div style={sectionLabel}>Deal Aging</div>
        <DealAgingSection />
      </div>
    </div>
  )
}
