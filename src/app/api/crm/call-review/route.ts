export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

import { logWorkspaceEvent } from '@/lib/audit'
import { analyzeCallTranscript, callAnalysisToActivity, callAnalysisToTask } from '@/lib/call-intelligence'
import {
  addDemoCrmActivity,
  addDemoCrmTask,
  createCrmActivity,
  createCrmTask,
  getDemoCrmLead,
  getLeadForWorkspace,
  type CrmLeadDto,
} from '@/lib/sme-crm'
import { getWorkspaceContext } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { leadId?: unknown; transcript?: unknown; commit?: unknown }
    if (typeof body.transcript !== 'string' || body.transcript.trim().length < 40) {
      return NextResponse.json({ error: 'Transcript must be at least 40 characters' }, { status: 400 })
    }
    if (typeof body.leadId !== 'string') return NextResponse.json({ error: 'leadId is required' }, { status: 400 })

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      const lead = getDemoCrmLead(body.leadId) as CrmLeadDto | undefined
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      const analysis = analyzeCallTranscript({ transcript: body.transcript, lead })
      if (body.commit !== true) return NextResponse.json({ analysis, lead })
      const activity = addDemoCrmActivity(callAnalysisToActivity({ analysis, lead, transcript: body.transcript }))
      const task = addDemoCrmTask(callAnalysisToTask({ analysis, lead }))
      return NextResponse.json({ analysis, lead, activity, task, committed: true })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const lead = await getLeadForWorkspace(workspaceId, body.leadId)
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const analysis = analyzeCallTranscript({ transcript: body.transcript, lead })
    if (body.commit !== true) return NextResponse.json({ analysis, lead })

    const [activity, task] = await Promise.all([
      createCrmActivity({ workspaceId, data: callAnalysisToActivity({ analysis, lead, transcript: body.transcript }) }),
      createCrmTask({ workspaceId, data: callAnalysisToTask({ analysis, lead }) }),
    ])

    await logWorkspaceEvent({
      workspaceId,
      userId,
      type: 'crm.call_review.committed',
      metadata: {
        leadId: lead.id,
        companyName: lead.companyName,
        sentiment: analysis.sentiment,
        activityId: activity.id,
        taskId: task.id,
      },
    })

    return NextResponse.json({ analysis, lead, activity, task, committed: true })
  } catch (error) {
    console.error('[POST /api/crm/call-review]', error)
    return NextResponse.json({ error: 'Unable to review call transcript' }, { status: 500 })
  }
}
