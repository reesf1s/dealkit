import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { workflows } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { dbErrResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

function workflowName(trigger: string, action: string): string {
  const triggerLabels: Record<string, string> = {
    morning_8am:         'Morning briefing',
    health_drop_10:      'Health drop alert',
    feature_linked:      'Feature linked',
    linear_issue_ships:  'Issue shipped',
  }
  const actionLabels: Record<string, string> = {
    slack_dm_me:         '→ Slack DM me',
    slack_dm_owner:      '→ Slack DM deal owner',
    draft_release_email: '→ Draft release email',
  }
  return `${triggerLabels[trigger] ?? trigger} ${actionLabels[action] ?? action}`
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    const rows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.workspaceId, workspaceId))
      .orderBy(desc(workflows.createdAt))
      .catch(() => [])

    return NextResponse.json({ data: rows })
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
    const { triggerType, actionType, config } = body

    if (!triggerType || !actionType) {
      return NextResponse.json({ error: 'triggerType and actionType are required' }, { status: 400 })
    }

    const name = workflowName(triggerType, actionType)

    const [row] = await db
      .insert(workflows)
      .values({ workspaceId, name, triggerType, actionType, config: config ?? {}, enabled: true })
      .returning()

    return NextResponse.json({ data: row }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
