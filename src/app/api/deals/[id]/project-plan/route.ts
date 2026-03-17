import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { rebuildWorkspaceBrain } from '@/lib/workspace-brain'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

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

/** Robustly extract the first valid JSON object from a string */
function extractJsonFromText(text: string): any {
  // 1. Try direct parse
  try { return JSON.parse(text.trim()) } catch {}
  // 2. Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceStripped = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim()
  try { return JSON.parse(fenceStripped) } catch {}
  // 3. Find first { to last } and parse that slice
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch {}
  }
  throw new Error('No JSON found in response')
}

// POST: Parse pasted text/table into structured project plan using AI
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(userId, 'project-plan:parse', 5)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
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
      ? `\n\nExisting deal to-dos (link relevant tasks using these IDs):\n${existingTodos.map((t: any) => `- ID: ${t.id} | "${t.text}" | Done: ${t.done}`).join('\n')}`
      : ''

    const extractMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `You are a project plan extractor for a sales deal management tool.
Your job is to convert ANY format of input (tables, emails, meeting notes, spreadsheet data, free text) into a structured project plan JSON.
You MUST respond with ONLY a valid JSON object — no explanation, no preamble, no markdown fences, just the raw JSON.`,
      messages: [{
        role: 'user',
        content: `Convert this input into a project plan for the deal with "${deal.prospectCompany}".

The input may be a table, spreadsheet, meeting notes, or any format. Extract all tasks/calls/meetings and group them into logical phases based on timing or theme.

For tables: each row is typically a task. Column headers give you field names. Parse dates intelligently.
For calls/meetings: "Internal" = internal task, "External" = customer-facing task.
Owner inference: if "Internal" → internal team; if "External" → both parties.
Status: blank/no status → "not_started"; explicitly done → "complete".
${todoContext}

Return this exact JSON structure (use short unique IDs like "p1", "p2", "t1", "t2" etc):
{
  "title": "Project Plan — [short descriptive title based on content]",
  "phases": [
    {
      "id": "p1",
      "name": "Phase name",
      "description": "Brief description of this phase",
      "order": 1,
      "targetDate": "YYYY-MM-DD or null",
      "tasks": [
        {
          "id": "t1",
          "text": "Clear task description",
          "status": "not_started",
          "owner": "person or team name, or null",
          "dueDate": "YYYY-MM-DD or null",
          "linkedTodoId": null,
          "notes": "any extra context like availability windows, or null"
        }
      ]
    }
  ]
}

Input to parse:
${text.slice(0, 8000)}`,
      }],
    })

    let parsed: any
    try {
      const raw = (extractMsg.content[0] as { type: string; text: string }).text
      parsed = extractJsonFromText(raw)
    } catch {
      // Log the raw response to help debug, then return a clear error
      console.error('Project plan parse failed. Raw AI response:', (extractMsg.content[0] as any)?.text?.slice(0, 500))
      return NextResponse.json({ error: 'The AI could not extract a structured plan from this input. Try pasting the content as plain text or with clearer column headers.' }, { status: 422 })
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
      updated.phases = (updated.phases ?? []).map((p: any) => ({
        ...p,
        tasks: (p.tasks ?? []).filter((t: any) => t.id !== deleteTaskId),
      }))
    }

    // Delete a phase
    else if (deletePhaseId) {
      updated.phases = (updated.phases ?? []).filter((p: any) => p.id !== deletePhaseId)
      updated.phases = updated.phases.map((p: any, i: number) => ({ ...p, order: i + 1 }))
    }

    // Add a task to a phase
    else if (addTask && phaseId) {
      updated.phases = (updated.phases ?? []).map((p: any) =>
        p.id === phaseId
          ? { ...p, tasks: [...(p.tasks ?? []), { id: crypto.randomUUID(), text: addTask, status: 'not_started', ...body.taskData }] }
          : p
      )
    }

    // Add a new phase
    else if (addPhase) {
      if (!updated.phases) updated.phases = []
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
      updated.phases = (updated.phases ?? [])
        .map((p: any) => ({ ...p, order: orderMap.get(p.id) ?? p.order }))
        .sort((a: any, b: any) => a.order - b.order)
    }

    // Update a specific task
    else if (taskId) {
      updated.phases = (updated.phases ?? []).map((p: any) => ({
        ...p,
        tasks: (p.tasks ?? []).map((t: any) => {
          if (t.id !== taskId) return t
          const upd = { ...t }
          if (status !== undefined) upd.status = status
          if (linkedTodoId !== undefined) upd.linkedTodoId = linkedTodoId
          if (notes !== undefined) upd.notes = notes
          if (owner !== undefined) upd.owner = owner
          if (body.assignee !== undefined) upd.assignee = body.assignee
          if (taskText !== undefined) upd.text = taskText
          return upd
        }),
      }))
    }

    // Update a phase
    else if (phaseId) {
      updated.phases = (updated.phases ?? []).map((p: any) => {
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
