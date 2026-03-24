/**
 * GET /api/integrations/slack/install
 * Redirects the user to Slack's OAuth authorization page.
 * After authorization, Slack sends the user back to /api/integrations/slack/callback.
 *
 * Query params:
 *   returnTo — optional path to redirect to after successful connection (e.g. /onboarding)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSlackConfigured, getSlackClientId } from '@/lib/slack-client'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isSlackConfigured()) {
    return NextResponse.json(
      { error: 'Slack app not configured. Add SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_SIGNING_SECRET to your environment.' },
      { status: 503 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (!appUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL env var is not set' }, { status: 503 })
  }

  const returnTo = req.nextUrl.searchParams.get('returnTo') ?? ''
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64url')

  const redirectUri = `${appUrl}/api/integrations/slack/callback`
  const scopes = [
    'chat:write',
    'commands',
    'im:history',
    'im:read',
    'im:write',
    'app_mentions:read',
  ].join(',')

  const params = new URLSearchParams({
    client_id: getSlackClientId(),
    scope: scopes,
    redirect_uri: redirectUri,
    user_scope: 'identity.basic,identity.email',
    state,
  })

  return NextResponse.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`)
}
