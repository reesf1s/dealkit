export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productGaps } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const gaps = await db.select().from(productGaps).where(eq(productGaps.workspaceId, workspaceId)).orderBy(desc(productGaps.frequency), desc(productGaps.createdAt))
    return NextResponse.json(gaps)
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    const { userId: _uid, workspaceId: _wid, ...rest } = body
    const [gap] = await db.insert(productGaps).values({ ...rest, workspaceId, userId, createdAt: new Date(), updatedAt: new Date() }).returning()
    return NextResponse.json({ data: gap })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
