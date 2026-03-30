/**
 * OpenAI model name constants.
 *
 * All generation uses GPT-4.1 mini unless a specific override is needed.
 * Routing policy:
 *   MINI   — everything: intent classification, extraction, analysis, generation
 *            GPT-4.1 mini is fast, cost-efficient, and strong enough for the
 *            assistant and extraction workloads in Halvex.
 */

export const MINI = 'gpt-4.1-mini' as const

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
