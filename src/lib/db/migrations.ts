/**
 * Central schema migration registry — versioned.
 *
 * ALL DDL statements live here — nowhere else.
 * A `_migrations` tracking table records which versions have run.
 * Each migration is idempotent (IF NOT EXISTS / IF NOT EXISTS checks) so
 * running it twice is always safe.
 *
 * Rules:
 *  - Always use ADD COLUMN IF NOT EXISTS (idempotent)
 *  - Add new migrations at the bottom of MIGRATIONS with the next version number
 *  - Never add ALTER TABLE / CREATE TABLE to an API route or library file
 *  - runMigrations() is called once per cold-start via ensureIndexes() in api-helpers.ts
 */

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

// ── Versioned migration registry ────────────────────────────────────────────────
const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'core_workspace_columns',
    sql: `
      ALTER TABLE workspaces
        ADD COLUMN IF NOT EXISTS workspace_brain   jsonb,
        ADD COLUMN IF NOT EXISTS pipeline_config   jsonb,
        ADD COLUMN IF NOT EXISTS embedding_cache   jsonb
    `,
  },
  {
    version: 2,
    name: 'core_deal_columns',
    sql: `
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
    `,
  },
  {
    version: 3,
    name: 'deal_ml_signal_columns',
    sql: `
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS intent_signals            jsonb,
        ADD COLUMN IF NOT EXISTS note_signals_json         text,
        ADD COLUMN IF NOT EXISTS score_breakdown           text,
        ADD COLUMN IF NOT EXISTS conversion_score_pinned   boolean NOT NULL DEFAULT false
    `,
  },
  {
    version: 4,
    name: 'deal_stage_outcome_columns',
    sql: `
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS win_reason                text,
        ADD COLUMN IF NOT EXISTS loss_reason               text,
        ADD COLUMN IF NOT EXISTS competitor_lost_to        text
    `,
  },
  {
    version: 5,
    name: 'deal_hubspot_columns',
    sql: `
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS hubspot_deal_id           text UNIQUE,
        ADD COLUMN IF NOT EXISTS hubspot_stage_label       text,
        ADD COLUMN IF NOT EXISTS hubspot_notes             text
    `,
  },
  {
    version: 6,
    name: 'deal_engagement_type_column',
    sql: `
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS engagement_type           text
    `,
  },
  {
    version: 7,
    name: 'create_brain_rebuild_log',
    sql: `
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
    `,
  },
  {
    version: 8,
    name: 'brain_rebuild_log_extra_columns',
    sql: `
      ALTER TABLE brain_rebuild_log
        ADD COLUMN IF NOT EXISTS models_trained   text,
        ADD COLUMN IF NOT EXISTS models_skipped   text,
        ADD COLUMN IF NOT EXISTS tokens_used      integer
    `,
  },
  {
    version: 9,
    name: 'create_calibration_history',
    sql: `
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
    `,
  },
  {
    version: 10,
    name: 'create_stage_transitions',
    sql: `
      CREATE TABLE IF NOT EXISTS stage_transitions (
        id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        deal_id         text NOT NULL,
        workspace_id    text NOT NULL,
        from_stage      text,
        to_stage        text NOT NULL,
        transitioned_at timestamp DEFAULT now()
      )
    `,
  },
  {
    version: 11,
    name: 'stage_transitions_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_stage_transitions_deal
        ON stage_transitions (deal_id, transitioned_at DESC);
      CREATE INDEX IF NOT EXISTS idx_stage_transitions_workspace
        ON stage_transitions (workspace_id, transitioned_at DESC)
    `,
  },
  {
    version: 12,
    name: 'workspace_extra_columns',
    sql: `
      ALTER TABLE workspaces
        ADD COLUMN IF NOT EXISTS ai_overview                jsonb,
        ADD COLUMN IF NOT EXISTS ai_overview_generated_at   timestamptz,
        ADD COLUMN IF NOT EXISTS zapier_api_key             text,
        ADD COLUMN IF NOT EXISTS inbound_email_token        text
    `,
  },
  {
    version: 13,
    name: 'collateral_extra_columns',
    sql: `
      ALTER TABLE collateral
        ADD COLUMN IF NOT EXISTS title                text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS custom_type_name     text,
        ADD COLUMN IF NOT EXISTS generation_source    text,
        ADD COLUMN IF NOT EXISTS share_token          text,
        ADD COLUMN IF NOT EXISTS is_shared            boolean NOT NULL DEFAULT false
    `,
  },
  {
    version: 14,
    name: 'create_hubspot_integrations',
    sql: `
      CREATE TABLE IF NOT EXISTS hubspot_integrations (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
        access_token    TEXT NOT NULL,
        refresh_token   TEXT NOT NULL DEFAULT '',
        expires_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '100 years',
        portal_id       TEXT NOT NULL DEFAULT '',
        last_sync_at    TIMESTAMP WITH TIME ZONE,
        deals_imported  INTEGER NOT NULL DEFAULT 0,
        sync_error      TEXT,
        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    version: 15,
    name: 'create_deal_prediction_log',
    sql: `
      CREATE TABLE IF NOT EXISTS deal_prediction_log (
        id                SERIAL PRIMARY KEY,
        workspace_id      TEXT NOT NULL,
        deal_id           TEXT NOT NULL,
        predicted_score   INTEGER NOT NULL,
        predicted_outcome TEXT,
        actual_outcome    TEXT,
        predicted_at      TIMESTAMPTZ DEFAULT NOW(),
        resolved_at       TIMESTAMPTZ,
        deal_value        NUMERIC
      )
    `,
  },
  {
    version: 16,
    name: 'deal_prediction_log_index',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_deal_prediction_log_workspace
        ON deal_prediction_log (workspace_id, resolved_at DESC)
    `,
  },
  {
    version: 17,
    name: 'create_weekly_digest',
    sql: `
      CREATE TABLE IF NOT EXISTS weekly_digest (
        id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id              TEXT NOT NULL,
        week_start                DATE NOT NULL,
        deals_added               INTEGER,
        deals_closed_won          INTEGER,
        deals_closed_lost         INTEGER,
        pipeline_value_change     NUMERIC,
        top_score_change_deal     TEXT,
        top_score_change_delta    INTEGER,
        notes_added               INTEGER,
        created_at                TIMESTAMP DEFAULT NOW()
      )
    `,
  },
  {
    version: 18,
    name: 'deal_scheduled_events_column',
    sql: `
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS scheduled_events jsonb NOT NULL DEFAULT '[]'::jsonb
    `,
  },
  {
    version: 19,
    name: 'archive_duplicate_collateral',
    sql: `
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY workspace_id, type,
              COALESCE(source_competitor_id::text, ''),
              COALESCE(source_case_study_id::text, '')
            ORDER BY updated_at DESC
          ) AS rn
        FROM collateral
        WHERE status != 'archived'
          AND type != 'custom'
      )
      UPDATE collateral
      SET status = 'archived', updated_at = NOW()
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    `,
  },
  {
    version: 20,
    name: 'create_deal_events',
    sql: `
      CREATE TABLE IF NOT EXISTS deal_events (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        deal_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        event_time TEXT,
        source TEXT NOT NULL,
        source_note_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `,
  },
  {
    version: 21,
    name: 'deal_events_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_deal_events_workspace_date
        ON deal_events (workspace_id, event_date);
      CREATE INDEX IF NOT EXISTS idx_deal_events_deal
        ON deal_events (deal_id, event_date);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_events_dedup
        ON deal_events (deal_id, event_date, title)
    `,
  },
  {
    version: 22,
    name: 'archive_duplicate_collateral_by_title',
    sql: `
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY workspace_id, type,
              COALESCE(source_competitor_id::text, LOWER(TRIM(title)))
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
          ) AS rn
        FROM collateral
        WHERE status != 'archived'
          AND type != 'custom'
      )
      UPDATE collateral
      SET status = 'archived', updated_at = NOW()
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    `,
  },
  {
    version: 23,
    name: 'backfill_lost_reason_from_notes',
    sql: `
      UPDATE deal_logs
      SET lost_reason = TRIM(SUBSTRING(
        meeting_notes FROM 'Primary reason: ([^\n]+)'
      ))
      WHERE stage = 'closed_lost'
        AND (lost_reason IS NULL OR lost_reason = '')
        AND meeting_notes LIKE '%[Win/Loss Interview]%'
        AND meeting_notes ~ 'Primary reason: [^\n]+'
    `,
  },
  {
    version: 24,
    name: 'create_unmatched_emails_and_note_source',
    sql: `
      CREATE TABLE IF NOT EXISTS unmatched_emails (
        id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        workspace_id       TEXT NOT NULL,
        from_email         TEXT NOT NULL,
        from_name          TEXT,
        subject            TEXT,
        body               TEXT,
        suggested_deal_ids JSONB DEFAULT '[]'::jsonb,
        status             TEXT NOT NULL DEFAULT 'pending',
        assigned_deal_id   TEXT,
        received_at        TIMESTAMPTZ NOT NULL,
        resolved_at        TIMESTAMPTZ,
        created_at         TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_unmatched_emails_workspace_status
        ON unmatched_emails (workspace_id, status);
      ALTER TABLE deal_logs
        ADD COLUMN IF NOT EXISTS note_source TEXT DEFAULT 'manual'
    `,
  },
  {
    version: 25,
    name: 'enable_pgvector',
    sql: `
      CREATE EXTENSION IF NOT EXISTS vector;
      ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS note_embedding vector(1536);
      ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS deal_embedding vector(1536)
    `,
  },
  {
    version: 26,
    name: 'embedding_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_note_embedding
        ON deal_logs USING hnsw (note_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
      CREATE INDEX IF NOT EXISTS idx_deal_embedding
        ON deal_logs USING hnsw (deal_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    `,
  },
  {
    version: 27,
    name: 'create_signal_outcomes',
    sql: `
      CREATE TABLE IF NOT EXISTS signal_outcomes (
        id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        workspace_id          TEXT NOT NULL,
        deal_id               TEXT NOT NULL,
        outcome               TEXT NOT NULL,
        close_date            TIMESTAMPTZ,
        champion_identified   BOOLEAN,
        budget_confirmed      BOOLEAN,
        competitor_present    BOOLEAN,
        competitor_name       TEXT,
        objection_themes      JSONB DEFAULT '[]'::jsonb,
        sentiment_trajectory  TEXT,
        days_to_close         INTEGER,
        total_meetings        INTEGER,
        stakeholder_count     INTEGER,
        deal_value            INTEGER,
        stage                 TEXT,
        win_reason            TEXT,
        loss_reason           TEXT,
        deal_embedding        TEXT,
        created_at            TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_signal_outcomes_workspace
        ON signal_outcomes (workspace_id, outcome);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_outcomes_deal
        ON signal_outcomes (workspace_id, deal_id)
    `,
  },
  {
    version: 29,
    name: 'workspace_mcp_api_key',
    sql: `
      ALTER TABLE workspaces
        ADD COLUMN IF NOT EXISTS mcp_api_key TEXT UNIQUE
    `,
  },
  {
    version: 28,
    name: 'ensure_embeddings_1536',
    sql: `
      DO $$
      BEGIN
        -- Ensure columns are vector(1536) for OpenAI text-embedding-3-small
        ALTER TABLE deal_logs DROP COLUMN IF EXISTS note_embedding;
        ALTER TABLE deal_logs ADD COLUMN note_embedding vector(1536);
        ALTER TABLE deal_logs DROP COLUMN IF EXISTS deal_embedding;
        ALTER TABLE deal_logs ADD COLUMN deal_embedding vector(1536);
        DROP INDEX IF EXISTS idx_note_embedding;
        DROP INDEX IF EXISTS idx_deal_embedding;
        CREATE INDEX IF NOT EXISTS idx_note_embedding
          ON deal_logs USING hnsw (note_embedding vector_cosine_ops)
          WITH (m = 16, ef_construction = 64);
        CREATE INDEX IF NOT EXISTS idx_deal_embedding
          ON deal_logs USING hnsw (deal_embedding vector_cosine_ops)
          WITH (m = 16, ef_construction = 64);
      END $$
    `,
  },
]

// ── In-process cache — prevents redundant round-trips on the same cold-start ──
let _migrationsDone = false

export async function runMigrations(): Promise<void> {
  if (_migrationsDone) return
  _migrationsDone = true

  // 1. Ensure the _migrations tracking table exists
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        version     INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        applied_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
  } catch { /* already exists */ }

  // 2. Read which versions have already been applied
  let appliedVersions = new Set<number>()
  try {
    const rows = await db.execute<{ version: number }>(
      sql`SELECT version FROM _migrations`
    )
    const arr: { version: number }[] = Array.isArray(rows) ? rows : (rows as any).rows ?? []
    appliedVersions = new Set(arr.map(r => r.version))
  } catch { /* _migrations may be brand new — treat as empty */ }

  // 3. Run each pending migration in order
  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue
    try {
      // Split on semicolons so multi-statement migrations (e.g. multiple CREATE INDEX) work
      const statements = migration.sql
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
      for (const stmt of statements) {
        await db.execute(sql.raw(stmt))
      }
      await db.execute(sql`
        INSERT INTO _migrations (version, name)
        VALUES (${migration.version}, ${migration.name})
        ON CONFLICT (version) DO NOTHING
      `)
    } catch (err) {
      // Log but don't throw — idempotent columns/tables that already exist will error here,
      // and we don't want a single failed migration to block the entire startup.
      console.warn(`[migrations] v${migration.version} (${migration.name}) error:`, (err as Error)?.message)
    }
  }
}
