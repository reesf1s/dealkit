/**
 * Release email generator — Phase 4 closed loop.
 *
 * Given deal context and a deployed Linear issue, generates a professional
 * release email that a CS/product rep can send to the prospect.
 *
 * Uses claude-haiku-4-5-20251001 with prompt caching on the system prompt.
 * Results are cached in mcp_action_log to avoid re-generating for the same combo.
 */

import { createAnthropic } from '@ai-sdk/anthropic'
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
}

interface DealContext {
  dealId: string
  dealName: string
  prospectCompany: string
  contactName: string | null
  notes: string | null
  successCriteria: string | null
  dealRisks: string[]
}

interface IssueContext {
  linearIssueId: string
  title: string
  description: string | null
  scopedUserStory: string | null  // from deal_linear_links (user story scoped in Phase 3)
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
    return { subject: r.subject, body: r.body }
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
  // Get the scoped user story from the link (set in Phase 3)
  const [link] = await db
    .select({ linearTitle: dealLinearLinks.linearTitle })
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
    scopedUserStory: null,  // Phase 3 stores user stories in the response but not in the DB column (yet)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior customer success manager writing release notification emails.

Your goal: write a concise, warm email from the product/CS team to a prospect notifying them that a capability they expressed interest in is now live — framing it as a reason to reconvene and move the deal forward.

Rules:
- Professional but conversational tone — not a cold email, not a marketing blast
- Lead with what shipped and why it matters to them specifically
- Connect the feature to the buyer's stated needs or success criteria
- Clear, soft CTA: "I'd love to show you this in action — are you free this week?"
- Keep the body under 150 words
- No emojis, no bullet lists in the email body
- Subject line: concise, specific (e.g. "The export feature you mentioned is live")

Output valid JSON only:
{
  "subject": "...",
  "body": "..."
}`

export async function generateReleaseEmail(
  workspaceId: string,
  deal: DealContext,
  issue: IssueContext,
): Promise<ReleaseEmail> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const anthropic = createAnthropic({ apiKey })

  const userPrompt = [
    `Company: ${deal.prospectCompany}`,
    deal.contactName ? `Contact name: ${deal.contactName}` : '',
    deal.notes ? `Deal notes (context): ${deal.notes.slice(0, 400)}` : '',
    deal.successCriteria ? `Their success criteria: ${deal.successCriteria.slice(0, 300)}` : '',
    deal.dealRisks.length > 0 ? `Key deal risks: ${deal.dealRisks.slice(0, 2).join('; ')}` : '',
    '',
    `Feature shipped: ${issue.title}`,
    issue.description ? `Feature description: ${issue.description.slice(0, 300)}` : '',
    issue.scopedUserStory ? `Scoped user story: ${issue.scopedUserStory.slice(0, 300)}` : '',
  ].filter(Boolean).join('\n')

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001', {
      cacheControl: true,  // enable prompt caching on qualifying messages
    }),
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 512,
  })

  // Parse JSON response
  let email: ReleaseEmail
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    email = JSON.parse(cleaned) as ReleaseEmail
    if (!email.subject || !email.body) throw new Error('Missing subject or body')
  } catch {
    // Fallback: extract manually if JSON parse fails
    const subjectMatch = text.match(/"subject"\s*:\s*"([^"]+)"/)
    const bodyMatch = text.match(/"body"\s*:\s*"([\s\S]+?)"(?:\s*[},])/)
    email = {
      subject: subjectMatch?.[1] ?? `${issue.title} is now live`,
      body: bodyMatch?.[1]?.replace(/\\n/g, '\n') ?? text.slice(0, 600),
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
    result: { subject: email.subject, body: email.body },
  })

  return email
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
