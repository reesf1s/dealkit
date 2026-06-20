export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { getDemoAuditEvents, getWorkspaceAuditEvents } from '@/lib/audit'
import { getDemoCrmWorkspacePayload } from '@/lib/sme-crm'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET() {
  try {
    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      return NextResponse.json({ events: getDemoAuditEvents(getDemoCrmWorkspacePayload()) })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)

    return NextResponse.json({ events: await getWorkspaceAuditEvents(workspaceId) }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[GET /api/crm/audit]', error)
    return NextResponse.json({ error: 'Unable to load audit events' }, { status: 500 })
  }
}
