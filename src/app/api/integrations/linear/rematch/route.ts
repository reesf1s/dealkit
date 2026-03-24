/**
 * POST /api/integrations/linear/rematch
 * Runs semantic issue matching for all open deals in the workspace.
 * Saves results to deal_linear_links.
 * Returns { matched: number, deals: number }
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { matchAllOpenDeals } from '@/lib/linear-signal-match'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    const result = await matchAllOpenDeals(workspaceId, 'user')

    return NextResponse.json({
      data: {
        matched: result.linked + result.suggested,
        deals: 0, // matchAllOpenDeals iterates internally; we surface totals
        linked: result.linked,
        suggested: result.suggested,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
