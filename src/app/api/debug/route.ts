import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// GET /api/debug — dev-only, returns DB connection status and table list
// Blocked in production to prevent schema/count exposure
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 })
  }
  const dbUrl = process.env.DATABASE_URL ?? '(not set)'
  const safeUrl = dbUrl.replace(/:([^:@]+)@/, ':***@') // redact password

  try {
    const tables = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    )
    const userCount = await db.execute(sql`SELECT count(*) as n FROM public.users`)
    const wsCount = await db.execute(sql`SELECT count(*) as n FROM workspaces`)
    const cols = await db.execute(
      sql`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('workspaces','workspace_memberships','users') ORDER BY table_name, column_name`
    )

    return NextResponse.json({
      ok: true,
      database: safeUrl,
      tables: (tables as unknown as { table_name: string }[]).map(r => r.table_name),
      userCount: (userCount as unknown as { n: string }[])[0]?.n,
      workspaceCount: (wsCount as unknown as { n: string }[])[0]?.n,
      columns: (cols as unknown as { table_name: string; column_name: string }[]),
    })
  } catch (e) {
    const err = e as { message?: string; cause?: { message?: string; code?: string } }
    return NextResponse.json({
      ok: false,
      database: safeUrl,
      error: err.message,
      cause: err.cause?.message,
      code: err.cause?.code,
    }, { status: 500 })
  }
}
