import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { disconnectGoogle } from '@/lib/crm/google-calendar'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    await disconnectGoogle(workspaceId, userId)
    return NextResponse.json({ data: { disconnected: true } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
