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

/**
 * Full date: "18 March 2026"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Short date: "18 Mar"
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Day + date: "Tue, 18 Mar"
 */
export function formatDateWithDay(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Relative: "2 days ago", "yesterday", "today", "tomorrow", "in 3 days"
 */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const diffDays = Math.round((d.getTime() - Date.now()) / 86400000)
  if (diffDays === 0) return 'today'
  if (diffDays === -1) return 'yesterday'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`
  return `in ${diffDays} days`
}
