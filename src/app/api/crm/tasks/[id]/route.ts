export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { completeCrmTask, completeDemoCrmTask } from '@/lib/sme-crm'
import { getWorkspaceContext } from '@/lib/workspace'

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      const task = completeDemoCrmTask(id)
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      return NextResponse.json({ task })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const task = await completeCrmTask({ workspaceId, taskId: id })

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    return NextResponse.json({ task })
  } catch (error) {
    console.error('[DELETE /api/crm/tasks/[id]]', error)
    return NextResponse.json({ error: 'Unable to complete task' }, { status: 500 })
  }
}
