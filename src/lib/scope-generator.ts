/**
 * scope-generator.ts — Claude Haiku call to generate user story + acceptance criteria.
 *
 * Uses claude-haiku-4-5-20251001 (low cost, structured output, not agentic).
 * Prompt caching is applied to the system prompt (ephemeral cache_control).
 *
 * Result is cached in deal_linear_links.scoped_* columns — never re-generated
 * for the same issue+deal combination unless explicitly requested.
 */

import Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScopeGeneratorInput {
  dealName: string
  prospectCompany: string
  dealNotes: string | null
  dealRisks: string[]
  issueTitle: string
  issueDescription: string | null
}

export interface ScopedIssue {
  description: string
  userStory: string
  acceptanceCriteria: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt (cached)
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a product scoping assistant for a B2B SaaS sales team. Your job is to take a Linear issue and deal context, then produce a customer-centric user story and acceptance criteria that will help a developer understand what to build and why it matters for closing the deal.

Output ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "description": "1-2 sentence description of what this feature does from the prospect's perspective",
  "userStory": "As a [user type at prospect company], I want [capability], so that [business outcome].",
  "acceptanceCriteria": [
    "Criterion 1",
    "Criterion 2",
    "Criterion 3"
  ]
}

Rules:
- userStory must follow the "As a ... I want ... so that ..." format exactly
- acceptanceCriteria must be 3-5 items, each a complete testable statement
- Be specific to the deal context — mention the prospect company where relevant
- Focus on the business outcome, not implementation details
- Output only the JSON object, nothing else`

// ─────────────────────────────────────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────────────────────────────────────

export async function generateScopedIssue(
  input: ScopeGeneratorInput,
): Promise<ScopedIssue> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var is not set')

  const client = new Anthropic({ apiKey })

  const riskContext = input.dealRisks.length > 0
    ? `\nDeal risks this should address: ${input.dealRisks.slice(0, 3).join('; ')}`
    : ''

  const notesContext = input.dealNotes
    ? `\nDeal notes: ${input.dealNotes.slice(0, 400)}`
    : ''

  const issueDescContext = input.issueDescription
    ? `\nIssue description: ${input.issueDescription.slice(0, 500)}`
    : ''

  const userMessage = `Deal: ${input.dealName} (${input.prospectCompany})${notesContext}${riskContext}

Linear issue: ${input.issueTitle}${issueDescContext}

Generate the scoped user story and acceptance criteria for this issue.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      { role: 'user', content: userMessage },
    ],
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`scope-generator: failed to parse Haiku response as JSON: ${cleaned.slice(0, 200)}`)
  }

  const p = parsed as Record<string, unknown>
  if (
    typeof p.description !== 'string' ||
    typeof p.userStory !== 'string' ||
    !Array.isArray(p.acceptanceCriteria)
  ) {
    throw new Error(`scope-generator: unexpected response shape: ${JSON.stringify(p).slice(0, 200)}`)
  }

  return {
    description: p.description,
    userStory: p.userStory,
    acceptanceCriteria: (p.acceptanceCriteria as unknown[]).map(String),
  }
}
