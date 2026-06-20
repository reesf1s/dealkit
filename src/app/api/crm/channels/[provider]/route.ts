export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { setChannelConnection, updateDemoChannelConnection, type ChannelId } from '@/lib/sme-crm'

const channels = new Set(['mail', 'instagram', 'linkedin', 'webchat'])

export async function PATCH(req: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await context.params
    if (!channels.has(provider)) return NextResponse.json({ error: 'Unknown channel provider' }, { status: 400 })

    const body = await req.json().catch(() => ({})) as { connected?: unknown }
    if (typeof body.connected !== 'boolean') return NextResponse.json({ error: 'connected must be a boolean' }, { status: 400 })

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      return NextResponse.json({ channel: updateDemoChannelConnection(provider as ChannelId, body.connected) })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const channel = await setChannelConnection({ workspaceId, provider: provider as ChannelId, connected: body.connected })

    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    return NextResponse.json({ channel })
  } catch (error) {
    console.error('[PATCH /api/crm/channels/[provider]]', error)
    return NextResponse.json({ error: 'Unable to update channel' }, { status: 500 })
  }
}
