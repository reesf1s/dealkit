import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { runMigrations } from '@/lib/db/migrations'

/** Returns true if the error is due to a missing / bad DATABASE_URL */
export function isDbConnectionError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? ''
  return (
    msg.includes('placeholder') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('getaddrinfo') ||
    msg.includes('connection refused') ||
    msg.includes('DATABASE_URL') ||
    msg.includes('password authentication failed') ||
    !process.env.DATABASE_URL
  )
}

/** Standard 503 response when the database is not configured */
export function dbNotConfigured(): NextResponse {
  return NextResponse.json(
    {
      error: 'Database not configured',
      code: 'DB_NOT_CONFIGURED',
      message:
        'Add DATABASE_URL to your Vercel environment variables. Get a free database at neon.tech.',
    },
    { status: 503 },
  )
}

/** No-op kept for backward compatibility — use runMigrations() for new columns. */
export async function ensureLinksColumn() {}

/** Create indexes on frequently-queried columns (idempotent, cached per cold-start).
 *  Runs schema migrations first, then index creation.
 *  Uses CONCURRENTLY so index builds never block reads/writes on the table. */
let _indexesMigrated = false
export async function ensureIndexes() {
  if (_indexesMigrated) return
  _indexesMigrated = true // mark before async work — prevents concurrent runs

  // Run all schema migrations before any index creation
  await runMigrations()

  // Each CONCURRENTLY index must be a separate statement (can't be in a transaction)
  const indexes = [
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deal_logs_workspace_stage ON deal_logs (workspace_id, stage)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deal_logs_workspace_updated ON deal_logs (workspace_id, updated_at DESC)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collateral_workspace_status ON collateral (workspace_id, status)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_workspace_created ON events (workspace_id, created_at DESC)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_competitors_workspace ON competitors (workspace_id)`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_gaps_workspace ON product_gaps (workspace_id)`,
  ]
  for (const stmt of indexes) {
    try { await db.execute(sql.raw(stmt)) } catch { /* already exists */ }
  }
}

/** Wraps a route handler with standard DB error handling.
 *  Logs full details server-side but returns sanitised message to client. */
export function dbErrResponse(err: unknown): NextResponse {
  if (isDbConnectionError(err)) return dbNotConfigured()
  const msg = err instanceof Error ? err.message : String(err)
  const cause = (err as { cause?: unknown })?.cause
  const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : undefined
  // Log full error server-side for debugging
  console.error('API error:', msg, causeMsg ?? '', err)
  // Return sanitised error to client — never leak schema/query details
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 },
  )
}
