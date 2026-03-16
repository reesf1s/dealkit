/**
 * GET /api/integrations/hubspot/auth
 * Redirects the user to HubSpot's OAuth consent screen.
 * Encodes the workspaceId in the state param so the callback can identify the workspace.
 */
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { buildAuthUrl, ensureHubspotSchema } from '@/lib/hubspot'

export async function GET(req: NextRequest) {
  try {
    if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET) {
      return NextResponse.json({ error: 'HubSpot integration not configured — set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET env vars' }, { status: 503 })
    }
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureHubspotSchema()
    const { workspaceId } = await getWorkspaceContext(userId)

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).trim().replace(/\/$/, '')
    const redirectUri = `${appUrl}/api/integrations/hubspot/callback`

    // State encodes workspaceId — verified in callback by checking workspace ownership
    const state = Buffer.from(JSON.stringify({ workspaceId, ts: Date.now() })).toString('base64url')
    const authUrl = buildAuthUrl(redirectUri, state)

    return NextResponse.redirect(authUrl)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
