import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { caseStudies, events } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

async function logEvent(workspaceId: string, userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const [caseStudy] = await db.select().from(caseStudies).where(and(eq(caseStudies.id, id), eq(caseStudies.workspaceId, workspaceId))).limit(1)
    if (!caseStudy) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: caseStudy })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const [existing] = await db.select({ id: caseStudies.id }).from(caseStudies).where(and(eq(caseStudies.id, id), eq(caseStudies.workspaceId, workspaceId))).limit(1)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json()
    const { customerName, customerIndustry, customerSize, challenge, solution, results, metrics, generatedNarrative, isPublic } = body
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (customerName !== undefined) updateData.customerName = customerName
    if (customerIndustry !== undefined) updateData.customerIndustry = customerIndustry
    if (customerSize !== undefined) updateData.customerSize = customerSize
    if (challenge !== undefined) updateData.challenge = challenge
    if (solution !== undefined) updateData.solution = solution
    if (results !== undefined) updateData.results = results
    if (metrics !== undefined) updateData.metrics = metrics
    if (generatedNarrative !== undefined) updateData.generatedNarrative = generatedNarrative
    if (isPublic !== undefined) updateData.isPublic = isPublic
    const [updated] = await db.update(caseStudies).set(updateData).where(and(eq(caseStudies.id, id), eq(caseStudies.workspaceId, workspaceId))).returning()
    await logEvent(workspaceId, userId, 'case_study.updated', { caseStudyId: id, customerName: updated.customerName })
    return NextResponse.json({ data: updated })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const [existing] = await db.select({ id: caseStudies.id, customerName: caseStudies.customerName }).from(caseStudies).where(and(eq(caseStudies.id, id), eq(caseStudies.workspaceId, workspaceId))).limit(1)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.delete(caseStudies).where(and(eq(caseStudies.id, id), eq(caseStudies.workspaceId, workspaceId)))
    await logEvent(workspaceId, userId, 'case_study.deleted', { caseStudyId: id, customerName: existing.customerName })
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
