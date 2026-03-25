/**
 * GET /api/integrations/slack/callback
 * OAuth callback from Slack. Exchanges the code for a bot token and stores it.
 *
 * On success: redirects to `returnTo` param (default /connections?slack=connected)
 * On error:   redirects to /connections?slack=error&reason=...
 *
 * After connecting: sends an intro DM to the installing user via the bot.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { slackConnections, slackUserMappings, linearIntegrations, dealLogs } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'
import { encrypt, getEncryptionKey } from '@/lib/encrypt'
import { exchangeOAuthCode, isSlackConfigured, slackOpenDm, slackPostMessage } from '@/lib/slack-client'
import { getWorkspaceContext } from '@/lib/workspace'
import { markdownToBlocks } from '@/lib/slack-blocks'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const connectionsUrl = `${appUrl}/connections`

  try {
    if (!isSlackConfigured()) {
      return NextResponse.redirect(`${connectionsUrl}?slack=error&reason=not_configured`)
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.redirect(`${appUrl}/sign-in`)
    }

    const error = req.nextUrl.searchParams.get('error')
    if (error) {
      return NextResponse.redirect(`${connectionsUrl}?slack=error&reason=${encodeURIComponent(error)}`)
    }

    const code = req.nextUrl.searchParams.get('code')
    if (!code) {
      return NextResponse.redirect(`${connectionsUrl}?slack=error&reason=no_code`)
    }

    // Decode state to get returnTo
    const stateParam = req.nextUrl.searchParams.get('state') ?? ''
    let returnTo = `${connectionsUrl}?slack=connected`
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
      if (decoded.returnTo) {
        returnTo = `${appUrl}${decoded.returnTo}?slack=connected`
      }
    } catch { /* use default */ }

    const wsCtx = await getWorkspaceContext(userId)
    if (!wsCtx) {
      return NextResponse.redirect(`${connectionsUrl}?slack=error&reason=no_workspace`)
    }

    const redirectUri = `${appUrl}/api/integrations/slack/callback`
    const tokenResult = await exchangeOAuthCode(code, redirectUri)

    if (!tokenResult.ok || !tokenResult.botToken || !tokenResult.slackTeamId) {
      console.error('[slack/callback] Token exchange failed:', tokenResult.error)
      return NextResponse.redirect(`${connectionsUrl}?slack=error&reason=${encodeURIComponent(tokenResult.error ?? 'token_exchange_failed')}`)
    }

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

    // Send intro DM to the installing user (non-blocking)
    const installedBySlackUserId = tokenResult.installedByUserId
    if (installedBySlackUserId) {
      // Save the Slack ↔ Clerk mapping for this user
      await db
        .insert(slackUserMappings)
        .values({
          workspaceId: wsCtx.workspaceId,
          clerkUserId: userId,
          slackUserId: installedBySlackUserId,
        })
        .onConflictDoNothing()

      // Fire intro DM (best-effort — don't block the redirect)
      sendIntroDm(tokenResult.botToken, installedBySlackUserId).catch(
        e => console.warn('[slack/callback] Intro DM failed:', e),
      )
    }

    // Smart redirect after Slack OAuth:
    // If returnTo was explicitly set (e.g. /onboarding), honour it.
    // Otherwise: check if Linear is connected and deals exist, then redirect appropriately.
    const isOnboarding = returnTo.includes('/onboarding')
    if (!isOnboarding) {
      try {
        const [linRow] = await db
          .select({ id: linearIntegrations.id })
          .from(linearIntegrations)
          .where(eq(linearIntegrations.workspaceId, wsCtx.workspaceId))
          .limit(1)

        if (!linRow) {
          return NextResponse.redirect(`${appUrl}/onboarding?step=2`)
        }

        const [{ value: dealCount }] = await db
          .select({ value: count() })
          .from(dealLogs)
          .where(eq(dealLogs.workspaceId, wsCtx.workspaceId))

        if (Number(dealCount) === 0) {
          return NextResponse.redirect(`${appUrl}/onboarding?step=3`)
        }
      } catch { /* non-fatal — fall through to default returnTo */ }
    }

    return NextResponse.redirect(returnTo)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    console.error('[slack/callback] Error:', msg, e)
    return NextResponse.redirect(`${connectionsUrl}?slack=error&reason=${encodeURIComponent(msg.slice(0, 100))}`)
  }
}

async function sendIntroDm(botToken: string, slackUserId: string): Promise<void> {
  const dmChannel = await slackOpenDm(botToken, slackUserId)
  if (!dmChannel) return

  const msg = `👋 Hi! I'm *Halvex* — your revenue-to-product loop bot.\n\nOnce you've added a deal, ask me about it here:\n\n• _"latest on Acme"_ → I'll show you deal health + matching Linear issues\n• _"yes"_ → I'll request prioritisation from your product team\n• When issues ship, I'll draft a follow-up email for you automatically\n\nLet's get started → add your first deal in the onboarding flow.`

  await slackPostMessage(
    botToken,
    dmChannel,
    markdownToBlocks(msg),
    "Hi! I'm Halvex — your revenue-to-product loop bot.",
  )
}
