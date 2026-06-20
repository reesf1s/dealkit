export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

import { logWorkspaceEvent } from '@/lib/audit'
import { buildAutomationRecommendations, crmAutomationRules, recommendationToTask } from '@/lib/crm-automations'
import { addDemoCrmTask, createCrmTask, getCrmWorkspacePayload, getDemoCrmWorkspacePayload } from '@/lib/sme-crm'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET() {
  try {
    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      const workspace = getDemoCrmWorkspacePayload()
      return NextResponse.json({ rules: crmAutomationRules, recommendations: buildAutomationRecommendations(workspace) })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const workspace = await getCrmWorkspacePayload(workspaceId)

    return NextResponse.json({ rules: crmAutomationRules, recommendations: buildAutomationRecommendations(workspace) }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[GET /api/crm/automations]', error)
    return NextResponse.json({ error: 'Unable to load automations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { recommendationIds?: unknown }
    const selectedIds = Array.isArray(body.recommendationIds) ? new Set(body.recommendationIds.filter(id => typeof id === 'string')) : null

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      const workspace = getDemoCrmWorkspacePayload()
      const recommendations = buildAutomationRecommendations(workspace).filter(item => !selectedIds || selectedIds.has(item.id))
      const tasks = recommendations.map(item => addDemoCrmTask(recommendationToTask(item))).filter(Boolean)
      return NextResponse.json({ created: tasks.length, tasks, recommendations })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const workspace = await getCrmWorkspacePayload(workspaceId)
    const recommendations = buildAutomationRecommendations(workspace).filter(item => !selectedIds || selectedIds.has(item.id))
    const tasks = []

    for (const item of recommendations) {
      tasks.push(await createCrmTask({ workspaceId, data: recommendationToTask(item) }))
    }

    await logWorkspaceEvent({
      workspaceId,
      userId,
      type: 'crm.automation.run',
      metadata: {
        created: tasks.length,
        recommendationIds: recommendations.map(item => item.id),
        ruleIds: [...new Set(recommendations.map(item => item.ruleId))],
      },
    })

    return NextResponse.json({ created: tasks.length, tasks, recommendations })
  } catch (error) {
    console.error('[POST /api/crm/automations]', error)
    return NextResponse.json({ error: 'Unable to run automations' }, { status: 500 })
  }
}
