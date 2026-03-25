/**
 * GET /api/integrations/linear/install
 * Redirects the user to Linear's OAuth authorization page.
 * After authorization, Linear sends the user back to /api/integrations/linear/callback.
 *
 * Query params:
 *   returnTo — optional path to redirect to after successful connection (e.g. /onboarding)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.LINEAR_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'Linear OAuth not configured. Add LINEAR_CLIENT_ID to environment variables.' },
      { status: 503 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const redirectUri = process.env.LINEAR_REDIRECT_URI ?? `${appUrl}/api/integrations/linear/callback`

  const returnTo = req.nextUrl.searchParams.get('returnTo') ?? ''

  // Encode returnTo in state (Linear passes state back in callback)
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64url')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read,write,issues:create',
    state,
  })

  return NextResponse.redirect(`https://linear.app/oauth/authorize?${params.toString()}`)
}
