import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { listActivity } from '@/lib/crm/core'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const data = await listActivity(workspaceId, userId)
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
