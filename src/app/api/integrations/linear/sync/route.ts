/**
 * POST /api/integrations/linear/sync
 * Manually trigger a Linear issue sync for the workspace.
 * After sync, re-matches all open deals against the updated issue cache.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // allow up to 60s for syncing many issues

import { auth } from '@clerk/nextjs/server'
import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { syncLinearIssues } from '@/lib/linear-sync'
import { smartMatchAllDeals } from '@/lib/smart-match'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    console.log(`[linear-sync] Starting manual full sync for workspace ${workspaceId}`)
    const result = await syncLinearIssues(workspaceId, true)  // force full sync on manual trigger
    console.log(`[linear-sync] Sync complete:`, result)

    // After sync, re-match all open deals in background
    after(async () => {
      try {
        await smartMatchAllDeals(workspaceId)
      } catch (err) {
        console.error('[linear-sync] Background rematch failed:', err)
      }
    })

    return NextResponse.json({ data: result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[linear-sync] Failed:', msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
