/**
 * GET /api/workspace/brain/refresh
 * Forces a workspace brain rebuild and returns the updated `updatedAt` timestamp.
 * Called from onboarding (aha moment) and can be triggered manually or by Linear sync.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { rebuildWorkspaceBrain } from '@/lib/workspace-brain'
import { dbErrResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const brain = await rebuildWorkspaceBrain(workspaceId, 'manual_refresh')

    return NextResponse.json({ ok: true, updatedAt: brain.updatedAt })
  } catch (err) {
    return dbErrResponse(err)
  }
}
