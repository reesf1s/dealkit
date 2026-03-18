export interface ScoreBreakdown {
  composite_score: number
  text_signal_score: number
  text_weight: number
  ml_score: number
  ml_weight: number
  momentum_score: number
  momentum_weight: number
  ml_active: boolean
  training_deals: number
  model_version: string
}

/**
 * DETERMINISTIC composite score — no LLM involvement.
 * @param textSignalScore 0-100 from extracted signals (champion, budget, objections, etc.)
 * @param mlProbability   0-1 from logistic regression, or null if ML not yet active
 * @param momentumScore   sentiment momentum (-10 to +10)
 * @param closedDealCount total closed deals used for training
 */
export function computeCompositeScore(
  textSignalScore: number,
  mlProbability: number | null,
  momentumScore: number,
  closedDealCount: number
): ScoreBreakdown {
  const momentum = Math.max(-10, Math.min(10, momentumScore ?? 0))
  // Convert momentum to a 40-60 score component (neutral=50)
  const momentumComponent = 50 + momentum

  if (mlProbability !== null && closedDealCount >= 10) {
    // ML active — weight scales logarithmically with data
    const mlWeight = Math.min(0.70, 0.14 * Math.log(Math.max(closedDealCount, 1)))
    const momentumWeight = 0.05
    const textWeight = Math.max(0, 1.0 - mlWeight - momentumWeight)
    const mlScore = mlProbability * 100
    const raw = textSignalScore * textWeight + mlScore * mlWeight + momentumComponent * momentumWeight
    const score = Math.max(0, Math.min(100, Math.round(raw)))
    return {
      composite_score: score,
      text_signal_score: Math.round(textSignalScore),
      text_weight: Math.round(textWeight * 100) / 100,
      ml_score: Math.round(mlScore),
      ml_weight: Math.round(mlWeight * 100) / 100,
      momentum_score: Math.round(momentum),
      momentum_weight: momentumWeight,
      ml_active: true,
      training_deals: closedDealCount,
      model_version: new Date().toISOString()
    }
  } else {
    // Cold start — 70% text signals, 25% global prior (50), 5% momentum
    const globalPrior = 50
    const raw = textSignalScore * 0.70 + globalPrior * 0.25 + momentumComponent * 0.05
    const score = Math.max(0, Math.min(100, Math.round(raw)))
    return {
      composite_score: score,
      text_signal_score: Math.round(textSignalScore),
      text_weight: 0.70,
      ml_score: globalPrior,
      ml_weight: 0.25,
      momentum_score: Math.round(momentum),
      momentum_weight: 0.05,
      ml_active: false,
      training_deals: closedDealCount,
      model_version: new Date().toISOString()
    }
  }
}

/**
 * Compute text signal score (0-100) from extracted deal signals.
 * Pure math — no LLM.
 */
export function computeTextSignalScore(signals: {
  champion_identified?: boolean
  budget_confirmed?: boolean
  decision_timeline_set?: boolean
  next_step_defined?: boolean
  positive_signal_count?: number
  negative_signal_count?: number
  objection_count?: number
  urgency_signal_count?: number
  competitor_present?: boolean
  days_since_last_note?: number
  todo_completion_rate?: number
}): number {
  let score = 50 // baseline

  // Positive structural signals (+5 each)
  if (signals.champion_identified) score += 8
  if (signals.budget_confirmed) score += 8
  if (signals.decision_timeline_set) score += 5
  if (signals.next_step_defined) score += 5

  // Engagement signals
  const posCount = signals.positive_signal_count ?? 0
  const negCount = signals.negative_signal_count ?? 0
  const urgencyCount = signals.urgency_signal_count ?? 0
  score += Math.min(posCount * 2, 15)   // cap at +15
  score -= Math.min(negCount * 2, 15)   // cap at -15
  score += Math.min(urgencyCount * 1.5, 8) // urgency is positive signal

  // Objections are negative
  score -= Math.min((signals.objection_count ?? 0) * 3, 12)

  // Recency (days since last note penalty)
  const daysSince = signals.days_since_last_note ?? 0
  if (daysSince > 21) score -= 10
  else if (daysSince > 14) score -= 5
  else if (daysSince <= 3) score += 3

  // Todo completion
  const todoRate = signals.todo_completion_rate ?? 0.5
  score += (todoRate - 0.5) * 10 // ±5 points

  // Competitor present is a mild negative
  if (signals.competitor_present) score -= 3

  return Math.max(0, Math.min(100, Math.round(score)))
}
