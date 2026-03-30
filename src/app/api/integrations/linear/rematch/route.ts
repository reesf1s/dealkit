/**
 * POST /api/integrations/linear/rematch
 * Legacy endpoint retained for UI compatibility.
 * Internal rematching has been replaced by Claude-assisted issue review.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { count, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLinearLinks } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { ISSUE_LINKING_MODE } from '@/lib/issue-linking'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const [{ totalLinks }] = await db
      .select({ totalLinks: count() })
      .from(dealLinearLinks)
      .where(eq(dealLinearLinks.workspaceId, workspaceId))

    return NextResponse.json({
      data: {
        mode: ISSUE_LINKING_MODE,
        matched: Number(totalLinks),
        linked: Number(totalLinks),
        created: 0,
        deals: 0,
        details: [],
        message: 'Internal rematching is disabled. Review deals in Claude using your Halvex MCP connection and save links back into Halvex.',
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[rematch] Failed:', msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
