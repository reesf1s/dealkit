/**
 * GET /api/cron/linear-match
 * Nightly cron (4 AM) — sync all Linear integrations and run signal matching
 * for all open deals across all connected workspaces.
 *
 * Authenticated by CRON_SECRET header (set in Vercel env vars).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — may process many workspaces

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { linearIntegrations } from '@/lib/db/schema'
import { syncLinearIssues } from '@/lib/linear-sync'
import { matchAllOpenDeals } from '@/lib/linear-signal-match'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allIntegrations = await db
    .select({ workspaceId: linearIntegrations.workspaceId })
    .from(linearIntegrations)

  let totalSynced = 0
  let totalLinked = 0
  let totalSuggested = 0
  const errors: string[] = []

  for (const { workspaceId } of allIntegrations) {
    try {
      const syncResult = await syncLinearIssues(workspaceId)
      totalSynced += syncResult.synced

      const matchResult = await matchAllOpenDeals(workspaceId)
      totalLinked += matchResult.linked
      totalSuggested += matchResult.suggested
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`workspace=${workspaceId.slice(0, 8)}: ${msg}`)
      console.error('[cron/linear-match] error for workspace', workspaceId.slice(0, 8), err)
    }
  }

  const result = {
    workspaces: allIntegrations.length,
    totalSynced,
    totalLinked,
    totalSuggested,
    errors,
  }

  console.log('[cron/linear-match]', JSON.stringify(result))
  return NextResponse.json({ data: result })
}
