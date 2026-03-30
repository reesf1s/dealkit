/**
 * Release email generator — Phase 4 closed loop.
 *
 * Given deal context and a deployed Linear issue, generates a professional
 * release email that a CS/product rep can send to the prospect.
 *
 * Uses claude-haiku-4-5-20251001 with prompt caching on the system prompt.
 * Results are cached in mcp_action_log to avoid re-generating for the same combo.
 */

import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { db } from '@/lib/db'
import { mcpActionLog, dealLinearLinks, dealLogs, linearIssuesCache } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReleaseEmail {
  subject: string
  body: string
  /** Pre-drafted Slack message the rep can send to schedule a call with the prospect */
  callSchedulingMessage?: string
}

interface DealContext {
  dealId: string
  dealName: string
  prospectCompany: string
  contactName: string | null
  notes: string | null
  successCriteria: string | null
  dealRisks: string[]
  contacts: { name?: string; email?: string; title?: string }[]
}

interface IssueContext {
  linearIssueId: string
  title: string
  description: string | null
  scopedUserStory: string | null  // from deal_linear_links (user story scoped in Phase 3)
  addressesRisk: string | null    // verbatim objection text this issue addresses
}

// ─────────────────────────────────────────────────────────────────────────────
// Cached result lookup
// ─────────────────────────────────────────────────────────────────────────────

export async function getCachedReleaseEmail(
  workspaceId: string,
  dealId: string,
  linearIssueId: string,
): Promise<ReleaseEmail | null> {
  const rows = await db
    .select({ result: mcpActionLog.result })
    .from(mcpActionLog)
    .where(and(
      eq(mcpActionLog.workspaceId, workspaceId),
      eq(mcpActionLog.dealId, dealId),
      eq(mcpActionLog.linearIssueId, linearIssueId),
      eq(mcpActionLog.actionType, 'release_email_generated'),
      eq(mcpActionLog.status, 'complete'),
    ))
    .limit(1)

  const row = rows[0]
  if (!row?.result) return null

  const r = row.result as Record<string, unknown>
  if (typeof r.subject === 'string' && typeof r.body === 'string') {
    return {
      subject: r.subject,
      body: r.body,
      callSchedulingMessage: typeof r.callSchedulingMessage === 'string' ? r.callSchedulingMessage : undefined,
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Context fetchers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchDealContext(workspaceId: string, dealId: string): Promise<DealContext | null> {
  const [deal] = await db
    .select({
      id: dealLogs.id,
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      prospectName: dealLogs.prospectName,
      contacts: dealLogs.contacts,
      notes: dealLogs.notes,
      successCriteria: dealLogs.successCriteria,
      dealRisks: dealLogs.dealRisks,
    })
    .from(dealLogs)
    .where(and(
      eq(dealLogs.id, dealId),
      eq(dealLogs.workspaceId, workspaceId),
    ))
    .limit(1)

  if (!deal) return null

  return {
    dealId: deal.id,
    dealName: deal.dealName,
    prospectCompany: deal.prospectCompany,
    contactName: deal.prospectName ?? null,
    contacts: (deal.contacts as { name?: string; email?: string; title?: string }[]) ?? [],
    notes: deal.notes ?? null,
    successCriteria: deal.successCriteria ?? null,
    dealRisks: (deal.dealRisks as string[]) ?? [],
  }
}

async function fetchIssueContext(
  workspaceId: string,
  dealId: string,
  linearIssueId: string,
): Promise<IssueContext | null> {
  // Get the scoped user story + objection mapping from the link (set in Phase 3)
  const [link] = await db
    .select({
      linearTitle: dealLinearLinks.linearTitle,
      scopedUserStory: dealLinearLinks.scopedUserStory,
      addressesRisk: dealLinearLinks.addressesRisk,
    })
    .from(dealLinearLinks)
    .where(and(
      eq(dealLinearLinks.workspaceId, workspaceId),
      eq(dealLinearLinks.dealId, dealId),
      eq(dealLinearLinks.linearIssueId, linearIssueId),
    ))
    .limit(1)

  // Get issue details from cache
  const [cached] = await db
    .select({
      title: linearIssuesCache.title,
      description: linearIssuesCache.description,
    })
    .from(linearIssuesCache)
    .where(and(
      eq(linearIssuesCache.workspaceId, workspaceId),
      eq(linearIssuesCache.linearIssueId, linearIssueId),
    ))
    .limit(1)

  const title = cached?.title ?? link?.linearTitle ?? linearIssueId

  return {
    linearIssueId,
    title,
    description: cached?.description ?? null,
    scopedUserStory: link?.scopedUserStory ?? null,
    addressesRisk: link?.addressesRisk ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior customer success manager writing release notification emails and helping the sales rep schedule a follow-up call.

Your goal: write a concise, warm email from the product/CS team to a prospect notifying them that capabilities they expressed interest in are now live — framing it as a reason to reconvene and move the deal forward.

Also draft a short Slack message the rep can send internally (or directly to the prospect on Slack if they're connected) to suggest a call.

Rules for the email:
- Professional but conversational tone — not a cold email, not a marketing blast
- CRITICAL: If an objection signal is provided, echo the prospect's EXACT concern in the email body. Use phrasing like "You mentioned that [verbatim objection] — we've built [feature] specifically to fix that."
- Do NOT paraphrase or soften the objection — use their words so they recognise their own feedback
- Lead with what shipped and why it matters to them specifically
- Clear, soft CTA: "I'd love to show you this in action — are you free this week?"
- Keep the body under 200 words
- No emojis, no bullet lists in the email body
- Subject line: concise, specific (e.g. "The export feature you asked about is live")

Rules for the call scheduling message:
- 1-2 sentences max — a casual Slack message the rep could send to the prospect
- Reference the specific feature(s) that shipped
- Suggest a specific short window e.g. "15 mins this week"
- Warm and direct — not salesy

Output valid JSON only:
{
  "subject": "...",
  "body": "...",
  "callSchedulingMessage": "..."
}`

export async function generateReleaseEmail(
  workspaceId: string,
  deal: DealContext,
  issue: IssueContext,
): Promise<ReleaseEmail> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const anthropic = createOpenAI({ apiKey })

  // Build primary contact info
  const primaryContact = deal.contacts?.[0]
  const contactName = deal.contactName ?? primaryContact?.name ?? null
  const contactEmail = primaryContact?.email ?? null

  const userPrompt = [
    `Company: ${deal.prospectCompany}`,
    contactName ? `Contact name: ${contactName}` : '',
    contactEmail ? `Contact email: ${contactEmail}` : '',
    deal.notes ? `Deal notes (context): ${deal.notes.slice(0, 400)}` : '',
    deal.successCriteria ? `Their success criteria: ${deal.successCriteria.slice(0, 300)}` : '',
    deal.dealRisks.length > 0 ? `Their objections (use these verbatim in the email): ${deal.dealRisks.slice(0, 3).join('; ')}` : '',
    issue.addressesRisk ? `Primary objection this feature addresses (echo this exactly): "${issue.addressesRisk}"` : '',
    '',
    `Feature shipped: ${issue.title}`,
    issue.description ? `Feature description: ${issue.description.slice(0, 300)}` : '',
    issue.scopedUserStory ? `Scoped user story (maps to their needs): ${issue.scopedUserStory.slice(0, 300)}` : '',
  ].filter(Boolean).join('\n')

  const { text } = await generateText({
    model: anthropic('gpt-5.4-mini'),
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 700,
  })

  // Parse JSON response
  let email: ReleaseEmail
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(cleaned) as ReleaseEmail
    if (!parsed.subject || !parsed.body) throw new Error('Missing subject or body')
    email = parsed
  } catch {
    const subjectMatch = text.match(/"subject"\s*:\s*"([^"]+)"/)
    const bodyMatch = text.match(/"body"\s*:\s*"([\s\S]+?)"(?:\s*[},])/)
    const callMatch = text.match(/"callSchedulingMessage"\s*:\s*"([^"]+)"/)
    email = {
      subject: subjectMatch?.[1] ?? `${issue.title} is now live`,
      body: bodyMatch?.[1]?.replace(/\\n/g, '\n') ?? text.slice(0, 600),
      callSchedulingMessage: callMatch?.[1] ?? undefined,
    }
  }

  // Cache in mcp_action_log
  await db.insert(mcpActionLog).values({
    workspaceId,
    actionType: 'release_email_generated',
    dealId: deal.dealId,
    linearIssueId: issue.linearIssueId,
    triggeredBy: 'webhook',
    status: 'complete',
    result: { subject: email.subject, body: email.body, callSchedulingMessage: email.callSchedulingMessage ?? null },
  })

  return email
}

// ─────────────────────────────────────────────────────────────────────────────
// generateBatchReleaseEmail — for when ALL linked issues for a deal ship
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SYSTEM_PROMPT = `You are a senior customer success manager writing a release notification email when multiple features have shipped for a specific prospect.

Your goal: write a compelling email showing the prospect that you've shipped everything they needed — this is the moment to re-engage and close the deal.

Also draft a short Slack message the rep can send to the prospect to schedule a call.

Rules for the email:
- Lead with the business impact: "We've shipped everything on your wishlist"
- CRITICAL: For each feature, explicitly echo the prospect's VERBATIM objection text. Say "You told us [exact objection] — we built [feature] to fix that." Use their own words so they recognise their feedback.
- Do NOT paraphrase — use the exact objection phrases provided in the context
- Make the prospect feel heard — you built this specifically for them
- Clear CTA: propose a specific call to do a live walkthrough
- Keep under 250 words, no bullet lists, professional but warm
- Subject line should feel personal and specific

Rules for the call scheduling message:
- 1-2 sentences, casual Slack message
- "Hey [name], we just shipped [X and Y] — would love to show you in 15 mins, free this week?"
- Use their actual name and feature names

Output valid JSON only:
{
  "subject": "...",
  "body": "...",
  "callSchedulingMessage": "..."
}`

export interface BatchReleaseEmail {
  subject: string
  body: string
  callSchedulingMessage: string
  /** Summary of what shipped and which objection it addresses — for the Slack DM */
  shippedSummary: { issueId: string; title: string; addressesObjection: string }[]
}

export async function generateBatchReleaseEmail(
  workspaceId: string,
  deal: DealContext,
  issues: IssueContext[],
): Promise<BatchReleaseEmail | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const anthropic = createOpenAI({ apiKey })

  const primaryContact = deal.contacts?.[0]
  const contactName = deal.contactName ?? primaryContact?.name ?? null

  const issuesList = issues.map((i, idx) => {
    const objection = i.addressesRisk ? ` | Addresses objection (echo verbatim): "${i.addressesRisk}"` : ''
    return `${idx + 1}. "${i.title}"${i.description ? ` — ${i.description.slice(0, 200)}` : ''}${i.scopedUserStory ? ` (user story: ${i.scopedUserStory.slice(0, 150)})` : ''}${objection}`
  }).join('\n')

  const userPrompt = [
    `Company: ${deal.prospectCompany}`,
    contactName ? `Contact name: ${contactName}` : '',
    deal.notes ? `Deal context: ${deal.notes.slice(0, 400)}` : '',
    deal.successCriteria ? `Their success criteria: ${deal.successCriteria.slice(0, 300)}` : '',
    deal.dealRisks.length > 0
      ? `Their objections (use these verbatim in the email):\n${deal.dealRisks.slice(0, 4).map(r => `- "${r}"`).join('\n')}`
      : '',
    '',
    `Features shipped (${issues.length} total):`,
    issuesList,
  ].filter(Boolean).join('\n')

  const { text } = await generateText({
    model: anthropic('gpt-5.4-mini'),
    system: BATCH_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 900,
  })

  let parsed: { subject: string; body: string; callSchedulingMessage: string }
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    parsed = JSON.parse(cleaned)
    if (!parsed.subject || !parsed.body) throw new Error('Missing fields')
  } catch {
    const subjectMatch = text.match(/"subject"\s*:\s*"([^"]+)"/)
    const bodyMatch = text.match(/"body"\s*:\s*"([\s\S]+?)"(?:\s*[},])/)
    const callMatch = text.match(/"callSchedulingMessage"\s*:\s*"([^"]+)"/)
    parsed = {
      subject: subjectMatch?.[1] ?? `Everything you asked for is live`,
      body: bodyMatch?.[1]?.replace(/\\n/g, '\n') ?? text.slice(0, 800),
      callSchedulingMessage: callMatch?.[1] ?? `Hey${contactName ? ` ${contactName}` : ''}, we just shipped the features you flagged — would love to show you in 15 mins, free this week?`,
    }
  }

  // Build shipped summary — use the stored addressesRisk if available, fall back gracefully
  const shippedSummary = issues.slice(0, 5).map((issue, idx) => ({
    issueId: issue.linearIssueId,
    title: issue.title,
    addressesObjection: issue.addressesRisk ?? deal.dealRisks[idx] ?? deal.dealRisks[0] ?? 'a key blocker the team raised',
  }))

  return {
    subject: parsed.subject,
    body: parsed.body,
    callSchedulingMessage: parsed.callSchedulingMessage,
    shippedSummary,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point — check cache first, then generate
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrGenerateReleaseEmail(
  workspaceId: string,
  dealId: string,
  linearIssueId: string,
): Promise<ReleaseEmail | null> {
  // Check cache
  const cached = await getCachedReleaseEmail(workspaceId, dealId, linearIssueId)
  if (cached) return cached

  // Fetch context
  const deal = await fetchDealContext(workspaceId, dealId)
  if (!deal) return null

  const issue = await fetchIssueContext(workspaceId, dealId, linearIssueId)
  if (!issue) return null

  return generateReleaseEmail(workspaceId, deal, issue)
}
