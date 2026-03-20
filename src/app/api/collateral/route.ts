import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, lt, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral } from '@/lib/db/schema'
import type { CollateralType, CollateralStatus } from '@/types'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { searchParams } = new URL(req.url)
    const typeFilter = searchParams.get('type') as CollateralType | null
    const statusFilter = searchParams.get('status') as CollateralStatus | null
    // Expire any records stuck in 'generating' for > 2 minutes (zombie requests)
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000)
    await db.update(collateral)
      .set({ status: 'stale', updatedAt: new Date() })
      .where(and(eq(collateral.workspaceId, workspaceId), eq(collateral.status, 'generating'), lt(collateral.updatedAt, twoMinsAgo)))

    const conditions = [eq(collateral.workspaceId, workspaceId)]
    if (typeFilter) conditions.push(eq(collateral.type, typeFilter))
    if (statusFilter) conditions.push(eq(collateral.status, statusFilter))
    // Exclude archived items unless explicitly requested via ?status=archived
    if (statusFilter !== 'archived') conditions.push(ne(collateral.status, 'archived'))
    const rows = await db.select().from(collateral).where(and(...conditions)).orderBy(collateral.createdAt)
    return NextResponse.json({ data: rows })
  } catch (err) { return dbErrResponse(err) }
}
