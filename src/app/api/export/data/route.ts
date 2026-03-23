import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companyProfiles, competitors, caseStudies, dealLogs, collateral } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { ensureLinksColumn } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const [company] = await db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1)
    const competitorRows = await db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)).orderBy(competitors.createdAt)
    const caseStudyRows = await db.select().from(caseStudies).where(eq(caseStudies.workspaceId, workspaceId)).orderBy(caseStudies.createdAt)
    await ensureLinksColumn()
    const dealRows = await db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)).orderBy(dealLogs.createdAt)
    const collateralRows = await db.select({ id: collateral.id, type: collateral.type, title: collateral.title, status: collateral.status, sourceCompetitorId: collateral.sourceCompetitorId, sourceCaseStudyId: collateral.sourceCaseStudyId, sourceDealLogId: collateral.sourceDealLogId, generatedAt: collateral.generatedAt, createdAt: collateral.createdAt, updatedAt: collateral.updatedAt }).from(collateral).where(eq(collateral.workspaceId, workspaceId)).orderBy(collateral.createdAt)
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), company: company ?? null, competitors: competitorRows, caseStudies: caseStudyRows, deals: dealRows, collateral: collateralRows }, null, 2)
    return new NextResponse(payload, { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="halvex-export.json"' } })
  } catch (err) {
    console.error('[export/data] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
