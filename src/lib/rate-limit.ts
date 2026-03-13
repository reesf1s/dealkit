/**
 * Postgres-backed sliding window rate limiter.
 * Degrades gracefully — if anything fails, requests are allowed through.
 */
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

let tableReady = false

async function ensureTable() {
  if (tableReady) return
  // "window" is a reserved word in Postgres — use "window_start" instead
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS api_rate_limits (
      user_id      TEXT        NOT NULL,
      endpoint     TEXT        NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      count        INTEGER     NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, endpoint, window_start)
    )
  `)
  tableReady = true
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  limit: number,
  windowSecs = 60,
): Promise<RateLimitResult> {
  const windowMs = windowSecs * 1000
  const now = Date.now()
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs)
  const resetAt = new Date(windowStart.getTime() + windowMs)

  try {
    await ensureTable()

    // Occasionally prune old rows
    if (Math.random() < 0.05) {
      db.execute(sql`DELETE FROM api_rate_limits WHERE window_start < NOW() - INTERVAL '2 hours'`).catch(() => {})
    }

    const rows = await db.execute(sql`
      INSERT INTO api_rate_limits (user_id, endpoint, window_start, count)
      VALUES (${userId}, ${endpoint}, ${windowStart.toISOString()}::timestamptz, 1)
      ON CONFLICT (user_id, endpoint, window_start)
      DO UPDATE SET count = api_rate_limits.count + 1
      RETURNING count
    `)

    const count = (rows as unknown as { count: number }[])[0]?.count ?? 1
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt }
  } catch {
    // If rate limiting fails for any reason, allow the request through
    // rather than breaking the feature. Errors here are non-fatal.
    return { allowed: true, remaining: limit, resetAt }
  }
}

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
