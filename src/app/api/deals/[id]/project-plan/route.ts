import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { rebuildWorkspaceBrain } from '@/lib/workspace-brain'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface Params { params: Promise<{ id: string }> }

let colMigrated = false
async function ensureProjectPlanCol() {
  if (colMigrated) return
  try {
    await db.execute(sql`
      ALTER TABLE deal_logs
      ADD COLUMN IF NOT EXISTS project_plan jsonb
    `)
  } catch { /* already exists */ }
  colMigrated = true
}

// POST: Parse pasted text/table into structured project plan using AI
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    await ensureProjectPlanCol()

    const [deal] = await db.select({ id: dealLogs.id, projectPlan: dealLogs.projectPlan, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany, stage: dealLogs.stage, todos: dealLogs.todos })
      .from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const { text } = body
    if (!text?.trim()) return NextResponse.json({ error: 'Text is required' }, { status: 400 })

    // Get existing todos for linking context
    const existingTodos = (deal.todos as any[]) ?? []
    const todoContext = existingTodos.length > 0
      ? `\n\nExisting deal to-dos (you may link relevant tasks using these IDs):\n${existingTodos.map((t: any) => `- ID: ${t.id} | "${t.text}" | Done: ${t.done}`).join('\n')}`
      : ''

    const extractMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Parse this text into a structured project plan for a sales deal with "${deal.prospectCompany}".

Extract logical phases and tasks. Each task should have a clear owner if mentioned, and realistic status inference.
${todoContext}

Return ONLY valid JSON:
{
  "title": "Project Plan — [descriptive title]",
  "phases": [
    {
      "id": "uuid-string",
      "name": "Phase name",
      "description": "What this phase covers",
      "order": 1,
      "targetDate": "ISO date or null",
      "tasks": [
        {
          "id": "uuid-string",
          "text": "Task description",
          "status": "not_started|in_progress|complete",
          "owner": "person name or null",
          "dueDate": "ISO date or null",
          "linkedTodoId": "matching todo ID if relevant, or null",
          "notes": "additional context or null"
        }
      ]
    }
  ]
}

Use UUIDs for all IDs (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx, use random-looking values).
If a task clearly matches an existing to-do, set linkedTodoId to that to-do's ID.
Infer status from context: items marked done/complete → "complete", in-progress items → "in_progress", else "not_started".

Text to parse:
${text.slice(0, 6000)}`,
      }],
    })

    let parsed: any
    try {
      const raw = (extractMsg.content[0] as { type: string; text: string }).text
      parsed = JSON.parse(raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim())
    } catch {
      return NextResponse.json({ error: 'Failed to parse the text into a project plan. Try providing more structured input.' }, { status: 422 })
    }

    const now = new Date().toISOString()
    const existingPlan = deal.projectPlan as any

    // Merge: if existing plan, append new phases (don't replace)
    const projectPlan = existingPlan?.phases
      ? {
          title: parsed.title || existingPlan.title,
          createdAt: existingPlan.createdAt,
          updatedAt: now,
          sourceText: (existingPlan.sourceText ? existingPlan.sourceText + '\n---\n' : '') + text.slice(0, 3000),
          phases: [
            ...existingPlan.phases,
            ...parsed.phases.map((p: any, i: number) => ({ ...p, order: existingPlan.phases.length + i + 1 })),
          ],
        }
      : {
          title: parsed.title || `Project Plan — ${deal.prospectCompany}`,
          createdAt: now,
          updatedAt: now,
          sourceText: text.slice(0, 3000),
          phases: parsed.phases ?? [],
        }

    await db.update(dealLogs)
      .set({ projectPlan, updatedAt: new Date() } as any)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))

    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch {} })

    return NextResponse.json({ data: projectPlan })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

// PATCH: Update task status, link todos, update phases
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    await ensureProjectPlanCol()

    const [deal] = await db.select({ id: dealLogs.id, projectPlan: dealLogs.projectPlan })
      .from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const plan = deal.projectPlan as any
    if (!plan) return NextResponse.json({ error: 'No project plan exists' }, { status: 404 })

    const body = await req.json()
    const { taskId, phaseId, status, linkedTodoId, notes, owner, text: taskText, phaseName, phaseDescription, deleteTaskId, deletePhaseId, addTask, addPhase, reorderPhases } = body

    let updated = { ...plan, updatedAt: new Date().toISOString() }

    // Delete a task
    if (deleteTaskId) {
      updated.phases = updated.phases.map((p: any) => ({
        ...p,
        tasks: p.tasks.filter((t: any) => t.id !== deleteTaskId),
      }))
    }

    // Delete a phase
    else if (deletePhaseId) {
      updated.phases = updated.phases.filter((p: any) => p.id !== deletePhaseId)
      updated.phases = updated.phases.map((p: any, i: number) => ({ ...p, order: i + 1 }))
    }

    // Add a task to a phase
    else if (addTask && phaseId) {
      updated.phases = updated.phases.map((p: any) =>
        p.id === phaseId
          ? { ...p, tasks: [...(p.tasks ?? []), { id: crypto.randomUUID(), text: addTask, status: 'not_started', ...body.taskData }] }
          : p
      )
    }

    // Add a new phase
    else if (addPhase) {
      updated.phases.push({
        id: crypto.randomUUID(),
        name: addPhase.name || 'New Phase',
        description: addPhase.description || '',
        order: updated.phases.length + 1,
        tasks: [],
      })
    }

    // Reorder phases
    else if (reorderPhases) {
      const orderMap = new Map(reorderPhases.map((id: string, i: number) => [id, i + 1]))
      updated.phases = updated.phases
        .map((p: any) => ({ ...p, order: orderMap.get(p.id) ?? p.order }))
        .sort((a: any, b: any) => a.order - b.order)
    }

    // Update a specific task
    else if (taskId) {
      updated.phases = updated.phases.map((p: any) => ({
        ...p,
        tasks: p.tasks.map((t: any) => {
          if (t.id !== taskId) return t
          const upd = { ...t }
          if (status !== undefined) upd.status = status
          if (linkedTodoId !== undefined) upd.linkedTodoId = linkedTodoId
          if (notes !== undefined) upd.notes = notes
          if (owner !== undefined) upd.owner = owner
          if (taskText !== undefined) upd.text = taskText
          return upd
        }),
      }))
    }

    // Update a phase
    else if (phaseId) {
      updated.phases = updated.phases.map((p: any) => {
        if (p.id !== phaseId) return p
        const upd = { ...p }
        if (phaseName !== undefined) upd.name = phaseName
        if (phaseDescription !== undefined) upd.description = phaseDescription
        return upd
      })
    }

    await db.update(dealLogs)
      .set({ projectPlan: updated, updatedAt: new Date() } as any)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))

    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch {} })

    return NextResponse.json({ data: updated })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

// DELETE: Remove entire project plan
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    await ensureProjectPlanCol()

    await db.update(dealLogs)
      .set({ projectPlan: null, updatedAt: new Date() } as any)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))

    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch {} })

    return NextResponse.json({ data: null })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
