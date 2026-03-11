import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// GET /api/debug — no auth, returns DB connection status and table list
// Used to diagnose which database Vercel is connected to
export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? '(not set)'
  const safeUrl = dbUrl.replace(/:([^:@]+)@/, ':***@') // redact password

  try {
    const tables = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    )
    const userCount = await db.execute(sql`SELECT count(*) as n FROM public.users`)
    const wsCount = await db.execute(sql`SELECT count(*) as n FROM workspaces`)

    return NextResponse.json({
      ok: true,
      database: safeUrl,
      tables: (tables as unknown as { table_name: string }[]).map(r => r.table_name),
      userCount: (userCount as unknown as { n: string }[])[0]?.n,
      workspaceCount: (wsCount as unknown as { n: string }[])[0]?.n,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      database: safeUrl,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }
}
