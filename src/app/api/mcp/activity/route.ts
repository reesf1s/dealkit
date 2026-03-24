import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { dealLogs, dealLinearLinks, mcpActionLog } from '@/lib/db/schema'
import { eq, gte, and, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function describeAction(actionType: string, payload: any): string {
  const p = payload ?? {}
  switch (actionType) {
    case 'link_created':    return `Halvex found a product issue linked to ${p.dealName || 'a deal'} automatically`
    case 'link_confirmed':  return `Issue confirmed for ${p.dealName || 'a deal'}`
    case 'scope_issue':     return `Scoped issue "${p.issueTitle || 'feature'}" to next product cycle`
    case 'draft_email':     return `Drafted release email for ${p.dealName || 'a deal'}`
    case 'slack_notify':    return `Sent health alert to Slack for ${p.dealName || 'a deal'}`
    case 'health_alert':    return `Sent health alert — ${p.dealName || 'deal'} health dropped`
    default:                return `Halvex ran an automated action`
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const hours = parseInt(req.nextUrl.searchParams.get('hours') ?? '24', 10)
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    const items: Array<{ description: string; timestamp: string; type: string }> = []

    // MCP action log — most informative source
    const actions = await db
      .select({ actionType: mcpActionLog.actionType, payload: mcpActionLog.payload, createdAt: mcpActionLog.createdAt, status: mcpActionLog.status })
      .from(mcpActionLog)
      .where(and(eq(mcpActionLog.workspaceId, workspaceId), gte(mcpActionLog.createdAt, since)))
      .orderBy(desc(mcpActionLog.createdAt))
      .limit(15)
      .catch(() => [])

    for (const action of actions) {
      if (action.status === 'error') continue
      items.push({
        type: action.actionType,
        description: describeAction(action.actionType, action.payload),
        timestamp: action.createdAt instanceof Date ? action.createdAt.toISOString() : String(action.createdAt),
      })
    }

    // Linear links created (may not be in action log)
    const recentLinks = await db
      .select({ linearTitle: dealLinearLinks.linearTitle, createdAt: dealLinearLinks.createdAt })
      .from(dealLinearLinks)
      .where(and(eq(dealLinearLinks.workspaceId, workspaceId), gte(dealLinearLinks.createdAt, since)))
      .orderBy(desc(dealLinearLinks.createdAt))
      .limit(8)
      .catch(() => [])

    for (const link of recentLinks) {
      const title = link.linearTitle || 'a product issue'
      // Only add if not already covered by action log
      if (!items.some(i => i.description.includes(title))) {
        items.push({
          type: 'linear_link',
          description: `Halvex found "${title}" linked to a deal automatically`,
          timestamp: link.createdAt instanceof Date ? link.createdAt.toISOString() : String(link.createdAt),
        })
      }
    }

    // Sort descending by time
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({ data: items.slice(0, 12) })
  } catch {
    return NextResponse.json({ data: [] })
  }
}
