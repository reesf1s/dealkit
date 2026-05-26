/**
 * OpenAI model name constants.
 *
 * V2 customer-product generation uses GPT-5.4 mini by default.
 * Routing policy:
 *   MINI   — everything: intent classification, extraction, analysis, generation.
 *            Override with HALVEX_AI_MODEL if we need a pinned snapshot.
 *   FRONTIER — premium/top-plan upgrade path for heavier reasoning.
 */

export const MINI = process.env.HALVEX_AI_MODEL || 'gpt-5.4-mini'
export const FRONTIER = process.env.HALVEX_PREMIUM_AI_MODEL || 'gpt-5.5'

/** Aliases kept so existing callers that import HAIKU/SONNET still compile */
export const HAIKU = MINI
export const SONNET = MINI

/** Max tokens budget by use case */
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
