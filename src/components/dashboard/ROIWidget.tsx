'use client'

interface Deal {
  outcome: 'won' | 'lost' | 'open'
  dealValue?: number | null
  dealType?: string | null
  recurringInterval?: string | null
}

interface ROIWidgetProps {
  deals: Deal[]
  collateralCount: number
  currencySymbol?: string
}

// Convert a deal's stored value to its annual equivalent
export function annualizedValue(value: number, dealType?: string | null, recurringInterval?: string | null): number {
  if (!value) return 0
  if (dealType !== 'recurring') return value
  if (recurringInterval === 'monthly') return value * 12
  if (recurringInterval === 'quarterly') return value * 4
  return value // annual
}

function formatCurrency(value: number, sym = '£'): string {
  if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${sym}${(value / 1_000).toFixed(1)}k`
  return `${sym}${Math.round(value)}`
}

export default function ROIWidget({ deals, collateralCount, currencySymbol = '£' }: ROIWidgetProps) {
  const wonDeals = deals.filter(d => d.outcome === 'won')
  const openDeals = deals.filter(d => d.outcome === 'open')

  // Separate one-off won revenue from recurring ARR
  const wonOneOff = wonDeals
    .filter(d => d.dealType !== 'recurring')
    .reduce((sum, d) => sum + (d.dealValue ?? 0), 0)

  const wonARR = wonDeals
    .filter(d => d.dealType === 'recurring')
    .reduce((sum, d) => sum + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0)

  // Pipeline: annualized total of all open deals
  const openPipeline = openDeals.reduce((sum, d) =>
    sum + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0)

  // Avg deal: annualized across all deals with a value (open + won + lost)
  const allWithValue = deals.filter(d => d.dealValue && d.dealValue > 0)
  const avgDealSize = allWithValue.length > 0
    ? allWithValue.reduce((sum, d) =>
        sum + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0
      ) / allWithValue.length
    : 0

  const timeSaved = collateralCount * 3

  const hasDeals = deals.length > 0

  const cells = [
    {
      label: 'Won Revenue',
      sublabel: 'one-off',
      value: !hasDeals ? '—' : wonOneOff > 0 ? formatCurrency(wonOneOff, currencySymbol) : '—',
      hint: !hasDeals ? 'No deals yet' : wonOneOff > 0
        ? `${wonDeals.filter(d => d.dealType !== 'recurring').length} deal${wonDeals.filter(d => d.dealType !== 'recurring').length !== 1 ? 's' : ''}`
        : 'No won one-off deals',
      color: '#22C55E',
      glow: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.15)',
    },
    {
      label: 'Won ARR',
      sublabel: 'recurring',
      value: !hasDeals ? '—' : wonARR > 0 ? formatCurrency(wonARR, currencySymbol) : '—',
      hint: !hasDeals ? 'Log deals' : wonARR > 0
        ? `${wonDeals.filter(d => d.dealType === 'recurring').length} recurring deal${wonDeals.filter(d => d.dealType === 'recurring').length !== 1 ? 's' : ''}`
        : 'No recurring wins yet',
      color: '#10B981',
      glow: 'rgba(16,185,129,0.12)',
      border: 'rgba(16,185,129,0.15)',
    },
    {
      label: 'Pipeline',
      sublabel: 'annualised',
      value: !hasDeals ? '—' : openPipeline > 0 ? formatCurrency(openPipeline, currencySymbol) : '—',
      hint: !hasDeals ? 'Log a deal' : `${openDeals.length} open deal${openDeals.length !== 1 ? 's' : ''}`,
      color: '#6366F1',
      glow: 'rgba(99,102,241,0.12)',
      border: 'rgba(99,102,241,0.15)',
    },
    {
      label: 'Avg Deal',
      sublabel: 'annualised',
      value: avgDealSize > 0 ? formatCurrency(avgDealSize, currencySymbol) : '—',
      hint: avgDealSize > 0 ? `${allWithValue.length} deal${allWithValue.length !== 1 ? 's' : ''}` : 'Add deal values',
      color: '#F59E0B',
      glow: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.15)',
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
        <span style={{ fontSize: '11px', color: '#444', marginLeft: '4px' }}>Recurring values annualised</span>
        {collateralCount > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#666' }}>
            ⏱ {timeSaved}h saved · {collateralCount} collateral
          </span>
        )}
      </div>

      {/* 4-metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {cells.map(({ label, sublabel, value, hint, color, glow, border }) => (
          <div key={label} style={{
            background: glow,
            border: `1px solid ${border}`,
            borderRadius: '10px',
            padding: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: '#666', letterSpacing: '0.02em' }}>{label}</span>
              <span style={{ fontSize: '10px', color: '#444' }}>{sublabel}</span>
            </div>
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
