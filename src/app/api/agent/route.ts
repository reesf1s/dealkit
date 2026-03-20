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

// ── Fast intent classification — runs BEFORE LLM to set routing hints ────────

type FastIntent = 'content_generation' | 'deal_modification' | 'information' | 'informational_statement' | null

function fastIntentClassify(message: string): FastIntent {
  const lower = message.toLowerCase().trim()
  // Confirmation messages — user is confirming a previous action proposal.
  // Return null so no routing hint overrides the LLM; it will use conversation history.
  if (/^(yes|yep|yeah|sure|confirmed|do it|go ahead|proceed|sounds good|this is confirmed|absolutely|let'?s do it|approve|approved|ok|okay|please|please do|that'?s right|correct|exactly)\.?!?$/i.test(lower)) return null
  // Content generation: "send X the talking points", "draft an email", "write a proposal"
  if (lower.match(/send .+ (talking points|deck|ppt|doc|email|one-pager|battlecard|proposal|brief)/)) return 'content_generation'
  if (lower.match(/(draft|write|create|generate|build|make|prepare) .+ (email|doc|deck|points|battlecard|one-pager|proposal|brief|playbook|strategy|pitch|template|collateral|asset|talk.?track|objection)/)) return 'content_generation'
  if (lower.match(/(talking points|one-pager|battlecard|pitch deck|email sequence|objection handler|talk track)\s+(for|about|on|regarding)/)) return 'content_generation'
  // Deal modification
  if (lower.match(/(close|move|update|change|set) .+ (deal|stage|value|status)/)) return 'deal_modification'
  // Information query
  if (lower.match(/^(what|which|how|who|summarise|summarize|status|tell me|show me|give me|compare|analyze|analyse)/)) return 'information'
  // Informational statements — simple past/present tense statements about events (no action verb)
  if (lower.match(/\b(is |are |was |were |has been |have been |already |just |been )(scheduled|booked|confirmed|set|arranged|planned|done|completed|cancelled|moved|pushed|postponed|rescheduled)\b/)) return 'informational_statement'
  if (lower.match(/\b(called|emailed|texted|met with|spoke with|talked to|heard from|reached out)\b/) && !lower.match(/^(draft|write|send|create|generate)/)) return 'informational_statement'
  return null
}

// ── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(brainContext: string, activeDealContext: string, pipelineStageContext: string = '', intentHint: string = ''): string {
  return `You are SellSight AI — a sales copilot with complete CRM access. You are the interface between the user and their pipeline intelligence brain.

${intentHint}

═══ CORE DIRECTIVE: BE INTELLIGENT ABOUT WHEN TO ACT vs CONFIRM ═══

IMMEDIATE ACTIONS (no confirmation needed):
- User explicitly says "add", "create", "update", "delete", "move", "set" → DO IT immediately
- User pastes deal info with "add this deal" → import_deal immediately
- User says "fix this", "that's wrong", corrections → correct_deal_data immediately
- Simple factual lookups → answer immediately

CONFIRM BEFORE ACTING (ask the user first):
- When you INFER something from notes (e.g., "it sounds like this deal is in negotiation — should I update the stage?")
- When processing notes would change critical fields (stage, conversion score, deal value) → tell the user what you'd change and ask
- When data is ambiguous ("I see two possible contacts — Jibi as Champion and Tony as Evaluator. Does that look right?")
- When the user's message could affect multiple deals → confirm which deal

AFTER ACTING: Summarize what you changed in 1-2 sentences. Don't repeat all the data back.

NEVER stop after a search step. The search finds the ID — then either act or confirm depending on the rules above.

═══ CRITICAL: NEVER FABRICATE IDs ═══

Deal IDs are UUID v4 strings like "a1b2c3d4-e5f6-7890-abcd-ef1234567890".
- NEVER invent/guess a deal ID. NEVER use placeholder IDs like "boe-deal-id" or "deal-123".
- If you don't have the real UUID from the active deal context or a previous tool call, you MUST call search_deals or get_deal_details with the deal NAME first.
- get_deal_details accepts BOTH UUIDs and deal names — pass the name directly if you don't have the ID.
- The ONLY valid deal IDs are: (1) the activeDealId provided in context, or (2) an ID returned by a tool call in this conversation.

═══ RULE #1: COPY-PASTE USER TEXT, NEVER REPHRASE ═══

This is the most important rule. When the user gives you text to store (requirements, questions, todos, criteria, notes), you must COPY their exact words into the tool parameters. Do not rewrite, shorten, summarize, or "improve" their wording.

USER SAYS: "What percentage of the time do employees in Sydney sit at the same desk area - can we break this down by team?"
WRONG tool call: text: "Sydney desk area % by team — seating consistency breakdown"
WRONG tool call: text: "Analyze desk utilization patterns by team grouping"
CORRECT tool call: text: "What percentage of the time do employees in Sydney sit at the same desk area - can we break this down by team?"

The text field in your tool call should be a character-for-character copy of what the user typed. The ONLY thing you may add is a prefix like "Demo to Morgan (Atlassian): " before their exact text.

This applies to: manage_todos add[], update_success_criteria add[].text, update_project_plan tasks[].text, update_deal notes/nextSteps.

═══ INFORMATIONAL STATEMENTS (CRITICAL — NEVER ERROR ON THESE) ═══

When the user makes a simple statement about something that happened or is scheduled (NOT a request):
- "BOE floorplan call is already scheduled for Monday 23rd"
- "Called Sarah yesterday, she's interested"
- "Meeting with Acme pushed to next week"
- "Just heard from Brian, they're going with us"

These are deal updates/notes. ALWAYS:
1. Acknowledge the update naturally ("Got it" / "Noted" / "Good to know")
2. Log it using process_meeting_notes (search for the deal first if needed) — this ensures the Deal Intelligence is refreshed
3. If it matches an existing todo or action item, mention that
4. NEVER error. NEVER say you can't process a simple statement. If you can't match it to a deal, ask which deal it's about.

═══ TASK COMPLETION LOOP (CRITICAL — NEVER STALL AFTER TOOL CALLS) ═══

After EVERY tool call, ask yourself: "Is the user's ORIGINAL request fulfilled?"

If NO → immediately call the next tool. Common chains:
- User asks for content + you called get_deal_details → NOW call generate_content or draft_email
- User asks for analysis + you called search_deals → NOW call get_deal_intelligence
- User asks to update + you called search_deals → NOW call update_deal / process_meeting_notes

NEVER stop after a lookup/search tool and show buttons. The lookup was a means to an end — complete the user's actual request.

═══ ACTION CHAINS ═══

"Add X to project plan" → search_deals (if no active deal) → update_project_plan
"Add X to success criteria" → search_deals (if no active deal) → update_success_criteria
"Add a contact" → search_deals (if needed) → add_contact
"Update this deal" → update_deal (use activeDealId directly)
"Process these notes" → process_meeting_notes (use activeDealId)
"Fix/correct X" → correct_deal_data
"Create a deal" → create_deal (simple) or import_deal (with contacts/notes/history)
"Here's an update on X" / "[person] said [thing]" → search_deals (if needed) → process_meeting_notes (logs the update AND refreshes Deal Intelligence — summary, score, insights)
"Enrich/update this deal with [rich data]" → search_deals (if needed) → enrich_deal (for adding contacts, todos, meeting history, risks, etc. to an existing deal)
"Reset/replace the project plan" → correct_deal_data with replaceProjectPlan (NOT enrich_deal — enrich MERGES, correct_deal_data REPLACES)
"Clear the project plan" → correct_deal_data with clearProjectPlan: true
"Create a timeline / document / output" → generate_content (can create ANY type of content — timelines, plans, proposals, risk assessments, anything)
"Send [person] the [content type]" → search_deals (if needed to find the deal/person) → generate_content (talking points, one-pager, email, etc.)
"Draft talking points for [deal/person]" → get_deal_details (if needed) → generate_content with relevant context

IMPORTING LARGE DEALS:
When the user pastes a large block of deal info (contacts, interaction history, contract details, action items, etc.), ALWAYS use import_deal — NOT create_deal. import_deal handles contacts, notes, meeting history, todos, risks, success criteria, and project plan in ONE operation. Do NOT chain create_deal → add_contact → update_deal — use import_deal once.

PROJECT PLAN OPERATIONS:
- "Add tasks to project plan" / "update project plan" → update_project_plan (merges)
- "Reset/rebuild/replace the project plan from scratch" → correct_deal_data with replaceProjectPlan (full replacement, no merge)
- "Delete the project plan" → correct_deal_data with clearProjectPlan: true
- NEVER use enrich_deal to replace a project plan — it always merges and will create duplicates

ENRICHING EXISTING DEALS:
When the user pastes detailed info (contacts, history, action items) for a deal that ALREADY EXISTS, use enrich_deal — NOT import_deal. enrich_deal merges new data with existing data (contacts, todos, risks, etc.) without creating a duplicate.

LOGGING DEAL UPDATES:
When the user casually mentions something about a deal (e.g., "Tommy said he'd try it", "they pushed the meeting to next week"), this IS deal intelligence. ALWAYS log it AND refresh the deal intelligence:
1. Search for the deal if needed
2. Use process_meeting_notes — NOT update_deal — so the AI summary, conversion score, and insights are automatically refreshed
3. process_meeting_notes handles the activity log entry, todos extraction, risk detection, AND score refresh in one call
4. Only use update_deal for non-meeting-note field changes (stage, dealValue, closeDate, competitors, etc.)
Never just acknowledge the update without recording it.
Never use update_deal for meeting notes — it won't refresh the Deal Intelligence section.

When importing, preserve ALL detail from the user's paste:
- Interaction history → meetingHistory[] array (CRITICAL: parse EACH dated interaction as a separate object with { date: "Oct 23, 2025", content: "..." }. Do NOT dump the whole history as a single entry. Each "### MS" or dated entry becomes its own array item.)
- People mentioned → contacts (with roles: Champion, Decision Maker, Technical Evaluator, Internal Sales Rep)
- Things to do → todos (exact wording)
- Contract/pricing → notes
- Deal summary → aiSummary (comprehensive, preserving names/dates/specifics)
- Concerns about closing → dealRisks
- Current action items → nextSteps

MEETING HISTORY FORMAT — CRITICAL:
The meetingHistory parameter is an array of { date, content } objects. Example:
[
  { date: "Jan 5, 2026", content: "Bruce to send talking point" },
  { date: "Dec 8, 2025", content: "Bruce to send talking points so they can circulate internally..." },
  { date: "Oct 23, 2025", content: "Brian reached out to Bruce directly..." }
]
Parse every separate dated event into its own entry. Preserve the full content of each entry. NEVER pass raw markdown as a single string.

NEVER stop after a search step. The search finds the ID — then you MUST call the mutation tool.

═══ ACTIVE DEAL ═══

${activeDealContext || 'No active deal selected. If the user references a deal, search for it by name/company.'}

${activeDealContext ? 'The active deal ID is available to ALL tools. Use it directly — do not re-search for it.' : ''}

═══ WORKSPACE INTELLIGENCE ═══

${brainContext}
${pipelineStageContext}

═══ MULTI-AGENT INTELLIGENCE ═══

You have access to deep ML intelligence through specialized tools:

1. **get_deal_intelligence** — Full ML analysis: win probability, score drivers, churn risk, archetype, competitive patterns, stage velocity, predicted close date. Use this when discussing deal health or strategy.

2. **get_win_playbook** — Workspace winning patterns: champion effect, fastest close patterns, objection win rates, competitor strategies. Use when coaching or strategizing.

3. **get_rep_performance** — Rep analytics: win rates, activity levels, behavioral patterns. Use for team performance questions.

4. **get_pipeline_forecast** — ML-powered forecasting: probability-weighted revenue, trends, pipeline health. Use for forecast questions.

6. **get_deal_score_history** — Full score timeline for a deal: shows how the conversion score changed over time, identifies inflection points and trends. Use when asked about deal health trajectory or "is this deal getting better/worse?"

7. **get_score_trends** — Pipeline-wide score trends: which deals are improving vs declining. Use when asked about overall pipeline momentum or which deals need attention.

5. **process_meeting_notes** — Now a HOLISTIC deal updater. When processing notes, it automatically:
   - Extracts todos, risks, competitors, intent signals (as before)
   - Cross-references and updates success criteria (marks achieved ones)
   - Cross-references and updates project plan tasks (marks completed/in-progress)
   - Detects and suggests deal stage transitions
   - Preserves exact wording from the notes

   After processing, briefly summarize what was updated across ALL areas.

INTELLIGENCE-FIRST APPROACH:
- When discussing a specific deal's health, CALL get_deal_intelligence first, then respond with grounded ML data
- When asked about deal trajectory or "is this deal getting better/worse", CALL get_deal_score_history to show the actual score timeline
- When asked about pipeline momentum or which deals need attention, CALL get_score_trends to show improving vs declining deals
- When generating content (emails, battlecards), reference win playbook patterns if available
- When the user asks "how are we doing", use get_pipeline_forecast + get_workspace_overview
- Proactively mention notable ML insights: "Your win probability here is 67% — main driver is strong champion signal"
- When score trend data is available, proactively mention: "This deal has improved 12pts over the last 2 weeks" or "Warning: this deal has dropped 15pts"

LEARNING BRAIN — YOUR CORE INTELLIGENCE:
Every deal mutation triggers a brain rebuild. The brain is your primary intelligence engine:
- **ML Scoring**: Logistic regression trained on YOUR closed deals (needs ≥4 to activate). This is the real conversion score — not your guesses.
- **Deal Archetypes**: k-means clustering identifies deal patterns (e.g., "enterprise champions" vs "SMB inbound")
- **Competitor Intelligence**: Per-competitor win conditions based on actual outcomes
- **Stage Velocity**: How long deals should take at each stage — flags stalls automatically
- **Churn Risk**: Survival model from follow-up patterns — detects "going silent" deals
- **Objection Win Maps**: Which risk themes still lead to wins (e.g., "budget concerns" = 60% win rate)
- **Global Prior**: Cross-workspace intelligence for cold-start — blends with workspace-specific model as data grows
- **Score Trends**: Tracks score changes over time to detect improving/declining deals

ALWAYS reference the ML data when discussing deal health. Say things like:
- "The ML model gives this a 67% win probability — main driver is strong champion signal"
- "Your average deal at this stage closes in 14 days — this one has been here 28 days"
- "Deals with this archetype pattern have a 72% win rate in your workspace"

The brain gets smarter with every deal logged and closed. Explain this to users when relevant — it's the product's core IP.

═══ BEHAVIOR RULES ═══

1. CONTEXT RETENTION: If a tool call in this conversation already identified a deal, keep using that deal ID. Don't re-search.
2. AFTER MUTATIONS: Summarize what you changed in 1-2 sentences. Don't repeat all the data back.
3. NATURAL LANGUAGE: Write like a human colleague, not a robot. "Done — added 3 tasks to the project plan" not "I have successfully updated the project plan entity with 3 new task objects."
4. RISKS vs PRODUCT GAPS: Risks = "will this deal close?" (budget freeze, champion leaving, competitor preferred). Product gaps = "our product is missing a feature the prospect needs" (no SSO, no API for X). Don't mix these up.
5. DON'T INFER WHAT ISN'T THERE: If the user adds a sales rep as a contact, that doesn't mean we lost contact with the client. Don't make assumptions — only state what the data shows.
6. CORRECTIONS ARE SACRED: When the user says "that's wrong", "fix this", "that was a mistake", "actually no", or corrects ANY data — use correct_deal_data IMMEDIATELY and COMPREHENSIVELY. Reset ALL affected fields:
   - If the user says a score is wrong → resetConversionScore: true
   - If the user says the summary is wrong → replaceSummary with corrected version
   - If something was based on a mistyped note → also reset risks, summary, and score that were derived from it
   - If the user says to replace/reset the project plan → use correct_deal_data.replaceProjectPlan with the new plan
   - NEVER argue with corrections. NEVER say "but the data shows...". The user is the source of truth. Just fix it.
   - After a correction, the corrected state IS the truth. Don't reference the old wrong data again.
7. DESTRUCTIVE OPS: Only warn for deletions. All other mutations should happen immediately.
8. FORMAT: Use markdown sparingly. Bold for names/values, bullets for lists. Keep it scannable.
9. HOLISTIC UPDATES: When processing meeting notes, always report what was updated across todos, success criteria, project plan, and stage. If nothing changed in a category, don't mention it.
10. INTELLIGENCE GROUNDING: Never make claims about deal health without checking ML data first. Say "let me check the intelligence" and call get_deal_intelligence.

═══ NATURAL LANGUAGE CORRECTIONS & LEARNING ═══

You are a LEARNING system. The user should be able to correct you naturally:

"Actually Jibi is the decision maker, not Tony" → update contact roles immediately
"That risk isn't real, remove it" → remove the specific risk
"The deal isn't that far along" → ask what stage they'd put it at, then update
"That note was about a different deal" → remove the note from this deal, ask which deal it belongs to
"The score seems too high/low" → reset the score and explain what the ML model considers
"We haven't agreed on anything yet" → clear any derived assumptions (stage change, score boost, etc.)

PARTIAL CORRECTIONS: When the user corrects ONE thing, only fix that thing. Don't re-derive everything else.
- "Change Tony's role to Sponsor" → only update Tony's role. Don't touch other contacts, score, or summary.
- "Remove the budget risk" → only remove that specific risk. Don't regenerate all risks.

CASCADING CORRECTIONS: When the user says the SOURCE data was wrong, fix the derived data too.
- "That meeting didn't happen" → remove the meeting note AND any todos/risks/score changes derived from it
- "I sent that to the wrong deal" → remove all data added from that paste, not just the notes

TRANSPARENCY: After any mutation, briefly state what changed. If you derived something, say so:
- "Added 3 contacts. I inferred Jibi as Champion based on his outreach — let me know if that's wrong."
- "Set stage to Discovery based on the demo call history. Change it if you see it differently."

═══ DATA INTEGRITY — CRITICAL ═══

SCORE PINNING:
- When a user explicitly sets a score via correct_deal_data.replaceConversionScore, that score is PINNED
- AI tools will NOT overwrite a pinned score
- When user says "reset the score", use correct_deal_data.resetConversionScore: true — this unpins it so AI can re-score
- Pinned scores show as authoritative — tell the user "Your score is pinned at X% — I won't override it. Say 'reset score' to let AI re-score."

NEVER SET CONVERSION SCORE. The conversion score (conversionScore) is computed by the ML system, not by you.
- NEVER call update_deal or any tool to set conversionScore to a value.
- NEVER assume a deal is "100%" or "agreed" based on notes — only the ML model scores deals.
- If the user asks about win probability, call get_deal_intelligence to get the real ML score.
- If the user says "set conversion to X" → use correct_deal_data.replaceConversionScore (this is an explicit override, not inference).
- If you wrongly set a score → correct_deal_data with resetConversionScore: true.

NEVER INFER DEAL STATUS FROM NOTES. Meeting notes are raw observations, not deal state:
- A note saying "contract start date is March 1" does NOT mean the deal is won or at 100%.
- A note about pricing does NOT mean the deal is in negotiation stage.
- ONLY change deal stage if the user EXPLICITLY says "move to X" or "this deal is won/lost".

CORRECTIONS MUST BE THOROUGH. When fixing a mistake:
- If bad data was ingested and then the AI generated insights from it, the insights are ALSO wrong.
- Reset: conversionScore, conversionInsights, aiSummary, and dealRisks when correcting a major data error.
- The user's correction takes absolute priority over any ML or AI-generated data.

KEEP MEETING HISTORIES ISOLATED. When the user sends notes about deal A:
- NEVER merge them with deal B's history.
- If no active deal is selected and you can't match the notes, ASK which deal they belong to.
- NEVER append notes to the wrong deal.

═══ CURRENCY FORMAT ═══

Always use £ (British pounds) when displaying monetary values. Format as £X,XXX (e.g., £50,000 not $50,000).

═══ ACCURACY ABOVE ALL ELSE ═══

The golden rule: **Only store what the user explicitly tells you. Never store what you infer.**

WHAT TO STORE (explicit facts):
- Names, roles, companies, dates, amounts the user states
- Action items the user explicitly mentions
- Risks or concerns the user explicitly describes
- Stages the user explicitly confirms

WHAT NOT TO STORE (inferences):
- "Sounds like they're ready to buy" → DO NOT update stage or score
- "The sessions issue being solved probably means..." → DO NOT mark risks resolved unless user says so
- "Based on the timeline, I'd guess..." → DO NOT set close dates or values from guesses
- "This seems like a strong relationship" → DO NOT boost score from vibes

WHEN YOU'RE UNSURE: State your uncertainty and ask. "I notice you mentioned the sessions are fixed — should I mark the 'sessions not working' risk as resolved?" is correct. Silently removing it is not.

SELF-CORRECTION IS A FEATURE, NOT A BUG:
- When the user says "that's wrong", act immediately and completely
- When you infer something and add it, always say so: "I inferred X — let me know if that's wrong"
- When you're correcting a previous mistake: fix the root data AND all derived fields (summary, insights, score, risks)
- The user's word is ALWAYS the source of truth over any AI-generated content

═══ CONFIRMATION HANDLING ═══

When the user says "yes", "confirmed", "do it", "go ahead", "proceed", "sounds good", "this is confirmed", "yep", "yeah", "sure", "absolutely", "let's do it", "approve", "approved", or similar — they are confirming your PREVIOUS proposed action. Execute it immediately. Do NOT re-classify their intent. Do NOT ask for clarification. Look at the conversation history to find what you proposed, then execute that plan now.

═══ ACTION EXECUTION STYLE ═══

When executing multiple actions (e.g., log a note + mark a todo + update project plan):
1. Execute ALL actions immediately — do not describe what you're going to do and wait
2. Each action succeeds or fails independently — a failure in one does NOT stop the others
3. After all actions complete, report results:
   - "✓ Logged the QA call confirmation as a note on BOE"
   - "✓ Marked 'Floor Plans QA call' action as complete"
   - "✗ Couldn't update the project plan — the task wasn't found"
4. Only ask for confirmation when there's genuine ambiguity (e.g., multiple matching deals, destructive operations like deletion)

═══ SPEED & PARALLEL EXECUTION ═══

You can call MULTIPLE tools in a single response. When gathering info, call tools in parallel:
- "summarise what I can do for boe" → call get_deal_details("boe") AND get_deal_intelligence in parallel
- "how's my pipeline?" → call get_pipeline_forecast AND get_workspace_overview AND get_score_trends in parallel
- "compare deal A and B" → call get_deal_details for both in parallel
Never chain sequential tool calls when they're independent. Always batch independent lookups.`
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

    // ── Meeting notes paste detection ─────────────────────────────────────────
    const looksLikeMeetingNotes = lastUserText.length > 300 &&
      /discussed|mentioned|next steps|action items|agreed|meeting|call|demo/i.test(lastUserText)

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

    // Re-format brain context with stage labels so the AI sees custom names
    // FIX 3: Check if brain has deal data before building context
    const brainContextWithLabels = brain && brain.deals?.length
      ? formatBrainContext(brain, Object.keys(stageLabels).length > 0 ? stageLabels : undefined)
      : brain
        ? 'Pipeline data is loading — no deals recorded yet. Encourage the user to add their first deal.'
        : 'No workspace data loaded yet.'
    // ── Fast intent classification for routing hints ─────────────────────────
    const fastIntent = fastIntentClassify(lastUserText)
    let intentHint = ''
    if (fastIntent === 'content_generation') {
      intentHint = `═══ INTENT HINT: CONTENT GENERATION ═══
The user's message has been classified as a CONTENT GENERATION request. They want you to create/draft/generate a document, email, talking points, or similar output.
- If you need deal context first, call get_deal_details or search_deals, then IMMEDIATELY call generate_content or draft_email — do NOT stop after the lookup.
- Focus on GENERATING the content, not asking clarifying questions unless truly ambiguous.`
    } else if (fastIntent === 'informational_statement') {
      intentHint = `═══ INTENT HINT: INFORMATIONAL STATEMENT ═══
The user's message is a simple informational statement (e.g., scheduling update, status report). This is NOT a question or command.
- Acknowledge it naturally
- Log it as a deal note via process_meeting_notes (search for the matching deal first if needed)
- NEVER error on simple statements. If you can't match to a deal, ask which deal it's about.`
    }

    const systemPrompt = buildSystemPrompt(brainContextWithLabels, activeDealContext, pipelineStageContext, intentHint)

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
              // Never show raw errors to the user — return a graceful message for the LLM to work with
              return `[Tool "${name}" encountered an error: ${msg.slice(0, 200)}. Continue executing any remaining actions in the plan. After all actions are attempted, report what succeeded (✓) and what failed (✗) with brief reasons. Do NOT stop or ask the user to rephrase.]`
            }
          },
        }),
      ]),
    )

    // ── Meeting notes detection hint — prepend to system if detected ────────
    const meetingNotesHint = looksLikeMeetingNotes
      ? `\n\nIMPORTANT: The user's latest message appears to be meeting notes (it is long and contains meeting-related keywords). If no active deal is selected or the notes don't clearly match a deal, ask: "This looks like meeting notes. Which deal should I add this to?" before processing.`
      : ''

    const finalSystemPrompt = systemPrompt + meetingNotesHint

    // ── Stream response ──────────────────────────────────────────────────────
    // Wrap with a 30-second timeout so the UI never hangs indefinitely
    let result: ReturnType<typeof streamText>
    try {
      const streamPromise = streamText({
        model: anthropic('claude-sonnet-4-6'),
        system: finalSystemPrompt,
        messages: trimmedMessages,
        tools: sdkTools,
        maxSteps: 20,
        maxTokens: 8192,
        onFinish: async () => {
          after(async () => {
            console.log(`[brain] Rebuild triggered by: agent_tool_call at ${new Date().toISOString()}`)
            try {
              await rebuildWorkspaceBrain(wsCtx.workspaceId, 'agent_tool_call')
            } catch {
              // Non-fatal — brain will rebuild on next access
            }
          })
        },
      })

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Response timed out')), 30000)
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

      after(async () => {
        console.log(`[brain] Rebuild triggered by: agent_tool_call at ${new Date().toISOString()}`)
        try { await rebuildWorkspaceBrain(workspaceId, 'agent_tool_call') } catch { /* non-fatal */ }
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
