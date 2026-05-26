import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { createNativeCompany, listCompanies } from '@/lib/crm/core'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const data = await listCompanies(workspaceId, userId)
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
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const data = await createNativeCompany({
      workspaceId,
      userId,
      name: String(body.name),
      domain: body.domain ? String(body.domain) : null,
      website: body.website ? String(body.website) : null,
      industry: body.industry ? String(body.industry) : null,
      sizeLabel: body.sizeLabel ? String(body.sizeLabel) : null,
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
