/**
 * POST /api/integrations/linear/rematch
 * Runs smart matching for all open deals — product gaps to Linear issues.
 * Quality over quantity: max 5 links per deal, only genuine product blockers.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { smartMatchAllDeals } from '@/lib/smart-match'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    console.log(`[rematch] Starting smart rematch for workspace ${workspaceId}`)
    const result = await smartMatchAllDeals(workspaceId)
    console.log(`[rematch] Complete: ${result.totalLinked} linked, ${result.totalCreated} created`)

    return NextResponse.json({
      data: {
        matched: result.totalLinked + result.totalCreated,
        linked: result.totalLinked,
        created: result.totalCreated,
        deals: result.results.length,
        details: result.results
          .filter(r => r.linked > 0 || r.created > 0)
          .map(r => `${r.dealName}: ${r.linked} linked, ${r.created} created`),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[rematch] Failed:', msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
