import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  companyProfiles,
  competitors,
  caseStudies,
  dealLogs,
  collateral,
} from '@/lib/db/schema'

// GET /api/export/data — fetches all user data, returns JSON file download
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [company] = await db
    .select()
    .from(companyProfiles)
    .where(eq(companyProfiles.userId, userId))
    .limit(1)

  const competitorRows = await db
    .select()
    .from(competitors)
    .where(eq(competitors.userId, userId))
    .orderBy(competitors.createdAt)

  const caseStudyRows = await db
    .select()
    .from(caseStudies)
    .where(eq(caseStudies.userId, userId))
    .orderBy(caseStudies.createdAt)

  const dealRows = await db
    .select()
    .from(dealLogs)
    .where(eq(dealLogs.userId, userId))
    .orderBy(dealLogs.createdAt)

  // Exclude content blob to keep size small
  const collateralRows = await db
    .select({
      id: collateral.id,
      userId: collateral.userId,
      type: collateral.type,
      title: collateral.title,
      status: collateral.status,
      sourceCompetitorId: collateral.sourceCompetitorId,
      sourceCaseStudyId: collateral.sourceCaseStudyId,
      sourceDealLogId: collateral.sourceDealLogId,
      generatedAt: collateral.generatedAt,
      createdAt: collateral.createdAt,
      updatedAt: collateral.updatedAt,
    })
    .from(collateral)
    .where(eq(collateral.userId, userId))
    .orderBy(collateral.createdAt)

  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      company: company ?? null,
      competitors: competitorRows,
      caseStudies: caseStudyRows,
      deals: dealRows,
      collateral: collateralRows,
    },
    null,
    2,
  )

  return new NextResponse(payload, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="dealkit-export.json"',
    },
  })
}
