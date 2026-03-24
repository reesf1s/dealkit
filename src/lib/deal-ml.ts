/**
 * Halvex ML Engine — v2
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

import { FEATURE_NAMES as ML_FEATURE_NAMES_IMPORT } from './ml/features'
import { trainLogisticRegression, predictProbability, sigmoid } from './ml/logistic-regression'
import { kMeans as kMeansLib, type ClusterResult } from './ml/kmeans'
import { fitOLS } from './ml/ols'
import { extractTextSignals } from '@/lib/text-signals'
import type { GlobalPriorInput } from '@/lib/global-pool'
import { db } from '@/lib/db'
import { workspaceMlModels } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export const ML_FEATURE_NAMES = ML_FEATURE_NAMES_IMPORT

export const ML_MIN_TRAINING_DEALS = 4

// Stage ordinal — maps stage IDs/names to a 0–4 scale.
// Custom stages that don't match any key default to 2 (mid-pipeline),
// which is neutral rather than the previous 0 (misclassified as earliest stage).
const STAGE_ORDINAL: Record<string, number> = {
  // Standard names
  prospecting: 0, lead: 0,
  qualification: 1, qualified: 1,
  discovery: 2, 'disco phase': 2, disco_phase: 2,
  static: 1.5,
  'demo phase': 2.5, demo_phase: 2.5, demo: 2.5, demonstration: 2.5,
  proposal: 3, 'proposal sent': 3,
  negotiation: 3.5, 'verbal commit': 3.5, verbal_commit: 3.5, verbally_committed: 3.5,
  client: 4, onboarding: 4,
  closed_won: 4, 'closed won': 4,
  closed_lost: 4, 'closed lost': 4,
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
  repId?: string | null            // owning rep/user ID — used for rep_win_rate feature
  /** Pre-computed NLP features — if not provided, extracted from meetingNotes. */
  textEngagement?: number          // 0–1 composite NLP signal
  momentumScore?: number           // 0–1 recent vs early sentiment
  stakeholderDepth?: number        // 0–1 breadth of stakeholder engagement
  urgencyScore?: number            // 0–1 urgency language density
  championStrength?: number        // 0–1 internal champion/sponsor signal strength
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
  compositeScore: number | null                  // ML+text-signal composite (set during brain rebuild or analyze-notes)
  confidence: 'high' | 'medium' | 'low'
  nearestWin:  { dealId: string; company: string } | null
  nearestLoss: { dealId: string; company: string } | null
  similarWins:  { dealId: string; company: string; similarity: number }[]
  similarLosses: { dealId: string; company: string; similarity: number }[]
  churnRisk?: number                             // 0-100 probability deal goes silent (survival model)
  churnDaysOverdue?: number                      // days past the stage's safe follow-up window
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

// ─── Math helpers (local utilities not exported from ml/ library) ─────────────

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0)
}

function euclidean(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0))
}

function olsSlope(pts: [number, number][]): number {
  const result = fitOLS(pts.map(([x]) => x), pts.map(([, y]) => y))
  return result.slope
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const idx = q * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// ─── K-means: adapt library return type to deal-ml's internal shape ───────────

function kMeans(
  points: number[][],
  k: number,
  maxIter = 100,
): { centroids: number[][]; assignments: number[] } {
  if (points.length === 0 || k <= 0 || k > points.length) {
    return { centroids: [], assignments: new Array(points.length).fill(0) }
  }
  // Build id-tagged points for the library
  const tagged = points.map((features, i) => ({ id: String(i), features }))
  const clusters: ClusterResult[] = kMeansLib(tagged, k, maxIter)

  // Reconstruct flat assignments array from cluster memberIds
  const assignments = new Array<number>(points.length).fill(0)
  for (let c = 0; c < clusters.length; c++) {
    for (const id of clusters[c].memberIds) {
      assignments[Number(id)] = c
    }
  }
  const centroids = clusters.map(cl => cl.centroid)
  return { centroids, assignments }
}

// ─── Feature extraction ───────────────────────────────────────────────────────

function extractFeatures(
  deal: DealMLInput,
  competitorWinRates: Map<string, number>,
  repWinRates: Map<string, number>,
  avgDealValue: number,
  maxDealValue: number,
  now: Date,
): number[] {
  // Normalize stage name: try exact match first, then lowercase, then default to mid-pipeline
  const stageKey = deal.stage ?? ''
  const f_stage = (STAGE_ORDINAL[stageKey] ?? STAGE_ORDINAL[stageKey.toLowerCase()] ?? 2) / 4

  const val = Math.max(deal.dealValue ?? avgDealValue, 1)
  const f_value = maxDealValue > 1
    ? Math.log(val + 1) / Math.log(maxDealValue + 1)
    : 0.5

  const createdMs = deal.createdAt ? new Date(deal.createdAt).getTime() : now.getTime()
  const f_age = Math.min((now.getTime() - createdMs) / 86_400_000 / 180, 1)

  // risk_intensity: continuous (replaces binary has_risks)
  const f_risk = Math.min(deal.dealRisks.length / 5, 1)

  const comps = deal.dealCompetitors.filter(Boolean)
  // Use MIN win rate (not mean) — one strong competitor should drag the score down
  // e.g. [Oracle 20%, SAP 50%] → 0.20, not 0.35. Weak competitors don't offset strong ones.
  const f_comp = comps.length > 0
    ? Math.min(...comps.map(c => competitorWinRates.get(c.toLowerCase()) ?? 0.5))
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

  // rep_win_rate: owning rep's historical win rate; 0.5 = neutral/unknown
  const f_rep = deal.repId ? (repWinRates.get(deal.repId) ?? 0.5) : 0.5

  // champion_signal: strongest single predictor of B2B close — separate from general text_engagement
  const f_champion   = deal.championStrength ?? sig().championStrength

  // Order must match ML_FEATURE_NAMES exactly
  return [f_stage, f_value, f_age, f_risk, f_comp, f_todo, f_text, f_momentum, f_stakeholder, f_urgency, f_rep, f_champion]
}

// ─── Logistic regression — thin wrappers around ml/logistic-regression ────────

interface TrainOpts { lr: number; epochs: number; lambda: number }

function trainLR(
  examples: { features: number[]; label: number }[],
  opts: TrainOpts = { lr: 0.1, epochs: 800, lambda: 0.01 },
): { weights: number[]; bias: number } {
  if (examples.length === 0) return { weights: new Array(ML_FEATURE_NAMES.length).fill(0), bias: 0 }
  const X = examples.map(e => e.features)
  const y = examples.map(e => e.label)
  const model = trainLogisticRegression(X, y, {
    learningRate: opts.lr,
    iterations: opts.epochs,
    l2Lambda: opts.lambda,
  })
  return { weights: model.weights, bias: model.bias }
}

function computeLOO(examples: { features: number[]; label: number }[]): number {
  if (examples.length < 4) return 0
  const X = examples.map(e => e.features)
  const y = examples.map(e => e.label)
  // Use reduced epochs for LOO (300 vs 800) — same as original
  const looOpts = { learningRate: 0.1, iterations: 300, l2Lambda: 0.01 }
  if (X.length < 4) return 0
  let correct = 0
  for (let i = 0; i < X.length; i++) {
    const trainX = [...X.slice(0, i), ...X.slice(i + 1)]
    const trainY = [...y.slice(0, i), ...y.slice(i + 1)]
    if (!trainY.includes(0) || !trainY.includes(1)) continue
    const model = trainLogisticRegression(trainX, trainY, looOpts)
    const prob = predictProbability(model, X[i])
    if ((prob >= 0.5 ? 1 : 0) === y[i]) correct++
  }
  return correct / X.length
}

/**
 * k-fold cross-validation — O(k × n) vs LOO's O(n²).
 * Used when n > 25; gives nearly identical accuracy estimates at ~1/30th the cost
 * for n=150.
 *
 * Shuffle is seeded by a simple deterministic permutation so results are
 * reproducible across rebuilds for the same dataset.
 */
function kFoldCrossValidate(
  examples: { features: number[]; label: number }[],
  k: number,
  seed: number,
): number {
  if (examples.length < k) return 0
  const cvOpts = { learningRate: 0.1, iterations: 300, l2Lambda: 0.01 }

  // Seeded Fisher-Yates shuffle (LCG — good enough for fold assignment)
  let rng = seed >>> 0
  const next = () => { rng = (Math.imul(1664525, rng) + 1013904223) >>> 0; return rng / 0x100000000 }
  const indices = examples.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }
  const shuffled = indices.map(i => examples[i]!)

  let totalCorrect = 0
  let totalEvaluated = 0

  for (let fold = 0; fold < k; fold++) {
    const foldSize  = Math.floor(shuffled.length / k)
    const start     = fold * foldSize
    const end       = fold === k - 1 ? shuffled.length : start + foldSize

    const holdout = shuffled.slice(start, end)
    const trainSet = [...shuffled.slice(0, start), ...shuffled.slice(end)]

    const trainX = trainSet.map(e => e.features)
    const trainY = trainSet.map(e => e.label)
    if (!trainY.includes(0) || !trainY.includes(1)) continue

    const model = trainLogisticRegression(trainX, trainY, cvOpts)
    for (const ex of holdout) {
      const prob = predictProbability(model, ex.features)
      if ((prob >= 0.5 ? 1 : 0) === ex.label) totalCorrect++
      totalEvaluated++
    }
  }

  return totalEvaluated > 0 ? totalCorrect / totalEvaluated : 0
}

/**
 * Selects and runs cross-validation: k-fold (k=5) for n > 25, LOO otherwise.
 * LOO is O(n²); k-fold is O(k×n) — ~30× faster at n=150.
 */
function computeCVAccuracy(
  examples: { features: number[]; label: number }[],
  workspaceIdSeed: string,
): number {
  if (examples.length > 25) {
    // Hash workspace ID to a numeric seed for the shuffle
    let seed = 0
    for (let i = 0; i < workspaceIdSeed.length; i++) {
      seed = (Math.imul(31, seed) + workspaceIdSeed.charCodeAt(i)) >>> 0
    }
    return kFoldCrossValidate(examples, 5, seed)
  }
  return computeLOO(examples)
}

// ─── Archetype helpers ────────────────────────────────────────────────────────

function labelArchetype(c: number[]): string {
  if (c.length === 0) return 'Mixed pipeline'
  // Indices: 0=stage, 1=value, 2=age, 3=risk, 4=comp, 5=todo, 6=text, 7=momentum, 8=stakeholder, 9=urgency
  const [stage, value, age, risk,,, text, momentum, stakeholder] = c
  // At-risk: elevated risk flags OR aging pipeline with declining momentum — check first
  if ((risk ?? 0) > 0.6) return 'At-risk deals'
  if ((age ?? 0) > 0.65 && (momentum ?? 0) < 0.35) return 'Stalling pipeline'
  // Fast-close SMB: advanced stage, recently entered, lower value (quick movers)
  if ((stage ?? 0) > 0.55 && (age ?? 0) < 0.35 && (value ?? 0) < 0.55) return 'Fast-close SMB'
  // Large-deal enterprise: high value + advanced stage
  if ((value ?? 0) > 0.65 && (stage ?? 0) > 0.55) return 'Enterprise pipeline'
  // Long-cycle: aged in pipeline, not at risk
  if ((age ?? 0) > 0.6) return 'Long-cycle deals'
  // Champion-led: strong stakeholder depth + high note engagement
  if ((stakeholder ?? 0) > 0.6 && (text ?? 0) > 0.55) return 'Champion-led'
  // Multi-stakeholder with active momentum
  if ((stakeholder ?? 0) > 0.55 && (momentum ?? 0) > 0.6) return 'Multi-stakeholder'
  // High-momentum, broad engagement
  if ((momentum ?? 0) > 0.65) return 'High-momentum deals'
  // Early stage
  if ((stage ?? 0) < 0.3) return 'Early-stage prospects'
  // High value, mid-stage
  if ((value ?? 0) > 0.55) return 'High-value pipeline'
  return 'Mid-market pipeline'
}

function winningCharacteristic(c: number[]): string {
  if (c.length === 0) return 'Mixed characteristics'
  // Indices: 0=stage, 1=value, 2=age, 3=risk, 4=comp, 5=todo, 6=text, 7=momentum, 8=stakeholder, 9=urgency
  const [stage, value, age, risk,,, text, momentum, stakeholder] = c
  const traits: string[] = []

  // Stage
  if ((stage ?? 0) > 0.7) traits.push('late-stage deals')
  else if ((stage ?? 0) < 0.25) traits.push('early-stage pipeline')

  // Value
  if ((value ?? 0) > 0.7) traits.push('high deal value')
  else if ((value ?? 0) < 0.25) traits.push('smaller deal size')

  // Momentum
  if ((momentum ?? 0) > 0.65) traits.push('strong deal momentum')
  else if ((momentum ?? 0) < 0.3) traits.push('declining momentum')

  // Stakeholder depth
  if ((stakeholder ?? 0) > 0.65) traits.push('broad stakeholder coverage')
  else if ((stakeholder ?? 0) < 0.25) traits.push('single-contact engagement')

  // Note engagement
  if ((text ?? 0) > 0.65) traits.push('high engagement in notes')
  else if ((text ?? 0) < 0.3) traits.push('low engagement signals')

  // Risk
  if ((risk ?? 0) > 0.6) traits.push('elevated risk flags')
  else if ((risk ?? 0) < 0.15) traits.push('low-risk profile')

  // Age
  if ((age ?? 0) > 0.7) traits.push('long pipeline cycle')
  else if ((age ?? 0) < 0.2) traits.push('recently entered pipeline')

  if (traits.length === 0) return 'Mid-market characteristics'
  const desc = traits.slice(0, 2).join(', ')
  return desc.charAt(0).toUpperCase() + desc.slice(1)
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
  rep_win_rate:         { pos: 'Strong rep track record',        neg: 'Rep win rate below average' },
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
  rep_win_rate:         'Assigned to a high-performing rep',
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
  rep_win_rate:         'Rep with below-average close rate',
}

function computeCompetitivePatterns(
  closed: DealMLInput[],
  competitorWinRates: Map<string, number>,
  repWinRates: Map<string, number>,
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
      features: extractFeatures(d, competitorWinRates, repWinRates, avgDealValue, maxDealValue, now),
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
  repWinRates: Map<string, number>,
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
      sigmoid(dot(weights, extractFeatures(d, competitorWinRates, repWinRates, avgDealValue, maxDealValue, now)) + bias) * 100

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
  repWinRates: Map<string, number>,
  avgDealValue: number,
  maxDealValue: number,
  now: Date,
): CloseDateModel | null {
  const samples = wonDeals
    .filter(d => d.createdAt && d.wonDate)
    .map(d => ({
      features: extractFeatures(d, competitorWinRates, repWinRates, avgDealValue, maxDealValue, now),
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

export function runMLEngine(
  allDeals: DealMLInput[],
  now = new Date(),
  globalPrior?: GlobalPriorInput | null,
  cachedWeightsOverride?: CachedMLWeights | null,
  workspaceId?: string,
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
    if (globalPrior && globalPrior.weights.length >= ML_FEATURE_NAMES.length - 1 && open.length > 0) {
      const allVals = allDeals.map(d => d.dealValue ?? 0).filter(v => v > 0)
      const avgDV = allVals.length > 0 ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 50_000
      const maxDV = allVals.length > 0 ? Math.max(...allVals) : 100_000
      const compRates = new Map<string, number>()
      const repRates  = new Map<string, number>()
      // Pad global prior weights to match current feature count (handles old 10-feature priors)
      const paddedWeights = [...globalPrior.weights]
      while (paddedWeights.length < ML_FEATURE_NAMES.length) paddedWeights.push(0)
      const coldPredictions: DealMLPrediction[] = open.map(deal => {
        const feats = extractFeatures(deal, compRates, repRates, avgDV, maxDV, now)
        const winProb = sigmoid(dot(paddedWeights, feats) + globalPrior.bias)
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
          scoreDrivers: computeScoreDrivers(feats, paddedWeights),
        }
      })
      const coldModel: TrainedMLModel = {
        weights: paddedWeights,
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

  // ── Rep win rates with recency decay (feature 10: rep behaviour) ────────────
  // Exponential decay with 180-day half-life so a rep's old track record fades
  // as more recent deals accumulate. Raw counts are replaced by weighted sums.
  const HALF_LIFE_DAYS = 180
  function repDecayWeight(deal: DealMLInput): number {
    const closeTs = deal.stage === 'closed_won'
      ? (deal.wonDate  ? new Date(deal.wonDate).getTime()  : null)
      : (deal.lostDate ? new Date(deal.lostDate).getTime() : null)
    if (!closeTs) return 1  // no close date — treat as fully weighted
    const daysSince = (now.getTime() - closeTs) / (1000 * 60 * 60 * 24)
    return Math.pow(0.5, daysSince / HALF_LIFE_DAYS)
  }

  const repDecayStats = new Map<string, { weightedWins: number; weightedTotal: number }>()
  for (const d of closed) {
    if (!d.repId) continue
    const w = repDecayWeight(d)
    const s = repDecayStats.get(d.repId) ?? { weightedWins: 0, weightedTotal: 0 }
    s.weightedTotal += w
    if (d.stage === 'closed_won') s.weightedWins += w
    repDecayStats.set(d.repId, s)
  }
  // Only use rep win rate if we have enough effective weight (≥ 3 unweighted deals equivalent)
  const repCounts = new Map<string, number>()
  for (const d of closed) {
    if (!d.repId) continue
    repCounts.set(d.repId, (repCounts.get(d.repId) ?? 0) + 1)
  }
  const repWinRates = new Map<string, number>(
    [...repDecayStats.entries()]
      .filter(([repId]) => (repCounts.get(repId) ?? 0) >= 3)
      .map(([k, s]) => [k, s.weightedTotal > 0 ? s.weightedWins / s.weightedTotal : 0.5])
  )

  // ── Feature extraction for all deals ─────────────────────────────────────
  const allFeats = allDeals.map(d => ({
    id: d.id,
    features: extractFeatures(d, competitorWinRates, repWinRates, avgDealValue, maxDealValue, now),
  }))
  const featMap = new Map<string, number[]>(allFeats.map(f => [f.id, f.features]))

  // ── Logistic regression — train on closed deals ───────────────────────────
  const training = closed.map(d => ({
    dealId:   d.id,
    company:  d.company,
    features: featMap.get(d.id) ?? extractFeatures(d, competitorWinRates, repWinRates, avgDealValue, maxDealValue, now),
    label:    d.stage === 'closed_won' ? 1 : 0,
  }))

  // ── Train or restore cached weights ──────────────────────────────────────
  let weights: number[]
  let bias: number
  let globalAlpha = 0
  let loo: number

  if (cachedWeightsOverride) {
    // Cache hit: skip training, Bayesian blend, and CV entirely
    weights = cachedWeightsOverride.weights
    bias    = cachedWeightsOverride.bias
    loo     = cachedWeightsOverride.looAccuracy
  } else {
    const { weights: rawWeights, bias: rawBias } = trainLR(training.map(e => ({ features: e.features, label: e.label })))

    // ── Bayesian blend with global prior (if available) ─────────────────────
    // α_global = 1 / (1 + localClosedDeals / 10) — fades to zero as local data grows
    // Global prior may have 10 features (before rep_win_rate was added); pad with 0 if needed.
    weights = rawWeights
    bias    = rawBias
    if (globalPrior && globalPrior.weights.length >= ML_FEATURE_NAMES.length - 1) {
      const paddedGlobalWeights = [...globalPrior.weights]
      while (paddedGlobalWeights.length < ML_FEATURE_NAMES.length) paddedGlobalWeights.push(0)
      globalAlpha  = 1 / (1 + closed.length / 10)
      const localAlpha = 1 - globalAlpha
      weights = paddedGlobalWeights.map((gw, i) => globalAlpha * gw + localAlpha * (rawWeights[i] ?? 0))
      bias    = globalAlpha * globalPrior.bias + localAlpha * rawBias
    }

    // ── CV accuracy: k-fold (n>25) or LOO (n≤25) ─────────────────────────────
    loo = computeCVAccuracy(
      training.map(e => ({ features: e.features, label: e.label })),
      workspaceId ?? 'default',
    )
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

  const rawArchetypes: DealArchetype[] = Array.from({ length: k }, (_, ci) => {
    const members = allDeals.filter((_, j) => assignments[j] === ci)
    const won  = members.filter(d => d.stage === 'closed_won')
    const lost = members.filter(d => d.stage === 'closed_lost')
    const openM = members.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    const total = won.length + lost.length
    const withVal = members.filter(d => (d.dealValue ?? 0) > 0)
    return {
      id: ci,
      label: labelArchetype(centroids[ci] ?? []),
      winRate: total > 0 ? Math.round((won.length / total) * 100) : -1,  // -1 = no closed deals in cluster
      dealCount: members.length,
      avgDealValue: withVal.length > 0
        ? Math.round(withVal.reduce((s, d) => s + (d.dealValue ?? 0), 0) / withVal.length)
        : 0,
      openDealIds: openM.map(d => d.id),
      centroidFeatures: centroids[ci] ?? [],
      winningCharacteristic: winningCharacteristic(centroids[ci] ?? []),
    }
  }).sort((a, b) => b.dealCount - a.dealCount)

  // ── Post-process archetypes: filter no-history clusters, deduplicate labels ──
  // 1. Filter out clusters with no closed deal history — win rate is meaningless (was 0%)
  //    Exception: if ALL clusters lack history, keep them all (early-stage workspace)
  const hasHistory = rawArchetypes.filter(a => a.winRate >= 0)
  const archetypesBeforeDedup = hasHistory.length > 0 ? hasHistory : rawArchetypes.map(a => ({ ...a, winRate: 0 }))

  // 2. Deduplicate labels — if two clusters share a label, differentiate the second
  //    by using the deal value signal (large vs SMB) from its centroid
  const usedLabels = new Set<string>()
  const archetypes: DealArchetype[] = archetypesBeforeDedup.map(arch => {
    if (!usedLabels.has(arch.label)) {
      usedLabels.add(arch.label)
      return arch
    }
    const [, value] = arch.centroidFeatures
    const qualifier = (value ?? 0) > 0.5 ? 'Large' : (value ?? 0) < 0.25 ? 'SMB' : 'Mid-market'
    const newLabel = `${arch.label} · ${qualifier}`
    usedLabels.add(newLabel)
    return { ...arch, label: newLabel }
  })

  // ── Predictions for open deals ────────────────────────────────────────────
  const knn = Math.max(2, Math.min(5, Math.floor(closed.length / 4)))

  const predictions: DealMLPrediction[] = open.map((deal, oi) => {
    const feats   = featMap.get(deal.id) ?? extractFeatures(deal, competitorWinRates, repWinRates, avgDealValue, maxDealValue, now)
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
    closed, competitorWinRates, repWinRates, avgDealValue, maxDealValue, now
  )

  // ── Score calibration timeline ────────────────────────────────────────────
  const calibrationTimeline = computeCalibrationTimeline(
    closed, weights, bias, competitorWinRates, repWinRates, avgDealValue, maxDealValue, now
  )

  // ── Close date regression ────────────────────────────────────────────────
  const closeDateModel = trainCloseDateRegression(
    closedWon, competitorWinRates, repWinRates, avgDealValue, maxDealValue, now
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

// ─── Composite score computation — deterministic math only, no LLM ───────────

/**
 * Blends the text-signal heuristic score with the ML model's logistic regression
 * prediction. The LLM never touches this function — it only narrates the result.
 *
 * Weighting schedule:
 *   - mlWeight  = min(0.70, 0.14 × ln(max(trainingSize,1)))
 *     grows from 0% (0 deals) → ~32% (10 deals) → ~70% (148 deals)
 *   - momentumWeight = 5%  (always)
 *   - textWeight     = 1 - mlWeight - momentumWeight (remainder)
 *
 * When trainingSize < 10: falls back to pure text-signal + momentum blend.
 *
 * Returns: { composite, textScore, mlScore, mlWeight, textWeight, momentumComponent, divergence, insight }
 */
export function computeCompositeScore(
  textSignalScore: number,
  mlProbability: number,
  trainingSize: number,
  momentumScore?: number,  // 0–1 from text signals; converted to -10..+10 component internally
): {
  composite: number
  textScore: number
  mlScore: number
  mlWeight: number
  textWeight: number
  momentumComponent: number
  divergence: number
  insight: string | null
} {
  const mlScore = Math.round(mlProbability * 100)

  // Convert 0–1 momentum to a -10..+10 component, then map to 40–60 range
  const rawMomentum = momentumScore !== undefined ? momentumScore : 0.5
  const momentumNorm  = Math.max(-10, Math.min(10, (rawMomentum - 0.5) * 20))  // -10..+10
  const momentumComponent = 50 + momentumNorm  // 40..60

  let composite: number
  let mlWeight: number
  let textWeight: number

  if (trainingSize >= 10) {
    mlWeight       = Math.min(0.70, 0.14 * Math.log(Math.max(trainingSize, 1)))
    const momentumWeight = 0.05
    textWeight     = Math.max(0, 1.0 - mlWeight - momentumWeight)
    const raw      = textSignalScore * textWeight + mlScore * mlWeight + momentumComponent * momentumWeight
    composite      = Math.max(0, Math.min(100, Math.round(raw)))
  } else {
    // Cold start (< 10 closed deals): text signals drive the score
    mlWeight   = 0
    textWeight = 0.70
    const raw  = textSignalScore * 0.70 + 50 * 0.25 + momentumComponent * 0.05
    composite  = Math.max(0, Math.min(100, Math.round(raw)))
  }

  const divergence = Math.abs(mlScore - textSignalScore)

  let insight: string | null = null
  if (trainingSize >= 10 && divergence >= 20) {
    insight = mlScore > textSignalScore
      ? `ML model (trained on ${trainingSize} closed deals) predicts ${mlScore}% — higher than the signal score of ${textSignalScore}%. Similar deals in your history performed better than current signals suggest.`
      : `ML model (trained on ${trainingSize} closed deals) predicts ${mlScore}% — lower than the signal score of ${textSignalScore}%. Historical patterns show similar deals at this stage are harder to close than they appear.`
  }

  return { composite, textScore: textSignalScore, mlScore, mlWeight, textWeight, momentumComponent, divergence, insight }
}

/**
 * Score breakdown record — saved alongside conversionScore for auditability.
 * Shows exactly which components drove the score and what weights were used.
 */
export interface ScoreBreakdown {
  composite_score: number
  text_signal_score: number
  text_weight: number
  ml_score: number
  ml_weight: number
  momentum_component: number
  ml_active: boolean
  training_deals: number
  model_version: string
}

// ─── ML model cache — persists trained weights to workspace_ml_models ─────────

export interface CachedMLWeights {
  weights: number[]
  bias: number
  looAccuracy: number
}

/**
 * Computes a cheap staleness key from sorted closed-deal IDs.
 * If the key matches the DB row's closed_deals_hash, retraining is skipped.
 */
export function computeClosedDealHash(closedDealIds: string[]): string {
  return [...closedDealIds].sort().join(',')
}

/**
 * Loads the cached model weights for a workspace/modelType pair.
 * Returns null if no cache exists or the hash doesn't match.
 */
export async function loadCachedModel(
  workspaceId: string,
  modelType: string,
  closedDealsHash: string,
): Promise<CachedMLWeights | null> {
  try {
    const [row] = await db
      .select()
      .from(workspaceMlModels)
      .where(and(
        eq(workspaceMlModels.workspaceId, workspaceId),
        eq(workspaceMlModels.modelType, modelType),
      ))
      .limit(1)

    if (!row || row.closedDealsHash !== closedDealsHash) return null

    const stored = row.weights as { coefficients?: number[]; weights?: number[]; bias: number }
    const weights = stored.coefficients ?? stored.weights ?? []
    if (!Array.isArray(weights) || weights.length === 0) return null

    return {
      weights,
      bias: stored.bias ?? 0,
      looAccuracy: row.accuracy ? Number(row.accuracy) : 0,
    }
  } catch {
    // Cache miss — non-fatal, will retrain
    return null
  }
}

/**
 * Upserts trained model weights for a workspace into the cache table.
 */
export async function saveCachedModel(
  workspaceId: string,
  modelType: string,
  model: TrainedMLModel,
  closedDealsHash: string,
): Promise<void> {
  try {
    await db
      .insert(workspaceMlModels)
      .values({
        workspaceId,
        modelType,
        weights: { coefficients: model.weights, bias: model.bias, featureNames: [...model.featureNames] },
        trainingSize: model.trainingSize,
        accuracy: String(Math.round(model.looAccuracy * 10000) / 10000),
        lastTrainedAt: new Date(),
        closedDealsHash,
      })
      .onConflictDoUpdate({
        target: [workspaceMlModels.workspaceId, workspaceMlModels.modelType],
        set: {
          weights: { coefficients: model.weights, bias: model.bias, featureNames: [...model.featureNames] },
          trainingSize: model.trainingSize,
          accuracy: String(Math.round(model.looAccuracy * 10000) / 10000),
          lastTrainedAt: new Date(),
          closedDealsHash,
        },
      })
  } catch (err) {
    console.error('[ml-cache] saveCachedModel failed (non-fatal):', err)
  }
}
