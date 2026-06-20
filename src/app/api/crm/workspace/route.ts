export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { ensureCrmSeeded, getCrmWorkspacePayload, getDemoCrmWorkspaceState } from '@/lib/sme-crm'

export async function GET() {
  try {
    if (process.env.NODE_ENV !== 'production' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      return NextResponse.json(getDemoCrmWorkspaceState())
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    await ensureCrmSeeded(workspaceId, userId)

    return NextResponse.json(await getCrmWorkspacePayload(workspaceId))
  } catch (error) {
    console.error('[GET /api/crm/workspace]', error)
    return NextResponse.json(
      { error: 'Unable to load CRM workspace', details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined },
      { status: 500 },
    )
  }
}
