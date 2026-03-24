/**
 * GET /api/integrations/slack/callback
 * OAuth callback from Slack. Exchanges the code for a bot token and stores it.
 *
 * On success: redirects to /settings?slack=connected
 * On error:   redirects to /settings?slack=error&reason=...
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { slackConnections } from '@/lib/db/schema'
import { encrypt, getEncryptionKey } from '@/lib/encrypt'
import { exchangeOAuthCode, isSlackConfigured } from '@/lib/slack-client'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const settingsUrl = `${appUrl}/settings`

  try {
    // Slack app configured?
    if (!isSlackConfigured()) {
      return NextResponse.redirect(`${settingsUrl}?slack=error&reason=not_configured`)
    }

    // Clerk auth
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.redirect(`${appUrl}/sign-in`)
    }

    // Check for Slack error in callback
    const error = req.nextUrl.searchParams.get('error')
    if (error) {
      console.warn('[slack/callback] Slack returned error:', error)
      return NextResponse.redirect(`${settingsUrl}?slack=error&reason=${encodeURIComponent(error)}`)
    }

    const code = req.nextUrl.searchParams.get('code')
    if (!code) {
      return NextResponse.redirect(`${settingsUrl}?slack=error&reason=no_code`)
    }

    // Get workspace
    const wsCtx = await getWorkspaceContext(userId)
    if (!wsCtx) {
      return NextResponse.redirect(`${settingsUrl}?slack=error&reason=no_workspace`)
    }

    // Exchange code for bot token
    const redirectUri = `${appUrl}/api/integrations/slack/callback`
    const tokenResult = await exchangeOAuthCode(code, redirectUri)

    if (!tokenResult.ok || !tokenResult.botToken || !tokenResult.slackTeamId) {
      console.error('[slack/callback] Token exchange failed:', tokenResult.error)
      return NextResponse.redirect(`${settingsUrl}?slack=error&reason=${encodeURIComponent(tokenResult.error ?? 'token_exchange_failed')}`)
    }

    // Encrypt and store
    const botTokenEnc = encrypt(tokenResult.botToken, getEncryptionKey())

    await db
      .insert(slackConnections)
      .values({
        workspaceId: wsCtx.workspaceId,
        slackTeamId: tokenResult.slackTeamId,
        slackTeamName: tokenResult.slackTeamName ?? null,
        botTokenEnc,
        installedBy: userId,
      })
      .onConflictDoUpdate({
        target: slackConnections.workspaceId,
        set: {
          slackTeamId: tokenResult.slackTeamId,
          slackTeamName: tokenResult.slackTeamName ?? null,
          botTokenEnc,
          installedBy: userId,
        },
      })

    console.log(`[slack/callback] Installed for workspace ${wsCtx.workspaceId}, team ${tokenResult.slackTeamId}`)
    return NextResponse.redirect(`${settingsUrl}?slack=connected`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    console.error('[slack/callback] Error:', msg, e)
    return NextResponse.redirect(`${settingsUrl}?slack=error&reason=${encodeURIComponent(msg.slice(0, 100))}`)
  }
}
