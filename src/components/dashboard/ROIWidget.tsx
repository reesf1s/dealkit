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
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

export default function ROIWidget({ deals, collateralCount }: ROIWidgetProps) {
  const wonDeals = deals.filter(d => d.outcome === 'won')
  const lostDeals = deals.filter(d => d.outcome === 'lost')
  const openDeals = deals.filter(d => d.outcome === 'open')

  const wonRevenue = wonDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
  const openRevenue = openDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
  const timeSaved = collateralCount * 3

  const closedDealsWithValue = [...wonDeals, ...lostDeals].filter(d => d.dealValue && d.dealValue > 0)
  const avgDealSize = closedDealsWithValue.length > 0
    ? closedDealsWithValue.reduce((sum, d) => sum + (d.dealValue ?? 0), 0) / closedDealsWithValue.length
    : 0

  const cells = [
    {
      label: 'Won Revenue',
      value: deals.length === 0 ? '—' : formatCurrency(wonRevenue),
      hint: deals.length === 0 ? 'No deals yet' : `${wonDeals.length} deal${wonDeals.length !== 1 ? 's' : ''} closed`,
      color: '#22C55E',
      glow: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.15)',
    },
    {
      label: 'Pipeline Value',
      value: deals.length === 0 ? '—' : formatCurrency(openRevenue),
      hint: deals.length === 0 ? 'Log a deal' : `${openDeals.length} open deal${openDeals.length !== 1 ? 's' : ''}`,
      color: '#6366F1',
      glow: 'rgba(99,102,241,0.12)',
      border: 'rgba(99,102,241,0.15)',
    },
    {
      label: 'Avg Deal Size',
      value: avgDealSize > 0 ? formatCurrency(avgDealSize) : '—',
      hint: avgDealSize > 0 ? `${closedDealsWithValue.length} deals with value` : 'Add deal values',
      color: '#F59E0B',
      glow: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.15)',
    },
    {
      label: 'Time Saved',
      value: timeSaved > 0 ? `${timeSaved}h` : '—',
      hint: collateralCount > 0 ? `${collateralCount} collateral × 3h` : 'Generate collateral',
      color: '#8B5CF6',
      glow: 'rgba(139,92,246,0.12)',
      border: 'rgba(139,92,246,0.15)',
    },
  ]

  return (
    <div style={{
      background: 'rgba(18,12,32,0.7)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(124,58,237,0.18)',
      borderRadius: '14px',
      padding: '16px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))',
          border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="12" width="4" height="9" rx="1" fill="#818CF8" />
            <rect x="10" y="7" width="4" height="14" rx="1" fill="#818CF8" />
            <rect x="17" y="3" width="4" height="18" rx="1" fill="#818CF8" />
          </svg>
        </div>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>Revenue Impact</span>
      </div>

      {/* 4-metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {cells.map(({ label, value, hint, color, glow, border }) => (
          <div key={label} style={{
            background: glow,
            border: `1px solid ${border}`,
            borderRadius: '10px',
            padding: '12px',
          }}>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', letterSpacing: '0.02em' }}>{label}</div>
            <div style={{
              fontSize: '22px', fontWeight: 800, letterSpacing: '-0.04em',
              color, lineHeight: 1, marginBottom: '4px',
              textShadow: `0 0 16px ${color}50`,
            }}>{value}</div>
            <div style={{ fontSize: '11px', color: '#555' }}>{hint}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
