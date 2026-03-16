/**
 * Shared currency formatting helpers.
 * The currency symbol is stored in workspace pipeline_config.currency (default '$').
 */

export function makeFmt(symbol: string) {
  return (v: number): string => {
    if (v >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(1)}m`
    if (v >= 1_000) return `${symbol}${(v / 1_000).toFixed(0)}k`
    return `${symbol}${Math.round(v)}`
  }
}

/** Fallback formatter using '$' — use makeFmt(symbol) when currency is available. */
export const defaultFmt = makeFmt('$')

export const CURRENCY_OPTIONS = [
  { symbol: '$', label: 'USD  $' },
  { symbol: '£', label: 'GBP  £' },
  { symbol: '€', label: 'EUR  €' },
  { symbol: '¥', label: 'JPY  ¥' },
  { symbol: 'A$', label: 'AUD  A$' },
  { symbol: 'C$', label: 'CAD  C$' },
  { symbol: 'CHF', label: 'CHF  CHF' },
  { symbol: 'kr', label: 'SEK/NOK  kr' },
  { symbol: 'R', label: 'ZAR  R' },
  { symbol: '₹', label: 'INR  ₹' },
]
