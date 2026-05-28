import { auth } from '@clerk/nextjs/server'
import { and, asc, desc, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { crmSavedViews } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const allowedObjectTypes = new Set(['deal', 'company', 'person', 'task'])

function normalizeObjectType(value: string | null) {
  const objectType = String(value ?? '').trim().toLowerCase()
  return allowedObjectTypes.has(objectType) ? objectType : null
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const objectType = normalizeObjectType(new URL(req.url).searchParams.get('objectType'))
    if (!objectType) return NextResponse.json({ error: 'Valid objectType is required' }, { status: 400 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const data = await db.select()
      .from(crmSavedViews)
      .where(and(eq(crmSavedViews.workspaceId, workspaceId), eq(crmSavedViews.objectType, objectType)))
      .orderBy(asc(crmSavedViews.position), desc(crmSavedViews.createdAt))
      .limit(24)
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    const objectType = normalizeObjectType(body.objectType)
    const label = String(body.label ?? '').trim()
    if (!objectType || !label) return NextResponse.json({ error: 'objectType and label are required' }, { status: 400 })
    const config = body.config && typeof body.config === 'object' && !Array.isArray(body.config) ? body.config : {}

    const [data] = await db.insert(crmSavedViews)
      .values({
        workspaceId,
        createdBy: userId,
        objectType,
        label,
        config,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [crmSavedViews.workspaceId, crmSavedViews.objectType, crmSavedViews.label],
        set: {
          config,
          createdBy: userId,
          updatedAt: new Date(),
        },
      })
      .returning()
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const [data] = await db.delete(crmSavedViews)
      .where(and(eq(crmSavedViews.id, id), eq(crmSavedViews.workspaceId, workspaceId)))
      .returning()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
