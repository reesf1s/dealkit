/**
 * POST /api/integrations/linear/disconnect
 * Remove the Linear integration for the workspace.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { linearIntegrations } from '@/lib/db/schema'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    await db
      .delete(linearIntegrations)
      .where(eq(linearIntegrations.workspaceId, workspaceId))

    return NextResponse.json({ data: { disconnected: true } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
