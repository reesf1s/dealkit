/**
 * GET /api/cron/workflows
 * Daily cron (8 AM UTC) — execute all enabled schedule-triggered workflows
 * across every workspace.
 *
 * Authenticated by CRON_SECRET header (set in Vercel env vars).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { workflows } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { runScheduledWorkflows } from '@/lib/workflow-executor'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get distinct workspace IDs that have at least one enabled schedule workflow
  const rows = await db.execute<{ workspace_id: string }>(
    sql`SELECT DISTINCT workspace_id FROM workflows WHERE is_enabled = true AND trigger_type = 'schedule'`
  )

  const workspaceIds = rows.map(r => r.workspace_id)

  let totalRan = 0
  let totalErrors = 0
  const workspaceErrors: string[] = []

  for (const workspaceId of workspaceIds) {
    try {
      const result = await runScheduledWorkflows(workspaceId)
      totalRan += result.ran
      totalErrors += result.errors
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      workspaceErrors.push(`workspace=${workspaceId.slice(0, 8)}: ${msg}`)
      console.error('[cron/workflows] error for workspace', workspaceId.slice(0, 8), err)
    }
  }

  const result = { workspaces: workspaceIds.length, totalRan, totalErrors, errors: workspaceErrors }
  console.log('[cron/workflows]', JSON.stringify(result))
  return NextResponse.json({ data: result })
}
