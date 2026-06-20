export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { addDemoCrmLead, createCrmLead, type LeadMutationInput } from '@/lib/sme-crm'
import { getWorkspaceContext } from '@/lib/workspace'

function leadInput(body: Record<string, unknown>): LeadMutationInput {
  return {
    title: typeof body.title === 'string' ? body.title : undefined,
    owner: typeof body.owner === 'string' ? body.owner : undefined,
    companyName: typeof body.companyName === 'string' ? body.companyName : undefined,
    primaryPersonName: typeof body.primaryPersonName === 'string' ? body.primaryPersonName : undefined,
    stage: typeof body.stage === 'string' ? body.stage : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    nextStep: typeof body.nextStep === 'string' ? body.nextStep : undefined,
    valueAmount: typeof body.valueAmount === 'number' ? body.valueAmount : Number(body.valueAmount ?? NaN),
    probability: typeof body.probability === 'number' ? body.probability : Number(body.probability ?? NaN),
    channel: body.channel === 'instagram' || body.channel === 'linkedin' || body.channel === 'webchat' || body.channel === 'mail' ? body.channel : undefined,
    risk: body.risk === 'hot' || body.risk === 'warm' || body.risk === 'new' ? body.risk : undefined,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const data = leadInput(body)

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      return NextResponse.json({ lead: addDemoCrmLead(data) })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const lead = await createCrmLead({ workspaceId, ownerId: userId, data })

    return NextResponse.json({ lead })
  } catch (error) {
    console.error('[POST /api/crm/leads]', error)
    return NextResponse.json({ error: 'Unable to create lead' }, { status: 500 })
  }
}
