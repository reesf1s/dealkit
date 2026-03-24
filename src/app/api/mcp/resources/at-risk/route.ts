/**
 * GET /api/mcp/resources/at-risk
 *
 * MCP resource: deals below health threshold that need attention.
 * Auth: Authorization: Bearer <mcp_api_key>
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { ensureIndexes } from '@/lib/api-helpers'
import { findAtRiskDeals } from '@/lib/mcp-tools'

export const maxDuration = 60

async function resolveWorkspace(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return null

  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.mcpApiKey, token))
    .limit(1)

  return ws?.id ?? null
}

export async function GET(req: NextRequest) {
  await ensureIndexes()

  const workspaceId = await resolveWorkspace(req)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const deals = await findAtRiskDeals(workspaceId)

  return NextResponse.json({
    uri: '/api/mcp/resources/at-risk',
    mimeType: 'application/json',
    data: deals,
    count: deals.length,
  })
}
