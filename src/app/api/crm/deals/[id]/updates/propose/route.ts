import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { getDealContextNative } from '@/lib/crm/core'
import { proposeDealUpdateWithAI } from '@/lib/crm/ai'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, plan } = await getWorkspaceContext(userId)
    const { id } = await params
    const { note } = await req.json()
    if (!note || typeof note !== 'string') {
      return NextResponse.json({ error: 'note is required' }, { status: 400 })
    }
    const context = await getDealContextNative(id, workspaceId)
    if (!context) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const data = await proposeDealUpdateWithAI(note, context, plan)
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
