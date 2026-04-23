import { getManualBriefOverride } from '@/lib/brief-override'

type DealSummaryLike = {
  aiSummary?: unknown
  dealReview?: unknown
} | null | undefined

export function getEffectiveDealSummary(input: DealSummaryLike): string | null {
  if (!input) return null

  const manualOverride = getManualBriefOverride(
    input.dealReview as Record<string, unknown> | null | undefined,
  )

  if (manualOverride?.text) {
    return manualOverride.text
  }

  if (typeof input.aiSummary === 'string') {
    const summary = input.aiSummary.trim()
    return summary || null
  }

  return null
}

export function getEffectiveDealSummarySnippet(
  input: DealSummaryLike,
  maxLength = 200,
): string | null {
  const summary = getEffectiveDealSummary(input)
  if (!summary) return null
  if (summary.length <= maxLength) return summary
  return `${summary.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}
