export const STAGE_ORDER = [
  'lead',
  'discovery',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost'
]

export const FEATURE_NAMES = [
  'stage_position',
  'deal_value',
  'deal_age_days',
  'engagement_velocity',
  'champion_identified',
  'budget_confirmed',
  'competitor_present',
  'momentum_direction',
  'stakeholder_count',
  'todo_completion_rate',
  'urgency_signal_density'
]

export interface FeatureStats {
  maxValue: number
  maxAge: number
  maxStakeholders: number
}

/**
 * Compute the 11-feature vector for a deal.
 * All features normalised to approximately 0-1.
 */
export function computeFeatureVector(
  deal: {
    stage?: string
    dealValue?: number
    deal_age_days?: number
    number_of_meetings?: number
    champion_identified?: boolean
    budget_confirmed?: boolean
    competitor_present?: boolean
    momentum_direction?: number
    number_of_stakeholders?: number
    todo_completion_rate?: number
    urgency_signal_count?: number
  },
  stats: FeatureStats
): number[] {
  const stageIdx = STAGE_ORDER.indexOf(deal.stage ?? 'discovery')
  // Use only open stages (0-4) for normalisation
  const stageNumeric = stageIdx >= 0 && stageIdx < 5 ? stageIdx / 4 : 0.5

  const ageDays = deal.deal_age_days ?? 0
  const ageWeeks = Math.max(ageDays / 7, 0.1)
  const meetings = deal.number_of_meetings ?? 0

  return [
    stageNumeric,
    stats.maxValue > 0 ? Math.min((deal.dealValue ?? 0) / stats.maxValue, 1) : 0,
    stats.maxAge > 0 ? Math.min(ageDays / stats.maxAge, 1) : 0,
    Math.min(meetings / ageWeeks / 2, 1),           // velocity normalised
    deal.champion_identified ? 1 : 0,
    deal.budget_confirmed ? 1 : 0,
    deal.competitor_present ? 1 : 0,
    Math.max(-1, Math.min(1, deal.momentum_direction ?? 0)),
    stats.maxStakeholders > 0 ? Math.min((deal.number_of_stakeholders ?? 0) / stats.maxStakeholders, 1) : 0,
    Math.max(0, Math.min(1, deal.todo_completion_rate ?? 0.5)),
    ageDays > 0 ? Math.min((deal.urgency_signal_count ?? 0) / ageWeeks, 1) : 0
  ]
}
