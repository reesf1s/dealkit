/** Format currency: £1,200 or £1.2k or £1.2m */
export function formatCurrency(value: number | null | undefined, compact = false): string {
  if (!value && value !== 0) return '—'
  if (compact) {
    if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
    if (value >= 1_000) return `£${(value / 1_000).toFixed(1)}k`
  }
  return `£${value.toLocaleString('en-GB')}`
}

/** Format percentage: 67% not 0.67 or 67.0% */
export function formatPct(value: number | null | undefined): string {
  if (value == null) return '—'
  // Handle both 0-1 range and 0-100 range
  const pct = value > 1 ? value : value * 100
  return `${Math.round(pct)}%`
}

/** Format days: 14 days */
export function formatDays(value: number | null | undefined): string {
  if (!value && value !== 0) return '—'
  return `${Math.round(value)} ${Math.round(value) === 1 ? 'day' : 'days'}`
}

/** Format deal count */
export function formatDeals(value: number): string {
  return `${value} ${value === 1 ? 'deal' : 'deals'}`
}
