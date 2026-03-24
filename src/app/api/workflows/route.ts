/**
 * /api/workflows — CRUD for workspace automation workflows
 *
 * GET    — list all workflows for the authenticated workspace
 * POST   — create a new workflow
 * PATCH  — update a workflow (toggle enabled, update name/config)
 * DELETE — remove a workflow by id (?id=...)
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workflows } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

// ── GET — list workflows ──────────────────────────────────────────────────────

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    const rows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.workspaceId, workspaceId))
      .orderBy(workflows.createdAt)

    return NextResponse.json({ data: rows })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// ── POST — create workflow ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()

    const { name, description, triggerType, triggerConfig, actions, outputTarget } = body
    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const [created] = await db
      .insert(workflows)
      .values({
        workspaceId,
        name: name.trim(),
        description: description ?? null,
        triggerType: triggerType ?? 'manual',
        triggerConfig: triggerConfig ?? {},
        actions: actions ?? [],
        outputTarget: outputTarget ?? 'today_tab',
        isEnabled: false,
      })
      .returning()

    return NextResponse.json({ data: created })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// ── PATCH — update workflow ───────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Only allow safe fields to be patched
    const patch: Record<string, unknown> = {}
    if (typeof updates.isEnabled === 'boolean') patch.isEnabled = updates.isEnabled
    if (typeof updates.name === 'string') patch.name = updates.name.trim()
    if (typeof updates.description === 'string') patch.description = updates.description
    if (updates.triggerType) patch.triggerType = updates.triggerType
    if (updates.triggerConfig) patch.triggerConfig = updates.triggerConfig
    if (updates.actions) patch.actions = updates.actions
    if (updates.outputTarget) patch.outputTarget = updates.outputTarget
    if (updates.lastOutput) patch.lastOutput = updates.lastOutput
    if (updates.lastRunAt) patch.lastRunAt = new Date(updates.lastRunAt)

    const [updated] = await db
      .update(workflows)
      .set(patch)
      .where(and(eq(workflows.id, id), eq(workflows.workspaceId, workspaceId)))
      .returning()

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ data: updated })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// ── DELETE — remove workflow ──────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    await db
      .delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.workspaceId, workspaceId)))

    return NextResponse.json({ data: { deleted: true } })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
