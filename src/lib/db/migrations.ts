/**
 * Central schema migration registry.
 *
 * ALL ALTER TABLE statements live here — nowhere else.
 * Every new column gets added to the appropriate block below,
 * and runMigrations() is called once per cold-start before any
 * route handler touches the database.
 *
 * Rules:
 *  - Always use ADD COLUMN IF NOT EXISTS (idempotent)
 *  - Group by table; add new columns at the bottom of each table block
 *  - Never add ALTER TABLE to an API route or library file
 */

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

let _migrationsDone = false

export async function runMigrations(): Promise<void> {
  if (_migrationsDone) return
  _migrationsDone = true

  // ── workspaces ──────────────────────────────────────────────────────────────
  try {
    await db.execute(sql`
      ALTER TABLE workspaces
        ADD COLUMN IF NOT EXISTS workspace_brain   jsonb,
        ADD COLUMN IF NOT EXISTS pipeline_config   jsonb,
        ADD COLUMN IF NOT EXISTS embedding_cache   jsonb
    `)
  } catch { /* already exists */ }

  // ── deal_logs ────────────────────────────────────────────────────────────────
  // Batch 1 — core columns
  try {
    await db.execute(sql`
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS contacts                  jsonb        NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS description               text,
        ADD COLUMN IF NOT EXISTS project_plan              jsonb,
        ADD COLUMN IF NOT EXISTS links                     jsonb        NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS parent_deal_id            uuid,
        ADD COLUMN IF NOT EXISTS expansion_type            text,
        ADD COLUMN IF NOT EXISTS contract_start_date       timestamptz,
        ADD COLUMN IF NOT EXISTS contract_end_date         timestamptz,
        ADD COLUMN IF NOT EXISTS outcome                   text
    `)
  } catch { /* already exists */ }

  // Batch 2 — ML / signals (separate try so a partial failure doesn't block batch 1)
  try {
    await db.execute(sql`
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS intent_signals            jsonb,
        ADD COLUMN IF NOT EXISTS note_signals_json         text,
        ADD COLUMN IF NOT EXISTS score_breakdown           text,
        ADD COLUMN IF NOT EXISTS conversion_score_pinned   boolean NOT NULL DEFAULT false
    `)
  } catch { /* already exists */ }

  // Batch 3 — stage outcome columns
  try {
    await db.execute(sql`
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS win_reason                text,
        ADD COLUMN IF NOT EXISTS loss_reason               text,
        ADD COLUMN IF NOT EXISTS competitor_lost_to        text
    `)
  } catch { /* already exists */ }

  // Batch 4 — HubSpot columns
  try {
    await db.execute(sql`
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS hubspot_deal_id           text UNIQUE,
        ADD COLUMN IF NOT EXISTS hubspot_stage_label       text,
        ADD COLUMN IF NOT EXISTS hubspot_notes             text
    `)
  } catch { /* already exists */ }

  // Batch 5 — engagement / deal type
  try {
    await db.execute(sql`
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS engagement_type           text
    `)
  } catch { /* already exists */ }

  // Batch 6 — scheduled events (calendar)
  try {
    await db.execute(sql`
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS scheduled_events          jsonb NOT NULL DEFAULT '[]'::jsonb
    `)
  } catch { /* already exists */ }

  // ── brain_rebuild_log ────────────────────────────────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS brain_rebuild_log (
        id                   text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        workspace_id         text NOT NULL,
        triggered_by         text,
        closed_deals_total   integer,
        wins                 integer,
        losses               integer,
        ml_active            boolean,
        model_accuracy_loo   real,
        open_deals_scored    integer,
        avg_score            real,
        errors               text,
        duration_ms          integer,
        models_trained       text,
        models_skipped       text,
        tokens_used          integer,
        created_at           timestamp DEFAULT now()
      )
    `)
  } catch { /* already exists */ }
  try {
    await db.execute(sql`
      ALTER TABLE brain_rebuild_log
        ADD COLUMN IF NOT EXISTS models_trained   text,
        ADD COLUMN IF NOT EXISTS models_skipped   text,
        ADD COLUMN IF NOT EXISTS tokens_used      integer
    `)
  } catch { /* already exists */ }

  // ── calibration_history ──────────────────────────────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS calibration_history (
        id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        workspace_id   text NOT NULL,
        month          text NOT NULL,
        avg_score_won  real,
        avg_score_lost real,
        separation     real,
        deal_count     integer,
        created_at     timestamp DEFAULT now(),
        UNIQUE(workspace_id, month)
      )
    `)
  } catch { /* already exists */ }

  // ── stage_transitions ────────────────────────────────────────────────────────
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stage_transitions (
        id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        deal_id         text NOT NULL,
        workspace_id    text NOT NULL,
        from_stage      text,
        to_stage        text NOT NULL,
        transitioned_at timestamp DEFAULT now()
      )
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_stage_transitions_deal
      ON stage_transitions (deal_id, transitioned_at DESC)
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_stage_transitions_workspace
      ON stage_transitions (workspace_id, transitioned_at DESC)
    `)
  } catch { /* already exists */ }
}
