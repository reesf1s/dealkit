import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { buildGoogleAuthUrl, isGoogleCalendarConfigured } from '@/lib/crm/google-calendar'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(new URL('/settings?section=integrations&google=not_configured', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
  }
  const { workspaceId } = await getWorkspaceContext(userId)
  return NextResponse.redirect(buildGoogleAuthUrl(workspaceId, userId))
}
