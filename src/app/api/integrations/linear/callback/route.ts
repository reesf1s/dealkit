/**
 * GET /api/integrations/linear/callback
 * OAuth callback from Linear. Exchanges the code for an access token and stores it.
 *
 * On success: redirects to `returnTo` param (default /connections?linear=connected)
 * On error:   redirects to /connections?linear=error&reason=...
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { linearIntegrations } from '@/lib/db/schema'
import { encrypt, getEncryptionKey } from '@/lib/encrypt'
import { getWorkspaceContext } from '@/lib/workspace'
import { validateApiKey } from '@/lib/linear-client'
import { syncLinearIssues } from '@/lib/linear-sync'

const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const connectionsUrl = `${appUrl}/connections`

  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.redirect(`${appUrl}/sign-in`)

    // Check for error from Linear
    const error = req.nextUrl.searchParams.get('error')
    if (error) {
      return NextResponse.redirect(`${connectionsUrl}?linear=error&reason=${encodeURIComponent(error)}`)
    }

    const code = req.nextUrl.searchParams.get('code')
    if (!code) {
      return NextResponse.redirect(`${connectionsUrl}?linear=error&reason=no_code`)
    }

    // Decode state to get returnTo
    const stateParam = req.nextUrl.searchParams.get('state') ?? ''
    let returnTo = connectionsUrl + '?linear=connected'
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
      if (decoded.returnTo) {
        returnTo = `${appUrl}${decoded.returnTo}?linear=connected`
      }
    } catch { /* use default */ }

    // Workspace
    const wsCtx = await getWorkspaceContext(userId)
    if (!wsCtx) {
      return NextResponse.redirect(`${connectionsUrl}?linear=error&reason=no_workspace`)
    }

    // Exchange code for access token
    const clientId = process.env.LINEAR_CLIENT_ID
    const clientSecret = process.env.LINEAR_CLIENT_SECRET
    const redirectUri = process.env.LINEAR_REDIRECT_URI ?? `${appUrl}/api/integrations/linear/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${connectionsUrl}?linear=error&reason=not_configured`)
    }

    const tokenRes = await fetch(LINEAR_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: 'authorization_code',
      }).toString(),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text().catch(() => 'token_exchange_failed')
      console.error('[linear/callback] Token exchange failed:', tokenRes.status, err)
      return NextResponse.redirect(`${connectionsUrl}?linear=error&reason=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string }

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${connectionsUrl}?linear=error&reason=${encodeURIComponent(tokenData.error ?? 'no_token')}`)
    }

    const accessToken = tokenData.access_token

    // Validate token + get team info
    const info = await validateApiKey(accessToken)

    // Encrypt and store (same column as API key — OAuth token is functionally identical)
    const apiKeyEnc = encrypt(accessToken, getEncryptionKey())

    await db
      .insert(linearIntegrations)
      .values({
        workspaceId: wsCtx.workspaceId,
        apiKeyEnc,
        teamId: info.teamId,
        teamName: info.teamName,
        workspaceName: info.workspaceName,
        syncError: null,
      })
      .onConflictDoUpdate({
        target: linearIntegrations.workspaceId,
        set: {
          apiKeyEnc,
          teamId: info.teamId,
          teamName: info.teamName,
          workspaceName: info.workspaceName,
          syncError: null,
          updatedAt: new Date(),
        },
      })

    console.log(`[linear/callback] Connected for workspace ${wsCtx.workspaceId}, team ${info.teamName}`)

    // Sync issues in background (non-blocking)
    after(async () => {
      try { await syncLinearIssues(wsCtx.workspaceId) } catch { /* non-fatal */ }
    })

    return NextResponse.redirect(returnTo)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    console.error('[linear/callback] Error:', msg, e)
    return NextResponse.redirect(`${connectionsUrl}?linear=error&reason=${encodeURIComponent(msg.slice(0, 100))}`)
  }
}
