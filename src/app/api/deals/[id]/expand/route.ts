import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, events } from '@/lib/db/schema'
import { dbErrResponse, ensureLinksColumn } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { rebuildWorkspaceBrain } from '@/lib/workspace-brain'

/**
 * POST /api/deals/[id]/expand
 *
 * Creates a new expansion deal (upsell, cross-sell, renewal, expansion)
 * linked to the parent won deal. Inherits company, contacts, competitors,
 * and description context from the parent.
 *
 * Body: { expansionType: 'upsell' | 'cross_sell' | 'renewal' | 'expansion',
 *         dealName?: string, dealValue?: number, description?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: parentId } = await params

    await ensureLinksColumn()

    // Fetch parent deal
    const [parent] = await db
      .select()
      .from(dealLogs)
      .where(and(eq(dealLogs.id, parentId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!parent) {
      return NextResponse.json({ error: 'Parent deal not found' }, { status: 404 })
    }

    const body = await req.json()
    const expansionType = body.expansionType ?? 'expansion'
    const EXPANSION_LABELS: Record<string, string> = {
      upsell: 'Upsell',
      cross_sell: 'Cross-sell',
      renewal: 'Renewal',
      expansion: 'Expansion',
    }
    const typeLabel = EXPANSION_LABELS[expansionType] || 'Expansion'

    const defaultName = body.dealName || `${parent.prospectCompany} — ${typeLabel}`

    const now = new Date()
    const [newDeal] = await db.insert(dealLogs).values({
      workspaceId,
      userId,
      dealName: defaultName,
      prospectCompany: parent.prospectCompany,
      prospectName: parent.prospectName,
      prospectTitle: parent.prospectTitle,
      contacts: parent.contacts ?? [],
      description: body.description || `${typeLabel} opportunity from won deal "${parent.dealName}".${parent.description ? `\n\nOriginal deal context: ${parent.description}` : ''}`,
      dealValue: body.dealValue ?? null,
      stage: 'prospecting',
      competitors: parent.competitors ?? [],
      notes: null,
      nextSteps: null,
      closeDate: null,
      dealType: expansionType === 'renewal' ? 'recurring' : (parent.dealType as string) ?? 'one_off',
      recurringInterval: expansionType === 'renewal' ? ((parent.recurringInterval as string) ?? 'annual') : null,
      parentDealId: parentId,
      expansionType,
      createdAt: now,
      updatedAt: now,
    }).returning()

    await db.insert(events).values({
      workspaceId,
      userId,
      type: 'deal_log.created',
      metadata: {
        dealLogId: newDeal.id,
        dealName: newDeal.dealName,
        parentDealId: parentId,
        parentDealName: parent.dealName,
        expansionType,
      },
      createdAt: now,
    })

    after(async () => {
      try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ }
    })

    return NextResponse.json({ data: newDeal }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
