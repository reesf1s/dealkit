export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { streamText, tool, jsonSchema } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

import { db } from '@/lib/db'
import { dealLogs, workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain, formatBrainContext } from '@/lib/workspace-brain'
import { requestBrainRebuild } from '@/lib/brain-rebuild'
import type { DealSnapshot } from '@/lib/workspace-brain'
import { getRelevantContext } from '@/lib/agent-context'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { PLAN_LIMITS } from '@/lib/stripe/plans'
import { allTools } from '@/lib/ai/tools'
import { normaliseParams } from '@/lib/ai/tool-wrapper'

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
  if (brainDeal.dealValue != null) lines.push(`- **Value**: £${brainDeal.dealValue.toLocaleString('en-GB')}`)
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

  // Current AI summary
  if (fullDeal?.aiSummary) {
    lines.push(`\nSummary: ${fullDeal.aiSummary}`)
  }

  // Recent meeting history (last 5 entries from meetingNotes — structured, dated)
  if (fullDeal?.meetingNotes) {
    const noteEntries = (fullDeal.meetingNotes as string).split(/\n---\n/).filter(Boolean)
    const recent = noteEntries.slice(-5)
    if (recent.length > 0) {
      lines.push('\nRecent Meeting History:')
      for (const n of recent) {
        lines.push(`  ${n.trim().substring(0, 500)}`)
      }
    }
  }

  // Next steps
  if (fullDeal?.nextSteps) {
    lines.push(`\nNext Steps: ${fullDeal.nextSteps}`)
  }

  // Contract dates
  if (fullDeal?.contractStartDate || fullDeal?.contractEndDate) {
    const start = fullDeal.contractStartDate ? new Date(fullDeal.contractStartDate).toLocaleDateString('en-GB') : 'TBD'
    const end = fullDeal.contractEndDate ? new Date(fullDeal.contractEndDate).toLocaleDateString('en-GB') : 'TBD'
    lines.push(`\nContract: ${start} → ${end}`)
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

  // Project plan — show full task list with IDs so LLM can reference them
  if (fullDeal) {
    const plan = (fullDeal.projectPlan as any)
    if (plan?.phases?.length > 0) {
      const allTasks = plan.phases.flatMap((p: any) => p.tasks ?? [])
      const total = allTasks.length
      const complete = allTasks.filter((t: any) => t.status === 'complete').length
      const pct = total > 0 ? Math.round((complete / total) * 100) : 0
      lines.push(`\nProject Plan: ${complete}/${total} tasks complete (${pct}%)`)
      for (const phase of plan.phases) {
        lines.push(`  Phase: ${phase.name}`)
        for (const task of (phase.tasks ?? [])) {
          const icon = task.status === 'complete' ? '✅' : task.status === 'in_progress' ? '🔄' : '⬜'
          const owner = task.owner ? `, owner: ${task.owner}` : ''
          lines.push(`  - [${task.id}] ${icon} ${task.text} (${phase.name}, status: ${task.status ?? 'pending'}${owner})`)
        }
      }
    }
  } else if (brainDeal.projectPlanProgress) {
    const { total, complete } = brainDeal.projectPlanProgress
    const pct = total > 0 ? Math.round((complete / total) * 100) : 0
    lines.push(`\nProject Plan: ${complete}/${total} tasks complete (${pct}%)`)
  }

  // Score trend from history
  if (brainDeal.scoreTrend && brainDeal.scoreTrend !== 'new') {
    const vel = brainDeal.scoreVelocity
    const arrow = brainDeal.scoreTrend === 'improving' ? '↑' : brainDeal.scoreTrend === 'declining' ? '↓' : '→'
    const velStr = vel != null ? ` (${vel > 0 ? '+' : ''}${vel}pts over 14 days)` : ''
    lines.push(`\nScore Trend: ${arrow} ${brainDeal.scoreTrend}${velStr}`)
    if (brainDeal.scoreTrend === 'declining') lines.push(`  ⚠ Score has dropped — investigate what changed`)
  }

  // Signal summary
  if (brainDeal.signalSummary) {
    const s = brainDeal.signalSummary
    lines.push('\nSignals:')
    const champStr = s.championStrength > 0.6 ? 'strong' : s.championStrength > 0.3 ? 'moderate' : 'weak/none'
    lines.push(`  - Momentum: ${s.momentum.toFixed(2)} | Risk: ${s.riskLevel} | Velocity: ${s.velocity}`)
    lines.push(`  - Stakeholder Depth: ${(s.stakeholderDepth * 100).toFixed(0)}% | Champion: ${champStr} (${s.championStrength.toFixed(2)})`)
    if (s.isDeteriorating) lines.push('  - ⚠ WARNING: Deal sentiment is deteriorating — recent notes more negative than early notes')
    if (s.predictedCloseDays != null) lines.push(`  - Predicted close: ~${s.predictedCloseDays} days`)
  }

  return lines.join('\n')
}

// ── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(brainContext: string, activeDealContext: string, pipelineStageContext: string = ''): string {
  return `You are Halvex AI — a sales copilot with complete CRM access. You are the interface between the user and their pipeline intelligence brain.

═══ YOUR 5 TOOLS ═══

You have exactly 5 tools:
1. **get_deal** — Look up a deal by name or ID. Returns full context: score, stage, contacts, todos, notes, risks, signals.
2. **update_deal** — Change ANYTHING on a deal (notes, todos, stage, value, contacts, close date, corrections, project plan, success criteria). Pass ALL changes in one call via the "changes" object. When "addNote" is provided, full meeting notes processing runs automatically.
3. **search_deals** — Find deals matching a query (name, company, stage).
4. **generate_content** — Create emails, battlecards, talking points, proposals, timelines, or any freeform content.
5. **answer_question** — Answer pipeline questions from brain data (forecasts, win rates, trends, performance).

═══ TOOL USAGE RULES ═══

- When the user mentions a deal by name, call get_deal first to get the ID, then update_deal with changes.
- When the user pastes text and says "update [deal]", call update_deal with changes.addNote containing the pasted text.
- When the user asks to add a todo, call update_deal with changes.addTodo.
- When the user asks to add a contact, call update_deal with changes.addContact.
- When the user says "fix this" or "that's wrong", call update_deal with the appropriate replace* fields in changes.
- When the user mentions something about a deal casually, call update_deal with changes.addNote to log it.
- NEVER describe what you'll do then wait for confirmation. Execute immediately and report results.
- After ANY tool call, check the result. If it says "TOOL FAILED", tell the user what went wrong.
- Keep responses to 1-2 sentences for confirmations.

═══ CRITICAL: DEAL ID PROTOCOL — READ BEFORE EVERY UPDATE ═══

Deal IDs are UUID v4 strings like "a1b2c3d4-e5f6-7890-abcd-ef1234567890".
NEVER invent or guess a deal ID.

DECISION TREE — follow this EXACTLY when a user asks to update a deal:

1. Is there an ACTIVE DEAL in context AND the user is referring to that same deal?
   → Use the active deal ID directly. Call update_deal immediately. DO NOT call get_deal or search_deals first.

2. Is the user referring to a DIFFERENT deal (by name) that is NOT the active deal?
   → Call get_deal with the deal name FIRST. Wait for the result. Then call update_deal with the returned ID.

3. NEVER call update_deal and then search_deals — that sequence is always wrong.
4. NEVER call update_deal with a fabricated, assumed, or placeholder ID.
5. Once you have a confirmed deal ID from step 1 or 2, do NOT search for it again — use it immediately.

The ONLY valid deal IDs are: (1) the activeDealId shown in ACTIVE DEAL CONTEXT below, or (2) an ID returned by a tool call in this conversation.

═══ RULE #1: COPY-PASTE USER TEXT, NEVER REPHRASE ═══

When the user gives you text to store (requirements, questions, todos, criteria, notes), COPY their exact words into the tool parameters. Do not rewrite, shorten, summarize, or "improve" their wording.

═══ ACTION CHAINS ═══

"Add X to project plan" → get_deal (if no ID in context) → update_deal with changes.addProjectTasks
"Add X to success criteria" → get_deal (if no ID in context) → update_deal with changes.addSuccessCriteria
"Add a contact" → get_deal (if no ID in context) → update_deal with changes.addContact
"Update this deal / here's an update / user pastes notes" → update_deal with changes.addNote (NOT appendNotes — addNote triggers full LLM extraction + scoring)
"Fix/correct X" → update_deal with appropriate replace* fields
"Reset project plan" → update_deal with changes.replaceProjectPlan or changes.clearProjectPlan
"Create content / draft email" → generate_content
"How's my pipeline?" → answer_question

NOTES vs FIELDS — use the right operation:
- User pastes meeting notes, an update, a call summary, or any free-form text → changes.addNote
- User explicitly sets a date/value/stage → changes.setCloseDate / setValue / setStage
- changes.appendNotes is for short factual appends ONLY (not meeting notes processing)

═══ INFORMATIONAL STATEMENTS ═══

When the user makes a simple statement about a deal ("Called Sarah yesterday", "Meeting pushed to next week"):
1. Acknowledge naturally
2. Log it via update_deal with changes.addNote — this ensures Deal Intelligence is refreshed
3. NEVER error on simple statements. If you can't match it to a deal, ask which deal.

═══ ACTIVE DEAL ═══

${activeDealContext || 'No active deal selected. If the user references a deal, search for it by name/company.'}

${activeDealContext ? 'The active deal ID is available to ALL tools. Use it directly — do not re-search for it.' : ''}

═══ WORKSPACE INTELLIGENCE ═══

${brainContext}
${pipelineStageContext}

═══ LEARNING BRAIN ═══

Every deal mutation triggers a brain rebuild. The brain powers ML scoring, deal archetypes, competitor intelligence, stage velocity, churn risk, and objection win maps. Reference ML data when discussing deal health.

═══ BEHAVIOR RULES ═══

1. CONTEXT RETENTION: If a tool call already identified a deal, keep using that ID.
2. AFTER MUTATIONS: Summarize in 1-2 sentences. Don't repeat all data back.
3. NATURAL LANGUAGE: Write like a human colleague. "Done — added 3 tasks" not "I have successfully updated..."
4. RISKS vs PRODUCT GAPS: Risks = will this deal close? Product gaps = our product is missing a feature.
5. DON'T INFER: Only store what the user explicitly tells you. Never store what you infer.
6. CORRECTIONS ARE SACRED: When user says "that's wrong" → use update_deal with replace* fields immediately. Never argue. The user is source of truth.
7. SCORE PINNING: User sets a score → it's pinned. Use changes.replaceConversionScore. Use changes.resetConversionScore to unpin.
8. NEVER SET CONVERSION SCORE directly. It's computed by ML. Only the user can override via replaceConversionScore.
9. NEVER INFER DEAL STATUS FROM NOTES. Only change stage if user explicitly says so.
10. CURRENCY: Always use £ (British pounds).
11. TASK COMPLETION: After a get_deal or search, always follow through with the actual requested action in the SAME response. Never stop after a lookup without completing the task.
12. PARALLEL EXECUTION: Call multiple tools in one response when they're independent.
13. CONFIRMATION HANDLING: "yes", "confirmed", "do it" = confirm previous proposed action. Execute immediately.
14. DECISIVENESS: "Update RELX with this note" = get_deal("RELX") then update_deal with addNote. One search, one update, done. No hedging, no "could you try again".`
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

    // ── Empty / whitespace-only message guard ────────────────────────────────
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')
    const lastUserText = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : Array.isArray(lastUserMessage?.content)
        ? lastUserMessage.content.map((p: any) => p.text ?? '').join('')
        : ''

    if (!lastUserText?.trim()) {
      const emptyStream = new ReadableStream({
        start(controller) {
          const msg = 'What would you like to know about your pipeline?'
          controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(msg)}\n`))
          controller.enqueue(new TextEncoder().encode(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`))
          controller.close()
        },
      })
      return new Response(emptyStream, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    // ── Context window guard: trim to last 20 non-system messages ─────────────
    let trimmedMessages = messages
    if (messages.length > 40) {
      const systemMessages = messages.filter((m: any) => m.role === 'system')
      const nonSystemMessages = messages.filter((m: any) => m.role !== 'system')
      trimmedMessages = [...systemMessages, ...nonSystemMessages.slice(-20)]
    }

    // ── Load workspace brain + active deal context ───────────────────────────
    const brain = await getWorkspaceBrain(wsCtx.workspaceId)

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

    // Load pipeline config for custom stage awareness
    let pipelineStageContext = ''
    let stageLabels: Record<string, string> = {}
    try {
      const [ws] = await db
        .select({ pipelineConfig: workspaces.pipelineConfig })
        .from(workspaces)
        .where(eq(workspaces.id, wsCtx.workspaceId))
        .limit(1)
      const pConfig = ws?.pipelineConfig as any
      if (pConfig?.stages?.length) {
        const stageList = pConfig.stages
          .filter((s: any) => !s.isHidden)
          .sort((a: any, b: any) => a.order - b.order)
          .map((s: any) => `${s.id} → "${s.label}"`)
          .join(', ')
        pipelineStageContext = `\n\nPIPELINE STAGES (user's custom configuration):\n${stageList}\n\nWhen the user references a stage by its display label (e.g., "Verbal Commit"), map it to the correct stage ID. When describing deal stages, use the display label the user sees, not the internal ID.`
        // Build stage ID → label map for tools and brain context
        for (const s of pConfig.stages) {
          stageLabels[s.id] = s.label
        }
      }
    } catch { /* non-fatal */ }

    // ── Semantic context retrieval: send only relevant deals instead of full brain ──
    // Fallback to full brain dump if semantic retrieval fails or brain has no deals
    const sl = (stageId: string) => stageLabels?.[stageId] ?? stageId
    let brainContextWithLabels: string

    if (brain && brain.deals?.length) {
      try {
        const semanticCtx = await getRelevantContext(wsCtx.workspaceId, lastUserText, 5)

        // Build compact deal list from semantic results
        const dealLines = semanticCtx.relevantDeals.map(d => {
          const score = d.conversionScore ?? 0
          const stage = sl(d.stage || 'unknown')
          const value = d.dealValue ? `£${d.dealValue.toLocaleString('en-GB')}` : '£0'
          const closeDate = d.closeDate ? ` | Close: ${new Date(d.closeDate).toLocaleDateString('en-GB')}` : ''
          return `• ${d.dealName} (${d.prospectCompany}): ${score}% | ${stage} | ${value}${closeDate}`
        }).join('\n')

        const ps = semanticCtx.pipelineSummary
        const pipelineLine = `Pipeline: ${ps.dealCount} open deals, £${ps.totalValue.toLocaleString('en-GB')}, avg score ${ps.avgScore}%, ${ps.wins}W/${ps.losses}L`

        // Preserve brain intelligence sections (ML, win/loss, archetypes, etc.) which are pipeline-wide
        const brainIntelLines: string[] = []
        const fullBrainCtx = formatBrainContext(brain, Object.keys(stageLabels).length > 0 ? stageLabels : undefined)

        // Extract non-deal sections from brain context (everything after the DEALS block)
        const sectionHeaders = [
          'URGENT — NEEDS ATTENTION:',
          'STALE DEALS',
          'TOP RISKS ACROSS PIPELINE:',
          'RECURRING PATTERNS:',
          'SUGGESTED COLLATERAL:',
          'PIPELINE RECOMMENDATIONS:',
          'PROJECT PLANS:',
          'HISTORICAL WIN/LOSS INTELLIGENCE:',
          'WEIGHTED FORECAST',
          'ML MODEL',
          'ML WIN PROBABILITIES',
          'TREND:',
          'COMPETITIVE THREAT:',
          'DEAL ARCHETYPES',
          'STAGE VELOCITY ALERTS',
          'COMPETITIVE INTELLIGENCE',
        ]
        for (const header of sectionHeaders) {
          const idx = fullBrainCtx.indexOf(header)
          if (idx !== -1) {
            // Find the end of this section (next double newline or end of string)
            const sectionStart = fullBrainCtx.lastIndexOf('\n', idx)
            let sectionEnd = fullBrainCtx.indexOf('\n\n', idx + header.length)
            if (sectionEnd === -1) sectionEnd = fullBrainCtx.length
            brainIntelLines.push(fullBrainCtx.slice(sectionStart, sectionEnd).trim())
          }
        }

        const totalDeals = brain.deals.length
        const shownDeals = semanticCtx.relevantDeals.length
        const otherCount = totalDeals - shownDeals

        brainContextWithLabels = [
          `PIPELINE OVERVIEW (brain updated ${brain.updatedAt ? new Date(brain.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown'})`,
          pipelineLine,
          '',
          `RELEVANT DEALS (${shownDeals} of ${totalDeals}${otherCount > 0 ? ` — ${otherCount} more available via search_deals` : ''}):`,
          dealLines,
          '',
          ...brainIntelLines,
        ].join('\n')
      } catch (semanticErr) {
        console.error('[agent] Semantic context failed, using full brain:', semanticErr)
        brainContextWithLabels = formatBrainContext(brain, Object.keys(stageLabels).length > 0 ? stageLabels : undefined)
      }
    } else {
      brainContextWithLabels = brain
        ? 'Pipeline data is loading — no deals recorded yet. Encourage the user to add their first deal.'
        : 'No workspace data loaded yet.'
    }

    const systemPrompt = buildSystemPrompt(brainContextWithLabels, activeDealContext, pipelineStageContext)

    // ── Build tool context for tool execute() calls ──────────────────────────
    const toolContext = {
      workspaceId: wsCtx.workspaceId,
      userId,
      plan: wsCtx.plan,
      brain: brain ?? null,
      activeDealId: activeDealId ?? null,
      stageLabels: Object.keys(stageLabels).length > 0 ? stageLabels : undefined,
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
              // Normalise LLM parameter name mistakes before Zod validation
              const normalised = normaliseParams(params)
              // Validate params through the original zod schema
              const validated = t.parameters.parse(normalised) as any
              const result = await (t.execute as any)(validated, toolContext)
              if (result.actions?.length) {
                accumulatedActions.push(...result.actions)
              }
              // Post-execution failure detection
              const resultText = result.result as string
              if (resultText && (resultText.includes('TOOL FAILED') || resultText.includes('wrote 0 rows'))) {
                return `${resultText}\n\nDO NOT tell the user this succeeded. Report the failure.`
              }
              return resultText
            } catch (toolErr) {
              const msg = toolErr instanceof Error ? toolErr.message : String(toolErr)
              console.error(`[agent] Tool "${name}" failed:`, msg, toolErr)
              return `TOOL FAILED: "${name}" did not execute. Error: ${msg.slice(0, 300)}. DO NOT tell the user this action succeeded. Report this failure explicitly: "Could not [action] — [reason]". If the error mentions parameter names, retry with the correct parameter names from the tool description.`
            }
          },
        }),
      ]),
    )

    // ── Stream response ──────────────────────────────────────────────────────
    // Wrap with a 30-second timeout so the UI never hangs indefinitely
    let result: ReturnType<typeof streamText>
    try {
      const streamPromise = streamText({
        model: anthropic('claude-sonnet-4-6'),
        system: systemPrompt,
        messages: trimmedMessages,
        tools: sdkTools,
        maxSteps: 5,
        maxTokens: 4096,
        onFinish: async () => {
          after(async () => { await requestBrainRebuild(wsCtx.workspaceId, 'agent_tool_call') })
        },
      })

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Response timed out')), 120000)
      )

      result = await Promise.race([
        Promise.resolve(streamPromise),
        timeoutPromise,
      ]) as ReturnType<typeof streamText>
    } catch (timeoutErr) {
      const timeoutMsg = timeoutErr instanceof Error && timeoutErr.message === 'Response timed out'
        ? "I'm taking longer than usual. Please try again."
        : (timeoutErr instanceof Error ? timeoutErr.message : String(timeoutErr))
      const timeoutStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(timeoutMsg)}\n`))
          controller.enqueue(new TextEncoder().encode(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`))
          controller.close()
        },
      })
      return new Response(timeoutStream, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    return result.toDataStreamResponse()
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[agent] Error:', errMsg, err)
    // Return a friendly message as a data stream — never expose raw error details to users
    const friendlyMessage = "I ran into an issue processing your request. Could you try rephrasing what you'd like me to do?"
    const errorStream = new ReadableStream({
      start(controller) {
        // Send as a normal text message (0: prefix) instead of error (3: prefix)
        // so the UI renders it as a regular assistant message, not a scary error banner
        controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(friendlyMessage)}\n`))
        controller.enqueue(new TextEncoder().encode(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`))
        controller.close()
      },
    })
    return new Response(errorStream, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
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

      after(async () => { await requestBrainRebuild(workspaceId, 'agent_tool_call') })

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

    after(async () => { await requestBrainRebuild(workspaceId, 'agent_tool_call') })

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
