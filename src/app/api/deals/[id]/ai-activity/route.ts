/**
 * GET /api/deals/[id]/ai-activity — fetch MCP action log entries for a deal
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { db } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { dealLogs, mcpActionLog } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { workspaceId } = await getWorkspaceContext(userId)

    // Verify deal belongs to workspace
    const [deal] = await db
      .select({ id: dealLogs.id })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const actions = await db
      .select({
        id: mcpActionLog.id,
        actionType: mcpActionLog.actionType,
        triggeredBy: mcpActionLog.triggeredBy,
        status: mcpActionLog.status,
        payload: mcpActionLog.payload,
        result: mcpActionLog.result,
        createdAt: mcpActionLog.createdAt,
      })
      .from(mcpActionLog)
      .where(and(eq(mcpActionLog.dealId, id), eq(mcpActionLog.workspaceId, workspaceId)))
      .orderBy(desc(mcpActionLog.createdAt))
      .limit(50)

    return NextResponse.json({ data: actions })
  } catch (err) {
    return dbErrResponse(err)
  }
}
