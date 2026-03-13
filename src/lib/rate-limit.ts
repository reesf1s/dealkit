/**
 * Postgres-backed sliding window rate limiter.
 * No Redis needed — uses the existing DB connection.
 *
 * Creates the `api_rate_limits` table lazily on first use.
 */
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

let tableReady = false

async function ensureTable() {
  if (tableReady) return
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS api_rate_limits (
      user_id   TEXT        NOT NULL,
      endpoint  TEXT        NOT NULL,
      window    TIMESTAMPTZ NOT NULL,
      count     INTEGER     NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, endpoint, window)
    )
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_api_rate_limits
    ON api_rate_limits (user_id, endpoint, window)
  `)
  tableReady = true
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

/**
 * Check & increment the rate limit counter for a user+endpoint.
 *
 * @param userId   Clerk user ID
 * @param endpoint Short string key, e.g. "collateral:generate"
 * @param limit    Max requests per window
 * @param windowSecs  Window length in seconds (default 60)
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  limit: number,
  windowSecs = 60,
): Promise<RateLimitResult> {
  await ensureTable()

  const windowMs = windowSecs * 1000
  const now = Date.now()
  // Bucket into fixed windows (floor to nearest window)
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs)
  const resetAt = new Date(windowStart.getTime() + windowMs)

  // Occasionally clean up windows older than 2 hours
  if (Math.random() < 0.05) {
    db.execute(sql`DELETE FROM api_rate_limits WHERE window < NOW() - INTERVAL '2 hours'`).catch(() => {})
  }

  // Upsert: insert row or increment existing count atomically
  const rows = await db.execute(sql`
    INSERT INTO api_rate_limits (user_id, endpoint, window, count)
    VALUES (${userId}, ${endpoint}, ${windowStart.toISOString()}::timestamptz, 1)
    ON CONFLICT (user_id, endpoint, window)
    DO UPDATE SET count = api_rate_limits.count + 1
    RETURNING count
  `)

  const count = (rows as unknown as { count: number }[])[0]?.count ?? 1

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  }
}

/** Returns a standard 429 NextResponse with Retry-After header. */
export function rateLimitResponse(resetAt: Date): NextResponse {
  const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000)
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': resetAt.toISOString(),
      },
    },
  )
}
