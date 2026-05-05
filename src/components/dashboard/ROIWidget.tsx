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
      color: '#0f7b6c',
      glow: 'rgba(15,123,108,0.06)',
      border: 'rgba(15,123,108,0.16)',
    },
    {
      label: 'Won ARR',
      sublabel: 'recurring',
      value: !hasDeals ? '—' : wonARR > 0 ? formatCurrency(wonARR, currencySymbol) : '—',
      hint: !hasDeals ? 'Log deals' : wonARR > 0
        ? `${wonDeals.filter(d => d.dealType === 'recurring').length} recurring deal${wonDeals.filter(d => d.dealType === 'recurring').length !== 1 ? 's' : ''}`
        : 'No recurring wins yet',
      color: '#0f7b6c',
      glow: 'rgba(15,123,108,0.06)',
      border: 'rgba(15,123,108,0.16)',
    },
    {
      label: 'Pipeline',
      sublabel: 'annualised',
      value: !hasDeals ? '—' : openPipeline > 0 ? formatCurrency(openPipeline, currencySymbol) : '—',
      hint: !hasDeals ? 'Log a deal' : `${openDeals.length} open deal${openDeals.length !== 1 ? 's' : ''}`,
      color: 'var(--brand)',
      glow: 'rgba(94,106,210,0.06)',
      border: 'rgba(94,106,210,0.16)',
    },
    {
      label: 'Avg Deal',
      sublabel: 'annualised',
      value: avgDealSize > 0 ? formatCurrency(avgDealSize, currencySymbol) : '—',
      hint: avgDealSize > 0 ? `${allWithValue.length} deal${allWithValue.length !== 1 ? 's' : ''}` : 'Add deal values',
      color: '#cb6c2c',
      glow: 'rgba(203,108,44,0.06)',
      border: 'rgba(203,108,44,0.16)',
    },
  ]

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid rgba(55,53,47,0.09)',
      borderRadius: '10px',
      padding: '16px 20px',
      boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: 'rgba(94,106,210,0.10)',
          border: '1px solid rgba(94,106,210,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="12" width="4" height="9" rx="1" fill="var(--brand)" />
            <rect x="10" y="7" width="4" height="14" rx="1" fill="var(--brand)" />
            <rect x="17" y="3" width="4" height="18" rx="1" fill="var(--brand)" />
          </svg>
        </div>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#37352f' }}>Revenue Impact</span>
        <span style={{ fontSize: '11px', color: '#9b9a97', marginLeft: '4px' }}>Recurring values annualised</span>
        {collateralCount > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#9b9a97' }}>
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
              <span style={{ fontSize: '11px', color: '#9b9a97', letterSpacing: '0.02em' }}>{label}</span>
              <span style={{ fontSize: '10px', color: '#9b9a97' }}>{sublabel}</span>
            </div>
            <div style={{
              fontSize: '22px', fontWeight: 800, letterSpacing: 0,
              color, lineHeight: 1, marginBottom: '4px',
            }}>{value}</div>
            <div style={{ fontSize: '11px', color: '#9b9a97' }}>{hint}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
