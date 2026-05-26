import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse, ensureIndexes } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { createNativeDeal, listPipeline } from '@/lib/crm/core'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    ensureIndexes().catch(() => {})
    const { workspaceId } = await getWorkspaceContext(userId)
    const data = await listPipeline(workspaceId, userId)
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
    if (!body.title || !body.companyName) {
      return NextResponse.json({ error: 'title and companyName are required' }, { status: 400 })
    }
    const deal = await createNativeDeal({
      workspaceId,
      userId,
      title: String(body.title),
      companyName: String(body.companyName),
      valueAmount: body.valueAmount === undefined || body.valueAmount === null ? null : Number(body.valueAmount),
      expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
    })
    return NextResponse.json({ data: deal }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
