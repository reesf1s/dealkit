export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getDemoCrmViews, getWorkspaceCrmViews, saveWorkspaceCrmView } from '@/lib/crm-views'
import { getWorkspaceContext } from '@/lib/workspace'

const saveViewSchema = z.object({
  name: z.string().trim().min(2).max(48),
  description: z.string().trim().max(160).optional(),
  filters: z.record(z.string(), z.unknown()).default({}),
})

export async function GET() {
  try {
    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      return NextResponse.json({ views: getDemoCrmViews() })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    return NextResponse.json({ views: await getWorkspaceCrmViews(workspaceId) }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[GET /api/crm/views]', error)
    return NextResponse.json({ error: 'Unable to load saved views' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = saveViewSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Valid view name is required' }, { status: 400 })

    if (process.env.NODE_ENV === 'development' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      return NextResponse.json({ ok: true })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    await saveWorkspaceCrmView({
      workspaceId,
      userId,
      name: parsed.data.name,
      description: parsed.data.description,
      filters: parsed.data.filters,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/crm/views]', error)
    return NextResponse.json({ error: 'Unable to save view' }, { status: 500 })
  }
}
