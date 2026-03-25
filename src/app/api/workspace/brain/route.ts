import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain, rebuildWorkspaceBrain } from '@/lib/workspace-brain'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspaceId } = await getWorkspaceContext(userId)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const forceRebuild = req.nextUrl.searchParams.get('rebuild') === 'true'

  if (forceRebuild) {
    after(async () => {
      await rebuildWorkspaceBrain(workspaceId, 'manual_refresh').catch(console.error)
    })
  }

  const brain = await getWorkspaceBrain(workspaceId)

  // If brain is null/empty, trigger a rebuild and return building status instead of empty
  if (!brain) {
    after(async () => {
      await rebuildWorkspaceBrain(workspaceId, 'missing_brain').catch(console.error)
    })
    return NextResponse.json({ brain: null, status: 'building' })
  }

  return NextResponse.json({ brain })
}
