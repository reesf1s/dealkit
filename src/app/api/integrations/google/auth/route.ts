import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { buildGoogleAuthUrl } from '@/lib/crm/google-calendar'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId } = await getWorkspaceContext(userId)
  return NextResponse.redirect(buildGoogleAuthUrl(workspaceId, userId))
}
