export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { ensureCrmSeeded, getCrmWorkspacePayload, getDemoCrmWorkspaceState, getSeedCrmWorkspacePayload } from '@/lib/sme-crm'

export async function GET() {
  try {
    if (process.env.HALVEX_DEMO_MODE === '1' || (process.env.NODE_ENV !== 'production' && process.env.HALVEX_LOCAL_DATABASE !== '1')) {
      return NextResponse.json(getDemoCrmWorkspaceState(), {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress

    try {
      const { workspaceId } = await getWorkspaceContext(userId, email)
      await ensureCrmSeeded(workspaceId, userId)

      return NextResponse.json(await getCrmWorkspacePayload(workspaceId), {
        headers: { 'Cache-Control': 'no-store' },
      })
    } catch (databaseError) {
      console.error('[GET /api/crm/workspace] database fallback', databaseError)
      return NextResponse.json(getSeedCrmWorkspacePayload(), {
        headers: {
          'Cache-Control': 'no-store',
          'X-Halvex-Data-Source': 'seeded-fallback',
        },
      })
    }
  } catch (error) {
    console.error('[GET /api/crm/workspace]', error)
    return NextResponse.json(
      { error: 'Unable to load CRM workspace', details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined },
      { status: 500 },
    )
  }
}
