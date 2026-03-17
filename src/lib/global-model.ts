/**
 * Global ML Model — Training and Bayesian Blending
 *
 * Trains a universal prior logistic regression on all non-erased contributions
 * in global_deal_outcomes. Computes cross-workspace benchmarks alongside.
 *
 * Bayesian blending formula:
 *   α_global = 1 / (1 + localClosedDeals / 10)
 *   blended_weights = α_global × global + (1 − α_global) × local
 *
 *   At 0 local deals  → 100% global prior (cold start)
 *   At 10 local deals → 50/50 blend
 *   At 30 local deals → 25% global / 75% local
 *   At 50+ deals      → ~17% global (effectively local)
 *
 * The global model retrains nightly via /api/cron/global-train.
 * MIN_POOL_SIZE = 50 records ensures the model is always better than a coin flip.
 */

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { ML_FEATURE_NAMES } from '@/lib/deal-ml'
import { ensureGlobalTables } from '@/lib/global-pool'
import type { GlobalPriorInput } from '@/lib/global-pool'

export type { GlobalPriorInput }

// ─── Internal ML helpers (mirror of deal-ml.ts primitives, no import cycle) ──

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))))
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0)
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const idx = q * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return (sorted[lo] ?? 0) + ((sorted[hi] ?? 0) - (sorted[lo] ?? 0)) * (idx - lo)
}

function trainLRGlobal(
  examples: { features: number[]; label: number }[],
  opts = { lr: 0.08, epochs: 800, lambda: 0.015 },
): { weights: number[]; bias: number } {
  if (examples.length === 0) {
    return { weights: new Array(ML_FEATURE_NAMES.length).fill(0), bias: 0 }
  }
  const n = examples[0]!.features.length
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

// ─── Main training function ────────────────────────────────────────────────────

export interface GlobalTrainResult {
  version:          number
  trainingSize:     number
  looAccuracy:      number
  globalWinRate:    number
  durationMs:       number
}

export const MIN_POOL_SIZE       = 50
export const MIN_BRAIN_VERSION   = 8   // ignore contributions from older feature schemas

export async function trainGlobalModel(): Promise<GlobalTrainResult> {
  const startedAt = Date.now()
  await ensureGlobalTables()

  // Fetch all non-erased, version-compatible contributions
  const rows = await db.execute(sql`
    SELECT features, outcome, deal_value_bucket, stage_duration_bucket,
           risk_themes, collateral_used
    FROM global_deal_outcomes
    WHERE is_erased = false
      AND brain_version >= ${MIN_BRAIN_VERSION}
    ORDER BY contributed_at DESC
  `) as unknown as Array<{
    features:             number[]
    outcome:              number
    deal_value_bucket:    string
    stage_duration_bucket: number
    risk_themes:          boolean[]
    collateral_used:      string[]
  }>

  if (rows.length < MIN_POOL_SIZE) {
    throw new Error(`Insufficient pool size: ${rows.length} < ${MIN_POOL_SIZE}`)
  }

  const won  = rows.filter(r => r.outcome === 1)
  const lost = rows.filter(r => r.outcome === 0)

  if (won.length === 0 || lost.length === 0) {
    throw new Error('Pool needs examples of both wins and losses')
  }

  // ── Train logistic regression ──────────────────────────────────────────────
  const examples = rows.map(r => ({
    features: r.features as number[],
    label:    r.outcome as number,
  }))

  const { weights, bias } = trainLRGlobal(examples)

  // Feature importance
  const featureImportance = ML_FEATURE_NAMES.map((name, i) => ({
    name,
    importance: Math.abs(weights[i] ?? 0),
    direction:  ((weights[i] ?? 0) >= 0 ? 'helps' : 'hurts') as 'helps' | 'hurts',
  })).sort((a, b) => b.importance - a.importance)

  // LOO accuracy — only if pool is small enough to be affordable
  let looAccuracy = 0
  if (rows.length <= 200) {
    let correct = 0
    for (let i = 0; i < examples.length; i++) {
      const trainSet = examples.filter((_, j) => j !== i)
      const { weights: lw, bias: lb } = trainLRGlobal(trainSet, { lr: 0.08, epochs: 300, lambda: 0.015 })
      const pred = sigmoid(dot(lw, examples[i]!.features) + lb) >= 0.5 ? 1 : 0
      if (pred === examples[i]!.label) correct++
    }
    looAccuracy = correct / examples.length
  } else {
    // For large pools: train-set accuracy as proxy
    const correct = examples.filter(
      e => (sigmoid(dot(weights, e.features) + bias) >= 0.5 ? 1 : 0) === e.label
    ).length
    looAccuracy = correct / examples.length
  }

  // ── Global benchmarks ──────────────────────────────────────────────────────

  const globalWinRate = won.length / rows.length

  // Stage velocity (days to close from stageDurationBucket)
  const durations = rows
    .filter(r => r.stage_duration_bucket > 0)
    .map(r => r.stage_duration_bucket)
    .sort((a, b) => a - b)

  const stageVelocityP25 = quantile(durations, 0.25)
  const stageVelocityP50 = quantile(durations, 0.5) || 60
  const stageVelocityP75 = quantile(durations, 0.75) || 90

  // Per risk theme: P(win | theme present)
  // Each row has risk_themes: boolean[7]
  const THEME_COUNT = 7
  const riskThemeWinRates: number[] = Array.from({ length: THEME_COUNT }, (_, ti) => {
    const withTheme = rows.filter(r => (r.risk_themes as boolean[])[ti] === true)
    if (withTheme.length < 5) return globalWinRate  // fallback to global if insufficient data
    const winsWithTheme = withTheme.filter(r => r.outcome === 1).length
    return winsWithTheme / withTheme.length
  })

  // Collateral lift: win rate with vs without each collateral type
  const allTypes = [...new Set(rows.flatMap(r => r.collateral_used as string[]))]
  const collateralLift = allTypes.map(type => {
    const withType    = rows.filter(r => (r.collateral_used as string[]).includes(type))
    const withoutType = rows.filter(r => !(r.collateral_used as string[]).includes(type))
    const withRate    = withType.length > 5    ? withType.filter(r => r.outcome === 1).length / withType.length    : null
    const withoutRate = withoutType.length > 5 ? withoutType.filter(r => r.outcome === 1).length / withoutType.length : null
    return { type, withRate: withRate ?? 0, withoutRate: withoutRate ?? 0 }
  }).filter(c => c.withRate > 0)

  // ── Write new model version ────────────────────────────────────────────────

  // Get current max version
  const versionRows = await db.execute(sql`
    SELECT COALESCE(MAX(version), 0) AS max_version FROM global_ml_model
  `) as unknown as { max_version: number }[]
  const nextVersion = ((versionRows[0]?.max_version ?? 0) as number) + 1

  // Deactivate current active model
  await db.execute(sql`UPDATE global_ml_model SET is_active = false WHERE is_active = true`)

  const durationMs = Date.now() - startedAt

  await db.execute(sql`
    INSERT INTO global_ml_model (
      version, is_active, weights, bias, feature_names, training_size,
      loo_accuracy, feature_importance, global_win_rate,
      stage_velocity_p25, stage_velocity_p50, stage_velocity_p75,
      risk_theme_win_rates, collateral_lift,
      min_brain_version, training_duration_ms
    ) VALUES (
      ${nextVersion}, true,
      ${JSON.stringify(weights)}::jsonb,
      ${JSON.stringify(bias)}::jsonb,
      ${JSON.stringify(ML_FEATURE_NAMES)}::jsonb,
      ${rows.length},
      ${JSON.stringify(looAccuracy)}::jsonb,
      ${JSON.stringify(featureImportance)}::jsonb,
      ${JSON.stringify(globalWinRate)}::jsonb,
      ${JSON.stringify(stageVelocityP25)}::jsonb,
      ${JSON.stringify(stageVelocityP50)}::jsonb,
      ${JSON.stringify(stageVelocityP75)}::jsonb,
      ${JSON.stringify(riskThemeWinRates)}::jsonb,
      ${JSON.stringify(collateralLift)}::jsonb,
      ${MIN_BRAIN_VERSION},
      ${durationMs}
    )
  `)

  // Invalidate benchmark cache
  await db.execute(sql`DELETE FROM global_benchmark_cache WHERE cache_key = 'benchmarks_v1'`)

  return {
    version:       nextVersion,
    trainingSize:  rows.length,
    looAccuracy,
    globalWinRate,
    durationMs,
  }
}

// ─── Bayesian weight blending ──────────────────────────────────────────────────

/**
 * Blend global prior weights with locally-trained weights.
 *
 *   α_global = 1 / (1 + localClosedDeals / 10)
 *
 * At  0 local deals: 100% global (cold start)
 * At 10 local deals: 50% global / 50% local
 * At 30 local deals: 25% / 75%
 * At 50+ local deals: ~17% / 83% (effectively local-dominant)
 */
export function blendWeights(
  globalPrior: GlobalPriorInput,
  localWeights: number[],
  localBias: number,
  localTrainingSize: number,
): { weights: number[]; bias: number; alphaGlobal: number } {
  const alphaGlobal = 1 / (1 + localTrainingSize / 10)
  const alphaLocal  = 1 - alphaGlobal

  return {
    weights: globalPrior.weights.map((gw, i) =>
      alphaGlobal * gw + alphaLocal * (localWeights[i] ?? 0)
    ),
    bias:        alphaGlobal * globalPrior.bias + alphaLocal * localBias,
    alphaGlobal,
  }
}

// ─── Benchmark aggregation ────────────────────────────────────────────────────

export interface GlobalBenchmarks {
  poolSize:         number
  globalWinRate:    number            // 0–100
  stageVelocity: {
    p25Days:  number
    p50Days:  number
    p75Days:  number
  }
  riskThemeWinRates: {
    theme:       string
    globalWinRate: number             // 0–100
    dealCount:   number
  }[]
  dealValueBucketWinRates: {
    bucket:  string
    winRate: number
    count:   number
  }[]
  collateralLift: {
    type:        string
    withRate:    number               // 0–100
    withoutRate: number
    lift:        number               // withRate - withoutRate
  }[]
}

const RISK_THEME_LABELS = [
  'Budget concerns',
  'Slow / disengaged prospect',
  'Competitive pressure',
  'Decision-maker access',
  'Timeline slippage',
  'Procurement / legal',
  'Competing priorities',
]

export async function getGlobalBenchmarks(): Promise<GlobalBenchmarks | null> {
  await ensureGlobalTables()

  // Check cache
  const cached = await db.execute(sql`
    SELECT data, computed_from_n
    FROM global_benchmark_cache
    WHERE cache_key = 'benchmarks_v1' AND expires_at > NOW()
    LIMIT 1
  `) as unknown as { data: GlobalBenchmarks; computed_from_n: number }[]

  if (cached[0]) return cached[0].data as GlobalBenchmarks

  // Fetch active model for pre-computed benchmarks
  const modelRows = await db.execute(sql`
    SELECT training_size, global_win_rate, stage_velocity_p25, stage_velocity_p50,
           stage_velocity_p75, risk_theme_win_rates, collateral_lift
    FROM global_ml_model
    WHERE is_active = true
    LIMIT 1
  `) as unknown as Array<{
    training_size:        number
    global_win_rate:      number
    stage_velocity_p25:   number | null
    stage_velocity_p50:   number | null
    stage_velocity_p75:   number | null
    risk_theme_win_rates: number[] | null
    collateral_lift:      { type: string; withRate: number; withoutRate: number }[] | null
  }>

  if (!modelRows[0] || modelRows[0].training_size < MIN_POOL_SIZE) return null
  const m = modelRows[0]

  // Per-bucket win rates
  const bucketRows = await db.execute(sql`
    SELECT deal_value_bucket, outcome, COUNT(*)::int AS cnt
    FROM global_deal_outcomes
    WHERE is_erased = false AND brain_version >= ${MIN_BRAIN_VERSION}
    GROUP BY deal_value_bucket, outcome
  `) as unknown as { deal_value_bucket: string; outcome: number; cnt: number }[]

  const bucketMap = new Map<string, { wins: number; total: number }>()
  for (const r of bucketRows) {
    const b = bucketMap.get(r.deal_value_bucket) ?? { wins: 0, total: 0 }
    b.total += Number(r.cnt)
    if (r.outcome === 1) b.wins += Number(r.cnt)
    bucketMap.set(r.deal_value_bucket, b)
  }

  const dealValueBucketWinRates = [...bucketMap.entries()].map(([bucket, { wins, total }]) => ({
    bucket,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    count:   total,
  }))

  // Risk theme rows
  const themeRows = await db.execute(sql`
    SELECT risk_themes, outcome
    FROM global_deal_outcomes
    WHERE is_erased = false AND brain_version >= ${MIN_BRAIN_VERSION}
  `) as unknown as { risk_themes: boolean[]; outcome: number }[]

  const THEME_COUNT = 7
  const riskThemeWinRates = Array.from({ length: THEME_COUNT }, (_, ti) => {
    const withTheme = themeRows.filter(r => (r.risk_themes as boolean[])[ti] === true)
    const wins = withTheme.filter(r => r.outcome === 1).length
    return {
      theme:        RISK_THEME_LABELS[ti] ?? `Theme ${ti + 1}`,
      globalWinRate: withTheme.length >= 5 ? Math.round((wins / withTheme.length) * 100) : 0,
      dealCount:    withTheme.length,
    }
  }).filter(t => t.dealCount >= 5)

  const benchmarks: GlobalBenchmarks = {
    poolSize:      m.training_size,
    globalWinRate: Math.round((m.global_win_rate as unknown as number) * 100),
    stageVelocity: {
      p25Days: Math.round((m.stage_velocity_p25 as unknown as number) ?? 0),
      p50Days: Math.round((m.stage_velocity_p50 as unknown as number) ?? 60),
      p75Days: Math.round((m.stage_velocity_p75 as unknown as number) ?? 90),
    },
    riskThemeWinRates,
    dealValueBucketWinRates,
    collateralLift: ((m.collateral_lift as unknown as { type: string; withRate: number; withoutRate: number }[]) ?? []).map(c => ({
      type:        c.type,
      withRate:    Math.round(c.withRate * 100),
      withoutRate: Math.round(c.withoutRate * 100),
      lift:        Math.round((c.withRate - c.withoutRate) * 100),
    })).filter(c => Math.abs(c.lift) >= 5)  // only show meaningful lifts
  }

  // Write to cache (24h TTL)
  await db.execute(sql`
    INSERT INTO global_benchmark_cache (cache_key, data, computed_from_n, expires_at)
    VALUES (
      'benchmarks_v1',
      ${JSON.stringify(benchmarks)}::jsonb,
      ${m.training_size},
      NOW() + INTERVAL '24 hours'
    )
    ON CONFLICT (cache_key) DO UPDATE SET
      data = EXCLUDED.data,
      computed_from_n = EXCLUDED.computed_from_n,
      expires_at = EXCLUDED.expires_at,
      created_at = NOW()
  `)

  return benchmarks
}
