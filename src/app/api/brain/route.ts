export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain, rebuildWorkspaceBrain } from '@/lib/workspace-brain'
import { dbErrResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const brain = await getWorkspaceBrain(workspaceId)
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
