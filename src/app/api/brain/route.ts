export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextResponse, after } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain, rebuildWorkspaceBrain, BRAIN_VERSION } from '@/lib/workspace-brain'
import { dbErrResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const brain = await getWorkspaceBrain(workspaceId)

    // Auto-rebuild in background if brain is stale (version mismatch) or missing
    if (!brain || (brain.brainVersion ?? 0) < BRAIN_VERSION) {
      after(async () => {
        try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ }
      })
    }

    return NextResponse.json({ data: brain })
  } catch (err) { return dbErrResponse(err) }
}

// POST — force rebuild the workspace brain (picks up new fields like dealNames in patterns)
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const brain = await rebuildWorkspaceBrain(workspaceId)
    return NextResponse.json({ data: brain })
  } catch (err) { return dbErrResponse(err) }
}
