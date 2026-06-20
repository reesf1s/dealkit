export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { addDemoCrmActivity, createCrmActivity, type ActivityMutationInput } from '@/lib/sme-crm'

function activityInput(body: Record<string, unknown>): ActivityMutationInput {
  return {
    leadId: typeof body.leadId === 'string' ? body.leadId : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    body: typeof body.body === 'string' ? body.body : undefined,
    type: typeof body.type === 'string' ? body.type : undefined,
    companyName: typeof body.companyName === 'string' ? body.companyName : undefined,
    personName: typeof body.personName === 'string' ? body.personName : undefined,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const data = activityInput(body)
    if (!data.title?.trim()) return NextResponse.json({ error: 'Activity title is required' }, { status: 400 })

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      return NextResponse.json({ activity: addDemoCrmActivity(data) })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const activity = await createCrmActivity({ workspaceId, data })

    return NextResponse.json({ activity })
  } catch (error) {
    console.error('[POST /api/crm/activities]', error)
    return NextResponse.json({ error: 'Unable to create activity' }, { status: 500 })
  }
}
