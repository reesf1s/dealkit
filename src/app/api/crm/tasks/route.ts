import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { completeTask, createNativeTask, listTasks } from '@/lib/crm/core'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const status = new URL(req.url).searchParams.get('status')
    const data = await listTasks(
      workspaceId,
      userId,
      status === 'done' || status === 'cancelled' || status === 'todo' ? status : undefined,
    )
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    if (!body.taskId || body.action !== 'complete') {
      return NextResponse.json({ error: 'taskId and action=complete are required' }, { status: 400 })
    }
    const data = await completeTask(workspaceId, userId, String(body.taskId))
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    if (!body.title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    const priority = ['low', 'normal', 'high', 'urgent'].includes(body.priority) ? body.priority : 'normal'
    const data = await createNativeTask({
      workspaceId,
      userId,
      title: String(body.title),
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      priority,
      dealId: body.dealId ? String(body.dealId) : null,
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
