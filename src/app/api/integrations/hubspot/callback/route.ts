/**
 * GET /api/integrations/hubspot/callback?code=...&state=...
 * Exchanges the authorisation code for tokens and stores them.
 * HubSpot redirects here after the user approves access.
 */
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hubspotIntegrations } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { exchangeCode, ensureHubspotSchema } from '@/lib/hubspot'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const redirectUri = `${appUrl}/api/integrations/hubspot/callback`

  try {
    const code  = req.nextUrl.searchParams.get('code')
    const state = req.nextUrl.searchParams.get('state')
    const error = req.nextUrl.searchParams.get('error')

    if (error) {
      return NextResponse.redirect(`${appUrl}/settings?hubspot=error&reason=${encodeURIComponent(error)}`)
    }
    if (!code || !state) {
      return NextResponse.redirect(`${appUrl}/settings?hubspot=error&reason=missing_params`)
    }

    // Decode state to get workspaceId
    let stateData: { workspaceId: string; ts: number }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    } catch {
      return NextResponse.redirect(`${appUrl}/settings?hubspot=error&reason=invalid_state`)
    }

    // Verify the authenticated user actually owns/belongs to this workspace
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.redirect(`${appUrl}/sign-in`)
    }
    const ctx = await getWorkspaceContext(userId)
    if (ctx.workspaceId !== stateData.workspaceId) {
      return NextResponse.redirect(`${appUrl}/settings?hubspot=error&reason=workspace_mismatch`)
    }

    await ensureHubspotSchema()

    // Exchange code for tokens
    const tokens = await exchangeCode(code, redirectUri)

    // Upsert integration record
    await db
      .insert(hubspotIntegrations)
      .values({
        workspaceId:  stateData.workspaceId,
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt:    tokens.expiresAt,
        portalId:     tokens.portalId,
      })
      .onConflictDoUpdate({
        target: hubspotIntegrations.workspaceId,
        set: {
          accessToken:  tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt:    tokens.expiresAt,
          portalId:     tokens.portalId,
          syncError:    null,
          updatedAt:    new Date(),
        },
      })

    return NextResponse.redirect(`${appUrl}/settings?hubspot=connected`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[hubspot/callback]', msg)
    return NextResponse.redirect(`${appUrl}/settings?hubspot=error&reason=${encodeURIComponent(msg.slice(0, 100))}`)
  }
}
