'use client'

import type { DealLog } from '@/types'

interface DealInsightsProps {
  deals: DealLog[]
  currencySymbol?: string
}

function toMRR(deal: DealLog): number {
  if (!deal.dealValue) return 0
  if (deal.recurringInterval === 'monthly') return deal.dealValue
  if (deal.recurringInterval === 'quarterly') return deal.dealValue / 3
  return deal.dealValue / 12 // annual (default)
}

function makeFmt(sym: string) {
  return (n: number): string => {
    if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${sym}${(n / 1_000).toFixed(1)}k`
    return `${sym}${Math.round(n).toLocaleString()}`
  }
}

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.72)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(0, 0, 0, 0.08)',
  borderRadius: '14px',
  overflow: 'hidden',
  boxShadow: '0 2px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
}

const CARD_HEADER_STYLE: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
}

const CARD_TITLE_STYLE: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em',
}

const DIVIDER_STYLE: React.CSSProperties = {
  borderTop: '1px solid rgba(0,0,0,0.06)',
}

function WinRateGauge({ rate }: { rate: number }) {
  const color = rate >= 60 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444'
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (rate / 100) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px 16px' }}>
      <div style={{ position: 'relative', width: '100px', height: '100px' }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 600ms ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '22px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(rate)}%
          </span>
        </div>
      </div>
      <span style={{ fontSize: '12px', color: '#aeaeb2' }}>Overall win rate</span>
    </div>
  )
}

export function DealInsights({ deals, currencySymbol = '£' }: DealInsightsProps) {
  const fmt = makeFmt(currencySymbol)
  const closedDeals = deals.filter((d) => d.stage === 'closed_won' || d.stage === 'closed_lost')
  const wonDeals = deals.filter((d) => d.stage === 'closed_won')
  const lostDeals = deals.filter((d) => d.stage === 'closed_lost')
  const winRate = closedDeals.length > 0 ? (wonDeals.length / closedDeals.length) * 100 : 0

  const recurringWon = wonDeals.filter((d) => d.dealType === 'recurring')
  const mrr = recurringWon.reduce((sum, d) => sum + toMRR(d), 0)
  const arr = mrr * 12

  const lossReasonCounts: Record<string, number> = {}
  lostDeals.forEach((d) => {
    if (d.lostReason) {
      lossReasonCounts[d.lostReason] = (lossReasonCounts[d.lostReason] ?? 0) + 1
    }
  })
  const topLossReasons = Object.entries(lossReasonCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const competitorStats: Record<string, { won: number; lost: number }> = {}
  closedDeals.forEach((d) => {
    d.competitors.forEach((c) => {
      if (!competitorStats[c]) competitorStats[c] = { won: 0, lost: 0 }
      if (d.stage === 'closed_won') competitorStats[c].won++
      else competitorStats[c].lost++
    })
  })
  const competitorRows = Object.entries(competitorStats)
    .map(([name, { won, lost }]) => ({
      name, won, lost,
      total: won + lost,
      rate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* MRR / ARR projection */}
      {recurringWon.length > 0 && (
        <div style={CARD_STYLE}>
          <div style={CARD_HEADER_STYLE}>
            <span style={CARD_TITLE_STYLE}>Revenue projection</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '16px 18px', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '10px', color: '#aeaeb2', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>MRR</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(255,255,255,0.80)', fontVariantNumeric: 'tabular-nums' }}>{fmt(mrr)}</div>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '10px', color: '#aeaeb2', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>ARR</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(255,255,255,0.70)', fontVariantNumeric: 'tabular-nums' }}>{fmt(arr)}</div>
            </div>
          </div>
          <div style={{ padding: '10px 18px' }}>
            <span style={{ fontSize: '11px', color: '#aeaeb2' }}>From {recurringWon.length} recurring deal{recurringWon.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Win rate gauge */}
      <div style={CARD_STYLE}>
        <div style={CARD_HEADER_STYLE}>
          <span style={CARD_TITLE_STYLE}>Win rate</span>
        </div>
        {closedDeals.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#aeaeb2', padding: '20px', margin: 0, textAlign: 'center' }}>
            Log your first closed deal to see win rate.
          </p>
        ) : (
          <>
            <WinRateGauge rate={winRate} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', ...DIVIDER_STYLE }}>
              <div style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{wonDeals.length}</div>
                <div style={{ fontSize: '11px', color: '#aeaeb2', marginTop: '2px' }}>Won</div>
              </div>
              <div style={{ padding: '14px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{lostDeals.length}</div>
                <div style={{ fontSize: '11px', color: '#aeaeb2', marginTop: '2px' }}>Lost</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Top loss reasons */}
      <div style={CARD_STYLE}>
        <div style={CARD_HEADER_STYLE}>
          <span style={CARD_TITLE_STYLE}>Top loss reasons</span>
        </div>
        <div style={{ padding: '14px 18px' }}>
          {topLossReasons.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#aeaeb2', margin: 0, textAlign: 'center', padding: '6px 0' }}>No data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topLossReasons.map(([reason, count]) => (
                <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '12px', color: '#6e6e73', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {reason}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    ×{count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Win rate by competitor */}
      <div style={CARD_STYLE}>
        <div style={CARD_HEADER_STYLE}>
          <span style={CARD_TITLE_STYLE}>Win rate vs competitors</span>
        </div>
        {competitorRows.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#aeaeb2', margin: 0, textAlign: 'center', padding: '20px' }}>No competitor data yet.</p>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px 70px', padding: '8px 18px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              {['Competitor', 'W', 'L', 'Rate'].map((h) => (
                <span key={h} style={{ fontSize: '10px', fontWeight: 600, color: '#aeaeb2', letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: h === 'Competitor' ? 'left' : 'right' }}>
                  {h}
                </span>
              ))}
            </div>
            {competitorRows.map((row, i) => (
              <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px 70px', padding: '10px 18px', borderBottom: i < competitorRows.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#1d1d1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.won}</span>
                <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.lost}</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                  <div style={{ width: '32px', height: '4px', borderRadius: '9999px', backgroundColor: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${row.rate}%`, backgroundColor: row.rate >= 50 ? '#10b981' : '#ef4444', borderRadius: '9999px' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: '#6e6e73', fontVariantNumeric: 'tabular-nums', minWidth: '30px', textAlign: 'right' }}>{row.rate}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
