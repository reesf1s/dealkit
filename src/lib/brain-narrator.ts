/**
 * Brain Narrator — unified LLM briefing system.
 *
 * The brain (ML + statistics + NLP) determines all intelligence.
 * This module packages those determinations into tight structured briefings.
 * The LLM's only job is to narrate the briefing in natural language —
 * it adds NO reasoning of its own.
 *
 * Every LLM route in the app should call buildBriefing() and pass the result
 * to Claude. Claude receives pre-computed facts, not raw data to analyse.
 *
 * Usage:
 *   const briefing = buildDealBriefing(brain, dealId, dealData, textSignals)
 *   const prompt = narrationPrompt(briefing)
 *   // → send prompt to Claude; response is a 2-3 sentence explanation
 */

import type { WorkspaceBrain, DealSnapshot } from '@/lib/workspace-brain'
import type { TextSignals } from '@/lib/text-signals'

// ─── Deal briefing ────────────────────────────────────────────────────────────

export interface DealBriefing {
  dealName: string
  company: string
  stage: string
  score: number                        // brain-determined composite score
  scoreBasis: 'ml_composite' | 'text_heuristic'  // how the score was computed
  mlWinProbability: number | null      // raw ML prediction [0–100]
  mlTrainingDeals: number              // how many closed deals the ML trained on
  topPositives: string[]               // up to 3 objective positive signals
  topRisks: string[]                   // up to 3 risk signals
  stalledDays: number | null           // null if not stalled, else days over threshold
  similarWin: string | null            // "Company X (82% similar)" if KNN match exists
  archetype: string | null             // deal archetype label from k-means
  competitorInsight: string | null     // e.g. "You win 60% vs Competitor Y"
  recommendation: string               // single most important recommended action
  // Extended signals
  isDeteriorating: boolean             // note sentiment declining over time
  momentumDirection: 'building' | 'stable' | 'declining'
  predictedCloseDays: number | null    // OLS regression prediction
  stakeholderDepth: number | null      // 0-1 breadth of stakeholder coverage
  nextStepDefined: boolean
}

export interface OverviewBriefing {
  totalActive: number
  totalValue: number
  avgScore: number | null
  stageBreakdown: Record<string, number>
  winRate: number | null               // from brain's win/loss intel
  winRateTrend: string | null          // "improving +4%/mo" or null
  topUrgencies: string[]               // up to 3 urgent deal summaries
  topStale: string[]                   // up to 3 stale deal summaries
  topRisks: string[]                   // up to 5 recurring risks
  topRecommendations: string[]         // up to 4 most important pipeline actions
  forecast: number | null              // probability-weighted pipeline value
  pipelineHealth: string | null        // e.g. "Strong (74/100)"
  deterioratingDeals: string[]         // deal names with declining sentiment
  nextMonthForecast: string | null     // ML revenue forecast for next month
}

export interface MeetingPrepBriefing {
  dealName: string
  company: string
  stage: string
  score: number | null
  pendingActions: string[]             // open todos
  risks: string[]
  competitors: string[]
  competitorInsights: string[]         // per-competitor win advice from brain
  similarWin: string | null
  winningPatterns: string[]            // from brain's feature importance
  stalledWarning: string | null
  decisionMakerSignal: boolean
  budgetConfirmed: boolean
}

// ─── Build deal briefing ──────────────────────────────────────────────────────

export function buildDealBriefing(
  brain: WorkspaceBrain | null,
  dealId: string,
  deal: {
    dealName: string
    company: string
    stage: string
    dealRisks?: string[] | unknown
    dealCompetitors?: string[] | unknown
    conversionScore?: number | null
    meetingNotes?: string | null
  },
  signals?: TextSignals,
): DealBriefing {
  const risks = (deal.dealRisks as string[]) ?? []
  const competitors = (deal.dealCompetitors as string[]) ?? []

  // ML prediction for this deal
  const mlPred = brain?.mlPredictions?.find(p => p.dealId === dealId)
  const mlModel = brain?.mlModel

  // Score determination
  const score = deal.conversionScore ?? 40
  const scoreBasis: DealBriefing['scoreBasis'] = mlPred ? 'ml_composite' : 'text_heuristic'
  const mlWinProbability = mlPred ? Math.round(mlPred.winProbability * 100) : null
  const mlTrainingDeals = mlModel?.trainingSize ?? 0

  // Top positive signals (from text signals + deal state)
  const positives: string[] = []
  if (signals?.budgetConfirmed)     positives.push('Budget confirmed')
  if (signals?.decisionMakerSignal) positives.push('Decision-maker engaged')
  if (signals?.urgencyScore && signals.urgencyScore > 0.4) positives.push('Urgency expressed by prospect')
  if (signals?.sentimentScore && signals.sentimentScore > 0.65) positives.push('Strong positive language in recent notes')
  if (deal.stage === 'negotiation' || deal.stage === 'proposal') positives.push(`Advanced to ${deal.stage}`)
  if (mlPred?.nearestWin) positives.push(`Similar to past win: ${mlPred.nearestWin.company}`)

  // Stall detection
  const stageAlert = brain?.stageVelocityIntel?.stageAlerts.find(a => a.dealId === dealId)
  const stalledDays = stageAlert ? stageAlert.currentAgeDays - stageAlert.expectedMaxDays : null

  // KNN nearest win
  const nearestWin = mlPred?.similarWins?.[0]
  const similarWin = nearestWin
    ? `${nearestWin.company} (${nearestWin.similarity}% similar)`
    : null

  // Archetype
  const archetypeId = mlPred?.archetypeId
  const archetype = archetypeId != null
    ? brain?.dealArchetypes?.find(a => a.id === archetypeId)?.label ?? null
    : null

  // Competitor insight
  let competitorInsight: string | null = null
  if (competitors.length > 0 && brain?.competitivePatterns) {
    const topPattern = brain.competitivePatterns.find(p =>
      competitors.some(c => c.toLowerCase().includes(p.competitor.toLowerCase()))
    )
    if (topPattern) {
      competitorInsight = `${topPattern.winRate}% win rate vs ${topPattern.competitor} — ${topPattern.topWinCondition}`
    }
  }

  // Recommendation (most critical single action)
  const brainRec = brain?.pipelineRecommendations?.find(r => r.dealId === dealId)
  let recommendation = brainRec?.recommendation ?? 'Review deal status and update next steps'
  if (stalledDays && stalledDays > 7) recommendation = `Deal has stalled ${stalledDays} days past expected stage duration — re-engage now`
  if (risks.length > 0 && !recommendation.includes('risk')) recommendation = `Address key risk: ${risks[0]}`

  // Extended signal data from brain snapshot
  const snap = brain?.deals?.find(d => d.id === dealId)
  const sig  = snap?.signalSummary
  const momentumDirection: DealBriefing['momentumDirection'] =
    sig == null        ? 'stable' :
    sig.momentum > 0.6 ? 'building' :
    sig.momentum < 0.4 ? 'declining' : 'stable'

  return {
    dealName: deal.dealName,
    company: deal.company,
    stage: deal.stage,
    score,
    scoreBasis,
    mlWinProbability,
    mlTrainingDeals,
    topPositives: positives.slice(0, 3),
    topRisks: risks.slice(0, 3),
    stalledDays,
    similarWin,
    archetype,
    competitorInsight,
    recommendation,
    isDeteriorating:  sig?.isDeteriorating ?? false,
    momentumDirection,
    predictedCloseDays: sig?.predictedCloseDays ?? null,
    stakeholderDepth:  sig?.stakeholderDepth ?? null,
    nextStepDefined:   sig?.nextStepDefined ?? false,
  }
}

// ─── Build overview briefing ──────────────────────────────────────────────────

export function buildOverviewBriefing(brain: WorkspaceBrain | null): OverviewBriefing {
  if (!brain) {
    return {
      totalActive: 0, totalValue: 0, avgScore: null,
      stageBreakdown: {}, winRate: null, winRateTrend: null,
      topUrgencies: [], topStale: [], topRisks: [],
      topRecommendations: [], forecast: null,
      pipelineHealth: null, deterioratingDeals: [], nextMonthForecast: null,
    }
  }

  const winRateTrend = brain.mlTrends?.winRate
    ? `${brain.mlTrends.winRate.direction} (${brain.mlTrends.winRate.slopePctPerMonth > 0 ? '+' : ''}${brain.mlTrends.winRate.slopePctPerMonth.toFixed(1)}%/mo)`
    : null

  const topRecommendations = (brain.pipelineRecommendations ?? [])
    .sort((a, b) => (a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0))
    .slice(0, 4)
    .map(r => `${r.dealName} (${r.company}): ${r.recommendation}`)

  const phi = brain.pipelineHealthIndex
  const pipelineHealth = phi ? `${phi.interpretation} (${phi.score}/100) — ${phi.keyInsight}` : null

  const deterioratingDeals = (brain.deteriorationAlerts ?? [])
    .slice(0, 3)
    .map(d => `${d.dealName} (${d.company}): ${d.warning}`)

  // Next month revenue forecast (using Date to handle December rollover correctly)
  const now = new Date()
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthKey  = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`
  const nextMonthRF = (brain.revenueForecasts ?? []).find(r => r.month === nextMonthKey)
  const nextMonthForecast = nextMonthRF
    ? `£${Math.round(nextMonthRF.expectedRevenue / 1000)}k expected (${nextMonthRF.dealCount} deals, ${nextMonthRF.avgConfidence}% avg confidence)`
    : null

  return {
    totalActive: brain.pipeline.totalActive,
    totalValue: brain.pipeline.totalValue,
    avgScore: brain.pipeline.avgConversionScore,
    stageBreakdown: brain.pipeline.stageBreakdown,
    winRate: brain.winLossIntel?.winRate ?? null,
    winRateTrend,
    topUrgencies: (brain.urgentDeals ?? []).slice(0, 3).map(u => `${u.dealName} (${u.company}): ${u.reason}`),
    topStale: (brain.staleDeals ?? []).slice(0, 3).map(s => `${s.dealName} — ${s.daysSinceUpdate} days stale`),
    topRisks: (brain.topRisks ?? []).slice(0, 5),
    topRecommendations,
    forecast: brain.dealVelocity?.weightedForecast ?? null,
    pipelineHealth,
    deterioratingDeals,
    nextMonthForecast,
  }
}

// ─── Build meeting prep briefing ──────────────────────────────────────────────

export function buildMeetingPrepBriefing(
  brain: WorkspaceBrain | null,
  deal: DealSnapshot & { dealCompetitors?: string[] | unknown; meetingNotes?: string | null },
  signals?: TextSignals,
): MeetingPrepBriefing {
  const competitors = (deal.dealCompetitors as string[] | undefined) ?? []
  const mlPred = brain?.mlPredictions?.find(p => p.dealId === deal.id)

  // Competitor win advice
  const competitorInsights: string[] = []
  for (const comp of competitors) {
    const pattern = brain?.competitivePatterns?.find(p =>
      comp.toLowerCase().includes(p.competitor.toLowerCase())
    )
    if (pattern) {
      competitorInsights.push(`vs ${pattern.competitor}: win ${pattern.winRate}% — ${pattern.topWinCondition}`)
    }
  }

  // Feature importance → winning patterns to emphasise
  const winningPatterns = (brain?.mlModel?.featureImportance ?? [])
    .filter(f => f.direction === 'helps' && f.importance > 0.05)
    .slice(0, 3)
    .map(f => {
      const labels: Record<string, string> = {
        stage_progress: 'Deal is well-progressed in pipeline',
        deal_value: 'High-value deals tend to win in this workspace',
        todo_engagement: 'Completing action items strongly correlates with wins',
        text_engagement: 'Active and positive engagement correlates with wins',
        competitor_win_rate: 'Historical win rate against this competitor is favourable',
      }
      return labels[f.name] ?? f.name
    })

  const stageAlert = brain?.stageVelocityIntel?.stageAlerts.find(a => a.dealId === deal.id)
  const stalledWarning = stageAlert
    ? `⚠ This deal is ${stageAlert.currentAgeDays - stageAlert.expectedMaxDays} days beyond your typical ${stageAlert.stage} stage duration — address velocity today`
    : null

  const nearestWin = mlPred?.similarWins?.[0]
  const similarWin = nearestWin ? `${nearestWin.company} (${nearestWin.similarity}% match)` : null

  return {
    dealName: deal.name,
    company: deal.company,
    stage: deal.stage,
    score: deal.conversionScore,
    pendingActions: deal.pendingTodos,
    risks: deal.risks,
    competitors,
    competitorInsights,
    similarWin,
    winningPatterns,
    stalledWarning,
    decisionMakerSignal: signals?.decisionMakerSignal ?? false,
    budgetConfirmed: signals?.budgetConfirmed ?? false,
  }
}

// ─── Narration prompt builders ────────────────────────────────────────────────
// These produce minimal, tightly scoped LLM prompts.
// Claude receives pre-determined facts — it writes sentences, not analysis.

export function scoreNarrationPrompt(briefing: DealBriefing): string {
  const mlLine = briefing.mlWinProbability != null && briefing.mlTrainingDeals >= 6
    ? `Statistical model (trained on ${briefing.mlTrainingDeals} closed deals in this workspace): ${briefing.mlWinProbability}% win probability.`
    : `No statistical model yet (need 6+ closed deals).`

  const positivesLine = briefing.topPositives.length
    ? `Positive signals detected: ${briefing.topPositives.join('; ')}.`
    : ''

  const risksLine = briefing.topRisks.length
    ? `Risk signals: ${briefing.topRisks.join('; ')}.`
    : ''

  const stalledLine = briefing.stalledDays
    ? `Deal is stalled — ${briefing.stalledDays} days past expected stage duration.`
    : ''

  const similarLine = briefing.similarWin
    ? `Most similar past win: ${briefing.similarWin}.`
    : ''

  const competitorLine = briefing.competitorInsight
    ? `Competitive context: ${briefing.competitorInsight}.`
    : ''

  const momentumLine = briefing.isDeteriorating
    ? `⚠ Deal signals deteriorating — recent notes more negative than early notes.`
    : briefing.momentumDirection === 'building'
      ? `Deal momentum building — recent notes more positive than earlier.`
      : ''

  const closeDateLine = briefing.predictedCloseDays != null
    ? `Predicted close: ~${briefing.predictedCloseDays} days from now (based on similar historical deals).`
    : ''

  const stakeholderLine = briefing.stakeholderDepth != null && briefing.stakeholderDepth < 0.34
    ? `Limited stakeholder coverage detected — only one functional area engaged so far.`
    : briefing.stakeholderDepth != null && briefing.stakeholderDepth > 0.5
      ? `Multi-function stakeholder engagement confirmed.`
      : ''

  return `You are a sales intelligence narrator. The scoring engine has determined the following facts about "${briefing.dealName}" (${briefing.company}):

Score: ${briefing.score}/100 (${briefing.scoreBasis === 'ml_composite' ? 'ML composite' : 'signal heuristic'}).
${mlLine}
${positivesLine}
${risksLine}
${stalledLine}
${similarLine}
${competitorLine}
${momentumLine}
${closeDateLine}
${stakeholderLine}
Primary recommendation: ${briefing.recommendation}

GROUNDING RULES — read carefully before writing:
1. Cite ONLY the signals listed above. Do not invent claims, infer motives, or reference information not explicitly provided.
2. Lead with the single highest-impact signal in this priority order: ML win probability > stall warning > top risk > top positive signal.
3. Every sentence must be traceable to a specific listed signal or fact. If a signal is absent, do not mention its category.
4. Never say "AI", "model", "algorithm", or "scoring engine". Use "your pipeline" or "this deal".
5. NEVER mention the numeric score (e.g. "82/100" or "rates at 82"). The score is shown separately in the UI — mentioning it in prose creates confusing duplicate displays. Focus on the qualitative signals instead.

OUTPUT FORMAT — return exactly 3 bullet lines (each starting with "- "):
- Line 1: analytical observation about the deal's current state (pattern, risk, or signal — what the data shows)
- Line 2: a second analytical observation (different angle — momentum, competitive position, stakeholder coverage, or timeline)
- Line 3: ONE specific, concrete next action for this week (what to do — grounded in the recommendation above)

CRITICAL: Lines 1-2 (insights) and Line 3 (action) MUST contain different text.
- Lines 1-2: analytical observations about the deal's state (patterns, risks, signals)
- Line 3: ONE sentence describing the single most important action this week
If you find yourself writing similar text for both, make lines 1-2 more analytical and line 3 more actionable.`
}

export function overviewNarrationPrompt(briefing: OverviewBriefing, dateStr: string): string {
  const lines = [
    `Pipeline as of ${dateStr}:`,
    `${briefing.totalActive} active deals, £${briefing.totalValue.toLocaleString()} total value.`,
    briefing.avgScore != null ? `Average deal score: ${briefing.avgScore}/100.` : '',
    briefing.winRate != null ? `Historical win rate: ${briefing.winRate}% ${briefing.winRateTrend ? `(${briefing.winRateTrend})` : ''}.` : '',
    briefing.pipelineHealth ? `Pipeline health: ${briefing.pipelineHealth}.` : '',
    briefing.topUrgencies.length ? `Urgent: ${briefing.topUrgencies.join(' | ')}.` : '',
    briefing.topStale.length ? `Stale: ${briefing.topStale.join(' | ')}.` : '',
    briefing.deterioratingDeals.length ? `Deteriorating: ${briefing.deterioratingDeals.join(' | ')}.` : '',
    briefing.topRisks.length ? `Recurring risks: ${briefing.topRisks.join('; ')}.` : '',
    briefing.forecast != null ? `Probability-weighted forecast: £${Math.round(briefing.forecast).toLocaleString()}.` : '',
    briefing.nextMonthForecast ? `Next month ML revenue forecast: ${briefing.nextMonthForecast}.` : '',
    briefing.topRecommendations.length ? `Top actions: ${briefing.topRecommendations.join(' | ')}.` : '',
  ].filter(Boolean).join('\n')

  return `You are a sales pipeline analyst. Here are the pre-computed facts about this workspace's pipeline today:

${lines}

Write:
1. summary: 2 sentences on pipeline health and momentum.
2. keyActions: exactly 3 specific, concrete actions for today (based only on the facts above).
3. pipelineHealth: one phrase (e.g. "Strong — 2 deals near close").
4. topRisk: the single most important risk, or null.
5. momentum: one positive signal, or null.

Return ONLY this JSON (no markdown):
{"summary":"...","keyActions":["...","...","..."],"pipelineHealth":"...","topRisk":"...","momentum":"..."}`
}

export function meetingPrepNarrationPrompt(
  briefing: MeetingPrepBriefing,
  companyContext: { products?: string[]; valueProps?: string[]; differentiators?: string[] },
): string {
  const lines = [
    `Deal: ${briefing.dealName} with ${briefing.company} (stage: ${briefing.stage}, score: ${briefing.score ?? 'unscored'}).`,
    briefing.pendingActions.length ? `Open actions: ${briefing.pendingActions.join('; ')}.` : '',
    briefing.risks.length ? `Known risks: ${briefing.risks.join('; ')}.` : '',
    briefing.competitors.length ? `Competitors in play: ${briefing.competitors.join(', ')}.` : '',
    briefing.competitorInsights.length ? `Competitive intel: ${briefing.competitorInsights.join(' | ')}.` : '',
    briefing.similarWin ? `Most similar past win: ${briefing.similarWin}.` : '',
    briefing.winningPatterns.length ? `Winning patterns in this workspace: ${briefing.winningPatterns.join('; ')}.` : '',
    briefing.stalledWarning ?? '',
    briefing.decisionMakerSignal ? 'Decision-maker is engaged.' : 'No decision-maker detected in notes — surface this.',
    briefing.budgetConfirmed ? 'Budget confirmed.' : 'Budget not confirmed — qualify today.',
    companyContext.differentiators?.length ? `Key differentiators: ${companyContext.differentiators.slice(0, 3).join('; ')}.` : '',
  ].filter(Boolean).join('\n')

  return `You are a meeting preparation assistant. Use ONLY the pre-computed facts below — do not add generic advice.

${lines}

Write a focused meeting prep brief with these exact sections (plain text, not JSON):
OBJECTIVE: (1 sentence)
KEY POINTS: (3 bullets — use the facts above)
OBJECTIONS TO PREPARE FOR: (2 bullets from the risk signals)
QUESTIONS TO ASK: (2 bullets addressing gaps in the facts)
NEXT STEP: (1 sentence, concrete)

Keep each bullet under 20 words.`
}
