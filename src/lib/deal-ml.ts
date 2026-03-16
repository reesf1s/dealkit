/**
 * DealKit ML Engine
 *
 * Trains a logistic regression model on each workspace's closed deal history
 * to predict win probability for open deals from real features — not templates.
 *
 * The trained model weights are stored in the workspace brain and accumulate
 * with every deal closed. They encode institutional knowledge unique to each
 * workspace's sales motion, customers, and competitive landscape.
 *
 * Model cannot be replicated by copying the codebase — only by replicating
 * the closed deal history.
 *
 * Components
 * ──────────
 * 1. Feature extraction  — 7 normalised signals per deal
 * 2. Logistic regression — gradient descent with L2 regularisation
 * 3. Leave-one-out CV    — measures whether the model predicts correctly
 * 4. K-nearest neighbours — "deals most similar to this one"
 * 5. Trend detection     — OLS regression on monthly cohorts for win rate,
 *                          deal velocity, and per-competitor threat changes
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const ML_FEATURE_NAMES = [
  'stage_progress',       // deal funnel position (0 = prospecting → 1 = negotiation)
  'deal_value',           // size relative to workspace history (log-scaled)
  'pipeline_age',         // days in pipeline / 180  (older = more stale)
  'has_risks',            // flagged risks present (binary 0/1)
  'competitor_win_rate',  // historical win rate against competitors on this deal
  'todo_engagement',      // fraction of todos completed (activity proxy)
  'ai_confidence',        // LLM conversion score / 100
] as const

const STAGE_ORDINAL: Record<string, number> = {
  prospecting: 0, qualification: 1, discovery: 2,
  proposal: 3, negotiation: 4, closed_won: 4, closed_lost: 4,
}

export const ML_MIN_TRAINING_DEALS = 6

// ─── Input / Output Types ─────────────────────────────────────────────────────

export interface DealMLInput {
  id: string
  company: string
  stage: string
  dealValue: number | null
  conversionScore: number | null
  dealRisks: string[]
  dealCompetitors: string[]
  todos: { done: boolean }[]
  createdAt: Date | string | null
  updatedAt: Date | string | null
  wonDate?: Date | string | null
  lostDate?: Date | string | null
}

export interface TrainedMLModel {
  weights: number[]
  bias: number
  featureNames: readonly string[]
  trainingSize: number
  looAccuracy: number           // leave-one-out CV accuracy [0–1]
  lastTrained: string           // ISO timestamp
  avgDealValue: number          // workspace context used for normalisation
  maxDealValue: number
  featureImportance: {
    name: string
    importance: number          // |weight| — magnitude of influence
    direction: 'helps' | 'hurts'  // positive or negative correlation with win
  }[]
}

export interface DealMLPrediction {
  dealId: string
  winProbability: number                        // 0–1
  confidence: 'high' | 'medium' | 'low'        // proximity to training data
  nearestWin:  { dealId: string; company: string } | null
  nearestLoss: { dealId: string; company: string } | null
  riskFlags: string[]
}

export interface MLTrends {
  winRate: {
    direction: 'improving' | 'declining' | 'stable'
    slopePctPerMonth: number    // positive = improving
    recentPct: number           // recent half-window average
    priorPct: number            // earlier half-window average
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

/** Ordinary-least-squares slope of y on x */
function olsSlope(pts: [number, number][]): number {
  const n = pts.length
  if (n < 2) return 0
  const mx = pts.reduce((s, [x]) => s + x, 0) / n
  const my = pts.reduce((s, [, y]) => s + y, 0) / n
  const num = pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0)
  const den = pts.reduce((s, [x]) => s + (x - mx) ** 2, 0)
  return den === 0 ? 0 : num / den
}

// ─── Feature extraction ───────────────────────────────────────────────────────

function extractFeatures(
  deal: DealMLInput,
  competitorWinRates: Map<string, number>,
  avgDealValue: number,
  maxDealValue: number,
  now: Date,
): number[] {
  // f0: stage progression [0, 1]
  const f_stage = (STAGE_ORDINAL[deal.stage] ?? 0) / 4

  // f1: deal value — log-normalised by workspace max [0, 1]
  const val = Math.max(deal.dealValue ?? avgDealValue, 1)
  const f_value = maxDealValue > 1
    ? Math.log(val + 1) / Math.log(maxDealValue + 1)
    : 0.5

  // f2: pipeline age in days, capped at 180 [0, 1]
  const createdMs = deal.createdAt ? new Date(deal.createdAt).getTime() : now.getTime()
  const f_age = Math.min((now.getTime() - createdMs) / 86_400_000 / 180, 1)

  // f3: active risks present [0 or 1]
  const f_risks = deal.dealRisks.length > 0 ? 1 : 0

  // f4: avg historical win rate against this deal's competitors [0, 1]
  const comps = deal.dealCompetitors.filter(Boolean)
  const f_comp = comps.length > 0
    ? comps.reduce((s, c) => s + (competitorWinRates.get(c.toLowerCase()) ?? 0.5), 0) / comps.length
    : 0.5  // no known competitors = neutral

  // f5: todo completion — engagement signal [0, 1]
  const todos = deal.todos ?? []
  const f_todo = todos.length > 0 ? todos.filter(t => t.done).length / todos.length : 0.5

  // f6: AI conversion score, normalised [0, 1]
  const f_ai = deal.conversionScore != null ? deal.conversionScore / 100 : 0.5

  return [f_stage, f_value, f_age, f_risks, f_comp, f_todo, f_ai]
}

// ─── Logistic regression training ─────────────────────────────────────────────

interface TrainOpts { lr: number; epochs: number; lambda: number }

function trainLR(
  examples: { features: number[]; label: number }[],
  opts: TrainOpts = { lr: 0.1, epochs: 800, lambda: 0.01 },
): { weights: number[]; bias: number } {
  const n = examples[0].features.length
  const w = new Array<number>(n).fill(0)
  let b = 0

  for (let epoch = 0; epoch < opts.epochs; epoch++) {
    const dw = new Array<number>(n).fill(0)
    let db = 0
    for (const { features, label } of examples) {
      const err = sigmoid(dot(w, features) + b) - label
      for (let i = 0; i < n; i++) dw[i] += err * features[i]
      db += err
    }
    const m = examples.length
    for (let i = 0; i < n; i++) {
      w[i] -= opts.lr * (dw[i] / m + 2 * opts.lambda * w[i])
    }
    b -= opts.lr * (db / m)
  }

  return { weights: w, bias: b }
}

/** Leave-one-out cross-validation accuracy */
function computeLOO(examples: { features: number[]; label: number }[]): number {
  if (examples.length < 4) return 0
  const loOpts: TrainOpts = { lr: 0.1, epochs: 300, lambda: 0.01 }
  let correct = 0
  for (let i = 0; i < examples.length; i++) {
    const trainSet = examples.filter((_, j) => j !== i)
    const { weights, bias } = trainLR(trainSet, loOpts)
    const p = sigmoid(dot(weights, examples[i].features) + bias)
    if ((p >= 0.5 ? 1 : 0) === examples[i].label) correct++
  }
  return correct / examples.length
}

// ─── Main engine export ───────────────────────────────────────────────────────

export function runMLEngine(allDeals: DealMLInput[], now = new Date()): MLEngineResult {
  const closedWon  = allDeals.filter(d => d.stage === 'closed_won')
  const closedLost = allDeals.filter(d => d.stage === 'closed_lost')
  const closed     = [...closedWon, ...closedLost]
  const open       = allDeals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  if (closed.length < ML_MIN_TRAINING_DEALS) {
    return { model: null, predictions: [], trends: null }
  }

  // ── Normalisation context ─────────────────────────────────────────────────
  const allVals = allDeals.map(d => d.dealValue ?? 0).filter(v => v > 0)
  const avgDealValue = allVals.length > 0
    ? allVals.reduce((a, b) => a + b, 0) / allVals.length
    : 50_000
  const maxDealValue = allVals.length > 0 ? Math.max(...allVals) : 100_000

  // ── Historical competitor win rates (context for features) ────────────────
  const compStats = new Map<string, { wins: number; total: number }>()
  for (const d of closed) {
    const won = d.stage === 'closed_won'
    for (const c of d.dealCompetitors.filter(Boolean)) {
      const k = c.toLowerCase()
      const s = compStats.get(k) ?? { wins: 0, total: 0 }
      s.total++
      if (won) s.wins++
      compStats.set(k, s)
    }
  }
  const competitorWinRates = new Map<string, number>(
    [...compStats.entries()].map(([k, s]) => [k, s.total > 0 ? s.wins / s.total : 0.5])
  )

  // ── Training examples ─────────────────────────────────────────────────────
  const training = closed.map(d => ({
    dealId:   d.id,
    company:  d.company,
    features: extractFeatures(d, competitorWinRates, avgDealValue, maxDealValue, now),
    label:    d.stage === 'closed_won' ? 1 : 0,
  }))

  // ── Train full model ──────────────────────────────────────────────────────
  const { weights, bias } = trainLR(training.map(e => ({ features: e.features, label: e.label })))

  // ── LOO accuracy (skip for > 50 deals — approximate with training accuracy)
  let loo: number
  if (closed.length <= 50) {
    loo = computeLOO(training.map(e => ({ features: e.features, label: e.label })))
  } else {
    const correct = training.filter(
      e => (sigmoid(dot(weights, e.features) + bias) >= 0.5 ? 1 : 0) === e.label
    ).length
    loo = correct / training.length
  }

  // ── Feature importance: |weight| = magnitude of influence ────────────────
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
  }

  // ── Predictions for open deals ────────────────────────────────────────────
  const k = Math.max(2, Math.min(5, Math.floor(closed.length / 4)))

  const predictions: DealMLPrediction[] = open.map(deal => {
    const feats   = extractFeatures(deal, competitorWinRates, avgDealValue, maxDealValue, now)
    const winProb = sigmoid(dot(weights, feats) + bias)

    // K-nearest closed deals
    const ranked = training
      .map(e => ({ ...e, dist: euclidean(feats, e.features) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, k)

    const nearestWinEntry  = ranked.find(e => e.label === 1) ?? null
    const nearestLossEntry = ranked.find(e => e.label === 0) ?? null

    const nearestWin  = nearestWinEntry
      ? { dealId: nearestWinEntry.dealId,  company: nearestWinEntry.company  }
      : null
    const nearestLoss = nearestLossEntry
      ? { dealId: nearestLossEntry.dealId, company: nearestLossEntry.company }
      : null

    // Confidence based on distance to nearest neighbour
    const minDist = ranked[0]?.dist ?? 1
    const confidence: 'high' | 'medium' | 'low' =
      minDist < 0.25 ? 'high' : minDist < 0.55 ? 'medium' : 'low'

    // Pattern-based risk flags derived from features
    const riskFlags: string[] = []
    if (feats[4] < 0.4 && deal.dealCompetitors.filter(Boolean).length > 0) {
      const topComp = deal.dealCompetitors.filter(Boolean)[0]
      riskFlags.push(`Below 40% win rate vs ${topComp} historically`)
    }
    if (feats[2] > 0.65) riskFlags.push('Deal aging in pipeline — similar deals stalled')
    if (feats[3] === 1)  riskFlags.push('Active risk flags on this deal')
    if (deal.conversionScore != null && feats[6] < 0.35) riskFlags.push('Low AI confidence score')

    return { dealId: deal.id, winProbability: winProb, confidence, nearestWin, nearestLoss, riskFlags }
  })

  // ── Trend detection (linear regression on monthly cohorts) ───────────────
  type MonthBucket = { wins: number; total: number; days: number[] }
  const monthMap = new Map<string, MonthBucket>()

  for (const d of closed) {
    const closeTs = d.stage === 'closed_won' ? d.wonDate : d.lostDate
    if (!closeTs) continue
    const dt  = new Date(closeTs)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    const entry: MonthBucket = monthMap.get(key) ?? { wins: 0, total: 0, days: [] }
    entry.total++
    if (d.stage === 'closed_won') entry.wins++
    if (d.createdAt) {
      const days = (dt.getTime() - new Date(d.createdAt).getTime()) / 86_400_000
      if (days >= 0) entry.days.push(days)
    }
    monthMap.set(key, entry)
  }

  const months = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b))
  let trends: MLTrends | null = null

  if (months.length >= 2) {
    // Win rate OLS slope
    const wrPts: [number, number][] = months.map(([, m], i) => [
      i, m.total > 0 ? m.wins / m.total : 0
    ])
    const wrSlope = olsSlope(wrPts)
    const mid     = Math.floor(wrPts.length / 2)
    const priorWR  = wrPts.slice(0, mid).reduce((s, [, y]) => s + y, 0) / (mid || 1)
    const recentWR = wrPts.slice(mid).reduce((s, [, y]) => s + y, 0) / ((wrPts.length - mid) || 1)

    // Deal velocity OLS slope (days to close)
    const velPts: [number, number][] = months
      .map(([, m], i): [number, number | null] =>
        m.days.length > 0
          ? [i, m.days.reduce((a, b) => a + b, 0) / m.days.length]
          : [i, null]
      )
      .filter((p): p is [number, number] => p[1] !== null)

    const velSlope = olsSlope(velPts)
    const midV     = Math.floor(velPts.length / 2)
    const priorVel  = velPts.slice(0, midV).reduce((s, [, y]) => s + y, 0) / (midV || 1)
    const recentVel = velPts.slice(midV).reduce((s, [, y]) => s + y, 0) / ((velPts.length - midV) || 1)

    // Per-competitor threat: recent 90d vs all-time
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
        direction: delta < -0.12 ? 'more_competitive'
          : delta > 0.12 ? 'less_competitive'
          : 'stable',
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

  return { model, predictions, trends }
}
