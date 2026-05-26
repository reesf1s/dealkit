import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { dbErrResponse, ensureIndexes } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { listToday } from '@/lib/crm/core'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    ensureIndexes().catch(() => {})
    const { workspaceId } = await getWorkspaceContext(userId)
    const data = await listToday(workspaceId, userId)
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
