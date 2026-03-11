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
        background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.04) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#555',
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          marginBottom: '16px',
        }}>
          ROI Overview
        </div>
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#555' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 10px', display: 'block' }}>
            <rect x="3" y="12" width="4" height="9" rx="1" fill="rgba(99,102,241,0.3)" />
            <rect x="10" y="7" width="4" height="14" rx="1" fill="rgba(99,102,241,0.3)" />
            <rect x="17" y="3" width="4" height="18" rx="1" fill="rgba(99,102,241,0.3)" />
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
      glowColor: 'rgba(34,197,94,0.15)',
      borderColor: 'rgba(34,197,94,0.15)',
      hint: `${wonDeals.length} deals closed`,
    },
    {
      label: 'Pipeline Value',
      value: formatCurrency(openRevenue),
      color: '#6366F1',
      glowColor: 'rgba(99,102,241,0.15)',
      borderColor: 'rgba(99,102,241,0.15)',
      hint: `${openDeals.length} open deals`,
    },
    {
      label: 'Win Rate',
      value: `${Math.round(winRate)}%`,
      color: winRateColor,
      glowColor: `rgba(${winRate >= 50 ? '34,197,94' : winRate >= 30 ? '234,179,8' : '239,68,68'},0.12)`,
      borderColor: `rgba(${winRate >= 50 ? '34,197,94' : winRate >= 30 ? '234,179,8' : '239,68,68'},0.15)`,
      hint: `${wonDeals.length}W / ${lostDeals.length}L`,
    },
    {
      label: 'Time Saved',
      value: `${timeSaved}h`,
      color: '#8B5CF6',
      glowColor: 'rgba(139,92,246,0.15)',
      borderColor: 'rgba(139,92,246,0.15)',
      hint: `${collateralCount} collateral × 3h`,
    },
  ]

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(139,92,246,0.04) 50%, rgba(255,255,255,0.02) 100%)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
    }}>
      {/* Title */}
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        color: '#555',
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          width: '16px', height: '16px', borderRadius: '4px',
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 8px rgba(99,102,241,0.4)',
        }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="12" width="4" height="9" rx="1" fill="white" />
            <rect x="10" y="7" width="4" height="14" rx="1" fill="white" />
            <rect x="17" y="3" width="4" height="18" rx="1" fill="white" />
          </svg>
        </div>
        ROI Overview
      </div>

      {/* 2x2 metrics grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '16px',
      }}>
        {cells.map(({ label, value, color, glowColor, borderColor, hint }) => (
          <div
            key={label}
            style={{
              background: glowColor,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${borderColor}`,
              borderRadius: '8px',
              padding: '12px',
              boxShadow: `0 2px 12px rgba(0,0,0,0.2)`,
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
          >
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', letterSpacing: '0.02em' }}>{label}</div>
            <div style={{
              fontSize: '30px',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color,
              lineHeight: 1,
              marginBottom: '5px',
              textShadow: `0 0 20px ${color}60`,
            }}>
              {value}
            </div>
            <div style={{ fontSize: '11px', color: '#555' }}>{hint}</div>
          </div>
        ))}
      </div>

      {/* Win rate bar */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '7px',
        }}>
          <span style={{ fontSize: '12px', color: '#666' }}>Win Rate</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: winRateColor, textShadow: `0 0 12px ${winRateColor}60` }}>
            {Math.round(winRate)}%
          </span>
        </div>
        <div style={{
          height: '5px',
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(winRate, 100)}%`,
            background: `linear-gradient(90deg, ${winRateColor}, ${winRateColor}cc)`,
            borderRadius: '3px',
            transition: 'width 0.6s ease',
            boxShadow: `0 0 8px ${winRateColor}80`,
          }} />
        </div>
      </div>

      {/* Collateral hint */}
      {collateralCount > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '9px 12px',
          background: 'rgba(99,102,241,0.08)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(99,102,241,0.18)',
          borderRadius: '8px',
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
