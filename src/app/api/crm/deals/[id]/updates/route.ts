import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { addDealUpdate } from '@/lib/crm/core'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const body = await req.json()
    if (!body.note || typeof body.note !== 'string') {
      return NextResponse.json({ error: 'note is required' }, { status: 400 })
    }
    const mode = body.mode === 'approved' ? 'approved' : 'note'
    const data = await addDealUpdate({
      workspaceId,
      userId,
      dealId: id,
      note: body.note,
      mode,
      proposedChanges: body.proposedChanges ?? null,
    })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
