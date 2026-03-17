/**
 * DealKit ML Engine — v2
 *
 * A multi-model machine learning pipeline trained exclusively on each
 * workspace's own closed deal history. Every model is unique to the
 * workspace; copying the codebase gives you nothing without the data.
 *
 * Models
 * ──────
 * 1. Logistic regression     — win probability per open deal (gradient descent, L2 reg)
 * 2. Leave-one-out CV        — honest accuracy estimate on your own data
 * 3. K-nearest neighbours    — "deals most similar to this one" (feature-space search)
 * 4. K-means clustering      — deal archetypes: groups your pipeline by natural segments
 * 5. Per-competitor mini-LR  — which features predict wins/losses vs each rival
 * 6. OLS trend regression    — win-rate, velocity, and competitive landscape over time
 * 7. Stage velocity intel    — quantile-based stall detection vs your own history
 * 8. Score calibration       — monthly tracking of ML discrimination vs actual outcomes
 *
 * The LLM (Claude) translates model outputs into plain-English advice.
 * It never overrides the model — it contextualises it.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const ML_FEATURE_NAMES = [
  'stage_progress',       // 0 = prospecting → 1 = negotiation
  'deal_value',           // log-normalised by workspace max
  'pipeline_age',         // days / 180, capped at 1
  'risk_intensity',       // continuous: dealRisks.length / 5, capped at 1 (replaces binary has_risks)
  'competitor_win_rate',  // historical win rate against this deal's rivals
  'todo_engagement',      // todos-completed / total
  'text_engagement',      // NLP composite from meeting notes (sentiment × recency × signals)
                          // Replaces ai_confidence — no circular LLM dependency.
  'momentum_score',       // recent vs early sentiment delta (0–1, 0.5=stable)
  'stakeholder_depth',    // breadth of stakeholder engagement (0–1, 6 categories)
  'urgency_score',        // urgency language density from NLP (0–1)
] as const

export const ML_MIN_TRAINING_DEALS = 4

const STAGE_ORDINAL: Record<string, number> = {
  prospecting: 0, qualification: 1, discovery: 2,
  proposal: 3,   negotiation: 4,   closed_won: 4, closed_lost: 4,
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface DealMLInput {
  id: string
  company: string
  stage: string
  dealValue: number | null
  dealRisks: string[]
  dealCompetitors: string[]
  todos: { done: boolean }[]
  createdAt: Date | string | null
  updatedAt: Date | string | null
  meetingNotes?: string | null     // used for NLP feature extraction
  wonDate?: Date | string | null
  lostDate?: Date | string | null
  /** Pre-computed NLP features — if not provided, extracted from meetingNotes. */
  textEngagement?: number          // 0–1 composite NLP signal
  momentumScore?: number           // 0–1 recent vs early sentiment
  stakeholderDepth?: number        // 0–1 breadth of stakeholder engagement
  urgencyScore?: number            // 0–1 urgency language density
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface TrainedMLModel {
  weights: number[]
  bias: number
  featureNames: readonly string[]
  trainingSize: number
  looAccuracy: number        // leave-one-out CV accuracy [0–1]
  lastTrained: string
  avgDealValue: number
  maxDealValue: number
  featureImportance: { name: string; importance: number; direction: 'helps' | 'hurts' }[]
  globalPriorAlpha?: number  // 0 = pure local, 1 = pure global prior (Bayesian blend weight)
  usingGlobalPrior?: boolean
}

export interface ScoreDriver {
  feature: string           // ML_FEATURE_NAMES key
  label: string             // human-readable label
  value: number             // normalised feature value [0–1]
  contribution: number      // weight × value (log-odds contribution; positive = helps win)
  direction: 'positive' | 'negative'
}

export interface DealMLPrediction {
  dealId: string
  winProbability: number                         // raw LR output [0–1]
  compositeScore: number | null                  // ML+LLM blend (set in analyze-notes)
  confidence: 'high' | 'medium' | 'low'
  nearestWin:  { dealId: string; company: string } | null
  nearestLoss: { dealId: string; company: string } | null
  similarWins:  { dealId: string; company: string; similarity: number }[]
  similarLosses: { dealId: string; company: string; similarity: number }[]
  archetypeId: number | null
  riskFlags: string[]
  predictedDaysToClose: number | null            // OLS regression prediction (null if no model)
  scoreDrivers: ScoreDriver[]                    // top factors pushing score up or down
}

export interface DealArchetype {
  id: number
  label: string
  winRate: number            // 0–100 from closed deals in this cluster
  dealCount: number
  avgDealValue: number
  openDealIds: string[]
  centroidFeatures: number[]
  winningCharacteristic: string
}

export interface StageVelocityIntel {
  medianDaysToClose: number
  p75DaysToClose: number
  stageAlerts: {
    dealId: string
    company: string
    currentAgeDays: number
    expectedMaxDays: number
    stage: string
    severity: 'warning' | 'critical'
  }[]
}

export interface CompetitivePattern {
  competitor: string
  totalDeals: number
  winRate: number           // 0–100
  topWinCondition: string
  topLossRisk: string
  miniAccuracy: number      // 0–1, accuracy of per-competitor mini-model
}

export interface ScoreCalibrationPoint {
  month: string             // "2025-03"
  n: number
  actualWinRate: number     // 0–100
  avgMlOnWins: number       // avg ML probability on actual winners [0–100]
  avgMlOnLoss: number       // avg ML probability on actual losers  [0–100]
  discrimination: number    // avgMlOnWins − avgMlOnLoss (positive = good)
}

export interface CloseDateModel {
  intercept: number          // regression intercept (normalised space)
  coefficients: number[]     // one coefficient per ML feature
  targetScale: number        // max training days — multiply normalised prediction by this
  trainingSize: number       // number of won deals used
  rmse: number               // root-mean-square error in days
  meanDaysToClose: number    // mean of training targets (for context)
  lastTrained: string
}

export interface MLTrends {
  winRate: {
    direction: 'improving' | 'declining' | 'stable'
    slopePctPerMonth: number
    recentPct: number
    priorPct: number
  }
  dealVelocity: {
    direction: 'faster' | 'slower' | 'stable'
    recentAvgDays: number
    priorAvgDays: number
  }
  competitorThreats: {
    name: string
    recentWinRatePct: number
    allTimeWinRatePct: number
    direction: 'more_competitive' | 'less_competitive' | 'stable'
  }[]
}

export interface MLEngineResult {
  model: TrainedMLModel | null
  predictions: DealMLPrediction[]
  trends: MLTrends | null
  archetypes: DealArchetype[]
  stageVelocity: StageVelocityIntel | null
  competitivePatterns: CompetitivePattern[]
  calibrationTimeline: ScoreCalibrationPoint[]
  closeDateModel: CloseDateModel | null
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))))
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0)
}

function euclidean(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0))
}

function olsSlope(pts: [number, number][]): number {
  const n = pts.length
  if (n < 2) return 0
  const mx = pts.reduce((s, [x]) => s + x, 0) / n
  const my = pts.reduce((s, [, y]) => s + y, 0) / n
  const num = pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0)
  const den = pts.reduce((s, [x]) => s + (x - mx) ** 2, 0)
  return den === 0 ? 0 : num / den
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const idx = q * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// ─── K-means clustering (deterministic maximin init) ─────────────────────────

function kMeans(
  points: number[][],
  k: number,
  maxIter = 100,
): { centroids: number[][]; assignments: number[] } {
  if (points.length === 0 || k <= 0 || k > points.length) {
    return { centroids: [], assignments: new Array(points.length).fill(0) }
  }
  const n = points[0]?.length ?? 0

  // Maximin init: spread centroids as far apart as possible (deterministic)
  const centroids: number[][] = [points[0].slice()]
  while (centroids.length < k) {
    let farthest = 0, farthestDist = -1
    for (let i = 0; i < points.length; i++) {
      const minDist = Math.min(...centroids.map(c => euclidean(points[i], c)))
      if (minDist > farthestDist) { farthestDist = minDist; farthest = i }
    }
    centroids.push(points[farthest].slice())
  }

  const assignments = new Array<number>(points.length).fill(0)

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false
    for (let i = 0; i < points.length; i++) {
      let nearest = 0, nearestDist = Infinity
      for (let j = 0; j < k; j++) {
        const d = euclidean(points[i], centroids[j])
        if (d < nearestDist) { nearestDist = d; nearest = j }
      }
      if (assignments[i] !== nearest) { assignments[i] = nearest; changed = true }
    }
    if (!changed) break
    for (let j = 0; j < k; j++) {
      const cluster = points.filter((_, i) => assignments[i] === j)
      if (cluster.length === 0) continue
      for (let d = 0; d < n; d++) {
        centroids[j][d] = cluster.reduce((s, p) => s + (p[d] ?? 0), 0) / cluster.length
      }
    }
  }

  return { centroids, assignments }
}

// ─── Feature extraction ───────────────────────────────────────────────────────

import { extractTextSignals } from '@/lib/text-signals'

function extractFeatures(
  deal: DealMLInput,
  competitorWinRates: Map<string, number>,
  avgDealValue: number,
  maxDealValue: number,
  now: Date,
): number[] {
  const f_stage = (STAGE_ORDINAL[deal.stage] ?? 0) / 4

  const val = Math.max(deal.dealValue ?? avgDealValue, 1)
  const f_value = maxDealValue > 1
    ? Math.log(val + 1) / Math.log(maxDealValue + 1)
    : 0.5

  const createdMs = deal.createdAt ? new Date(deal.createdAt).getTime() : now.getTime()
  const f_age = Math.min((now.getTime() - createdMs) / 86_400_000 / 180, 1)

  // risk_intensity: continuous (replaces binary has_risks)
  const f_risk = Math.min(deal.dealRisks.length / 5, 1)

  const comps = deal.dealCompetitors.filter(Boolean)
  const f_comp = comps.length > 0
    ? comps.reduce((s, c) => s + (competitorWinRates.get(c.toLowerCase()) ?? 0.5), 0) / comps.length
    : 0.5

  const todos = deal.todos ?? []
  const f_todo = todos.length > 0 ? todos.filter(t => t.done).length / todos.length : 0.5

  // NLP features — lazy-extract text signals if any are missing
  let _sig: ReturnType<typeof extractTextSignals> | null = null
  const sig = (): ReturnType<typeof extractTextSignals> => {
    if (!_sig) _sig = extractTextSignals(deal.meetingNotes, deal.createdAt ?? now, deal.updatedAt ?? now)
    return _sig
  }

  const f_text       = deal.textEngagement   ?? sig().textEngagement
  const f_momentum   = deal.momentumScore    ?? sig().momentumScore
  const f_stakeholder= deal.stakeholderDepth ?? sig().stakeholderDepth
  const f_urgency    = deal.urgencyScore     ?? sig().urgencyScore

  // Order must match ML_FEATURE_NAMES exactly
  return [f_stage, f_value, f_age, f_risk, f_comp, f_todo, f_text, f_momentum, f_stakeholder, f_urgency]
}

// ─── Logistic regression ──────────────────────────────────────────────────────

interface TrainOpts { lr: number; epochs: number; lambda: number }

function trainLR(
  examples: { features: number[]; label: number }[],
  opts: TrainOpts = { lr: 0.1, epochs: 800, lambda: 0.01 },
): { weights: number[]; bias: number } {
  if (examples.length === 0) return { weights: new Array(ML_FEATURE_NAMES.length).fill(0), bias: 0 }
  const n = examples[0].features.length
  const w = new Array<number>(n).fill(0)
  let b = 0

  for (let epoch = 0; epoch < opts.epochs; epoch++) {
    const dw = new Array<number>(n).fill(0)
    let db = 0
    for (const { features, label } of examples) {
      const err = sigmoid(dot(w, features) + b) - label
      for (let i = 0; i < n; i++) dw[i] += err * (features[i] ?? 0)
      db += err
    }
    const m = examples.length
    for (let i = 0; i < n; i++) w[i] -= opts.lr * (dw[i] / m + 2 * opts.lambda * w[i])
    b -= opts.lr * (db / m)
  }
  return { weights: w, bias: b }
}

function computeLOO(examples: { features: number[]; label: number }[]): number {
  if (examples.length < 4) return 0
  const opts: TrainOpts = { lr: 0.1, epochs: 300, lambda: 0.01 }
  let correct = 0
  for (let i = 0; i < examples.length; i++) {
    const trainSet = examples.filter((_, j) => j !== i)
    const { weights, bias } = trainLR(trainSet, opts)
    if ((sigmoid(dot(weights, examples[i].features) + bias) >= 0.5 ? 1 : 0) === examples[i].label)
      correct++
  }
  return correct / examples.length
}

// ─── Archetype helpers ────────────────────────────────────────────────────────

function labelArchetype(c: number[]): string {
  if (c.length === 0) return 'Mixed pipeline'
  // Indices: 0=stage, 1=value, 2=age, 3=risk, 4=comp, 5=todo, 6=text, 7=momentum, 8=stakeholder, 9=urgency
  const [stage, value, age, risk,,, text, momentum, stakeholder] = c
  if ((age ?? 0) > 0.6 || (risk ?? 0) > 0.6) return 'At-risk deals'
  if ((value ?? 0) > 0.65 && (stage ?? 0) > 0.55) return 'Enterprise opportunities'
  if ((stage ?? 0) > 0.65 && (text ?? 0) > 0.6) return 'High-confidence closes'
  if ((momentum ?? 0) > 0.65 && (stakeholder ?? 0) > 0.5) return 'High-momentum deals'
  if ((stage ?? 0) < 0.3 && (value ?? 0) < 0.4) return 'Early-stage leads'
  if ((value ?? 0) > 0.5) return 'High-value opportunities'
  return 'Mid-market pipeline'
}

function winningCharacteristic(c: number[]): string {
  if (c.length === 0) return 'Mixed characteristics'
  let maxDev = 0, topIdx = 0, topDir = 1
  for (let i = 0; i < c.length; i++) {
    const dev = Math.abs((c[i] ?? 0.5) - 0.5)
    if (dev > maxDev) { maxDev = dev; topIdx = i; topDir = (c[i] ?? 0.5) > 0.5 ? 1 : -1 }
  }
  // One label per feature (10 features)
  const pos = ['Advanced stage','High deal value','Long pipeline age','Multiple risk flags','Strong comp record','High action completion','Strong notes engagement','Building momentum','Broad stakeholder coverage','High urgency from prospect']
  const neg = ['Early stage','Smaller deal','Fresh entry','No risk flags','Weak comp record','Low action completion','Weak notes engagement','Declining momentum','Narrow stakeholder reach','Low urgency from prospect']
  return (topDir > 0 ? pos[topIdx] : neg[topIdx]) ?? 'Mixed'
}

// ─── Stage velocity intelligence ──────────────────────────────────────────────

function computeStageVelocityIntel(
  wonDeals: DealMLInput[],
  openDeals: DealMLInput[],
  now: Date,
): StageVelocityIntel {
  const days = wonDeals
    .filter(d => d.createdAt && d.wonDate)
    .map(d => (new Date(d.wonDate!).getTime() - new Date(d.createdAt!).getTime()) / 86_400_000)
    .filter(d => d >= 0)
    .sort((a, b) => a - b)

  const median = quantile(days, 0.5) || 60
  const p75    = quantile(days, 0.75) || 90

  const stageAlerts: StageVelocityIntel['stageAlerts'] = openDeals
    .filter(d => d.createdAt)
    .map(d => {
      const ageDays = (now.getTime() - new Date(d.createdAt!).getTime()) / 86_400_000
      return { deal: d, ageDays }
    })
    .filter(({ ageDays }) => ageDays > p75)
    .map(({ deal, ageDays }) => ({
      dealId: deal.id,
      company: deal.company,
      currentAgeDays: Math.round(ageDays),
      expectedMaxDays: Math.round(p75),
      stage: deal.stage,
      severity: (ageDays > p75 * 1.5 ? 'critical' : 'warning') as 'critical' | 'warning',
    }))

  return {
    medianDaysToClose: Math.round(median),
    p75DaysToClose: Math.round(p75),
    stageAlerts,
  }
}

// ─── Score driver labels (human-readable per-feature explanations) ────────────

const SCORE_DRIVER_LABELS: Record<string, { pos: string; neg: string }> = {
  stage_progress:       { pos: 'Advanced pipeline stage',        neg: 'Early pipeline stage' },
  deal_value:           { pos: 'High-value deal',                neg: 'Smaller deal value' },
  pipeline_age:         { pos: 'Pipeline maturity',              neg: 'Deal aging / stalling' },
  risk_intensity:       { pos: 'Few active risks',               neg: 'Multiple risk flags' },
  competitor_win_rate:  { pos: 'Strong competitive record',      neg: 'Weak vs this competitor' },
  todo_engagement:      { pos: 'High action completion',         neg: 'Low action completion' },
  text_engagement:      { pos: 'Positive engagement in notes',   neg: 'Weak / negative notes' },
  momentum_score:       { pos: 'Building deal momentum',         neg: 'Declining momentum' },
  stakeholder_depth:    { pos: 'Broad stakeholder coverage',     neg: 'Limited stakeholder reach' },
  urgency_score:        { pos: 'Prospect urgency expressed',     neg: 'No urgency from prospect' },
}

/** Compute per-deal score drivers: which features are pushing win probability up or down. */
function computeScoreDrivers(
  features: number[],
  weights: number[],
): ScoreDriver[] {
  return ML_FEATURE_NAMES
    .map((name, i) => {
      const value = features[i] ?? 0
      const weight = weights[i] ?? 0
      const contribution = weight * value
      const direction: ScoreDriver['direction'] = contribution >= 0 ? 'positive' : 'negative'
      const labels = SCORE_DRIVER_LABELS[name]
      const label = labels
        ? (contribution >= 0 ? labels.pos : labels.neg)
        : (name as string)
      return { feature: name as string, label, value, contribution, direction }
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 5)  // top 5 drivers by absolute contribution
}

// ─── Competitive pattern analysis ─────────────────────────────────────────────

const WIN_CONDITIONS: Record<string, string> = {
  stage_progress:       'Late-stage deals',
  deal_value:           'Smaller deal sizes',
  pipeline_age:         'Fresh pipeline entries',
  risk_intensity:       'Deals with few or no risk flags',
  competitor_win_rate:  'Strong competitive track record',
  todo_engagement:      'High rep engagement',
  text_engagement:      'Strong positive engagement in notes',
  momentum_score:       'Deal momentum building over time',
  stakeholder_depth:    'Broad multi-function stakeholder engagement',
  urgency_score:        'Strong urgency expressed by prospect',
}
const LOSS_RISKS: Record<string, string> = {
  stage_progress:       'Early-stage deals',
  deal_value:           'Large deal values',
  pipeline_age:         'Aging or stalling deals',
  risk_intensity:       'Multiple active risk flags',
  competitor_win_rate:  'Weak competitive positioning',
  todo_engagement:      'Low rep engagement',
  text_engagement:      'Weak or negative engagement in notes',
  momentum_score:       'Declining deal momentum over time',
  stakeholder_depth:    'Limited stakeholder engagement',
  urgency_score:        'No urgency from prospect',
}

function computeCompetitivePatterns(
  closed: DealMLInput[],
  competitorWinRates: Map<string, number>,
  avgDealValue: number,
  maxDealValue: number,
  now: Date,
): CompetitivePattern[] {
  const byComp = new Map<string, DealMLInput[]>()
  for (const d of closed) {
    for (const c of d.dealCompetitors.filter(Boolean)) {
      const k = c.toLowerCase()
      const arr = byComp.get(k) ?? []
      arr.push(d)
      byComp.set(k, arr)
    }
  }

  const patterns: CompetitivePattern[] = []
  for (const [key, deals] of byComp) {
    if (deals.length < 3) continue
    const won = deals.filter(d => d.stage === 'closed_won')
    const winRate = Math.round((won.length / deals.length) * 100)

    const examples = deals.map(d => ({
      features: extractFeatures(d, competitorWinRates, avgDealValue, maxDealValue, now),
      label: d.stage === 'closed_won' ? 1 : 0,
    }))

    const { weights } = trainLR(examples, { lr: 0.1, epochs: 500, lambda: 0.05 })

    // Top helping feature (max positive weight)
    let topWinIdx = 0
    for (let i = 1; i < weights.length; i++)
      if ((weights[i] ?? 0) > (weights[topWinIdx] ?? 0)) topWinIdx = i

    // Top hurting feature (max negative weight)
    let topLossIdx = 0
    for (let i = 1; i < weights.length; i++)
      if ((weights[i] ?? 0) < (weights[topLossIdx] ?? 0)) topLossIdx = i

    const correct = examples.filter(
      e => (sigmoid(dot(weights, e.features) + 0) >= 0.5 ? 1 : 0) === e.label
    ).length

    patterns.push({
      competitor: key.charAt(0).toUpperCase() + key.slice(1),
      totalDeals: deals.length,
      winRate,
      topWinCondition:  WIN_CONDITIONS[ML_FEATURE_NAMES[topWinIdx]  ?? ''] ?? 'Favourable conditions',
      topLossRisk:      LOSS_RISKS[ML_FEATURE_NAMES[topLossIdx] ?? ''] ?? 'Unfavourable conditions',
      miniAccuracy: correct / examples.length,
    })
  }

  return patterns.sort((a, b) => b.totalDeals - a.totalDeals)
}

// ─── Score calibration timeline ───────────────────────────────────────────────

function computeCalibrationTimeline(
  closed: DealMLInput[],
  weights: number[],
  bias: number,
  competitorWinRates: Map<string, number>,
  avgDealValue: number,
  maxDealValue: number,
  now: Date,
): ScoreCalibrationPoint[] {
  const byMonth = new Map<string, DealMLInput[]>()
  for (const d of closed) {
    const ts = d.stage === 'closed_won' ? d.wonDate : d.lostDate
    if (!ts) continue
    const dt  = new Date(ts)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    const arr = byMonth.get(key) ?? []
    arr.push(d)
    byMonth.set(key, arr)
  }

  const timeline: ScoreCalibrationPoint[] = []
  for (const [month, deals] of [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const won  = deals.filter(d => d.stage === 'closed_won')
    const lost = deals.filter(d => d.stage === 'closed_lost')
    const pred = (d: DealMLInput) =>
      sigmoid(dot(weights, extractFeatures(d, competitorWinRates, avgDealValue, maxDealValue, now)) + bias) * 100

    const predsWon  = won.map(pred)
    const predsLost = lost.map(pred)
    const avgW = predsWon.length  > 0 ? predsWon.reduce((a, b) => a + b, 0)  / predsWon.length  : 0
    const avgL = predsLost.length > 0 ? predsLost.reduce((a, b) => a + b, 0) / predsLost.length : 0

    timeline.push({
      month,
      n: deals.length,
      actualWinRate: Math.round((won.length / deals.length) * 100),
      avgMlOnWins:   Math.round(avgW),
      avgMlOnLoss:   Math.round(avgL),
      discrimination: Math.round(avgW - avgL),
    })
  }

  return timeline
}

// ─── Close date regression (OLS via gradient descent) ─────────────────────────
// Predicts days-to-close for open deals using the same feature space as the LR model.
// Trained only on closed_won deals that have both createdAt and wonDate.

function trainCloseDateRegression(
  wonDeals: DealMLInput[],
  competitorWinRates: Map<string, number>,
  avgDealValue: number,
  maxDealValue: number,
  now: Date,
): CloseDateModel | null {
  const samples = wonDeals
    .filter(d => d.createdAt && d.wonDate)
    .map(d => ({
      features: extractFeatures(d, competitorWinRates, avgDealValue, maxDealValue, now),
      daysToClose: (new Date(d.wonDate!).getTime() - new Date(d.createdAt!).getTime()) / 86_400_000,
    }))
    .filter(s => s.daysToClose >= 0)

  if (samples.length < 4) return null

  const meanDays    = samples.reduce((s, e) => s + e.daysToClose, 0) / samples.length
  const maxDays     = Math.max(...samples.map(s => s.daysToClose), 1)
  const targetScale = maxDays

  // Normalise targets to [0,1] for stable gradient descent
  const normalised = samples.map(s => ({
    features: s.features,
    target:   s.daysToClose / targetScale,
  }))

  const n = normalised[0]?.features.length ?? ML_FEATURE_NAMES.length
  const w = new Array<number>(n).fill(0)
  let   b = 0.5   // init at midpoint
  const lambda = 0.01
  const lr     = 0.05

  for (let epoch = 0; epoch < 1200; epoch++) {
    const dw = new Array<number>(n).fill(0)
    let db = 0
    for (const { features, target } of normalised) {
      const err = dot(w, features) + b - target
      for (let i = 0; i < n; i++) dw[i] += err * (features[i] ?? 0)
      db += err
    }
    const m = normalised.length
    for (let i = 0; i < n; i++) w[i] -= lr * (dw[i] / m + 2 * lambda * w[i])
    b -= lr * (db / m)
  }

  // RMSE in days
  const mse = samples.reduce((s, { features, daysToClose }) => {
    const pred = (dot(w, features) + b) * targetScale
    return s + (pred - daysToClose) ** 2
  }, 0) / samples.length

  return {
    intercept:       b,
    coefficients:    w,
    targetScale,
    trainingSize:    samples.length,
    rmse:            Math.round(Math.sqrt(mse)),
    meanDaysToClose: Math.round(meanDays),
    lastTrained:     now.toISOString(),
  }
}

export function predictDaysToClose(model: CloseDateModel, features: number[]): number {
  const raw = (dot(model.coefficients, features) + model.intercept) * model.targetScale
  return Math.max(1, Math.round(raw))
}

// ─── Main engine ──────────────────────────────────────────────────────────────

import type { GlobalPriorInput } from '@/lib/global-pool'

export function runMLEngine(
  allDeals: DealMLInput[],
  now = new Date(),
  globalPrior?: GlobalPriorInput | null,
): MLEngineResult {
  const closedWon  = allDeals.filter(d => d.stage === 'closed_won')
  const closedLost = allDeals.filter(d => d.stage === 'closed_lost')
  const closed     = [...closedWon, ...closedLost]
  const open       = allDeals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  const empty: MLEngineResult = {
    model: null, predictions: [], trends: null,
    archetypes: [], stageVelocity: null,
    competitivePatterns: [], calibrationTimeline: [],
    closeDateModel: null,
  }
  if (closed.length < ML_MIN_TRAINING_DEALS) {
    // Cold start: if we have a global prior, use it to generate predictions for open deals
    if (globalPrior && globalPrior.weights.length === ML_FEATURE_NAMES.length && open.length > 0) {
      const allVals = allDeals.map(d => d.dealValue ?? 0).filter(v => v > 0)
      const avgDV = allVals.length > 0 ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 50_000
      const maxDV = allVals.length > 0 ? Math.max(...allVals) : 100_000
      const compRates = new Map<string, number>()
      const coldPredictions: DealMLPrediction[] = open.map(deal => {
        const feats = extractFeatures(deal, compRates, avgDV, maxDV, now)
        const winProb = sigmoid(dot(globalPrior.weights, feats) + globalPrior.bias)
        return {
          dealId: deal.id,
          winProbability: winProb,
          compositeScore: null,
          confidence: 'low' as const,
          nearestWin: null, nearestLoss: null,
          similarWins: [], similarLosses: [],
          archetypeId: null,
          riskFlags: [],
          predictedDaysToClose: globalPrior.stageVelocityP50 > 0
            ? Math.round(globalPrior.stageVelocityP50)
            : null,
          scoreDrivers: computeScoreDrivers(feats, globalPrior.weights),
        }
      })
      const coldModel: TrainedMLModel = {
        weights: globalPrior.weights,
        bias: globalPrior.bias,
        featureNames: ML_FEATURE_NAMES,
        trainingSize: 0,
        looAccuracy: 0,
        lastTrained: now.toISOString(),
        avgDealValue: avgDV, maxDealValue: maxDV,
        featureImportance: globalPrior.featureImportance,
        globalPriorAlpha: 1,
        usingGlobalPrior: true,
      }
      return { model: coldModel, predictions: coldPredictions, trends: null, archetypes: [], stageVelocity: null, competitivePatterns: [], calibrationTimeline: [], closeDateModel: null }
    }
    return empty
  }
  // Logistic regression needs at least one example of each class to be meaningful
  if (closedWon.length === 0 || closedLost.length === 0) return empty

  // ── Normalisation ─────────────────────────────────────────────────────────
  const allVals = allDeals.map(d => d.dealValue ?? 0).filter(v => v > 0)
  const avgDealValue = allVals.length > 0 ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 50_000
  const maxDealValue = allVals.length > 0 ? Math.max(...allVals) : 100_000

  // ── Competitor win rates ──────────────────────────────────────────────────
  const compStats = new Map<string, { wins: number; total: number }>()
  for (const d of closed) {
    const won = d.stage === 'closed_won'
    for (const c of d.dealCompetitors.filter(Boolean)) {
      const k = c.toLowerCase()
      const s = compStats.get(k) ?? { wins: 0, total: 0 }
      s.total++; if (won) s.wins++
      compStats.set(k, s)
    }
  }
  const competitorWinRates = new Map<string, number>(
    [...compStats.entries()].map(([k, s]) => [k, s.total > 0 ? s.wins / s.total : 0.5])
  )

  // ── Feature extraction for all deals ─────────────────────────────────────
  const allFeats = allDeals.map(d => ({
    id: d.id,
    features: extractFeatures(d, competitorWinRates, avgDealValue, maxDealValue, now),
  }))
  const featMap = new Map<string, number[]>(allFeats.map(f => [f.id, f.features]))

  // ── Logistic regression — train on closed deals ───────────────────────────
  const training = closed.map(d => ({
    dealId:   d.id,
    company:  d.company,
    features: featMap.get(d.id) ?? extractFeatures(d, competitorWinRates, avgDealValue, maxDealValue, now),
    label:    d.stage === 'closed_won' ? 1 : 0,
  }))

  const { weights: rawWeights, bias: rawBias } = trainLR(training.map(e => ({ features: e.features, label: e.label })))

  // ── Bayesian blend with global prior (if available) ───────────────────────
  // α_global = 1 / (1 + localClosedDeals / 10) — fades to zero as local data grows
  let weights = rawWeights
  let bias    = rawBias
  let globalAlpha = 0
  if (globalPrior && globalPrior.weights.length === ML_FEATURE_NAMES.length) {
    globalAlpha  = 1 / (1 + closed.length / 10)
    const localAlpha = 1 - globalAlpha
    weights = globalPrior.weights.map((gw, i) => globalAlpha * gw + localAlpha * (rawWeights[i] ?? 0))
    bias    = globalAlpha * globalPrior.bias + localAlpha * rawBias
  }

  // ── LOO accuracy ──────────────────────────────────────────────────────────
  let loo: number
  if (closed.length <= 50) {
    loo = computeLOO(training.map(e => ({ features: e.features, label: e.label })))
  } else {
    const correct = training.filter(
      e => (sigmoid(dot(weights, e.features) + bias) >= 0.5 ? 1 : 0) === e.label
    ).length
    loo = correct / training.length
  }

  const featureImportance = ML_FEATURE_NAMES.map((name, i) => ({
    name,
    importance: Math.abs(weights[i] ?? 0),
    direction: (weights[i] ?? 0) >= 0 ? 'helps' as const : 'hurts' as const,
  })).sort((a, b) => b.importance - a.importance)

  const model: TrainedMLModel = {
    weights, bias,
    featureNames: ML_FEATURE_NAMES,
    trainingSize: closed.length,
    looAccuracy: loo,
    lastTrained: now.toISOString(),
    avgDealValue, maxDealValue,
    featureImportance,
    globalPriorAlpha:  globalAlpha > 0 ? Math.round(globalAlpha * 100) / 100 : undefined,
    usingGlobalPrior:  globalAlpha > 0,
  }

  // ── K-means archetypes (k=2 small / k=3 larger) ───────────────────────────
  const k = Math.min(3, Math.max(2, Math.floor(allDeals.length / 4)))
  const { centroids, assignments } = kMeans(allFeats.map(f => f.features), k)

  const archetypes: DealArchetype[] = Array.from({ length: k }, (_, ci) => {
    const members = allDeals.filter((_, j) => assignments[j] === ci)
    const won  = members.filter(d => d.stage === 'closed_won')
    const lost = members.filter(d => d.stage === 'closed_lost')
    const openM = members.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    const total = won.length + lost.length
    const withVal = members.filter(d => (d.dealValue ?? 0) > 0)
    return {
      id: ci,
      label: labelArchetype(centroids[ci] ?? []),
      winRate: total > 0 ? Math.round((won.length / total) * 100) : 0,
      dealCount: members.length,
      avgDealValue: withVal.length > 0
        ? Math.round(withVal.reduce((s, d) => s + (d.dealValue ?? 0), 0) / withVal.length)
        : 0,
      openDealIds: openM.map(d => d.id),
      centroidFeatures: centroids[ci] ?? [],
      winningCharacteristic: winningCharacteristic(centroids[ci] ?? []),
    }
  }).sort((a, b) => b.dealCount - a.dealCount)

  // ── Predictions for open deals ────────────────────────────────────────────
  const knn = Math.max(2, Math.min(5, Math.floor(closed.length / 4)))

  const predictions: DealMLPrediction[] = open.map((deal, oi) => {
    const feats   = featMap.get(deal.id) ?? extractFeatures(deal, competitorWinRates, avgDealValue, maxDealValue, now)
    const winProb = sigmoid(dot(weights, feats) + bias)

    const ranked = training
      .map(e => ({ ...e, dist: euclidean(feats, e.features) }))
      .sort((a, b) => a.dist - b.dist)

    const topK = ranked.slice(0, knn)
    const nearestWinEntry  = topK.find(e => e.label === 1) ?? null
    const nearestLossEntry = topK.find(e => e.label === 0) ?? null

    const similarWins = ranked
      .filter(e => e.label === 1).slice(0, 3)
      .map(e => ({ dealId: e.dealId, company: e.company, similarity: Math.round((1 - Math.min(e.dist / 1.5, 1)) * 100) }))

    const similarLosses = ranked
      .filter(e => e.label === 0).slice(0, 3)
      .map(e => ({ dealId: e.dealId, company: e.company, similarity: Math.round((1 - Math.min(e.dist / 1.5, 1)) * 100) }))

    const minDist = topK[0]?.dist ?? 1
    const confidence: 'high' | 'medium' | 'low' =
      minDist < 0.25 ? 'high' : minDist < 0.55 ? 'medium' : 'low'

    const riskFlags: string[] = []
    if ((feats[4] ?? 0.5) < 0.4 && deal.dealCompetitors.filter(Boolean).length > 0)
      riskFlags.push(`Below 40% win rate vs ${deal.dealCompetitors.filter(Boolean)[0]} historically`)
    if ((feats[2] ?? 0) > 0.65) riskFlags.push('Deal aging in pipeline — similar deals stalled')
    if ((feats[3] ?? 0) > 0.4)  riskFlags.push('Multiple risk flags on this deal')
    if ((feats[6] ?? 0.5) < 0.35) riskFlags.push('Weak engagement signal in meeting notes')
    if ((feats[7] ?? 0.5) < 0.35) riskFlags.push('Deal momentum declining — notes turning negative')

    // Archetype: find which cluster this deal was assigned to
    const globalIdx = allDeals.findIndex(d => d.id === deal.id)
    const archetypeId: number | null = globalIdx >= 0 ? (assignments[globalIdx] ?? null) : null

    // Account for the open-deal index in allDeals
    void oi // used implicitly via globalIdx

    return {
      dealId: deal.id,
      winProbability: winProb,
      compositeScore: null,  // set later in analyze-notes when LLM score is available
      confidence,
      nearestWin:  nearestWinEntry  ? { dealId: nearestWinEntry.dealId,  company: nearestWinEntry.company  } : null,
      nearestLoss: nearestLossEntry ? { dealId: nearestLossEntry.dealId, company: nearestLossEntry.company } : null,
      similarWins,
      similarLosses,
      archetypeId,
      riskFlags,
      predictedDaysToClose: null,  // filled after closeDateModel is trained below
      scoreDrivers: computeScoreDrivers(feats, weights),
    }
  })

  // ── Stage velocity intelligence ───────────────────────────────────────────
  const stageVelocity = closedWon.length >= 3
    ? computeStageVelocityIntel(closedWon, open, now)
    : null

  // ── Competitive patterns ──────────────────────────────────────────────────
  const competitivePatterns = computeCompetitivePatterns(
    closed, competitorWinRates, avgDealValue, maxDealValue, now
  )

  // ── Score calibration timeline ────────────────────────────────────────────
  const calibrationTimeline = computeCalibrationTimeline(
    closed, weights, bias, competitorWinRates, avgDealValue, maxDealValue, now
  )

  // ── Close date regression ────────────────────────────────────────────────
  const closeDateModel = trainCloseDateRegression(
    closedWon, competitorWinRates, avgDealValue, maxDealValue, now
  )

  // Backfill predictedDaysToClose on open-deal predictions
  const predictionsWithDates = predictions.map(pred => {
    if (!closeDateModel) return pred
    const feats = featMap.get(pred.dealId) ?? []
    return { ...pred, predictedDaysToClose: predictDaysToClose(closeDateModel, feats) }
  })

  // ── Trend detection ───────────────────────────────────────────────────────
  type MonthBucket = { wins: number; total: number; days: number[] }
  const monthMap = new Map<string, MonthBucket>()
  for (const d of closed) {
    const ts = d.stage === 'closed_won' ? d.wonDate : d.lostDate
    if (!ts) continue
    const dt  = new Date(ts)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    const entry: MonthBucket = monthMap.get(key) ?? { wins: 0, total: 0, days: [] }
    entry.total++
    if (d.stage === 'closed_won') entry.wins++
    if (d.createdAt) {
      const daysVal = (dt.getTime() - new Date(d.createdAt).getTime()) / 86_400_000
      if (daysVal >= 0) entry.days.push(daysVal)
    }
    monthMap.set(key, entry)
  }

  const months = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b))
  let trends: MLTrends | null = null

  if (months.length >= 2) {
    const wrPts: [number, number][] = months.map(([, m], i) => [i, m.total > 0 ? m.wins / m.total : 0])
    const wrSlope = olsSlope(wrPts)
    const mid = Math.floor(wrPts.length / 2)
    const priorWR  = wrPts.slice(0, mid).reduce((s, [, y]) => s + y, 0) / (mid || 1)
    const recentWR = wrPts.slice(mid).reduce((s, [, y]) => s + y, 0) / ((wrPts.length - mid) || 1)

    const velPts: [number, number][] = months
      .map(([, m], i): [number, number | null] =>
        m.days.length > 0 ? [i, m.days.reduce((a, b) => a + b, 0) / m.days.length] : [i, null]
      )
      .filter((p): p is [number, number] => p[1] !== null)
    const velSlope  = olsSlope(velPts)
    const midV      = Math.floor(velPts.length / 2)
    const priorVel  = velPts.slice(0, midV).reduce((s, [, y]) => s + y, 0) / (midV || 1)
    const recentVel = velPts.slice(midV).reduce((s, [, y]) => s + y, 0) / ((velPts.length - midV) || 1)

    const cutoff      = new Date(now.getTime() - 90 * 86_400_000)
    const recentClosed = closed.filter(d => {
      const ts = d.stage === 'closed_won' ? d.wonDate : d.lostDate
      return ts && new Date(ts) >= cutoff
    })
    const compTrends: MLTrends['competitorThreats'] = []
    for (const [name, allRate] of competitorWinRates) {
      const withComp = recentClosed.filter(d =>
        d.dealCompetitors.map(c => c.toLowerCase()).includes(name)
      )
      if (withComp.length < 2) continue
      const recentRate = withComp.filter(d => d.stage === 'closed_won').length / withComp.length
      const delta = recentRate - allRate
      compTrends.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        recentWinRatePct:  Math.round(recentRate * 100),
        allTimeWinRatePct: Math.round(allRate    * 100),
        direction: delta < -0.12 ? 'more_competitive' : delta > 0.12 ? 'less_competitive' : 'stable',
      })
    }

    trends = {
      winRate: {
        direction: wrSlope > 0.04 ? 'improving' : wrSlope < -0.04 ? 'declining' : 'stable',
        slopePctPerMonth: Math.round(wrSlope * 100),
        recentPct: Math.round(recentWR * 100),
        priorPct:  Math.round(priorWR  * 100),
      },
      dealVelocity: {
        direction: velSlope < -2 ? 'faster' : velSlope > 2 ? 'slower' : 'stable',
        recentAvgDays: Math.round(recentVel),
        priorAvgDays:  Math.round(priorVel),
      },
      competitorThreats: compTrends,
    }
  }

  return { model, predictions: predictionsWithDates, trends, archetypes, stageVelocity, competitivePatterns, calibrationTimeline, closeDateModel }
}

// ─── Composite score computation (called from analyze-notes after LLM scores) ─

/**
 * Blends the LLM's qualitative score with the ML model's data-driven prediction.
 * Alpha (ML weight) scales from 0 → 0.7 as training data grows, ensuring the
 * model only overrides the LLM once it has enough evidence to be trusted.
 *
 * Returns: { composite, llmScore, mlScore, divergence, insight }
 */
export function computeCompositeScore(
  llmScore: number,
  mlProbability: number,
  trainingSize: number,
): {
  composite: number
  mlScore: number
  divergence: number
  insight: string | null
} {
  const mlScore   = Math.round(mlProbability * 100)
  // Scale ML weight more aggressively: 4 deals → 14%, 10 → 33%, 20 → 57%, 30+ → 70%
  // Previous formula (/ 100) gave only 10% weight at 10 deals — too conservative.
  const alpha     = Math.min(0.7, trainingSize / 30)
  const composite = Math.round(alpha * mlScore + (1 - alpha) * llmScore)
  const divergence = Math.abs(mlScore - llmScore)

  let insight: string | null = null
  if (trainingSize >= 10 && divergence >= 20) {
    insight = mlScore > llmScore
      ? `ML model (trained on ${trainingSize} closed deals) predicts ${mlScore}% — higher than the AI score of ${llmScore}%. Similar deals in your history performed better than current signals suggest.`
      : `ML model (trained on ${trainingSize} closed deals) predicts ${mlScore}% — lower than the AI score of ${llmScore}%. Historical patterns show similar deals at this stage are harder to close than they appear.`
  }

  return { composite, mlScore, divergence, insight }
}
