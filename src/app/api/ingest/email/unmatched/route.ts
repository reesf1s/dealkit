export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { and, eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { unmatchedEmails, dealLogs } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { requestBrainRebuild } from '@/lib/brain-rebuild'

// GET: List unmatched emails for the current workspace
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    const emails = await db
      .select()
      .from(unmatchedEmails)
      .where(and(
        eq(unmatchedEmails.workspaceId, workspaceId),
        eq(unmatchedEmails.status, 'pending'),
      ))
      .orderBy(desc(unmatchedEmails.receivedAt))
      .limit(50)

    // Resolve suggested deal names for each email
    const allDealIds = new Set<string>()
    for (const email of emails) {
      const ids = (email.suggestedDealIds ?? []) as string[]
      ids.forEach(id => allDealIds.add(id))
    }

    let dealMap: Record<string, { id: string; dealName: string; prospectCompany: string }> = {}
    if (allDealIds.size > 0) {
      const deals = await db
        .select({
          id: dealLogs.id,
          dealName: dealLogs.dealName,
          prospectCompany: dealLogs.prospectCompany,
        })
        .from(dealLogs)
        .where(eq(dealLogs.workspaceId, workspaceId))
      dealMap = Object.fromEntries(deals.map(d => [d.id, d]))
    }

    const enriched = emails.map(email => ({
      ...email,
      suggestedDeals: ((email.suggestedDealIds ?? []) as string[])
        .map(id => dealMap[id])
        .filter(Boolean),
    }))

    // Also return total pending count
    const pendingCount = emails.length

    return NextResponse.json({ data: enriched, pendingCount })
  } catch (err) {
    console.error('[unmatched-emails] GET error:', err)
    return dbErrResponse(err)
  }
}

// PATCH: Assign an unmatched email to a deal
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    const { emailId, dealId } = await req.json()
    if (!emailId || !dealId) {
      return NextResponse.json({ error: 'emailId and dealId are required' }, { status: 400 })
    }

    // Verify the email belongs to this workspace and is pending
    const [email] = await db
      .select()
      .from(unmatchedEmails)
      .where(and(
        eq(unmatchedEmails.id, emailId),
        eq(unmatchedEmails.workspaceId, workspaceId),
        eq(unmatchedEmails.status, 'pending'),
      ))
      .limit(1)

    if (!email) {
      return NextResponse.json({ error: 'Email not found or already resolved' }, { status: 404 })
    }

    // Verify the deal belongs to this workspace
    const [deal] = await db
      .select({
        id: dealLogs.id,
        meetingNotes: dealLogs.meetingNotes,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Append the email content to the deal's notes
    const noteBlock = `[Email from ${email.fromName ?? email.fromEmail}] ${email.subject ?? '(no subject)'}\n\n${email.body ?? ''}`
    const currentNotes = (deal.meetingNotes as string) ?? ''
    const newNotes = currentNotes
      ? `${currentNotes}\n---\n${noteBlock}`
      : noteBlock

    await db
      .update(dealLogs)
      .set({
        meetingNotes: newNotes,
        noteSource: 'email',
        updatedAt: new Date(),
      })
      .where(eq(dealLogs.id, dealId))

    // Mark the email as assigned
    await db
      .update(unmatchedEmails)
      .set({
        status: 'assigned',
        assignedDealId: dealId,
        resolvedAt: new Date(),
      })
      .where(eq(unmatchedEmails.id, emailId))

    // Trigger brain rebuild in background
    after(async () => {
      await requestBrainRebuild(workspaceId, `unmatched_email_assigned:${dealId}`)
    })

    return NextResponse.json({ ok: true, dealId })
  } catch (err) {
    console.error('[unmatched-emails] PATCH error:', err)
    return dbErrResponse(err)
  }
}

// DELETE: Dismiss an unmatched email
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    const { emailId } = await req.json()
    if (!emailId) {
      return NextResponse.json({ error: 'emailId is required' }, { status: 400 })
    }

    const [email] = await db
      .select({ id: unmatchedEmails.id })
      .from(unmatchedEmails)
      .where(and(
        eq(unmatchedEmails.id, emailId),
        eq(unmatchedEmails.workspaceId, workspaceId),
        eq(unmatchedEmails.status, 'pending'),
      ))
      .limit(1)

    if (!email) {
      return NextResponse.json({ error: 'Email not found or already resolved' }, { status: 404 })
    }

    await db
      .update(unmatchedEmails)
      .set({
        status: 'dismissed',
        resolvedAt: new Date(),
      })
      .where(eq(unmatchedEmails.id, emailId))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[unmatched-emails] DELETE error:', err)
    return dbErrResponse(err)
  }
}
