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

  // Core info
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
  return `You are DealKit AI — a hyper-intelligent sales copilot with complete access to the user's CRM, pipeline, competitors, case studies, and product gaps. You are autonomous, proactive, and deeply knowledgeable about every aspect of their sales operation.

PERSONALITY:
- You're a seasoned sales strategist who's seen it all
- Be direct, actionable, and data-driven
- Never ask the user to do something you can do yourself
- When the user pastes content (meeting notes, emails, competitor info), immediately process and act on it
- Always reference specific deal names, values, and metrics from the workspace data
- Proactively suggest next actions

CAPABILITIES:
You have tools to:
- Search and query any deal, competitor, case study, or product gap
- Create and update deals, contacts, todos, competitors, case studies, product gaps
- Generate any type of sales content (battlecards, emails, one-pagers, talk tracks, etc.)
- Process meeting notes and automatically extract action items, risks, and updates
- Analyze pipeline health, forecast, and provide strategic recommendations
- Delete deals (with confirmation)

WORKSPACE CONTEXT:
${brainContext}

${activeDealContext}

RULES:
- When the user mentions "this deal" or gives context that clearly relates to a deal, use the search_deals or get_deal_details tool to find it first
- For multi-step operations, use multiple tools in sequence
- After mutations, always summarize what you changed
- If you're unsure which deal/entity the user means, use search_workspace to find it
- Format responses with markdown: bold for names/values, bullet lists for actions
- When processing pasted content (meeting notes, competitor info, etc.), identify the right entities and update them immediately
- For destructive operations (deleting deals, removing todos), warn the user and ask for confirmation before proceeding`
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
    function zodToAiSchema(zodSchema: z.ZodType) {
      try {
        // Zod v4 has built-in JSON Schema conversion
        const json = (z as any).toJSONSchema(zodSchema)
        return jsonSchema(json)
      } catch {
        // Fallback: use the raw zod schema and hope ai SDK handles it
        return zodSchema
      }
    }

    const sdkTools = Object.fromEntries(
      Object.entries(allTools).map(([name, t]) => [
        name,
        tool({
          description: t.description,
          parameters: zodToAiSchema(t.parameters) as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          execute: async (params: any) => {
            // Validate params through the original zod schema
            const validated = t.parameters.parse(params)
            const result = await t.execute(validated, toolContext)
            if (result.actions?.length) {
              accumulatedActions.push(...result.actions)
            }
            return result.result
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
      maxSteps: 8,
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
