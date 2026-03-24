/**
 * POST /api/workflows/execute
 * Manually execute a single workflow for the authenticated workspace.
 * Body: { workflowId: string }
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { executeWorkflow } from '@/lib/workflow-executor'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const { workflowId } = await req.json()

    if (!workflowId) return NextResponse.json({ error: 'workflowId is required' }, { status: 400 })

    const result = await executeWorkflow(workspaceId, workflowId)

    return NextResponse.json({ data: result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
