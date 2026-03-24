/**
 * GET /api/integrations/slack/install
 * Redirects the user to Slack's OAuth authorization page.
 * After authorization, Slack sends the user back to /api/integrations/slack/callback.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSlackConfigured, getSlackClientId } from '@/lib/slack-client'

export async function GET() {
  // Auth check
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Guard: Slack app must be configured
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
    // Include user scope for mapping Slack user → Clerk user
    user_scope: 'identity.basic,identity.email',
  })

  return NextResponse.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`)
}
