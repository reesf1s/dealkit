/**
 * POST /api/integrations/hubspot/connect
 * Saves and validates a HubSpot Private App access token.
 * No OAuth needed — user creates a private app in their HubSpot account and pastes the token here.
 */
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { connectWithToken } from '@/lib/hubspot'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const { portalId } = await connectWithToken(workspaceId, token)

    return NextResponse.json({ data: { connected: true, portalId } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
