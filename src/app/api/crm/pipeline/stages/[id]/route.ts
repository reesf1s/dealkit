import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { crmPipelineStages } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, role } = await getWorkspaceContext(userId)
    if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const patch: Partial<typeof crmPipelineStages.$inferInsert> = { updatedAt: new Date() }
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
    if (body.probability !== undefined) {
      const probability = Number(body.probability)
      if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
        return NextResponse.json({ error: 'probability must be between 0 and 100' }, { status: 400 })
      }
      patch.probability = Math.round(probability)
    }
    if (Object.keys(patch).length === 1) return NextResponse.json({ error: 'No stage changes provided' }, { status: 400 })

    const [stage] = await db.update(crmPipelineStages)
      .set(patch)
      .where(and(eq(crmPipelineStages.id, id), eq(crmPipelineStages.workspaceId, workspaceId)))
      .returning()
    if (!stage) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: stage })
  } catch (err) {
    return dbErrResponse(err)
  }
}

