export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { streamText, tool, jsonSchema, convertToCoreMessages, generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
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
import { sendAgentGradeTranscript } from '@/lib/agentgrade'
import { MINI } from '@/lib/ai/models'

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

const AgentIncomingMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool', 'data']),
  content: z.unknown().optional(),
  parts: z.unknown().optional(),
  id: z.string().optional(),
}).passthrough()

const AgentRequestSchema = z.object({
  messages: z.array(AgentIncomingMessageSchema).min(1),
  activeDealId: z.string().nullable().optional(),
  currentPage: z.string().optional(),
  confirmAction: z.unknown().optional(),
  conversationId: z.string().trim().min(1).max(120).optional(),
}).passthrough()

// ── OpenAI client ────────────────────────────────────────────────────────────

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return null
  }
  return createOpenAI({ apiKey })
}

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

// ── System prompt + orchestration planning ──────────────────────────────────

const OrchestrationPlanSchema = z.object({
  intents: z.array(z.object({
    order: z.number().int().positive(),
    objective: z.string().min(3),
    suggestedTool: z.string().nullable().optional(),
    dependsOn: z.array(z.number().int().positive()).default([]),
  })).max(8).default([]),
  executionNotes: z.string().optional().default(''),
  clarificationNeeded: z.array(z.string()).max(2).default([]),
})

type OrchestrationPlan = z.infer<typeof OrchestrationPlanSchema>

function summariseToolDescription(description: string): string {
  const compact = description.replace(/\s+/g, ' ').trim()
  const firstSentence = compact.split(/[.!?]/)[0]?.trim() ?? compact
  return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}...` : firstSentence
}

function buildToolCatalog(): string {
  return Object.entries(allTools)
    .map(([toolName, toolDef], index) => `${index + 1}. ${toolName} — ${summariseToolDescription(toolDef.description)}`)
    .join('\n')
}

function buildFallbackOrchestrationPlan(userText: string): string {
  const clauses = userText
    .split(/(?:\n+|,\s+and\s+|\band then\b|\bthen\b|;)/i)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 6)
  if (clauses.length <= 1) return 'Single-intent request: complete the requested outcome directly; use tools as needed.'
  return [
    'Multi-intent request detected. Complete all intents in this order:',
    ...clauses.map((clause, idx) => `${idx + 1}. ${clause}`),
  ].join('\n')
}

function formatOrchestrationPlan(plan: OrchestrationPlan | null, userText: string): string {
  if (!plan || plan.intents.length === 0) {
    return buildFallbackOrchestrationPlan(userText)
  }

  const lines = [
    'Derived execution plan (complete all intents unless blocked by missing data):',
    ...plan.intents
      .sort((a, b) => a.order - b.order)
      .map(intent => {
        const depends = intent.dependsOn.length > 0 ? ` | depends on: ${intent.dependsOn.join(', ')}` : ''
        const toolHint = intent.suggestedTool ? ` | tool: ${intent.suggestedTool}` : ''
        return `${intent.order}. ${intent.objective}${toolHint}${depends}`
      }),
  ]
  if (plan.executionNotes) lines.push(`Execution notes: ${plan.executionNotes}`)
  if (plan.clarificationNeeded.length > 0) {
    lines.push(`Only ask clarification if blocked. Candidate clarification: ${plan.clarificationNeeded.join(' | ')}`)
  }
  return lines.join('\n')
}

async function buildOrchestrationPlan(
  openai: ReturnType<typeof createOpenAI>,
  userText: string,
  hasActiveDealContext: boolean,
): Promise<OrchestrationPlan | null> {
  try {
    const toolNames = Object.keys(allTools)
    const trimmedUserText = userText.trim().slice(0, 4000)
    const { object } = await generateObject({
      model: openai(MINI),
      schema: OrchestrationPlanSchema,
      prompt: `You are an execution planner for a CRM AI agent.
User message:
${trimmedUserText}

Active deal context available: ${hasActiveDealContext ? 'yes' : 'no'}

Available tools:
${toolNames.join(', ')}

Plan requirements:
- Detect all distinct intents in the message, including vague asks.
- For updates, plan deal lookup before mutation unless a confirmed active deal id is already present in context.
- For multi-part asks in one message, output all intents and dependencies.
- Keep intent count <= 8.
- suggestedTool must be one of the available tools or null.
- Use clarificationNeeded only when execution is truly blocked.`,
      providerOptions: {
        openai: {
          maxCompletionTokens: 700,
        },
      },
    })

    const plannedObject = OrchestrationPlanSchema.parse(object)

    const sanitizedIntents = plannedObject.intents
      .filter(intent => intent.objective.trim().length > 0)
      .map(intent => ({
        ...intent,
        suggestedTool: intent.suggestedTool && Object.prototype.hasOwnProperty.call(allTools, intent.suggestedTool)
          ? intent.suggestedTool
          : null,
      }))
      .sort((a, b) => a.order - b.order)
      .slice(0, 8)

    return {
      ...plannedObject,
      intents: sanitizedIntents,
    }
  } catch (err) {
    console.warn('[agent] orchestration planner failed:', err)
    return null
  }
}

function buildSystemPrompt(
  brainContext: string,
  activeDealContext: string,
  toolCatalog: string,
  orchestrationPlan: string,
  pipelineStageContext: string = '',
): string {
  return `You are Halvex AI — a sales copilot with complete CRM and intelligence access.

═══ TOOLBOX (FULL ACCESS) ═══
You can call any of these tools:
${toolCatalog}

Tooling policy:
- Use the smallest set of tools needed to complete the user outcome.
- For deal mutations, resolve the right deal first, then mutate.
- For analytics questions, prefer read-only analytics tools before guessing.
- For multi-step asks, execute the full chain in one response using multiple tool calls when needed.

═══ ORCHESTRATION PRIORITY ═══
${orchestrationPlan}

Hard orchestration rules:
1. Complete every intent in the plan; do not stop after the first successful tool call.
2. Respect dependencies: lookup/resolve before update, retrieval before content generation.
3. If intents are independent, call tools in parallel in the same response.
4. If a tool fails, report the failure clearly and continue remaining intents where possible.
5. Never fabricate IDs. Use active deal id or IDs returned by tools.

═══ DEAL ID PROTOCOL ═══
Deal IDs are UUID v4 strings. Never invent them.
- If active deal context matches user intent: use it directly.
- If user names another deal: resolve it first with get_deal or search_deals, then update.
- Never run update_deal with placeholder or guessed IDs.

═══ DATA FIDELITY RULES ═══
- Copy user-provided source text exactly into mutation fields when logging notes/todos/criteria.
- Do not infer facts the user did not say.
- Do not change stage unless explicitly requested or unambiguously instructed.
- Conversion score is model-driven unless user explicitly overrides with score pinning fields.

═══ ACTION MAPPING ═══
- Freeform update/call notes/email summaries → update_deal.changes.addNote
- Fix/correction requests → update_deal replace* fields
- Todo/contact/project-plan/success-criteria edits → update_deal changes object
- Competitive intel / pipeline questions / performance / forecasts → analytics tools
- Competitor/company/case-study/product-gap CRUD → knowledge tools
- Drafts, battlecards, docs, collateral → generate_content / draft_email / generate_battlecard

═══ ACTIVE DEAL ═══
${activeDealContext || 'No active deal selected. Resolve deal by name/company when needed.'}
${activeDealContext ? 'Active deal ID is valid for direct tool calls.' : ''}

═══ WORKSPACE INTELLIGENCE ═══
${brainContext}
${pipelineStageContext}

═══ RESPONSE STYLE ═══
- Be decisive and execution-first.
- After tool execution, summarize completed actions and outcomes succinctly.
- If blocked, ask one crisp clarification question only when necessary.`
}

function getMessageText(message: { content?: unknown }): string {
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) {
    return message.content
      .filter((part: any) => part?.type === 'text')
      .map((part: any) => part?.text ?? '')
      .join('\n')
  }
  return ''
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function withActiveDealFallback(toolName: string, rawParams: Record<string, unknown>, activeDealId: string | null) {
  if (!activeDealId) return rawParams
  if (toolName === 'update_deal' && !rawParams.dealId) {
    return { ...rawParams, dealId: activeDealId }
  }
  if (toolName === 'get_deal' && !rawParams.dealId && !rawParams.dealName) {
    return { ...rawParams, dealId: activeDealId }
  }
  return rawParams
}

function normaliseIncomingMessages(messages: any[]) {
  const supportedMessages = messages.filter((message) => message?.role !== 'data')
  const coreMessages = convertToCoreMessages(supportedMessages)
  const deduped: any[] = []

  for (const message of coreMessages) {
    if (message.role !== 'user') {
      deduped.push(message)
      continue
    }

    const text = getMessageText(message).trim()
    if (!text) continue

    const previous = deduped[deduped.length - 1]
    if (previous?.role === 'user') {
      const previousText = getMessageText(previous).trim()

      if (compactWhitespace(previousText) === compactWhitespace(text)) {
        deduped[deduped.length - 1] = {
          ...message,
          content: [{ type: 'text', text }],
        }
        continue
      }

      deduped[deduped.length - 1] = {
        role: 'user',
        content: [{ type: 'text', text: `${previousText}\n\n${text}`.trim() }],
      }
      continue
    }

    deduped.push({
      ...message,
      content: [{ type: 'text', text }],
    })
  }

  return deduped
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json(
        { error: 'Ask AI is unavailable because OPENAI_API_KEY is not configured.' },
        { status: 503 },
      )
    }

    const { userId } = await auth()
    if (!userId) return new Response('Unauthorized', { status: 401 })

    const wsCtx = await getWorkspaceContext(userId)
    if (!wsCtx) return new Response('No workspace', { status: 400 })

    const rl = await checkRateLimit(userId, 'agent', 30, 60) // 30 per minute
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    const rawBody = await req.json().catch(() => null)
    const parsedBody = AgentRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }

    const { messages, activeDealId, confirmAction, conversationId } = parsedBody.data

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

    const normalisedMessages = normaliseIncomingMessages(messages)
    if (!normalisedMessages.length) {
      return NextResponse.json({ error: 'No valid messages provided' }, { status: 400 })
    }

    // ── Empty / whitespace-only message guard ────────────────────────────────
    const lastUserMessage = [...normalisedMessages].reverse().find((m: any) => m.role === 'user')
    const lastUserText = getMessageText(lastUserMessage ?? {})

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

    const latestCustomerMessage = [...normalisedMessages].reverse().find((m: any) => m.role === 'user')
    if (latestCustomerMessage && conversationId) {
      after(async () => {
        await sendAgentGradeTranscript({
          conversationId,
          customerIdentifier: userId,
          messages: [latestCustomerMessage],
        })
      })
    }

    // ── Context window guard: trim to last 20 non-system messages ─────────────
    let trimmedMessages = normalisedMessages
    if (normalisedMessages.length > 40) {
      const systemMessages = normalisedMessages.filter((m: any) => m.role === 'system')
      const nonSystemMessages = normalisedMessages.filter((m: any) => m.role !== 'system')
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

    const toolCatalog = buildToolCatalog()
    const derivedPlan = await buildOrchestrationPlan(
      openai,
      lastUserText,
      Boolean(activeDealId && activeDealContext),
    )
    const orchestrationPlan = formatOrchestrationPlan(derivedPlan, lastUserText)

    const systemPrompt = buildSystemPrompt(
      brainContextWithLabels,
      activeDealContext,
      toolCatalog,
      orchestrationPlan,
      pipelineStageContext,
    )

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
              const normalised = withActiveDealFallback(
                name,
                normaliseParams(params),
                toolContext.activeDealId ?? null,
              )
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
        model: openai(MINI),
        system: systemPrompt,
        messages: trimmedMessages,
        tools: sdkTools,
        maxSteps: 20,
        providerOptions: {
          openai: {
            maxCompletionTokens: 4096,
          },
        },
        onFinish: async ({ text }) => {
          after(async () => {
            await Promise.allSettled([
              requestBrainRebuild(wsCtx.workspaceId, 'agent_tool_call'),
              sendAgentGradeTranscript({
                conversationId,
                customerIdentifier: userId,
                messages: text.trim() ? [{ role: 'assistant', content: text }] : [],
              }),
            ])
          })
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
