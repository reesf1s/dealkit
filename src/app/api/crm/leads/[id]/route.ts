export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { updateCrmLead, updateDemoCrmLead, type LeadMutationInput } from '@/lib/sme-crm'
import { logWorkspaceEvent } from '@/lib/audit'

function leadInput(body: Record<string, unknown>): LeadMutationInput {
  return {
    title: typeof body.title === 'string' ? body.title : undefined,
    owner: typeof body.owner === 'string' ? body.owner : undefined,
    companyName: typeof body.companyName === 'string' ? body.companyName : undefined,
    primaryPersonName: typeof body.primaryPersonName === 'string' ? body.primaryPersonName : undefined,
    status: typeof body.status === 'string' ? body.status : undefined,
    stage: typeof body.stage === 'string' ? body.stage : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    nextStep: typeof body.nextStep === 'string' ? body.nextStep : undefined,
    valueAmount: typeof body.valueAmount === 'number' ? body.valueAmount : Number(body.valueAmount ?? NaN),
    probability: typeof body.probability === 'number' ? body.probability : Number(body.probability ?? NaN),
    channel: body.channel === 'meetings' || body.channel === 'linkedin' || body.channel === 'webchat' || body.channel === 'mail' ? body.channel : undefined,
    risk: body.risk === 'hot' || body.risk === 'warm' || body.risk === 'new' ? body.risk : undefined,
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const data = leadInput(body)
    const { id } = await context.params

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      const lead = updateDemoCrmLead({ leadId: id, data })
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      return NextResponse.json({ lead })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const lead = await updateCrmLead({ workspaceId, leadId: id, data })

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    await logWorkspaceEvent({
      workspaceId,
      userId,
      type: 'crm.lead.updated',
      metadata: {
        leadId: lead.id,
        companyName: lead.companyName,
        stage: lead.stageName,
        status: lead.status,
        valueAmount: lead.valueAmount,
        probability: lead.probability,
        risk: lead.risk,
      },
    })
    return NextResponse.json({ lead })
  } catch (error) {
    console.error('[PATCH /api/crm/leads/[id]]', error)
    return NextResponse.json({ error: 'Unable to update lead' }, { status: 500 })
  }
}
