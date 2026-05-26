import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, workspaceInvites, workspaceMemberships } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

async function accept(token: string) {
  const clerkUser = await currentUser()
  if (!clerkUser) return { error: 'Unauthorized' as const, status: 401 }
  const email = clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase() ?? `${clerkUser.id}@clerk.placeholder`

  const [invite] = await db.select()
    .from(workspaceInvites)
    .where(and(eq(workspaceInvites.token, token), isNull(workspaceInvites.acceptedAt)))
    .limit(1)

  if (!invite || invite.expiresAt.getTime() < Date.now()) return { error: 'Invite not found or expired' as const, status: 404 }
  if (invite.email.toLowerCase() !== email && !email.endsWith('@clerk.placeholder')) {
    return { error: 'This invite was sent to a different email address' as const, status: 403 }
  }

  await db.insert(users).values({
    id: clerkUser.id,
    email,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: users.id,
    set: { email, updatedAt: new Date() },
  })

  await db.insert(workspaceMemberships).values({
    workspaceId: invite.workspaceId,
    userId: clerkUser.id,
    role: invite.role,
    appRole: invite.role === 'admin' ? 'admin' : 'sales',
  }).onConflictDoUpdate({
    target: [workspaceMemberships.workspaceId, workspaceMemberships.userId],
    set: { role: invite.role, appRole: invite.role === 'admin' ? 'admin' : 'sales' },
  })

  await db.update(workspaceInvites).set({ acceptedAt: new Date() }).where(eq(workspaceInvites.id, invite.id))
  return { ok: true as const }
}

export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get('token') ?? ''
    if (!token) return NextResponse.redirect(new URL('/sign-in', req.url))
    const result = await accept(token)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.redirect(new URL('/today', req.url))
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })
    const result = await accept(String(token))
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return dbErrResponse(err)
  }
}
