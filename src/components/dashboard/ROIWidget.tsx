'use client'

interface ROIWidgetProps {
  deals: Array<{
    outcome: 'won' | 'lost' | 'open'
    dealValue?: number | null
    competitors?: string[]
  }>
  collateralCount: number
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}m`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`
  }
  return `$${value.toFixed(0)}`
}

export default function ROIWidget({ deals, collateralCount }: ROIWidgetProps) {
  if (!deals || deals.length === 0) {
    return (
      <div style={{
        backgroundColor: '#141414',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px',
        padding: '20px',
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#555',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '16px',
        }}>
          ROI Overview
        </div>
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#555' }}>
          {/* Subtle bar chart icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 10px', display: 'block' }}>
            <rect x="3" y="12" width="4" height="9" rx="1" fill="#333" />
            <rect x="10" y="7" width="4" height="14" rx="1" fill="#333" />
            <rect x="17" y="3" width="4" height="18" rx="1" fill="#333" />
          </svg>
          <span style={{ fontSize: '13px' }}>Log deals to see your ROI</span>
        </div>
      </div>
    )
  }

  const wonDeals = deals.filter(d => d.outcome === 'won')
  const lostDeals = deals.filter(d => d.outcome === 'lost')
  const openDeals = deals.filter(d => d.outcome === 'open')

  const wonRevenue = wonDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
  const lostRevenue = lostDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
  const openRevenue = openDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
  const totalPipeline = wonRevenue + lostRevenue + openRevenue

  const closedCount = wonDeals.length + lostDeals.length
  const winRate = closedCount > 0 ? (wonDeals.length / closedCount) * 100 : 0

  const timeSaved = collateralCount * 3

  const winRateColor = winRate >= 50 ? '#22C55E' : winRate >= 30 ? '#EAB308' : '#EF4444'

  const dealsPerCollateral = collateralCount > 0
    ? Math.round(deals.length / collateralCount)
    : deals.length

  const cells = [
    {
      label: 'Won Revenue',
      value: formatCurrency(wonRevenue),
      color: '#22C55E',
      hint: `${wonDeals.length} deals closed`,
    },
    {
      label: 'Pipeline Value',
      value: formatCurrency(openRevenue),
      color: '#6366F1',
      hint: `${openDeals.length} open deals`,
    },
    {
      label: 'Win Rate',
      value: `${Math.round(winRate)}%`,
      color: winRateColor,
      hint: `${wonDeals.length}W / ${lostDeals.length}L`,
    },
    {
      label: 'Time Saved',
      value: `${timeSaved}h`,
      color: '#6366F1',
      hint: `${collateralCount} collateral × 3h`,
    },
  ]

  return (
    <div style={{
      backgroundColor: '#141414',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '8px',
      padding: '20px',
    }}>
      {/* Title */}
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        color: '#555',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: '16px',
      }}>
        ROI Overview
      </div>

      {/* 2x2 metrics grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '16px',
      }}>
        {cells.map(({ label, value, color, hint }) => (
          <div
            key={label}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: '6px',
              padding: '12px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '6px' }}>{label}</div>
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              color,
              lineHeight: 1,
              marginBottom: '4px',
            }}>
              {value}
            </div>
            <div style={{ fontSize: '11px', color: '#444' }}>{hint}</div>
          </div>
        ))}
      </div>

      {/* Win rate bar */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}>
          <span style={{ fontSize: '12px', color: '#555' }}>Win Rate</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: winRateColor }}>
            {Math.round(winRate)}%
          </span>
        </div>
        <div style={{
          height: '4px',
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(winRate, 100)}%`,
            backgroundColor: winRateColor,
            borderRadius: '2px',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Collateral hint */}
      {collateralCount > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '8px 10px',
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.12)',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#818CF8',
          lineHeight: 1.5,
        }}>
          Each piece of AI collateral covers ~{dealsPerCollateral} deal{dealsPerCollateral !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
