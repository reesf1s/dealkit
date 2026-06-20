export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { addDemoCrmMessage, createCrmMessage, type ChannelId } from '@/lib/sme-crm'

const channels = new Set(['mail', 'instagram', 'linkedin', 'webchat'])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { leadId?: unknown; channel?: unknown; text?: unknown; from?: unknown }
    if (typeof body.leadId !== 'string') return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    if (typeof body.channel !== 'string' || !channels.has(body.channel)) return NextResponse.json({ error: 'Valid channel is required' }, { status: 400 })
    if (typeof body.text !== 'string' || !body.text.trim()) return NextResponse.json({ error: 'Message text is required' }, { status: 400 })
    const from = body.from === 'ai' || body.from === 'customer' || body.from === 'rep' ? body.from : 'rep'

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      const message = addDemoCrmMessage({
        leadId: body.leadId,
        channel: body.channel as ChannelId,
        from,
        text: body.text.trim(),
      })

      if (!message) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      return NextResponse.json({
        message,
      })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const message = await createCrmMessage({
      workspaceId,
      leadId: body.leadId,
      channel: body.channel as ChannelId,
      from,
      text: body.text.trim(),
    })

    if (!message) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    return NextResponse.json({ message })
  } catch (error) {
    console.error('[POST /api/crm/messages]', error)
    return NextResponse.json({ error: 'Unable to send message' }, { status: 500 })
  }
}
