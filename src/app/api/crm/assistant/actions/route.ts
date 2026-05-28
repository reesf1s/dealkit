import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { executeAssistantAction } from '@/lib/crm/assistant-actions'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { action, confirmed } = await req.json()
    if (!confirmed) return NextResponse.json({ error: 'Confirmation is required' }, { status: 400 })
    if (!action?.type || !action?.params) return NextResponse.json({ error: 'A proposed action is required' }, { status: 400 })

    const result = await executeAssistantAction({ action, workspaceId, userId })
    return NextResponse.json({ data: result })
  } catch (err) {
    return dbErrResponse(err)
  }
}
