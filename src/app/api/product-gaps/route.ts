export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productGaps, users } from '@/lib/db/schema'

async function ensureUser(userId: string) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (!existing) await db.insert(users).values({ id: userId, email: `${userId}@clerk.placeholder`, plan: 'free', createdAt: new Date(), updatedAt: new Date() })
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await ensureUser(userId)
    const gaps = await db.select().from(productGaps).where(eq(productGaps.userId, userId)).orderBy(desc(productGaps.frequency), desc(productGaps.createdAt))
    return NextResponse.json(gaps)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await ensureUser(userId)
    const body = await req.json()
    const [gap] = await db.insert(productGaps).values({ ...body, userId, createdAt: new Date(), updatedAt: new Date() }).returning()
    return NextResponse.json({ data: gap })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
