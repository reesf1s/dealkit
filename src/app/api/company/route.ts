import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companyProfiles, collateral, events } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

async function logEvent(workspaceId: string, userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1)
    return NextResponse.json({ data: profile ?? null })
  } catch (err) { return dbErrResponse(err) }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    const { companyName, website, industry, description, products, valuePropositions, differentiators, commonObjections, targetMarket, competitiveAdvantage, founded, employeeCount } = body
    if (!companyName) return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
    const now = new Date()
    const [existing] = await db.select({ id: companyProfiles.id }).from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1)
    let profile
    if (existing) {
      const [updated] = await db.update(companyProfiles).set({
        userId, companyName, website: website ?? null, industry: industry ?? null,
        description: description ?? null, products: products ?? [], valuePropositions: valuePropositions ?? [],
        differentiators: differentiators ?? [], commonObjections: commonObjections ?? [],
        targetMarket: targetMarket ?? null, competitiveAdvantage: competitiveAdvantage ?? null,
        founded: founded ?? null, employeeCount: employeeCount ?? null, updatedAt: now,
      }).where(eq(companyProfiles.workspaceId, workspaceId)).returning()
      profile = updated
    } else {
      const [created] = await db.insert(companyProfiles).values({
        workspaceId, userId, companyName, website: website ?? null, industry: industry ?? null,
        description: description ?? null, products: products ?? [], valuePropositions: valuePropositions ?? [],
        differentiators: differentiators ?? [], commonObjections: commonObjections ?? [],
        targetMarket: targetMarket ?? null, competitiveAdvantage: competitiveAdvantage ?? null,
        founded: founded ?? null, employeeCount: employeeCount ?? null, createdAt: now, updatedAt: now,
      }).returning()
      profile = created
    }
    await db.update(collateral).set({ status: 'stale', updatedAt: now }).where(eq(collateral.workspaceId, workspaceId))
    await logEvent(workspaceId, userId, 'company_profile.updated', { companyName })
    return NextResponse.json({ data: profile })
  } catch (err) { return dbErrResponse(err) }
}

export const PUT = POST
