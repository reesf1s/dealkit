import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { crmActivities, crmCompanies, crmContacts } from '@/lib/db/schema'
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

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    const id = body.id ? String(body.id) : ''
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (body.fullName !== undefined && !String(body.fullName).trim()) {
      return NextResponse.json({ error: 'fullName cannot be empty' }, { status: 400 })
    }

    let companyId: string | null | undefined
    if (body.companyId !== undefined) {
      companyId = body.companyId ? String(body.companyId) : null
      if (companyId) {
        const [company] = await db.select({ id: crmCompanies.id })
          .from(crmCompanies)
          .where(and(eq(crmCompanies.id, companyId), eq(crmCompanies.workspaceId, workspaceId)))
          .limit(1)
        if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
      }
    } else if (body.companyName !== undefined) {
      const companyName = String(body.companyName ?? '').trim()
      if (!companyName) {
        companyId = null
      } else {
        const [existing] = await db.select({ id: crmCompanies.id })
          .from(crmCompanies)
          .where(and(eq(crmCompanies.workspaceId, workspaceId), eq(crmCompanies.name, companyName)))
          .limit(1)
        if (existing) {
          companyId = existing.id
        } else {
          const [company] = await db.insert(crmCompanies).values({
            workspaceId,
            name: companyName,
            source: 'manual',
            ownerId: userId,
          }).returning({ id: crmCompanies.id })
          companyId = company.id
        }
      }
    }

    const patch: Partial<typeof crmContacts.$inferInsert> = { updatedAt: new Date() }
    if (body.fullName !== undefined) patch.fullName = String(body.fullName).trim()
    if (body.email !== undefined) patch.email = body.email ? String(body.email).trim() : null
    if (body.phone !== undefined) patch.phone = body.phone ? String(body.phone).trim() : null
    if (body.jobTitle !== undefined) patch.jobTitle = body.jobTitle ? String(body.jobTitle).trim() : null
    if (body.linkedinUrl !== undefined) patch.linkedinUrl = body.linkedinUrl ? String(body.linkedinUrl).trim() : null
    if (companyId !== undefined) patch.companyId = companyId

    const [data] = await db.update(crmContacts)
      .set(patch)
      .where(and(eq(crmContacts.id, id), eq(crmContacts.workspaceId, workspaceId)))
      .returning()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.insert(crmActivities).values({
      workspaceId,
      companyId: data.companyId,
      contactId: data.id,
      type: 'note',
      source: 'crm',
      title: 'Updated person fields',
      body: 'Person record fields were updated manually.',
      occurredAt: new Date(),
      createdBy: userId,
      metadata: { contactId: data.id },
    })

    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
