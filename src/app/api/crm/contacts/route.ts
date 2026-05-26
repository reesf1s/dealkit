import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { createNativeContact, listContacts } from '@/lib/crm/core'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const data = await listContacts(workspaceId, userId)
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
    if (!body.fullName) return NextResponse.json({ error: 'fullName is required' }, { status: 400 })
    const data = await createNativeContact({
      workspaceId,
      userId,
      fullName: String(body.fullName),
      email: body.email ? String(body.email) : null,
      jobTitle: body.jobTitle ? String(body.jobTitle) : null,
      phone: body.phone ? String(body.phone) : null,
      companyName: body.companyName ? String(body.companyName) : null,
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
