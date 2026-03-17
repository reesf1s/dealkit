export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { streamText, tool, jsonSchema } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain, formatBrainContext, rebuildWorkspaceBrain } from '@/lib/workspace-brain'
import type { DealSnapshot } from '@/lib/workspace-brain'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { PLAN_LIMITS } from '@/lib/stripe/plans'
import { allTools } from '@/lib/ai/tools'

// ── Types ────────────────────────────────────────────────────────────────────

interface DealContact {
  id: string
  name: string
  title?: string
  email?: string
  phone?: string
  role?: string
}

interface DealTodo {
  id: string
  text: string
  done: boolean
  createdAt: string
}

interface ProjectPlanPhase {
  name: string
  tasks: { text: string; done: boolean }[]
}

export interface PendingAction {
  type: 'todo_cleanup'
  dealId: string
  dealName: string
  removeIds: string[]
  completeIds: string[]
  removedTexts: string[]
  completedTexts: string[]
}

// ── Anthropic client ─────────────────────────────────────────────────────────

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Active deal context builder ──────────────────────────────────────────────

function buildActiveDealContext(
  brainDeal: DealSnapshot,
  fullDeal: typeof dealLogs.$inferSelect | undefined,
): string {
  const lines: string[] = ['ACTIVE DEAL CONTEXT:']

  // Core info — include ID so the agent can use it directly in tool calls
  lines.push(`- **Deal ID**: ${brainDeal.id}`)
  lines.push(`- **Deal**: ${brainDeal.name}`)
  lines.push(`- **Company**: ${brainDeal.company}`)
  lines.push(`- **Stage**: ${brainDeal.stage}`)
  if (brainDeal.dealValue != null) lines.push(`- **Value**: ${brainDeal.dealValue.toLocaleString()}`)
  if (brainDeal.conversionScore != null) lines.push(`- **Conversion Score**: ${brainDeal.conversionScore}%`)
  if (brainDeal.closeDate) lines.push(`- **Close Date**: ${brainDeal.closeDate}`)

  // Contacts
  if (fullDeal) {
    const contacts = (fullDeal.contacts as DealContact[]) ?? []
    if (contacts.length > 0) {
      lines.push('\nContacts:')
      for (const c of contacts) {
        const parts = [c.name]
        if (c.title) parts.push(c.title)
        if (c.role) parts.push(`(${c.role})`)
        lines.push(`  - ${parts.join(' — ')}`)
      }
    }
  }

  // Pending todos
  if (brainDeal.pendingTodos.length > 0) {
    lines.push('\nPending Todos:')
    for (const t of brainDeal.pendingTodos.slice(0, 10)) {
      lines.push(`  - [ ] ${t}`)
    }
  }

  // Recent notes (last 5 entries)
  if (fullDeal?.notes) {
    const noteEntries = fullDeal.notes.split(/\n---\n|\n\n/).filter(Boolean)
    const recent = noteEntries.slice(-5)
    if (recent.length > 0) {
      lines.push('\nRecent Notes:')
      for (const n of recent) {
        lines.push(`  ${n.trim().substring(0, 300)}`)
      }
    }
  }

  // Risks
  if (brainDeal.risks.length > 0) {
    lines.push('\nRisks:')
    for (const r of brainDeal.risks) {
      lines.push(`  - ${r}`)
    }
  }

  // Competitors on deal
  if (fullDeal) {
    const comps = (fullDeal.competitors as string[]) ?? []
    if (comps.length > 0) {
      lines.push(`\nCompetitors: ${comps.join(', ')}`)
    }
  }

  // Project plan progress
  if (brainDeal.projectPlanProgress) {
    const { total, complete } = brainDeal.projectPlanProgress
    const pct = total > 0 ? Math.round((complete / total) * 100) : 0
    lines.push(`\nProject Plan: ${complete}/${total} tasks complete (${pct}%)`)
  }

  // Signal summary
  if (brainDeal.signalSummary) {
    const s = brainDeal.signalSummary
    lines.push('\nSignals:')
    lines.push(`  - Momentum: ${s.momentum.toFixed(2)} | Risk: ${s.riskLevel} | Velocity: ${s.velocity}`)
    lines.push(`  - Stakeholder Depth: ${s.stakeholderDepth.toFixed(2)} | Champion Strength: ${s.championStrength.toFixed(2)}`)
    if (s.isDeteriorating) lines.push('  - WARNING: Deal is deteriorating')
    if (s.predictedCloseDays != null) lines.push(`  - Predicted close: ~${s.predictedCloseDays} days`)
  }

  return lines.join('\n')
}

// ── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(brainContext: string, activeDealContext: string): string {
  return `You are DealKit AI — a sales copilot with complete CRM access. You are the interface between the user and their pipeline intelligence brain.

═══ CORE DIRECTIVE: ACT FIRST, EXPLAIN AFTER ═══

When the user asks you to DO something, CALL THE MUTATION TOOL IMMEDIATELY.
- Do NOT stop after searching. Searching is step 1 — the mutation is the goal.
- Do NOT say "I found the deal, would you like me to...?" — just DO IT.
- Do NOT explain what you're going to do — just do it and confirm what you did.
- If you need a deal ID, search ONCE then immediately call the mutation tool with the ID.

═══ RULE #1: PRESERVE VERBATIM DETAIL ═══

This is non-negotiable. When the user provides specific text — requirements, questions, notes, names, quotes — store their EXACT wording. Never summarize, rephrase, or abstract.

BAD: "Analyze desk utilization patterns by team"
GOOD: "What percentage of the time do employees in Sydney sit at the same desk area - can we break this down by team?"

Each bullet point or question becomes its own task/criterion with the FULL original text.
Include WHO requested it in the notes field (e.g., "Requested by Morgan from Atlassian").

═══ ACTION CHAINS ═══

"Add X to project plan" → search_deals (if no active deal) → update_project_plan
"Add X to success criteria" → search_deals (if no active deal) → update_success_criteria
"Add a contact" → search_deals (if needed) → add_contact
"Update this deal" → update_deal (use activeDealId directly)
"Process these notes" → process_meeting_notes (use activeDealId)
"Fix/correct X" → correct_deal_data
"Create a deal" → create_deal (immediately, don't search first)

NEVER stop after a search step. The search finds the ID — then you MUST call the mutation tool.

═══ ACTIVE DEAL ═══

${activeDealContext || 'No active deal selected. If the user references a deal, search for it by name/company.'}

${activeDealContext ? 'The active deal ID is available to ALL tools. Use it directly — do not re-search for it.' : ''}

═══ WORKSPACE INTELLIGENCE ═══

${brainContext}

═══ BEHAVIOR RULES ═══

1. CONTEXT RETENTION: If a tool call in this conversation already identified a deal, keep using that deal ID. Don't re-search.
2. AFTER MUTATIONS: Summarize what you changed in 1-2 sentences. Don't repeat all the data back.
3. NATURAL LANGUAGE: Write like a human colleague, not a robot. "Done — added 3 tasks to the project plan" not "I have successfully updated the project plan entity with 3 new task objects."
4. RISKS vs PRODUCT GAPS: Risks = "will this deal close?" (budget freeze, champion leaving, competitor preferred). Product gaps = "our product is missing a feature the prospect needs" (no SSO, no API for X). Don't mix these up.
5. DON'T INFER WHAT ISN'T THERE: If the user adds a sales rep as a contact, that doesn't mean we lost contact with the client. Don't make assumptions — only state what the data shows.
6. CORRECTIONS: When the user says "that's wrong" or "fix this", use correct_deal_data to override the incorrect data immediately. Don't argue — just fix it.
7. DESTRUCTIVE OPS: Only warn for deletions. All other mutations should happen immediately.
8. FORMAT: Use markdown sparingly. Bold for names/values, bullets for lists. Keep it scannable.`
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return new Response('Unauthorized', { status: 401 })

    const wsCtx = await getWorkspaceContext(userId)
    if (!wsCtx) return new Response('No workspace', { status: 400 })

    const rl = await checkRateLimit(userId, 'agent', 30, 60) // 30 per minute
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    const body = await req.json()
    const { messages, activeDealId, currentPage, confirmAction } = body

    // ── Confirmed action (legacy confirmation flow) ──────────────────────────
    if (confirmAction) {
      const result = await executeConfirmedAction(
        wsCtx.workspaceId,
        userId,
        confirmAction as PendingAction,
      )
      return NextResponse.json(result)
    }

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    // ── Load workspace brain + active deal context ───────────────────────────
    const brain = await getWorkspaceBrain(wsCtx.workspaceId)
    const brainContext = brain ? formatBrainContext(brain) : 'No workspace data loaded yet.'

    let activeDealContext = ''
    if (activeDealId && brain?.deals) {
      const deal = brain.deals.find((d) => d.id === activeDealId)
      if (deal) {
        const [fullDeal] = await db
          .select()
          .from(dealLogs)
          .where(eq(dealLogs.id, activeDealId))
          .limit(1)
        activeDealContext = buildActiveDealContext(deal, fullDeal)
      }
    }

    const systemPrompt = buildSystemPrompt(brainContext, activeDealContext)

    // ── Build tool context for tool execute() calls ──────────────────────────
    const toolContext = {
      workspaceId: wsCtx.workspaceId,
      userId,
      plan: wsCtx.plan,
      brain: brain ?? null,
      activeDealId: activeDealId ?? null,
    }

    // ── Convert tools to Vercel AI SDK format ────────────────────────────────
    // Zod v4 schemas need to be converted to JSON Schema for the AI SDK.
    // We use zod v4's built-in toJSONSchema, then wrap with the AI SDK's jsonSchema() helper.
    const accumulatedActions: Record<string, unknown>[] = []

    // Helper: convert zod v4 schema to AI SDK compatible format
    function zodToAiSchema(zodSchema: z.ZodType, toolName: string) {
      try {
        // Zod v4 has built-in JSON Schema conversion
        const json = (z as any).toJSONSchema(zodSchema, {
          unrepresentable: 'any',  // Don't throw on edge-case types
          target: 'draft-07',       // Most compatible with AI providers
        })
        return jsonSchema(json)
      } catch (e) {
        console.error(`[agent] zodToAiSchema failed for tool "${toolName}":`, e)
        // Last resort: build a permissive JSON schema from the zod shape
        try {
          const shape = (zodSchema as any)._zod?.def?.shape
          if (shape) {
            const properties: Record<string, any> = {}
            for (const [key, val] of Object.entries(shape)) {
              properties[key] = {} // Accept anything
            }
            return jsonSchema({ type: 'object', properties, additionalProperties: true })
          }
        } catch { /* ignore */ }
        return jsonSchema({ type: 'object', properties: {}, additionalProperties: true })
      }
    }

    const sdkTools = Object.fromEntries(
      Object.entries(allTools).map(([name, t]) => [
        name,
        tool({
          description: t.description,
          parameters: zodToAiSchema(t.parameters, name) as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          execute: async (params: any) => {
            try {
              // Validate params through the original zod schema
              const validated = t.parameters.parse(params) as any
              const result = await (t.execute as any)(validated, toolContext)
              if (result.actions?.length) {
                accumulatedActions.push(...result.actions)
              }
              return result.result
            } catch (toolErr) {
              const msg = toolErr instanceof Error ? toolErr.message : String(toolErr)
              console.error(`[agent] Tool "${name}" failed:`, msg, toolErr)
              return `Error executing ${name}: ${msg}`
            }
          },
        }),
      ]),
    )

    // ── Stream response ──────────────────────────────────────────────────────
    const result = streamText({
      model: anthropic('claude-sonnet-4-6'),
      system: systemPrompt,
      messages,
      tools: sdkTools,
      maxSteps: 15,
      onFinish: async () => {
        after(async () => {
          try {
            await rebuildWorkspaceBrain(wsCtx.workspaceId)
          } catch {
            // Non-fatal — brain will rebuild on next access
          }
        })
      },
    })

    return result.toDataStreamResponse()
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[agent] Error:', errMsg, err)
    // Return as a text stream error so useChat can display it
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

// ── Legacy confirmed action handler ──────────────────────────────────────────

async function executeConfirmedAction(
  workspaceId: string,
  userId: string,
  pendingAction: PendingAction,
): Promise<{ reply: string; actions: Record<string, unknown>[] }> {
  if (pendingAction.type === 'todo_cleanup') {
    const { dealId, dealName, removeIds, completeIds } = pendingAction

    // Special case: full deal deletion
    if (removeIds[0] === '__delete_deal__') {
      await db
        .delete(dealLogs)
        .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))

      after(async () => {
        try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ }
      })

      return {
        reply: `**${dealName}** has been permanently deleted.`,
        actions: [{ type: 'deal_updated', dealId, dealName, changes: ['deal deleted'] }],
      }
    }

    // Todo cleanup: remove + complete
    const [dealRow] = await db
      .select({ todos: dealLogs.todos })
      .from(dealLogs)
      .where(eq(dealLogs.id, dealId))
      .limit(1)

    if (!dealRow) return { reply: "Couldn't find that deal.", actions: [] }

    const allTodos = (dealRow.todos as DealTodo[]) ?? []
    const removeSet = new Set(removeIds)
    const completeSet = new Set(completeIds)

    const updatedTodos = allTodos
      .filter((t) => !removeSet.has(t.id))
      .map((t) => (completeSet.has(t.id) ? { ...t, done: true } : t))

    await db
      .update(dealLogs)
      .set({ todos: updatedTodos, updatedAt: new Date() })
      .where(eq(dealLogs.id, dealId))

    after(async () => {
      try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ }
    })

    const removed = pendingAction.removedTexts ?? []
    const completed = pendingAction.completedTexts ?? []
    const parts: string[] = []
    if (removed.length) parts.push(`Removed ${removed.length} todo(s)`)
    if (completed.length) parts.push(`Completed ${completed.length} todo(s)`)

    return {
      reply: `**${dealName}** — ${parts.join(' and ')}.`,
      actions: [{
        type: 'todos_updated',
        added: 0,
        removed: removed.length,
        completed: completed.length,
        dealName,
      }],
    }
  }

  return { reply: 'Unknown action type.', actions: [] }
}
