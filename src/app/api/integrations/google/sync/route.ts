import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { syncGoogleCalendar } from '@/lib/crm/google-calendar'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const data = await syncGoogleCalendar(workspaceId, userId)
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
