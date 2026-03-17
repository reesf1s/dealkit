/**
 * Shared currency formatting helpers.
 * The currency symbol is stored in workspace pipeline_config.currency (default '$').
 * The value display mode is stored in pipeline_config.valueDisplay ('arr' | 'mrr', default 'arr').
 */

export type ValueDisplay = 'arr' | 'mrr'

/**
 * Convert a raw deal value to the user's preferred display amount.
 *
 * Non-recurring deals always return their face value regardless of mode.
 * Recurring deals:
 *   'arr' → annualise (×12 monthly, ×4 quarterly, ×1 annual)
 *   'mrr' → monthly equivalent (÷3 quarterly, ÷12 annual, ×1 monthly)
 */
export function toDisplayAmount(
  rawValue: number,
  dealType: string | null | undefined,
  recurringInterval: string | null | undefined,
  mode: ValueDisplay,
): number {
  if (!rawValue || rawValue <= 0) return 0
  if (dealType !== 'recurring') return rawValue
  if (mode === 'arr') {
    if (recurringInterval === 'monthly')   return rawValue * 12
    if (recurringInterval === 'quarterly') return rawValue * 4
    return rawValue // already annual
  } else {
    if (recurringInterval === 'monthly')   return rawValue                  // already monthly
    if (recurringInterval === 'quarterly') return Math.round(rawValue / 3)
    return Math.round(rawValue / 12)                                        // annual → monthly
  }
}

/** Label suffix to append when values are recurring and display mode is known */
export function recurringLabel(
  dealList: { dealType?: string | null }[],
  mode: ValueDisplay,
): string {
  const hasRecurring = dealList.some(d => d.dealType === 'recurring')
  if (!hasRecurring) return ''
  return mode === 'mrr' ? ' · MRR' : ' · ARR'
}

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
