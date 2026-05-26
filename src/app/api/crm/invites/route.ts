import { randomBytes } from 'crypto'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaceInvites } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

function inviteToken() {
  return randomBytes(24).toString('hex')
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, role } = await getWorkspaceContext(userId)
    if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const data = await db
      .select()
      .from(workspaceInvites)
      .where(and(eq(workspaceInvites.workspaceId, workspaceId), isNull(workspaceInvites.acceptedAt)))
      .orderBy(desc(workspaceInvites.createdAt))

    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, role } = await getWorkspaceContext(userId)
    if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const inviteRole = body.role === 'admin' || body.role === 'member' ? body.role : 'member'
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })

    const [invite] = await db.insert(workspaceInvites).values({
      workspaceId,
      email,
      role: inviteRole,
      token: inviteToken(),
      invitedBy: userId,
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
    }).onConflictDoUpdate({
      target: [workspaceInvites.workspaceId, workspaceInvites.email],
      set: {
        role: inviteRole,
        token: inviteToken(),
        invitedBy: userId,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 14 * 86_400_000),
      },
    }).returning()

    const origin = new URL(req.url).origin
    return NextResponse.json({
      data: {
        ...invite,
        acceptUrl: `${origin}/api/crm/invites/accept?token=${invite.token}`,
      },
    }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
