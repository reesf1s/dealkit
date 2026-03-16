/**
 * GET /api/integrations/hubspot/auth
 * Deprecated — HubSpot integration now uses Private App tokens, not OAuth.
 * Redirects to settings where users can connect via the token input form.
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).trim().replace(/\/$/, '')
  return NextResponse.redirect(`${appUrl}/settings`)
}
