export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { addDemoCrmTask, createCrmTask, type TaskMutationInput } from '@/lib/sme-crm'
import { logWorkspaceEvent } from '@/lib/audit'

function taskInput(body: Record<string, unknown>): TaskMutationInput {
  return {
    leadId: typeof body.leadId === 'string' ? body.leadId : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    priority: typeof body.priority === 'string' ? body.priority : undefined,
    dueAt: typeof body.dueAt === 'string' ? body.dueAt : undefined,
    companyName: typeof body.companyName === 'string' ? body.companyName : undefined,
    personName: typeof body.personName === 'string' ? body.personName : undefined,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const data = taskInput(body)
    if (!data.title?.trim()) return NextResponse.json({ error: 'Task title is required' }, { status: 400 })

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      return NextResponse.json({ task: addDemoCrmTask(data) })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const task = await createCrmTask({ workspaceId, data })
    await logWorkspaceEvent({
      workspaceId,
      userId,
      type: 'crm.task.created',
      metadata: {
        taskId: task.id,
        title: task.title,
        companyName: task.companyName,
        priority: task.priority,
      },
    })

    return NextResponse.json({ task })
  } catch (error) {
    console.error('[POST /api/crm/tasks]', error)
    return NextResponse.json({ error: 'Unable to create task' }, { status: 500 })
  }
}
