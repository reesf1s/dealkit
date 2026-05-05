'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import { AlertTriangle, BarChart3, Gauge, LineChart, Target, TrendingUp } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorKpi, OperatorPage } from '@/components/shared/OperatorUI'

interface VelocityData {
  stageMetrics: Array<{
    stage: string
    avgDays: number
    conversionRate: number
    dealCount: number
    dropOffRate: number
  }>
  velocity: { value: number }
  avgCycleLength: number
  winRate: number
  avgDealSize: number
  bottleneck: { stage: string; reason: string } | null
  totalDeals: number
}

interface WinLossData {
  overall: {
    winRate: number
    totalClosed: number
    won: number
    lost: number
    avgWonValue: number
    avgLostValue: number
    avgWonCycle: number
    avgLostCycle: number
  }
  lossReasons: Array<{ reason: string; count: number }>
  winFactors: Array<{ factor: string; count: number }>
  competitorImpact: Array<{ competitor: string; wonAgainst: number; lostTo: number }>
  monthlyTrend: Array<{ month: string; won: number; lost: number; winRate: number }>
}

function currency(value: number | null | undefined): string {
  if (!value && value !== 0) return '—'
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${Math.round(value)}`
}

function stageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function shortMonth(value: string): string {
  const [year, month] = value.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString(undefined, { month: 'short' })
}

export default function AnalyticsPage() {
  const { data: velocityRes, isLoading: loadingVelocity } = useSWR<{ data: VelocityData }>('/api/analytics/pipeline-velocity', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const { data: winLossRes, isLoading: loadingWinLoss } = useSWR<{ data: WinLossData }>('/api/analytics/win-loss', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const velocity = velocityRes?.data
  const winLoss = winLossRes?.data

  const maxStageDays = Math.max(...(velocity?.stageMetrics?.map(s => s.avgDays || 0) ?? [1]), 1)
  const maxMonthly = Math.max(...(winLoss?.monthlyTrend?.map(m => m.won + m.lost) ?? [1]), 1)

  return (
    <OperatorPage>
      <OperatorHeader
        eyebrow="Revenue Intelligence Report"
        title="Pipeline performance and win/loss signals"
        description="Inspect conversion leakage, stage speed, and the factors most tied to wins and losses."
      />

      <section className="analytics-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {[
          { label: 'Pipeline Velocity', value: currency(velocity?.velocity?.value ?? 0), sub: 'Forecasted throughput', icon: Gauge },
          { label: 'Win Rate', value: `${Math.round(winLoss?.overall?.winRate ?? 0)}%`, sub: `${winLoss?.overall?.won ?? 0} won / ${winLoss?.overall?.totalClosed ?? 0} closed`, icon: Target },
          { label: 'Avg Cycle', value: `${Math.round(velocity?.avgCycleLength ?? 0)}d`, sub: 'Created to won', icon: LineChart },
          { label: 'Avg Deal Size', value: currency(velocity?.avgDealSize ?? 0), sub: `${velocity?.totalDeals ?? 0} total deals`, icon: TrendingUp },
        ].map(card => (
          <OperatorKpi key={card.label} label={card.label} value={card.value} sub={card.sub} icon={card.icon} />
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10 }}>
        <article className="notion-panel" style={{ padding: '12px 14px' }}>
          <h2 style={{ margin: '0 0 8px', textTransform: 'none', fontSize: 15, letterSpacing: 0, color: 'var(--text-primary)' }}>
            Stage velocity and conversion
          </h2>

          {loadingVelocity ? (
            <div className="skeleton" style={{ height: 240, borderRadius: 10 }} />
          ) : !velocity || velocity.stageMetrics.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No stage data available yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {velocity.stageMetrics.map(stage => (
                <div key={stage.stage} style={{ border: '1px solid var(--border-default)', borderRadius: 9, padding: '9px 10px', background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{stageLabel(stage.stage)}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{stage.dealCount} deals</span>
                  </div>

                  <div style={{ marginTop: 7, height: 8, borderRadius: 999, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.max(6, (stage.avgDays / maxStageDays) * 100)}%`,
                        background: 'var(--brand)',
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    <span>{stage.avgDays.toFixed(1)}d avg dwell</span>
                    <span>{stage.conversionRate}% convert</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {velocity?.bottleneck && (
            <div style={{ marginTop: 9, border: '1px solid rgba(251, 191, 36, 0.3)', background: 'rgba(251, 191, 36, 0.12)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <AlertTriangle size={13} style={{ color: '#fbbf24' }} />
              <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                <strong>{stageLabel(velocity.bottleneck.stage)}:</strong> {velocity.bottleneck.reason}
              </span>
            </div>
          )}
        </article>

        <article className="notion-panel" style={{ padding: '12px 14px' }}>
          <h2 style={{ margin: '0 0 8px', textTransform: 'none', fontSize: 15, letterSpacing: 0, color: 'var(--text-primary)' }}>
            Monthly close trend
          </h2>

          {loadingWinLoss ? (
            <div className="skeleton" style={{ height: 240, borderRadius: 10 }} />
          ) : !winLoss || winLoss.monthlyTrend.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>Not enough closed-deal history yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {winLoss.monthlyTrend.map(item => {
                const total = item.won + item.lost
                return (
                  <div key={item.month} style={{ border: '1px solid var(--border-default)', borderRadius: 9, padding: '8px 10px', background: 'var(--surface-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span>{shortMonth(item.month)}</span>
                      <span>{item.winRate}% win</span>
                    </div>
                    <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(8, (total / maxMonthly) * 100)}%`, background: 'var(--brand)' }} />
                    </div>
                    <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>{item.won} won · {item.lost} lost</div>
                  </div>
                )
              })}
            </div>
          )}
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <article className="notion-panel" style={{ padding: '12px 14px' }}>
          <h2 style={{ margin: '0 0 8px', textTransform: 'none', fontSize: 15, letterSpacing: 0, color: 'var(--text-primary)' }}>
            Top loss reasons
          </h2>
          {loadingWinLoss ? (
            <div className="skeleton" style={{ height: 180, borderRadius: 10 }} />
          ) : (winLoss?.lossReasons.length ?? 0) === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No loss reasons captured yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {winLoss!.lossReasons.slice(0, 6).map((item, index) => (
                <div key={`${item.reason}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{item.reason}</span>
                  <span style={{ fontSize: 12, color: '#fb7185', fontWeight: 700 }}>{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="notion-panel" style={{ padding: '12px 14px' }}>
          <h2 style={{ margin: '0 0 8px', textTransform: 'none', fontSize: 15, letterSpacing: 0, color: 'var(--text-primary)' }}>
            Top win factors
          </h2>
          {loadingWinLoss ? (
            <div className="skeleton" style={{ height: 180, borderRadius: 10 }} />
          ) : (winLoss?.winFactors.length ?? 0) === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No win factors captured yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {winLoss!.winFactors.slice(0, 6).map((item, index) => (
                <div key={`${item.factor}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{item.factor}</span>
                  <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="notion-panel" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <BarChart3 size={14} style={{ color: 'var(--brand)' }} />
          <h2 style={{ margin: 0, textTransform: 'none', fontSize: 15, letterSpacing: 0, color: 'var(--text-primary)' }}>
            Competitor pressure snapshot
          </h2>
        </div>

        {(winLoss?.competitorImpact?.length ?? 0) === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No competitor data captured yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {winLoss!.competitorImpact.slice(0, 6).map((comp, index) => (
              <div key={`${comp.competitor}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{comp.competitor}</span>
                <span style={{ fontSize: 11.5, color: '#4ade80', textAlign: 'right' }}>Won {comp.wonAgainst}</span>
                <span style={{ fontSize: 11.5, color: '#fb7185', textAlign: 'right' }}>Lost {comp.lostTo}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        @media (max-width: 1120px) {
          .analytics-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 980px) {
          section[style*='grid-template-columns: 1.3fr 1fr'] { grid-template-columns: 1fr !important; }
          section[style*='grid-template-columns: 1fr 1fr'] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 760px) {
          .analytics-kpis { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </OperatorPage>
  )
}
