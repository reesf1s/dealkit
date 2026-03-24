/**
 * Deal + Linear issue embedding generation using OpenAI text-embedding-3-small.
 *
 * Used for pgvector-based deal-to-Linear issue similarity matching.
 * Falls back gracefully when OPENAI_API_KEY is not set.
 *
 * Embeddings are 1536-dimensional vectors stored as:
 *  - deal_logs.deal_embedding  (vector(1536), stored as text in Drizzle)
 *  - linear_issues_cache.pgvector_embedding  (vector(1536))
 */

import { db } from '@/lib/db'
import { dealLogs, linearIssuesCache } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI client (lazy — only initialised when OPENAI_API_KEY is present)
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const EMBEDDING_MODEL = 'text-embedding-3-small'

/** Returns true if OpenAI embeddings are available. */
export function isEmbeddingAvailable(): boolean {
  return Boolean(OPENAI_API_KEY)
}

/**
 * Call the OpenAI Embeddings API and return a 1536-dim vector.
 * Throws if the call fails or OPENAI_API_KEY is not set.
 */
async function callOpenAIEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: text.slice(0, 8192), model: EMBEDDING_MODEL }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI embeddings error ${res.status}: ${err}`)
  }

  const data = await res.json() as { data: { embedding: number[] }[] }
  return data.data[0].embedding
}

// ─────────────────────────────────────────────────────────────────────────────
// Text preparation
// ─────────────────────────────────────────────────────────────────────────────

/** Build the text to embed for a deal. */
function dealEmbedText(deal: {
  dealName: string
  prospectCompany: string
  stage?: string | null
  notes?: string | null
  meetingNotes?: string | null
  dealRisks?: unknown
  lostReason?: string | null
  description?: string | null
}): string {
  const risks = Array.isArray(deal.dealRisks)
    ? (deal.dealRisks as string[]).join(' ')
    : ''

  return [
    `Deal: ${deal.dealName}`,
    `Company: ${deal.prospectCompany}`,
    deal.stage ? `Stage: ${deal.stage}` : '',
    risks,
    deal.notes ?? '',
    deal.meetingNotes ?? '',
    deal.lostReason ?? '',
    deal.description ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
}

/** Build the text to embed for a Linear issue. */
function issueEmbedText(issue: {
  title: string
  description?: string | null
  identifier?: string | null
}): string {
  return [
    issue.identifier ? `${issue.identifier}:` : '',
    issue.title,
    issue.description ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a 1536-dim embedding for a deal using OpenAI.
 * Throws if OPENAI_API_KEY is not set or the API call fails.
 */
export async function generateDealEmbedding(deal: {
  dealName: string
  prospectCompany: string
  stage?: string | null
  notes?: string | null
  meetingNotes?: string | null
  dealRisks?: unknown
  lostReason?: string | null
  description?: string | null
}): Promise<number[]> {
  const text = dealEmbedText(deal)
  return callOpenAIEmbedding(text)
}

/**
 * Generate a 1536-dim embedding for a Linear issue using OpenAI.
 */
export async function generateIssueEmbedding(issue: {
  title: string
  description?: string | null
  identifier?: string | null
}): Promise<number[]> {
  const text = issueEmbedText(issue)
  return callOpenAIEmbedding(text)
}

/**
 * Save a deal embedding to deal_logs.deal_embedding.
 * The column is vector(1536) in Postgres — Drizzle stores it as text, so we
 * pass a formatted string '[0.1,0.2,...]'.
 */
export async function upsertDealEmbedding(dealId: string, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`
  await db.execute(
    sql`UPDATE deal_logs SET deal_embedding = ${vectorStr}::vector WHERE id = ${dealId}::uuid`
  )
}

/**
 * Save a Linear issue embedding to linear_issues_cache.pgvector_embedding.
 */
export async function upsertIssueEmbedding(
  workspaceId: string,
  linearIssueId: string,
  embedding: number[],
): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`
  await db.execute(
    sql`UPDATE linear_issues_cache
        SET pgvector_embedding = ${vectorStr}::vector
        WHERE workspace_id = ${workspaceId}::uuid
          AND linear_issue_id = ${linearIssueId}`
  )
}

/**
 * Generate and store embeddings for all Linear issues in a workspace that
 * currently have a null pgvector_embedding. Processes in batches of 20 to
 * stay within OpenAI rate limits.
 *
 * Returns the number of issues embedded.
 */
export async function embedNullLinearIssues(workspaceId: string): Promise<number> {
  if (!isEmbeddingAvailable()) return 0

  const issues = await db.execute<{
    linear_issue_id: string
    title: string
    description: string | null
  }>(
    sql`SELECT linear_issue_id, title, description
        FROM linear_issues_cache
        WHERE workspace_id = ${workspaceId}::uuid
          AND pgvector_embedding IS NULL
        LIMIT 200`
  )

  if (issues.length === 0) return 0

  let embedded = 0
  const BATCH = 20

  for (let i = 0; i < issues.length; i += BATCH) {
    const batch = issues.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(async (issue) => {
        try {
          const vec = await generateIssueEmbedding({
            title: issue.title,
            description: issue.description,
            identifier: issue.linear_issue_id,
          })
          await upsertIssueEmbedding(workspaceId, issue.linear_issue_id, vec)
          embedded++
        } catch (err) {
          console.warn(`[deal-embeddings] Failed to embed issue ${issue.linear_issue_id}:`, err)
        }
      }),
    )
  }

  if (embedded > 0) {
    console.log(`[deal-embeddings] Embedded ${embedded} Linear issues for workspace ${workspaceId.slice(0, 8)}`)
  }

  return embedded
}

/**
 * Generate and store the embedding for a single deal.
 * No-ops if OPENAI_API_KEY is not set.
 */
export async function embedDealIfNeeded(dealId: string, workspaceId: string): Promise<void> {
  if (!isEmbeddingAvailable()) return

  try {
    const rows = await db.execute<{
      deal_name: string
      prospect_company: string
      stage: string
      notes: string | null
      meeting_notes: string | null
      deal_risks: unknown
      lost_reason: string | null
      description: string | null
    }>(
      sql`SELECT deal_name, prospect_company, stage, notes, meeting_notes, deal_risks, lost_reason, description
          FROM deal_logs
          WHERE id = ${dealId}::uuid AND workspace_id = ${workspaceId}::uuid
          LIMIT 1`
    )

    const deal = rows[0]
    if (!deal) return

    const vec = await generateDealEmbedding({
      dealName: deal.deal_name,
      prospectCompany: deal.prospect_company,
      stage: deal.stage,
      notes: deal.notes,
      meetingNotes: deal.meeting_notes,
      dealRisks: deal.deal_risks,
      lostReason: deal.lost_reason,
      description: deal.description,
    })

    await upsertDealEmbedding(dealId, vec)
  } catch (err) {
    console.warn(`[deal-embeddings] Failed to embed deal ${dealId}:`, err)
  }
}
