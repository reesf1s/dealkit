import { NextResponse } from 'next/server'

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

/** Wraps a route handler with standard DB error handling */
export function dbErrResponse(err: unknown): NextResponse {
  if (isDbConnectionError(err)) return dbNotConfigured()
  const msg = err instanceof Error ? err.message : String(err)
  // postgres.js wraps the real PG error in err.cause — expose it for debugging
  const cause = (err as { cause?: unknown })?.cause
  const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : undefined
  console.error('API error:', msg, causeMsg ?? '', err)
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR', detail: msg, cause: causeMsg },
    { status: 500 },
  )
}
