import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { crmActivities, crmContacts, crmDealParticipants, crmDeals } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { refreshDealSignals } from '@/lib/crm/core'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const body = await req.json()
    const contactId = body.contactId ? String(body.contactId) : ''
    if (!contactId) return NextResponse.json({ error: 'contactId is required' }, { status: 400 })

    const [deal] = await db.select({ id: crmDeals.id, companyId: crmDeals.companyId, title: crmDeals.title })
      .from(crmDeals)
      .where(and(eq(crmDeals.id, dealId), eq(crmDeals.workspaceId, workspaceId)))
      .limit(1)
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const [contact] = await db.select({ id: crmContacts.id, fullName: crmContacts.fullName })
      .from(crmContacts)
      .where(and(eq(crmContacts.id, contactId), eq(crmContacts.workspaceId, workspaceId)))
      .limit(1)
    if (!contact) return NextResponse.json({ error: 'Person not found' }, { status: 404 })

    const role = typeof body.role === 'string' && body.role.trim() ? body.role.trim() : null
    const isPrimary = Boolean(body.isPrimary)

    if (isPrimary) {
      await db.update(crmDealParticipants)
        .set({ isPrimary: false })
        .where(and(eq(crmDealParticipants.workspaceId, workspaceId), eq(crmDealParticipants.dealId, dealId)))
    }

    const [existing] = await db.select({ id: crmDealParticipants.id })
      .from(crmDealParticipants)
      .where(and(
        eq(crmDealParticipants.workspaceId, workspaceId),
        eq(crmDealParticipants.dealId, dealId),
        eq(crmDealParticipants.contactId, contactId),
      ))
      .limit(1)

    const [participant] = existing
      ? await db.update(crmDealParticipants)
        .set({ role, isPrimary })
        .where(eq(crmDealParticipants.id, existing.id))
        .returning()
      : await db.insert(crmDealParticipants).values({
        workspaceId,
        dealId,
        contactId,
        role,
        isPrimary,
      }).returning()

    await db.insert(crmActivities).values({
      workspaceId,
      dealId,
      companyId: deal.companyId,
      contactId,
      type: 'note',
      source: 'crm',
      title: existing ? `Updated person link: ${contact.fullName}` : `Linked person: ${contact.fullName}`,
      body: role ? `Role: ${role}${isPrimary ? '. Marked as primary.' : ''}` : isPrimary ? 'Marked as primary.' : null,
      occurredAt: new Date(),
      createdBy: userId,
      metadata: { contactId, participantId: participant.id, role, isPrimary },
    })

    refreshDealSignals(workspaceId, dealId).catch(error => {
      console.warn('[crm] background signal refresh failed after linking person', error)
    })

    return NextResponse.json({ data: participant }, { status: existing ? 200 : 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const body = await req.json().catch(() => ({}))
    const contactId = body.contactId ? String(body.contactId) : ''
    if (!contactId) return NextResponse.json({ error: 'contactId is required' }, { status: 400 })

    const [deal] = await db.select({ id: crmDeals.id, companyId: crmDeals.companyId })
      .from(crmDeals)
      .where(and(eq(crmDeals.id, dealId), eq(crmDeals.workspaceId, workspaceId)))
      .limit(1)
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const [contact] = await db.select({ id: crmContacts.id, fullName: crmContacts.fullName })
      .from(crmContacts)
      .where(and(eq(crmContacts.id, contactId), eq(crmContacts.workspaceId, workspaceId)))
      .limit(1)

    const [removed] = await db.delete(crmDealParticipants)
      .where(and(
        eq(crmDealParticipants.workspaceId, workspaceId),
        eq(crmDealParticipants.dealId, dealId),
        eq(crmDealParticipants.contactId, contactId),
      ))
      .returning()

    if (!removed) return NextResponse.json({ error: 'Link not found' }, { status: 404 })

    await db.insert(crmActivities).values({
      workspaceId,
      dealId,
      companyId: deal.companyId,
      contactId,
      type: 'note',
      source: 'crm',
      title: `Unlinked person: ${contact?.fullName ?? 'Person'}`,
      occurredAt: new Date(),
      createdBy: userId,
      metadata: { contactId, participantId: removed.id },
    })

    refreshDealSignals(workspaceId, dealId).catch(error => {
      console.warn('[crm] background signal refresh failed after unlinking person', error)
    })

    return NextResponse.json({ data: removed })
  } catch (err) {
    return dbErrResponse(err)
  }
}
