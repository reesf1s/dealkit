import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral } from '@/lib/db/schema'
import type { CollateralType, CollateralStatus } from '@/types'

// GET /api/collateral — list collateral with optional type and status filters
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const typeFilter = searchParams.get('type') as CollateralType | null
  const statusFilter = searchParams.get('status') as CollateralStatus | null

  const conditions = [eq(collateral.userId, userId)]

  if (typeFilter) {
    conditions.push(eq(collateral.type, typeFilter))
  }
  if (statusFilter) {
    conditions.push(eq(collateral.status, statusFilter))
  }

  const rows = await db
    .select()
    .from(collateral)
    .where(and(...conditions))
    .orderBy(collateral.createdAt)

  return NextResponse.json({ data: rows })
}
