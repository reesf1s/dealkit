import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { backfillLegacyDealLogs } from '@/lib/crm/core'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, role } = await getWorkspaceContext(userId)
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 })
    }
    const data = await backfillLegacyDealLogs(workspaceId, userId)
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
