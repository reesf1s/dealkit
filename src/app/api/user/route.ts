import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  users,
  competitors,
  caseStudies,
  dealLogs,
  collateral,
  companyProfiles,
  events,
} from '@/lib/db/schema'

// GET /api/user — returns { data: User }
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ data: user })
}

// DELETE /api/user — deletes ALL user data then returns { ok: true }
export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Delete in dependency order (cascade handles most, but explicit is safer)
  await db.delete(events).where(eq(events.userId, userId))
  await db.delete(collateral).where(eq(collateral.userId, userId))
  await db.delete(dealLogs).where(eq(dealLogs.userId, userId))
  await db.delete(caseStudies).where(eq(caseStudies.userId, userId))
  await db.delete(competitors).where(eq(competitors.userId, userId))
  await db.delete(companyProfiles).where(eq(companyProfiles.userId, userId))
  await db.delete(users).where(eq(users.id, userId))

  return NextResponse.json({ ok: true })
}
