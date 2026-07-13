export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { logWorkspaceEvent } from '@/lib/audit'
import { deleteCrmActivity, deleteDemoCrmActivity } from '@/lib/sme-crm'
import { getWorkspaceContext } from '@/lib/workspace'

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      const activity = deleteDemoCrmActivity(id)
      if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
      return NextResponse.json({ activity })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const activity = await deleteCrmActivity({ workspaceId, activityId: id })

    if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })

    await logWorkspaceEvent({
      workspaceId,
      userId,
      type: 'crm.activity.deleted',
      metadata: {
        activityId: activity.id,
        title: activity.title,
        companyName: activity.companyName,
        activityType: activity.type,
      },
    })

    return NextResponse.json({ activity })
  } catch (error) {
    console.error('[DELETE /api/crm/activities/[id]]', error)
    return NextResponse.json({ error: 'Unable to delete activity' }, { status: 500 })
  }
}
