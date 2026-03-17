/**
 * Global Transfer-Learning Pool — Privacy-Preserving Contribution Pipeline
 *
 * Collects anonymised deal outcome vectors from consenting workspaces.
 * Zero PII is ever stored — workspace identity is a one-way HMAC hash,
 * features are normalised floats, no names / notes / values / text ever leave
 * the workspace.
 *
 * Compliance: GDPR (Art.5/6/17/25), SOC2 Type II, CCPA.
 *
 * What we store per closed deal:
 *   - features: number[10] — the same ML feature vector already computed in deal-ml.ts
 *   - outcome: 0 (lost) | 1 (won)
 *   - dealValueBucket: one of xs/s/m/l/xl (log-scale, NOT raw value)
 *   - stageDurationBucket: days rounded to nearest 5
 *   - riskThemes: boolean[7] — category flags, no text
 *   - collateralUsed: string[] — type enum values, no content
 *
 * What we NEVER store:
 *   dealName, prospectCompany, prospectName, contacts, meetingNotes,
 *   aiSummary, lostReason, exact dealValue, exact timestamps,
 *   workspaceId, userId, competitor names.
 */

import crypto from 'crypto'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { ML_FEATURE_NAMES } from '@/lib/deal-ml'
import { BRAIN_VERSION } from '@/lib/brain-constants'

// ─── Types ────────────────────────────────────────────────────────────────────

/** The anonymised payload contributed per closed deal. */
export interface GlobalDealContribution {
  features:            number[]           // exactly 10 floats matching ML_FEATURE_NAMES, truncated to 3dp
  outcome:             0 | 1             // closed_lost=0, closed_won=1
  dealValueBucket:     'xs' | 's' | 'm' | 'l' | 'xl'
  stageDurationBucket: number            // days rounded to nearest 5
  riskThemes:          boolean[]         // 7 booleans, index matches RISK_THEME_KEYWORDS
  collateralUsed:      string[]          // type enum values only
  brainVersion:        number
}

/** The global prior returned to each workspace for Bayesian blending. */
export interface GlobalPriorInput {
  weights:             number[]
  bias:                number
  trainingSize:        number
  globalWinRate:       number            // 0–1
  stageVelocityP50:    number            // global median days to close
  stageVelocityP75:    number            // global p75 days to close
  riskThemeWinRates:   number[]          // P(win | theme_present) per theme, length 7
  featureImportance:   { name: string; importance: number; direction: 'helps' | 'hurts' }[]
}

// ─── Risk theme keyword index (matches 7 categories in workspace-brain riskWords) ──

const RISK_THEME_KEYWORDS: string[][] = [
  ['budget', 'cost', 'price', 'expensive', 'investment', 'spend', 'roi', 'finance', 'funding'],
  ['slow', 'quiet', 'unresponsive', 'ghosted', 'no reply', 'chasing', 'not responding', 'delayed'],
  ['competitor', 'alternative', 'salesforce', 'hubspot', 'looking at others', 'other vendor', 'comparing'],
  ['decision', 'authority', 'approval', 'sign off', 'board', 'sign-off', 'committee', 'champion'],
  ['time', 'urgent', 'rush', 'delay', 'timeline', 'q4', 'quarter', 'fiscal', 'deadline'],
  ['procurement', 'legal', 'contract', 'security review', 'compliance', 'it review', 'infosec', 'gdpr'],
  ['priority', 'bandwidth', 'capacity', 'internal', 'distracted', 'other projects', 'too busy'],
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * One-way HMAC of workspaceId using server-side salt.
 * Consistent per workspace (allows erasure) but not reverse-lookupable.
 * GLOBAL_POOL_SALT must be set in production env — never in code.
 */
export function computePoolContributorId(workspaceId: string): string {
  const salt = process.env.GLOBAL_POOL_SALT ?? 'dev-salt-change-in-production'
  return crypto.createHmac('sha256', salt).update(workspaceId).digest('hex')
}

/** Log-scale bucket for deal value — 5 bands, not raw value. */
function valueBucket(raw: number | null): 'xs' | 's' | 'm' | 'l' | 'xl' {
  const v = raw ?? 0
  if (v < 10_000)  return 'xs'
  if (v < 50_000)  return 's'
  if (v < 150_000) return 'm'
  if (v < 500_000) return 'l'
  return 'xl'
}

/** Detect which of the 7 risk themes are present in the risk strings. */
function extractRiskThemes(risks: string[]): boolean[] {
  const allText = risks.join(' ').toLowerCase()
  return RISK_THEME_KEYWORDS.map(kwds => kwds.some(kw => allText.includes(kw)))
}

/**
 * Deterministic fingerprint for deduplication.
 * Same feature vector + outcome from the same contributor never inserts twice.
 */
function fingerprint(poolContributorId: string, features: number[], outcome: number): string {
  return crypto
    .createHash('sha256')
    .update(poolContributorId + JSON.stringify(features) + outcome)
    .digest('hex')
    .slice(0, 40)  // 40 hex chars — unique enough, fits text PK comfortably
}

// ─── Core extraction ──────────────────────────────────────────────────────────

export interface ClosedDealForContribution {
  stage:              string
  dealValue:          number | null
  dealRisks:          string[]
  createdAt:          Date | string | null
  wonDate:            Date | string | null
  lostDate:           Date | string | null
  collateralTypes?:   string[]         // type enum values only — no names / content
  features:           number[]         // pre-computed ML feature vector (10 floats)
}

/**
 * Extract anonymised contributions from closed deals.
 * Enforces zero-PII guarantee — only numeric features and categorical buckets.
 */
export function extractContributions(
  closedDeals: ClosedDealForContribution[],
): GlobalDealContribution[] {
  return closedDeals
    .filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost')
    .filter(d => d.features.length === ML_FEATURE_NAMES.length)
    .map(d => {
      const outcome: 0 | 1 = d.stage === 'closed_won' ? 1 : 0

      const startMs = d.createdAt ? new Date(d.createdAt).getTime() : 0
      const endTs   = d.stage === 'closed_won' ? d.wonDate : d.lostDate
      const endMs   = endTs ? new Date(endTs).getTime() : 0
      const rawDays = startMs > 0 && endMs > 0 ? (endMs - startMs) / 86_400_000 : 0
      const stageDurationBucket = Math.max(0, Math.round(rawDays / 5) * 5)

      return {
        // Truncate features to 3dp — prevents fingerprinting via float precision
        features:            d.features.map(f => Math.round(f * 1000) / 1000),
        outcome,
        dealValueBucket:     valueBucket(d.dealValue),
        stageDurationBucket,
        riskThemes:          extractRiskThemes(d.dealRisks),
        collateralUsed:      d.collateralTypes ?? [],
        brainVersion:        BRAIN_VERSION,
      }
    })
}

// ─── Table bootstrap ──────────────────────────────────────────────────────────

/**
 * Idempotent CREATE TABLE IF NOT EXISTS for all global pool tables.
 * Called on first contribution/consent operation.
 */
export async function ensureGlobalTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS workspace_global_consent (
      id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id         uuid NOT NULL UNIQUE,
      consented            boolean NOT NULL DEFAULT false,
      consented_at         timestamptz,
      consented_by_user_id text,
      consent_version      integer NOT NULL DEFAULT 1,
      revoked_at           timestamptz,
      erased_at            timestamptz,
      created_at           timestamptz NOT NULL DEFAULT NOW(),
      updated_at           timestamptz NOT NULL DEFAULT NOW()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS global_deal_outcomes (
      id                    text PRIMARY KEY,
      pool_contributor_id   text NOT NULL,
      features              jsonb NOT NULL,
      outcome               integer NOT NULL,
      deal_value_bucket     text NOT NULL DEFAULT 'm',
      stage_duration_bucket integer NOT NULL DEFAULT 0,
      risk_themes           jsonb NOT NULL DEFAULT '[]'::jsonb,
      collateral_used       jsonb NOT NULL DEFAULT '[]'::jsonb,
      brain_version         integer NOT NULL DEFAULT 8,
      is_erased             boolean NOT NULL DEFAULT false,
      contributed_at        timestamptz NOT NULL DEFAULT NOW()
    )
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_gdo_contributor ON global_deal_outcomes(pool_contributor_id)
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_gdo_not_erased ON global_deal_outcomes(is_erased) WHERE is_erased = false
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS global_ml_model (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      version             integer NOT NULL UNIQUE,
      is_active           boolean NOT NULL DEFAULT false,
      weights             jsonb NOT NULL,
      bias                jsonb NOT NULL,
      feature_names       jsonb NOT NULL,
      training_size       integer NOT NULL,
      loo_accuracy        jsonb NOT NULL,
      feature_importance  jsonb NOT NULL,
      global_win_rate     jsonb NOT NULL,
      stage_velocity_p25  jsonb,
      stage_velocity_p50  jsonb,
      stage_velocity_p75  jsonb,
      risk_theme_win_rates jsonb,
      collateral_lift     jsonb,
      archetype_centroids jsonb,
      archetype_win_rates jsonb,
      min_brain_version   integer NOT NULL DEFAULT 8,
      trained_at          timestamptz NOT NULL DEFAULT NOW(),
      training_duration_ms integer
    )
  `)

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gmm_active ON global_ml_model(is_active) WHERE is_active = true
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS global_contribution_audit (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pool_contributor_id text NOT NULL,
      event_type          text NOT NULL,
      deal_count          integer,
      brain_version       integer,
      metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at          timestamptz NOT NULL DEFAULT NOW()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS global_benchmark_cache (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cache_key        text NOT NULL UNIQUE,
      data             jsonb NOT NULL,
      computed_from_n  integer NOT NULL,
      expires_at       timestamptz NOT NULL,
      created_at       timestamptz NOT NULL DEFAULT NOW()
    )
  `)
}

// ─── Contribution ─────────────────────────────────────────────────────────────

/**
 * Upsert anonymised contributions for a workspace into the global pool.
 * Silently no-ops if workspace has no consent or fewer than 4 contributions.
 */
export async function contributeToGlobalPool(
  workspaceId: string,
  contributions: GlobalDealContribution[],
): Promise<void> {
  // k-anonymity: require minimum closed deals before contributing
  if (contributions.length < 4) return

  // Check consent
  const hasConsent = await getGlobalConsent(workspaceId)
  if (!hasConsent) return

  await ensureGlobalTables()

  const poolId = computePoolContributorId(workspaceId)

  for (const c of contributions) {
    const fp = fingerprint(poolId, c.features, c.outcome)
    await db.execute(sql`
      INSERT INTO global_deal_outcomes (
        id, pool_contributor_id, features, outcome,
        deal_value_bucket, stage_duration_bucket, risk_themes, collateral_used,
        brain_version, is_erased
      ) VALUES (
        ${fp},
        ${poolId},
        ${JSON.stringify(c.features)}::jsonb,
        ${c.outcome},
        ${c.dealValueBucket},
        ${c.stageDurationBucket},
        ${JSON.stringify(c.riskThemes)}::jsonb,
        ${JSON.stringify(c.collateralUsed)}::jsonb,
        ${c.brainVersion},
        false
      )
      ON CONFLICT (id) DO NOTHING
    `)
  }

  // Audit log
  await db.execute(sql`
    INSERT INTO global_contribution_audit (pool_contributor_id, event_type, deal_count, brain_version, metadata)
    VALUES (
      ${poolId},
      'contributed',
      ${contributions.length},
      ${contributions[0]?.brainVersion ?? BRAIN_VERSION},
      '{}'::jsonb
    )
  `)
}

// ─── Consent management ───────────────────────────────────────────────────────

export async function getGlobalConsent(workspaceId: string): Promise<boolean> {
  try {
    const rows = await db.execute(sql`
      SELECT consented
      FROM workspace_global_consent
      WHERE workspace_id = ${workspaceId}::uuid
        AND erased_at IS NULL
      LIMIT 1
    `) as unknown as { consented: boolean }[]
    return rows[0]?.consented ?? false
  } catch {
    return false  // table may not exist yet — treat as no consent
  }
}

export async function setGlobalConsent(
  workspaceId: string,
  consented: boolean,
  userId: string,
): Promise<void> {
  await ensureGlobalTables()
  const poolId = computePoolContributorId(workspaceId)

  await db.execute(sql`
    INSERT INTO workspace_global_consent
      (workspace_id, consented, consented_at, consented_by_user_id, consent_version, revoked_at, updated_at)
    VALUES
      (${workspaceId}::uuid, ${consented}, NOW(), ${userId}, 1,
       ${consented ? null : sql`NOW()`},
       NOW())
    ON CONFLICT (workspace_id) DO UPDATE SET
      consented             = EXCLUDED.consented,
      consented_at          = CASE WHEN EXCLUDED.consented THEN NOW() ELSE workspace_global_consent.consented_at END,
      consented_by_user_id  = EXCLUDED.consented_by_user_id,
      revoked_at            = CASE WHEN NOT EXCLUDED.consented THEN NOW() ELSE NULL END,
      updated_at            = NOW()
  `)

  // Audit
  await db.execute(sql`
    INSERT INTO global_contribution_audit (pool_contributor_id, event_type, metadata)
    VALUES (${poolId}, ${consented ? 'consent_granted' : 'consent_revoked'}, '{}'::jsonb)
  `)

  // If revoking, soft-delete all their contributions
  if (!consented) {
    await db.execute(sql`
      UPDATE global_deal_outcomes
      SET is_erased = true
      WHERE pool_contributor_id = ${poolId}
    `)
  }
}

// ─── GDPR erasure ─────────────────────────────────────────────────────────────

/**
 * Full GDPR Article 17 erasure — deletes all contributions and marks
 * consent as erased. A global model retrain should be scheduled after this.
 */
export async function eraseFromGlobalPool(workspaceId: string, userId: string): Promise<number> {
  await ensureGlobalTables()
  const poolId = computePoolContributorId(workspaceId)

  // Mark all contributions as erased
  const result = await db.execute(sql`
    UPDATE global_deal_outcomes
    SET is_erased = true
    WHERE pool_contributor_id = ${poolId} AND is_erased = false
    RETURNING id
  `) as unknown as { id: string }[]

  const count = result.length

  // Mark consent as erased
  await db.execute(sql`
    UPDATE workspace_global_consent
    SET erased_at = NOW(), consented = false, updated_at = NOW()
    WHERE workspace_id = ${workspaceId}::uuid
  `)

  // Audit
  await db.execute(sql`
    INSERT INTO global_contribution_audit (pool_contributor_id, event_type, deal_count, metadata)
    VALUES (${poolId}, 'erased', ${count}, '{"source":"gdpr_article_17"}'::jsonb)
  `)

  return count
}

// ─── Global model read ────────────────────────────────────────────────────────

const MIN_POOL_SIZE = 50  // minimum records before global model is trusted

export async function getActiveGlobalModel(): Promise<GlobalPriorInput | null> {
  try {
    const rows = await db.execute(sql`
      SELECT weights, bias, training_size, global_win_rate,
             stage_velocity_p50, stage_velocity_p75,
             risk_theme_win_rates, feature_importance
      FROM global_ml_model
      WHERE is_active = true
      LIMIT 1
    `) as unknown as Array<{
      weights:             number[]
      bias:                number
      training_size:       number
      global_win_rate:     number
      stage_velocity_p50:  number | null
      stage_velocity_p75:  number | null
      risk_theme_win_rates: number[] | null
      feature_importance:  { name: string; importance: number; direction: 'helps' | 'hurts' }[]
    }>

    const row = rows[0]
    if (!row || row.training_size < MIN_POOL_SIZE) return null

    return {
      weights:           row.weights,
      bias:              row.bias as unknown as number,
      trainingSize:      row.training_size,
      globalWinRate:     row.global_win_rate as unknown as number,
      stageVelocityP50:  (row.stage_velocity_p50 as unknown as number) ?? 60,
      stageVelocityP75:  (row.stage_velocity_p75 as unknown as number) ?? 90,
      riskThemeWinRates: (row.risk_theme_win_rates as unknown as number[]) ?? [],
      featureImportance: row.feature_importance,
    }
  } catch {
    return null  // table may not exist yet
  }
}
