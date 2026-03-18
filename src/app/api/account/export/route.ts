export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, companyProfiles, competitors, caseStudies, dealLogs, collateral, events, productGaps } from '@/lib/db/schema'
import { ensureLinksColumn } from '@/lib/api-helpers'

// GET /api/account/export — export all user data as JSON (GDPR right to portability)
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Export all workspace data (not just user's own rows) for full data portability
    const { getWorkspaceContext } = await import('@/lib/workspace')
    const { workspaceId } = await getWorkspaceContext(userId)

    await ensureLinksColumn()
    const [
      userRows,
      profileRows,
      competitorRows,
      caseStudyRows,
      dealRows,
      collateralRows,
      eventRows,
      gapRows,
    ] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)),
      db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)),
      db.select().from(caseStudies).where(eq(caseStudies.workspaceId, workspaceId)),
      db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)),
      db.select().from(collateral).where(eq(collateral.workspaceId, workspaceId)),
      db.select().from(events).where(eq(events.userId, userId)),
      db.select().from(productGaps).where(eq(productGaps.workspaceId, workspaceId)),
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      user: userRows[0] ?? null,
      companyProfile: profileRows[0] ?? null,
      competitors: competitorRows,
      caseStudies: caseStudyRows,
      dealLogs: dealRows,
      collateral: collateralRows,
      productGaps: gapRows,
      activityEvents: eventRows,
    }

    const json = JSON.stringify(exportData, null, 2)
    const filename = `sellsight-export-${new Date().toISOString().split('T')[0]}.json`

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(Buffer.byteLength(json, 'utf8')),
      },
    })
  } catch (e: unknown) {
    console.error('[account/export] failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
