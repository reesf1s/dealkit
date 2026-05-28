import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { crmActivities, crmCompanies } from '@/lib/db/schema'
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

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    const id = body.id ? String(body.id) : ''
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    }

    const patch: Partial<typeof crmCompanies.$inferInsert> = { updatedAt: new Date() }
    if (body.name !== undefined) patch.name = String(body.name).trim()
    if (body.domain !== undefined) patch.domain = body.domain ? String(body.domain).trim() : null
    if (body.website !== undefined) patch.website = body.website ? String(body.website).trim() : null
    if (body.industry !== undefined) patch.industry = body.industry ? String(body.industry).trim() : null
    if (body.sizeLabel !== undefined) patch.sizeLabel = body.sizeLabel ? String(body.sizeLabel).trim() : null
    if (body.description !== undefined) patch.description = body.description ? String(body.description).trim() : null

    const [data] = await db.update(crmCompanies)
      .set(patch)
      .where(and(eq(crmCompanies.id, id), eq(crmCompanies.workspaceId, workspaceId)))
      .returning()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.insert(crmActivities).values({
      workspaceId,
      companyId: data.id,
      type: 'note',
      source: 'crm',
      title: 'Updated company fields',
      body: 'Company record fields were updated manually.',
      occurredAt: new Date(),
      createdBy: userId,
      metadata: { companyId: data.id },
    })

    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
