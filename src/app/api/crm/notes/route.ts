import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { dbErrResponse } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { crmActivities, crmNotes } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const search = new URL(req.url).searchParams
    const dealId = search.get('dealId')
    const companyId = search.get('companyId')
    const contactId = search.get('contactId')
    const conditions = [eq(crmNotes.workspaceId, workspaceId)]
    if (dealId) conditions.push(eq(crmNotes.dealId, dealId))
    if (companyId) conditions.push(eq(crmNotes.companyId, companyId))
    if (contactId) conditions.push(eq(crmNotes.contactId, contactId))
    const data = await db.select().from(crmNotes).where(and(...conditions)).orderBy(desc(crmNotes.createdAt)).limit(50)
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
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    if (!note) return NextResponse.json({ error: 'note is required' }, { status: 400 })
    const [data] = await db.insert(crmNotes).values({
      workspaceId,
      dealId: body.dealId ? String(body.dealId) : null,
      companyId: body.companyId ? String(body.companyId) : null,
      contactId: body.contactId ? String(body.contactId) : null,
      body: note,
      createdBy: userId,
    }).returning()

    await db.insert(crmActivities).values({
      workspaceId,
      dealId: data.dealId,
      companyId: data.companyId,
      contactId: data.contactId,
      type: 'note',
      source: 'manual',
      title: 'Added note',
      body: note,
      occurredAt: new Date(),
      createdBy: userId,
      metadata: { noteId: data.id },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
