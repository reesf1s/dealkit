import { NextRequest, NextResponse } from 'next/server'
import { handleGoogleCallback, syncGoogleCalendar } from '@/lib/crm/google-calendar'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  if (error) return NextResponse.redirect(new URL(`/settings?google=error&reason=${encodeURIComponent(error)}`, req.url))
  if (!code || !state) return NextResponse.redirect(new URL('/settings?google=missing', req.url))

  try {
    const { workspaceId, userId } = await handleGoogleCallback(code, state)
    await syncGoogleCalendar(workspaceId, userId).catch(() => null)
    return NextResponse.redirect(new URL('/settings?google=connected', req.url))
  } catch (err) {
    console.error('[google/callback]', err)
    return NextResponse.redirect(new URL('/settings?google=error', req.url))
  }
}
