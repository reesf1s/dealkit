import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companyProfiles, collateral, events, users } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'

async function logEvent(userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ userId, type, metadata, createdAt: new Date() })
}

async function ensureUser(userId: string) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (!existing) {
    await db.insert(users).values({ id: userId, email: `${userId}@clerk.placeholder`, plan: 'free', createdAt: new Date(), updatedAt: new Date() })
  }
}

// GET /api/company — fetch the current user's company profile (or null)
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureUser(userId)

    const [profile] = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.userId, userId))
      .limit(1)

    return NextResponse.json({ data: profile ?? null })
  } catch (err) {
    return dbErrResponse(err)
  }
}

// POST /api/company — upsert company profile; mark all collateral as stale
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureUser(userId)

    const body = await req.json()

    const {
      companyName,
      website,
      industry,
      description,
      products,
      valuePropositions,
      differentiators,
      commonObjections,
      targetMarket,
      competitiveAdvantage,
      founded,
      employeeCount,
    } = body

    if (!companyName) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
    }

    const now = new Date()

    const [existing] = await db
      .select({ id: companyProfiles.id })
      .from(companyProfiles)
      .where(eq(companyProfiles.userId, userId))
      .limit(1)

    let profile

    if (existing) {
      const [updated] = await db
        .update(companyProfiles)
        .set({
          companyName,
          website: website ?? null,
          industry: industry ?? null,
          description: description ?? null,
          products: products ?? [],
          valuePropositions: valuePropositions ?? [],
          differentiators: differentiators ?? [],
          commonObjections: commonObjections ?? [],
          targetMarket: targetMarket ?? null,
          competitiveAdvantage: competitiveAdvantage ?? null,
          founded: founded ?? null,
          employeeCount: employeeCount ?? null,
          updatedAt: now,
        })
        .where(eq(companyProfiles.userId, userId))
        .returning()
      profile = updated
    } else {
      const [created] = await db
        .insert(companyProfiles)
        .values({
          userId,
          companyName,
          website: website ?? null,
          industry: industry ?? null,
          description: description ?? null,
          products: products ?? [],
          valuePropositions: valuePropositions ?? [],
          differentiators: differentiators ?? [],
          commonObjections: commonObjections ?? [],
          targetMarket: targetMarket ?? null,
          competitiveAdvantage: competitiveAdvantage ?? null,
          founded: founded ?? null,
          employeeCount: employeeCount ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      profile = created
    }

    // Mark all ready collateral as stale — company context has changed
    await db
      .update(collateral)
      .set({ status: 'stale', updatedAt: now })
      .where(eq(collateral.userId, userId))

    await logEvent(userId, 'company_profile.updated', { companyName })

    return NextResponse.json({ data: profile })
  } catch (err) {
    return dbErrResponse(err)
  }
}

// PUT /api/company — alias for POST (same upsert logic)
export const PUT = POST
