/**
 * Deal-to-Linear issue matching using pgvector cosine similarity.
 *
 * Primary path: pgvector (OpenAI text-embedding-3-small, 1536-dim vectors).
 * Fallback path: TF-IDF cosine similarity via semantic-search.ts.
 *
 * The pgvector path requires:
 *  1. OPENAI_API_KEY env var
 *  2. pgvector extension enabled in Postgres
 *  3. linear_issues_cache.pgvector_embedding populated (via embedNullLinearIssues)
 *
 * If any requirement is missing or the query fails, it falls back silently.
 */

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { isEmbeddingAvailable, generateDealEmbedding } from '@/lib/deal-embeddings'
import { findSimilarLinearIssues } from '@/lib/semantic-search'
import { extractDealSignalText } from '@/lib/linear-signal-match'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LinearIssueMatch {
  issueId: string       // e.g. "ENG-42"
  similarity: number    // 0.0 – 1.0
  source: 'pgvector' | 'tfidf'
}

// ─────────────────────────────────────────────────────────────────────────────
// pgvector path
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run pgvector cosine similarity search for a deal against all Linear issues
 * in the workspace that have embeddings.
 *
 * Returns issues with similarity > 0.6, ordered by similarity desc.
 */
async function findMatchingIssuesPgvector(
  dealId: string,
  workspaceId: string,
  dealData: {
    dealName: string
    prospectCompany: string
    stage?: string | null
    notes?: string | null
    meetingNotes?: string | null
    dealRisks?: unknown
    lostReason?: string | null
    description?: string | null
  },
  limit = 25,
): Promise<LinearIssueMatch[]> {
  // 1. Get or generate deal embedding
  let dealEmbedding: number[] | null = null

  // Try to load existing deal_embedding from DB first
  const existing = await db.execute<{ deal_embedding: string | null }>(
    sql`SELECT deal_embedding::text FROM deal_logs WHERE id = ${dealId}::uuid LIMIT 1`
  )

  if (existing[0]?.deal_embedding) {
    try {
      // Postgres returns vector as "[0.1,0.2,...]" string
      dealEmbedding = JSON.parse(existing[0].deal_embedding)
    } catch {
      // fall through to regenerate
    }
  }

  if (!dealEmbedding) {
    dealEmbedding = await generateDealEmbedding(dealData)
    // Persist for future calls (fire-and-forget)
    const vectorStr = `[${dealEmbedding.join(',')}]`
    db.execute(
      sql`UPDATE deal_logs SET deal_embedding = ${vectorStr}::vector WHERE id = ${dealId}::uuid`
    ).catch(() => { /* non-fatal */ })
  }

  const vectorStr = `[${dealEmbedding.join(',')}]`

  // 2. pgvector cosine similarity search
  const rows = await db.execute<{
    linear_issue_id: string
    similarity: number
  }>(
    sql`SELECT linear_issue_id,
               1 - (pgvector_embedding <=> ${vectorStr}::vector) AS similarity
        FROM linear_issues_cache
        WHERE workspace_id = ${workspaceId}::uuid
          AND pgvector_embedding IS NOT NULL
          AND status NOT IN ('Done', 'Cancelled', 'Duplicate')
        ORDER BY pgvector_embedding <=> ${vectorStr}::vector
        LIMIT ${limit}`
  )

  return rows
    .filter(r => r.similarity > 0.6)
    .map(r => ({
      issueId: r.linear_issue_id,
      similarity: Math.round(r.similarity * 1000) / 1000,
      source: 'pgvector' as const,
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the top N Linear issues most similar to a deal.
 *
 * Uses pgvector when OPENAI_API_KEY is set and embeddings exist.
 * Falls back to TF-IDF when pgvector is unavailable or returns no results.
 *
 * @param dealId       UUID of the deal in deal_logs
 * @param workspaceId  UUID of the workspace
 * @param dealData     Deal fields needed for embedding / signal extraction
 * @param opts         Optional: limit (default 25), minSimilarity (default 0.4)
 */
export async function findMatchingIssues(
  dealId: string,
  workspaceId: string,
  dealData: {
    dealName: string
    prospectCompany: string
    stage?: string | null
    notes?: string | null
    meetingNotes?: string | null
    dealRisks?: unknown
    lostReason?: string | null
    description?: string | null
    successCriteria?: string | null
  },
  opts: { limit?: number; minSimilarity?: number } = {},
): Promise<LinearIssueMatch[]> {
  const limit = opts.limit ?? 25
  const minSimilarity = opts.minSimilarity ?? 0.15

  // Try pgvector first
  if (isEmbeddingAvailable()) {
    try {
      const results = await findMatchingIssuesPgvector(dealId, workspaceId, dealData, limit)
      if (results.length > 0) {
        return results.filter(r => r.similarity >= minSimilarity)
      }
      // No results — may mean embeddings aren't populated yet; fall through to TF-IDF
    } catch (err) {
      console.warn('[deal-linear-matcher] pgvector match failed, falling back to TF-IDF:', err)
    }
  }

  // Fallback: TF-IDF
  const signalText = extractDealSignalText({
    notes: dealData.notes ?? null,
    meetingNotes: dealData.meetingNotes ?? null,
    dealRisks: dealData.dealRisks,
    lostReason: dealData.lostReason ?? null,
    description: dealData.description ?? null,
    successCriteria: dealData.successCriteria ?? null,
  })
  if (!signalText) return []

  const tfidfResults = await findSimilarLinearIssues(workspaceId, signalText, {
    limit,
    minSimilarity,
  })

  return tfidfResults.map(r => ({
    issueId: r.issueId,
    similarity: r.similarity,
    source: 'tfidf' as const,
  }))
}
