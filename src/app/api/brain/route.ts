export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextResponse, after } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain, BRAIN_VERSION } from '@/lib/workspace-brain'
import { requestBrainRebuild } from '@/lib/brain-rebuild'
import { dbErrResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const brain = await getWorkspaceBrain(workspaceId)

    // Auto-rebuild in background if brain is stale (version mismatch) or missing
    if (!brain || (brain.brainVersion ?? 0) < BRAIN_VERSION) {
      after(async () => { await requestBrainRebuild(workspaceId, 'stale_version') })
    }

    return NextResponse.json({
      data: brain,
      meta: {
        lastRebuilt: brain?.updatedAt ?? null,
        isStale: brain?.updatedAt ? (Date.now() - new Date(brain.updatedAt).getTime() > 3600000) : true,
      },
    })
  } catch (err) { return dbErrResponse(err) }
}

// POST — force rebuild the workspace brain (picks up new fields like dealNames in patterns)
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    await requestBrainRebuild(workspaceId, 'manual_refresh')
    const brain = await getWorkspaceBrain(workspaceId)
    return NextResponse.json({ data: brain })
  } catch (err) { return dbErrResponse(err) }
}
