/**
 * Anthropic model name constants.
 *
 * Using constants prevents typos and makes it easy to upgrade model versions
 * across the codebase in one place.
 *
 * Routing policy:
 *   HAIKU  — intent classification, short-form formatting, simple extraction,
 *             workflow summaries, anything with max_tokens ≤ 1024
 *   SONNET — complex analysis, multi-step reasoning, structured extractions
 *             with many fields, anything that must be accurate over fast
 */

export const HAIKU = 'claude-haiku-4-5-20251001' as const
export const SONNET = 'claude-sonnet-4-6' as const

/** Max tokens budget by model and use case — prevents over-spending on output */
export const TOKEN_BUDGET = {
  /** Intent classification / routing */
  INTENT: 60,
  /** Short summaries, formatting, status labels */
  FORMAT: 150,
  /** Extraction: short structured outputs (5-10 fields) */
  EXTRACT_SM: 512,
  /** Extraction: medium structured outputs (10-20 fields) */
  EXTRACT_MD: 1024,
  /** Analysis with narrative sections */
  ANALYSE: 1500,
  /** Full collateral generation (battlecards, case studies) */
  COLLATERAL: 4096,
} as const
