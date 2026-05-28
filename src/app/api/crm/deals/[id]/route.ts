import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { getDealContextNative, refreshDealSignals, updateNativeDeal } from '@/lib/crm/core'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const data = await getDealContextNative(id, workspaceId)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const signals = await refreshDealSignals(workspaceId, id)
    const data = await getDealContextNative(id, workspaceId)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data, signals })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const body = await req.json()
    const status = ['open', 'won', 'lost', 'archived'].includes(body.status) ? body.status : undefined
    const data = await updateNativeDeal({
      workspaceId,
      userId,
      dealId: id,
      title: body.title === undefined ? undefined : (body.title ? String(body.title) : null),
      stageId: body.stageId === undefined ? undefined : (body.stageId ? String(body.stageId) : null),
      status,
      valueAmount: body.valueAmount === undefined ? undefined : (body.valueAmount ? Number(body.valueAmount) : null),
      expectedCloseDate: body.expectedCloseDate === undefined ? undefined : (body.expectedCloseDate ? new Date(body.expectedCloseDate) : null),
      aiNextAction: body.aiNextAction === undefined ? undefined : (body.aiNextAction ? String(body.aiNextAction) : null),
    })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
