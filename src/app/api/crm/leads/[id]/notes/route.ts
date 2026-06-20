export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { saveDemoCrmLeadNotes, updateLeadNotes } from '@/lib/sme-crm'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({})) as { notes?: unknown }
    if (typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'notes must be a string' }, { status: 400 })
    }

    const { id } = await context.params

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      const lead = saveDemoCrmLeadNotes({ leadId: id, notes: body.notes })
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      return NextResponse.json({ lead })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const lead = await updateLeadNotes({ workspaceId, leadId: id, notes: body.notes })

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    return NextResponse.json({ lead })
  } catch (error) {
    console.error('[PATCH /api/crm/leads/[id]/notes]', error)
    return NextResponse.json({ error: 'Unable to save notes' }, { status: 500 })
  }
}
