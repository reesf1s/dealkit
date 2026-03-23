// ─── Canonical feature schema for Halvex ML engine ────────────────────────
// This is the single source of truth for all 12 ML features.
// deal-ml.ts imports FEATURE_NAMES from here; all other ml/ modules use this list.

export const STAGE_ORDER = [
  'prospecting',
  'qualification',
  'discovery',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]

export const FEATURE_NAMES = [
  'stage_progress',       // 0 = prospecting → 1 = negotiation
  'deal_value',           // log-normalised by workspace max
  'pipeline_age',         // days / 180, capped at 1
  'risk_intensity',       // continuous: dealRisks.length / 5, capped at 1
  'competitor_win_rate',  // min win rate across this deal's competitors
  'todo_engagement',      // todos-completed / total
  'text_engagement',      // NLP composite from meeting notes
  'momentum_score',       // recent vs early sentiment delta (0–1, 0.5=stable)
  'stakeholder_depth',    // breadth of stakeholder engagement (0–1)
  'urgency_score',        // urgency language density from NLP (0–1)
  'rep_win_rate',         // owning rep's historical win rate (0–1, 0.5=unknown)
  'champion_signal',      // internal champion/sponsor strength from NLP (0–1)
] as const

export type FeatureName = typeof FEATURE_NAMES[number]

export interface FeatureStats {
  maxValue: number
  maxAge: number
  maxStakeholders: number
}
