/**
 * Slack Agent — full agentic Claude handler for Slack messages.
 *
 * Every incoming Slack message (DM, @mention, slash command) routes here.
 * Uses generateText (not streamText) with the full Halvex + Linear tool suite.
 * Responses are formatted as Slack Block Kit blocks.
 *
 * Multi-turn state:
 * - Pending confirmations are stored in mcp_action_log with status 'awaiting_confirmation'
 * - On next message from the same user/channel, pending action is resolved first
 * - Typical flow: bot asks "shall I scope issue 36?", user says "yes" → action fires
 *
 * System prompt is a Slack-adapted version of the web agent's prompt:
 * - No streaming, concise responses, Slack formatting conventions
 * - Full brain context + relevant deal context injected
 */

import { generateText, tool, jsonSchema } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { db } from '@/lib/db'
import { workspaces, mcpActionLog, slackUserMappings } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getWorkspaceBrain, formatBrainContext, type WorkspaceBrain } from '@/lib/workspace-brain'
import { getRelevantContext } from '@/lib/agent-context'
import { normaliseParams } from '@/lib/ai/tool-wrapper'
import { allTools } from '@/lib/ai/tools'
import { slackTools } from '@/lib/ai/tools/slack-tools'
import { markdownToBlocks } from '@/lib/slack-blocks'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SlackAgentResult {
  text: string
  blocks: ReturnType<typeof markdownToBlocks>
}

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic client
// ─────────────────────────────────────────────────────────────────────────────

function getAnthropicClient() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY env var is not set')
  return createAnthropic({ apiKey: key })
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-turn state helpers
// ─────────────────────────────────────────────────────────────────────────────

interface PendingSlackAction {
  type: 'awaiting_confirmation'
  prompt: string       // what the bot asked (for context in the next turn)
  action: string       // what will happen on confirmation
  params: Record<string, unknown>
}

/** Retrieve any pending confirmation for this user+channel (max 1 open at a time). */
async function getPendingAction(
  workspaceId: string,
  slackUserId: string,
  channelId: string,
): Promise<{ id: string; payload: PendingSlackAction } | null> {
  const rows = await db
    .select({ id: mcpActionLog.id, payload: mcpActionLog.payload })
    .from(mcpActionLog)
    .where(and(
      eq(mcpActionLog.workspaceId, workspaceId),
      eq(mcpActionLog.triggeredBy, 'slack'),
      eq(mcpActionLog.status, 'awaiting_confirmation'),
    ))
    .orderBy(desc(mcpActionLog.createdAt))
    .limit(1)

  const row = rows[0]
  if (!row?.payload) return null

  const p = row.payload as Record<string, unknown>
  if (p.slackUserId !== slackUserId || p.channelId !== channelId) return null

  return { id: row.id, payload: p as unknown as PendingSlackAction }
}

/** Mark a pending action as resolved (complete or cancelled). */
async function resolvePendingAction(id: string, status: 'complete' | 'error'): Promise<void> {
  await db
    .update(mcpActionLog)
    .set({ status })
    .where(eq(mcpActionLog.id, id))
}

/** Check if the user's message is a confirmation or cancellation. */
function isConfirmation(text: string): boolean {
  return /^\s*(yes|yeah|yep|sure|ok|okay|do it|confirm|go ahead|proceed|sounds good)\s*\.?\s*$/i.test(text)
}

function isCancellation(text: string): boolean {
  return /^\s*(no|nope|cancel|stop|nevermind|never mind|skip)\s*\.?\s*$/i.test(text)
}

/** Extract Linear issue IDs (e.g. ENG-36, ENG-42) from a reply. */
function extractIssueIds(text: string): string[] {
  const matches = text.match(/([A-Z]+-\d+)/gi) ?? []
  return [...new Set(matches.map(m => m.toUpperCase()))]
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

// Static block: tool descriptions + formatting rules + behavior rules
// This never changes per-request, so it qualifies for Anthropic prompt caching.
const SLACK_STATIC_SYSTEM_BLOCK = `You are Halvex — a sales intelligence bot in Slack. You have full access to the user's CRM pipeline, Linear issues, and deal intelligence.

═══ YOUR TOOLS ═══

Core deal tools:
- get_deal — look up any deal by name or company
- update_deal — update deal fields, add notes, set stage, value, close date
- search_deals — find deals matching a query
- generate_content — draft emails, proposals, battlecards
- answer_question — answer pipeline questions from brain data

Slack/Linear tools:
- halvex_discover_issues — **PRIMARY TOOL for deal questions** — look up a deal, discover semantically matching Linear issues from objection signals, store them as links, and ask if you should prioritise them into the next cycle
- halvex_bulk_scope_to_cycle — scope multiple Linear issues at once: generates user story + ACs for each, updates Linear, adds all to the next cycle. Use when user confirms after halvex_discover_issues.
- halvex_get_linked_issues — list already-linked Linear issues for a deal
- halvex_link_issue_to_deal — manually link an issue to a deal
- halvex_confirm_link — confirm a suggested link
- halvex_dismiss_link — dismiss a link
- halvex_mark_issue_released — mark issue as deployed, trigger release email flow
- halvex_mark_issue_deployed — mark issue as deployed + fire proactive Slack DM notification
- halvex_get_cycle_candidates — list confirmed issues for a deal that could go into next cycle
- halvex_get_upcoming_cycle — show upcoming cycle: name, dates, issues already in it
- halvex_scope_issue_to_cycle — scope a single issue to cycle with user story + ACs
- halvex_search_linear_issues — search issues by keyword
- halvex_get_linear_issue — get details of a specific issue
- halvex_find_at_risk_deals — show deals needing attention
- halvex_get_win_loss_signals — workspace win/loss intelligence
- halvex_generate_release_email — generate or retrieve cached release email for a deployed issue

═══ CORE PRODUCT FLOW ═══

When a user asks about a deal (e.g. "what's the latest on the Miro deal?", "how's Coke going?"):

1. Call **halvex_discover_issues** with the deal name.
   - This returns: deal health (score, stage, risk factors) + matching Linear issues
   - It also stores a pending confirmation so "yes" will trigger bulk scope

2. Present the result clearly:
   - Deal score, stage, close date, key risk factors
   - The matching Linear issues with relevance scores
   - End with: "I found N issues that would help convert [Company] — want me to write user stories and prioritise them into the next cycle?"

3. If user says "yes" / "go ahead" / "do it":
   - Call **halvex_bulk_scope_to_cycle** with the deal name and the issue IDs
   - This generates user stories + ACs for ALL issues, updates Linear, adds them to the cycle
   - Reply: "Done — scoped all 3 issues into [Cycle Name]. I'll notify you when they ship."

4. When issues ship (webhook fires automatically):
   - You'll get a proactive DM with the email draft + call scheduling message
   - The Slack DM shows: what shipped, which objection each issue addresses, draft email to prospect, and a suggested message to schedule a call

═══ SLACK FORMATTING RULES ═══

- Use Slack markdown: *bold* not **bold**, _italic_ not *italic*
- Keep responses concise — this is a chat, not a report
- For lists: use bullet points (•), not numbered lists unless order matters
- For confirmations like "Done — linked ENG-42 to Coke" keep it to one line
- For complex answers (deal health, issue lists), use structured sections

═══ MULTI-TURN CONFIRMATION ═══

When halvex_discover_issues finds issues and you ask "shall I prioritise these?", the system has stored a pending confirmation. When the user says "yes"/"sure"/"go ahead", the system will re-invoke you with context to call halvex_bulk_scope_to_cycle.

If the user specifies a subset (e.g. "only ENG-36 and ENG-42"), call halvex_bulk_scope_to_cycle with only those IDs.

═══ BEHAVIOR RULES ═══

1. Act immediately — don't describe what you'll do, do it
2. When user asks about ANY deal, use halvex_discover_issues first (not get_deal + halvex_get_linked_issues separately)
3. Don't invent deal IDs — only use IDs returned by tool calls
4. Currency: £ (British pounds) unless told otherwise
5. If Linear is not connected, say so clearly and direct to Settings
6. Never 500 — catch errors gracefully`

// Dynamic block: workspace brain + stage labels — changes per-request, must NOT be cached.
function buildSlackDynamicBlock(
  brainContext: string,
  stageLabels: Record<string, string>,
): string {
  const stageLabelNote = Object.keys(stageLabels).length > 0
    ? `\nStage labels: ${Object.entries(stageLabels).map(([id, label]) => `${id} → "${label}"`).join(', ')}`
    : ''

  return `═══ WORKSPACE INTELLIGENCE ═══

${brainContext}${stageLabelNote}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool adapter (converts our tool format to Vercel AI SDK format)
// ─────────────────────────────────────────────────────────────────────────────

interface SlackInternalToolContext {
  workspaceId: string
  userId: string
  plan: string
  brain: WorkspaceBrain | null
  activeDealId: string | null
  stageLabels?: Record<string, string>
  channelId?: string
}

function buildSdkTools(toolContext: SlackInternalToolContext) {
  const allToolsCombined = { ...allTools, ...slackTools }

  return Object.fromEntries(
    Object.entries(allToolsCombined).map(([name, t]) => [
      name,
      tool({
        description: t.description,
        parameters: (() => {
          try {
            const json = (z as unknown as { toJSONSchema: (s: z.ZodType, opts: Record<string, unknown>) => unknown }).toJSONSchema(t.parameters, {
              unrepresentable: 'any',
              target: 'draft-07',
            })
            return jsonSchema(json as Record<string, unknown>)
          } catch {
            return jsonSchema({ type: 'object', properties: {}, additionalProperties: true })
          }
        })() as ReturnType<typeof jsonSchema>,
        execute: async (params: unknown) => {
          try {
            const normalised = normaliseParams(params as Record<string, unknown>)
            const validated = t.parameters.parse(normalised) as Record<string, unknown>
            const result = await (t.execute as (p: Record<string, unknown>, ctx: typeof toolContext) => Promise<{ result: string }>)(validated, toolContext)
            return result.result
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            console.error(`[slack-agent] Tool "${name}" failed:`, msg)
            return `TOOL FAILED: ${msg.slice(0, 200)}`
          }
        },
      }),
    ]),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle an incoming Slack message and return a response.
 *
 * @param userText     - the user's message text (stripped of bot mention)
 * @param workspaceId  - Halvex workspace ID (looked up from Slack team ID)
 * @param slackUserId  - Slack user ID (e.g. "U01234567")
 * @param channelId    - Slack channel ID (e.g. "C01234567" or "D01234567" for DMs)
 */
export async function handleSlackMessage(
  userText: string,
  workspaceId: string,
  slackUserId: string,
  channelId: string,
): Promise<SlackAgentResult> {
  const text = userText.trim()
  if (!text) {
    return textResult('Hi! Ask me anything about your pipeline. Try: "how is the Coke deal?" or "what deals need attention?"')
  }

  // ── Check for pending confirmation ────────────────────────────────────────
  const pending = await getPendingAction(workspaceId, slackUserId, channelId)

  if (pending && isConfirmation(text)) {
    await resolvePendingAction(pending.id, 'complete')
    // Re-invoke with the original action as a follow-up prompt
    const followUpText = `${pending.payload.prompt}\n\nUser confirmed: yes. Execute the action: ${pending.payload.action}`
    return handleSlackMessage(followUpText, workspaceId, slackUserId, channelId)
  }

  if (pending && isCancellation(text)) {
    await resolvePendingAction(pending.id, 'error')
    return textResult("Got it — cancelled. What else can I help with?")
  }

  // ── Partial confirmation: user listed specific issue IDs (e.g. "just ENG-36 and ENG-42") ──
  if (pending) {
    const partialIds = extractIssueIds(text)
    if (partialIds.length > 0) {
      await resolvePendingAction(pending.id, 'complete')
      const followUpText = `${pending.payload.prompt}\n\nUser wants to scope only these specific issues: ${partialIds.join(', ')}. Execute the action for ONLY these IDs, not all of them.`
      return handleSlackMessage(followUpText, workspaceId, slackUserId, channelId)
    }
    // Ambiguous response — ask to clarify
    const pendingParams = pending.payload.params as { issueIds?: string[] } | undefined
    const exampleIds = pendingParams?.issueIds?.slice(0, 2).join(' and ') ?? 'ENG-36 and ENG-42'
    return textResult(
      `Just to confirm — should I scope all the issues, or only specific ones? ` +
      `You can say _"yes"_ to scope all, or list them, e.g. _"${exampleIds}"_.`
    )
  }

  // ── Load workspace context ────────────────────────────────────────────────
  const brain = await getWorkspaceBrain(workspaceId)

  // Load pipeline config for stage labels
  const stageLabels: Record<string, string> = {}
  try {
    const [ws] = await db
      .select({ pipelineConfig: workspaces.pipelineConfig })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)
    const cfg = ws?.pipelineConfig as { stages?: { id: string; label: string; isHidden?: boolean }[] } | null
    if (cfg?.stages) {
      for (const s of cfg.stages) stageLabels[s.id] = s.label
    }
  } catch { /* non-fatal */ }

  // Build compact brain context (same approach as web agent)
  let brainContext: string
  if (brain?.deals?.length) {
    try {
      const ctx = await getRelevantContext(workspaceId, text, 5)
      const pipelineLines = ctx.relevantDeals.map(d => {
        const score = d.conversionScore ?? 0
        const stage = stageLabels[d.stage] ?? d.stage
        const value = d.dealValue ? `£${d.dealValue.toLocaleString('en-GB')}` : '£0'
        return `• ${d.dealName} (${d.prospectCompany}): ${score}% | ${stage} | ${value}`
      }).join('\n')
      const ps = ctx.pipelineSummary
      brainContext = [
        `Pipeline: ${ps.dealCount} open deals, £${ps.totalValue.toLocaleString('en-GB')}, avg score ${ps.avgScore}%`,
        '',
        'Relevant deals:',
        pipelineLines,
      ].join('\n')
    } catch {
      brainContext = formatBrainContext(brain, Object.keys(stageLabels).length > 0 ? stageLabels : undefined)
    }
  } else {
    brainContext = brain ? 'No deals yet. Encourage the user to add deals via the web app.' : 'No workspace data loaded.'
  }

  const dynamicBlock = buildSlackDynamicBlock(brainContext, stageLabels)

  // ── Build tool context (matches ToolContext interface) ───────────────────
  const toolContext: SlackInternalToolContext = {
    workspaceId,
    userId: slackUserId,       // no Clerk user ID in Slack context — use Slack ID
    plan: 'pro',               // Slack access implies pro plan
    brain: brain ?? null,
    activeDealId: null,
    stageLabels: Object.keys(stageLabels).length > 0 ? stageLabels : undefined,
    channelId,                 // pass channel so tools can store pending confirmations
  }

  const sdkTools = buildSdkTools(toolContext)

  // ── Call Claude with prompt caching ─────────────────────────────────────
  // Static block (tool descriptions + rules) is cached with Anthropic ephemeral
  // cache_control — reduces billed input tokens by ~80-90% for the cached portion.
  // Dynamic block (brain summary + stage labels) changes per-request, so no cache.
  let responseText: string
  try {
    const result = await generateText({
      model: getAnthropicClient()('claude-sonnet-4-6'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: SLACK_STATIC_SYSTEM_BLOCK,
              experimental_providerMetadata: {
                anthropic: { cacheControl: { type: 'ephemeral' } },
              },
            },
            {
              type: 'text',
              text: `${dynamicBlock}\n\nUser message: ${text}`,
            },
          ],
        },
      ],
      tools: sdkTools as Parameters<typeof generateText>[0]['tools'],
      maxSteps: 5,
      maxTokens: 2048,
    })
    responseText = result.text?.trim() || "I couldn't generate a response. Please try again."
  } catch (e) {
    console.error('[slack-agent] generateText failed:', e)
    responseText = "I ran into an issue. Please try again in a moment."
  }

  return {
    text: responseText,
    blocks: markdownToBlocks(responseText),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function textResult(text: string): SlackAgentResult {
  return { text, blocks: markdownToBlocks(text) }
}

/**
 * Look up the Clerk user ID for a Slack user in a workspace.
 * Returns null if the user hasn't set up the mapping.
 */
export async function getClerkUserForSlack(
  workspaceId: string,
  slackUserId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ clerkUserId: slackUserMappings.clerkUserId })
    .from(slackUserMappings)
    .where(and(
      eq(slackUserMappings.workspaceId, workspaceId),
      eq(slackUserMappings.slackUserId, slackUserId),
    ))
    .limit(1)
  return row?.clerkUserId ?? null
}
