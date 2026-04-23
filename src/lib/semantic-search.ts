/**
 * Semantic Search & Similarity Engine
 *
 * Pure in-process computation — no external APIs, no pgvector dependency.
 * Embeddings are computed using TF-IDF + NLP signals + character n-grams
 * (see embeddings.ts) and stored as JSONB on the workspace brain.
 *
 * All similarity is computed at query time from the brain snapshot.
 * This is fast because:
 * - Vectors are 336-dimensional (tiny vs 1024d+ from external models)
 * - Brain is already loaded in memory for every request
 * - Cosine similarity on 336d vectors takes <0.01ms per comparison
 * - Typical workspace has <100 deals — scanning all is instant
 */

import { db } from '@/lib/db'
import { eq, and, sql } from 'drizzle-orm'
import {
  embedDeal,
  embedCompetitor,
  embedCollateral,
  embedQuery,
  nameSimilarity,
  cosineSimilarity,
  contentHash,
  EMBEDDING_DIMS,
} from '@/lib/embeddings'
import type { TextSignals } from '@/lib/text-signals'
import { getEffectiveDealSummary } from '@/lib/effective-deal-summary'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EntityType = 'deal' | 'competitor' | 'collateral'

export interface SimilarEntity {
  entityId: string
  entityType: EntityType
  similarity: number
}

export interface CompetitorDuplicate {
  existingId: string
  existingName: string
  newName: string
  similarity: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Embedding cache on workspace brain JSONB
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbeddingCache {
  version: number
  dims: number
  deals: { id: string; vector: number[]; hash: string }[]
  competitors: { id: string; vector: number[]; hash: string }[]
  collateral: { id: string; vector: number[]; hash: string }[]
  /** Linear issue embeddings — populated by embedLinearIssues() */
  linearIssues?: { id: string; vector: number[]; hash: string }[]
}

const CACHE_VERSION = 2

/**
 * Load the embedding cache from the workspace brain JSONB.
 */
async function loadCache(workspaceId: string): Promise<EmbeddingCache | null> {
  try {
    const rows = await db.execute<{ embedding_cache: EmbeddingCache | null }>(
      sql`SELECT embedding_cache FROM workspaces WHERE id = ${workspaceId} LIMIT 1`
    )
    const cache = rows[0]?.embedding_cache
    if (cache && cache.version === CACHE_VERSION && cache.dims === EMBEDDING_DIMS) {
      return cache
    }
    return null
  } catch {
    return null
  }
}

/**
 * Save the embedding cache to the workspace brain JSONB.
 */
async function saveCache(workspaceId: string, cache: EmbeddingCache): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE workspaces
      SET embedding_cache = ${JSON.stringify(cache)}::jsonb
      WHERE id = ${workspaceId}
    `)
  } catch (err) {
    console.error('[semantic] Failed to save embedding cache:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Embed workspace entities (called after brain rebuild)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Embed all workspace entities and store in JSONB cache.
 * Pure computation — no external calls. Runs in <50ms for typical workspaces.
 *
 * Uses content hashing to skip unchanged entities.
 */
export async function embedWorkspaceEntities(workspaceId: string): Promise<{
  deals: number
  competitors: number
  collateral: number
}> {
  const { dealLogs, competitors, collateral } = await import('@/lib/db/schema')
  const { extractTextSignals } = await import('@/lib/text-signals')

  // Load existing cache for hash comparison
  const existingCache = await loadCache(workspaceId)
  const existingDealHashes = new Map(existingCache?.deals.map(d => [d.id, d.hash]) ?? [])
  const existingCompHashes = new Map(existingCache?.competitors.map(c => [c.id, c.hash]) ?? [])
  const existingCollHashes = new Map(existingCache?.collateral.map(c => [c.id, c.hash]) ?? [])

  // Load entities sequentially to avoid saturating the connection pool.
  // Running these in parallel (Promise.all) would hold 3 connections simultaneously —
  // combined with the concurrent brain-rebuild and proactive-collateral tasks this
  // could exhaust the pool (max 5) and stall unrelated requests (e.g. /api/deals).
  const deals = await db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId))
  const comps = await db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId))
  const colls = await db.select().from(collateral).where(
    and(eq(collateral.workspaceId, workspaceId), eq(collateral.status, 'ready'))
  )

  // Compute max deal value for normalisation
  const maxDealValue = Math.max(...deals.map(d => d.dealValue ?? 0), 1)
  const stageOrdinals: Record<string, number> = {
    prospecting: 0, qualification: 0.2, discovery: 0.4,
    proposal: 0.6, negotiation: 0.8, closed_won: 1, closed_lost: 1,
  }

  let dealCount = 0
  let compCount = 0
  let collCount = 0

  // Embed deals
  const dealEmbeddings: EmbeddingCache['deals'] = []
  for (const d of deals) {
    const effectiveSummary = getEffectiveDealSummary(d)
    const hashInput = `${d.dealName}|${d.prospectCompany}|${effectiveSummary ?? ''}|${d.meetingNotes ?? ''}|${d.description ?? ''}`
    const hash = contentHash(hashInput)

    // Reuse cached embedding if content unchanged
    const existing = existingCache?.deals.find(e => e.id === d.id)
    if (existing && existing.hash === hash) {
      dealEmbeddings.push(existing)
      continue
    }

    // Extract NLP signals for the signal feature vector
    const signals: Partial<TextSignals> = (() => {
      try { return extractTextSignals(d.meetingNotes, d.createdAt, d.updatedAt) }
      catch { return {} }
    })()

    const todos = (d.todos as { done: boolean }[]) ?? []
    const todoRate = todos.length > 0 ? todos.filter(t => t.done).length / todos.length : 0.5

    const result = embedDeal({
      dealName: d.dealName,
      prospectCompany: d.prospectCompany,
      description: d.description,
      aiSummary: effectiveSummary,
      meetingNotes: d.meetingNotes,
      notes: d.notes,
      nextSteps: d.nextSteps,
      lostReason: d.lostReason,
      dealRisks: (d.dealRisks as string[]) ?? [],
      competitors: (d.competitors as string[]) ?? [],
      sentimentScore: signals.sentimentScore,
      urgencyScore: signals.urgencyScore,
      engagementScore: signals.engagementScore,
      momentumScore: signals.momentumScore,
      stakeholderDepth: signals.stakeholderDepth,
      championStrength: signals.championStrength,
      objectionCount: signals.objectionCount,
      decisionMakerSignal: signals.decisionMakerSignal,
      budgetConfirmed: signals.budgetConfirmed,
      nextStepDefined: signals.nextStepDefined,
      dealValue: d.dealValue ?? 0,
      maxDealValue,
      stageOrdinal: stageOrdinals[d.stage] ?? 0.5,
      todoCompletionRate: todoRate,
    })

    dealEmbeddings.push({ id: d.id, vector: result.vector, hash })
    dealCount++
  }

  // Embed competitors
  const compEmbeddings: EmbeddingCache['competitors'] = []
  for (const c of comps) {
    const hashInput = `${c.name}|${c.description ?? ''}|${c.notes ?? ''}`
    const hash = contentHash(hashInput)

    const existing = existingCache?.competitors.find(e => e.id === c.id)
    if (existing && existing.hash === hash) {
      compEmbeddings.push(existing)
      continue
    }

    const result = embedCompetitor({
      name: c.name,
      description: c.description,
      notes: c.notes,
      strengths: (c.strengths as string[]) ?? [],
      weaknesses: (c.weaknesses as string[]) ?? [],
      keyFeatures: (c.keyFeatures as string[]) ?? [],
    })

    compEmbeddings.push({ id: c.id, vector: result.vector, hash })
    compCount++
  }

  // Embed collateral
  const collEmbeddings: EmbeddingCache['collateral'] = []
  for (const c of colls) {
    const hashInput = `${c.title}|${c.type}|${c.customTypeName ?? ''}`
    const hash = contentHash(hashInput)

    const existing = existingCache?.collateral.find(e => e.id === c.id)
    if (existing && existing.hash === hash) {
      collEmbeddings.push(existing)
      continue
    }

    const result = embedCollateral({
      title: c.title,
      type: c.type,
      customTypeName: c.customTypeName,
      content: c.content as any,
    })

    collEmbeddings.push({ id: c.id, vector: result.vector, hash })
    collCount++
  }

  // Save cache
  const cache: EmbeddingCache = {
    version: CACHE_VERSION,
    dims: EMBEDDING_DIMS,
    deals: dealEmbeddings,
    competitors: compEmbeddings,
    collateral: collEmbeddings,
  }
  await saveCache(workspaceId, cache)

  const total = dealCount + compCount + collCount
  if (total > 0) {
    console.log(`[semantic] Computed ${dealCount} deal, ${compCount} competitor, ${collCount} collateral embeddings for workspace ${workspaceId.slice(0, 8)}`)
  }

  return { deals: dealCount, competitors: compCount, collateral: collCount }
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic search (in-memory, from brain cache)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find entities semantically similar to a query text.
 * Scans all cached embeddings in-memory — instant for typical workspaces.
 */
export async function semanticSearch(
  workspaceId: string,
  query: string,
  opts: {
    entityTypes?: EntityType[]
    limit?: number
    minSimilarity?: number
  } = {},
): Promise<SimilarEntity[]> {
  const cache = await loadCache(workspaceId)
  if (!cache) return []

  const queryVec = embedQuery(query).vector
  const limit = opts.limit ?? 10
  const minSim = opts.minSimilarity ?? 0.15 // Lower threshold for TF-IDF (sparser than neural)
  const types = opts.entityTypes ?? ['deal', 'competitor', 'collateral']

  const results: SimilarEntity[] = []

  if (types.includes('deal')) {
    for (const d of cache.deals) {
      const sim = cosineSimilarity(queryVec, d.vector)
      if (sim >= minSim) results.push({ entityId: d.id, entityType: 'deal', similarity: sim })
    }
  }
  if (types.includes('competitor')) {
    for (const c of cache.competitors) {
      const sim = cosineSimilarity(queryVec, c.vector)
      if (sim >= minSim) results.push({ entityId: c.id, entityType: 'competitor', similarity: sim })
    }
  }
  if (types.includes('collateral')) {
    for (const c of cache.collateral) {
      const sim = cosineSimilarity(queryVec, c.vector)
      if (sim >= minSim) results.push({ entityId: c.id, entityType: 'collateral', similarity: sim })
    }
  }

  results.sort((a, b) => b.similarity - a.similarity)
  return results.slice(0, limit).map(r => ({
    ...r,
    similarity: Math.round(r.similarity * 1000) / 1000,
  }))
}

/**
 * Find deals similar to a specific deal.
 */
export async function findSimilarDeals(
  workspaceId: string,
  dealId: string,
  limit = 5,
): Promise<SimilarEntity[]> {
  const cache = await loadCache(workspaceId)
  if (!cache) return []

  const target = cache.deals.find(d => d.id === dealId)
  if (!target) return []

  const results: SimilarEntity[] = []
  for (const d of cache.deals) {
    if (d.id === dealId) continue
    const sim = cosineSimilarity(target.vector, d.vector)
    if (sim >= 0.1) results.push({ entityId: d.id, entityType: 'deal', similarity: sim })
  }

  results.sort((a, b) => b.similarity - a.similarity)
  return results.slice(0, limit).map(r => ({
    ...r,
    similarity: Math.round(r.similarity * 1000) / 1000,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Competitor deduplication (pure in-memory)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if new competitor names are duplicates of existing ones.
 * Uses character n-gram similarity — catches "Salesforce" vs "SFDC" etc.
 * Pure computation, no DB calls needed for the similarity check itself.
 */
export async function findCompetitorDuplicates(
  workspaceId: string,
  newNames: string[],
  threshold = 0.55, // Lower threshold for n-gram (sparser than neural embeddings)
): Promise<CompetitorDuplicate[]> {
  if (newNames.length === 0) return []

  const { competitors } = await import('@/lib/db/schema')
  const existingComps = await db
    .select({ id: competitors.id, name: competitors.name })
    .from(competitors)
    .where(eq(competitors.workspaceId, workspaceId))

  if (existingComps.length === 0) return []

  const duplicates: CompetitorDuplicate[] = []
  for (const newName of newNames) {
    for (const existing of existingComps) {
      const sim = nameSimilarity(newName, existing.name)
      if (sim >= threshold) {
        duplicates.push({
          existingId: existing.id,
          existingName: existing.name,
          newName,
          similarity: Math.round(sim * 1000) / 1000,
        })
      }
    }
  }

  return duplicates
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP Phase 1 extension — Linear issue embeddings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Embed all Linear issues from linear_issues_cache and store them in the
 * workspace's embedding_cache.linearIssues array.
 *
 * Uses embedQuery() on "title + description" — the same TF-IDF system used for
 * semantic search queries, which is semantically appropriate for topic-focused
 * feature request / bug text.
 *
 * Non-breaking: if no issues are cached, this is a no-op.
 */
export async function embedLinearIssues(workspaceId: string): Promise<{ embedded: number }> {
  const { linearIssuesCache } = await import('@/lib/db/schema')

  const issues = await db
    .select()
    .from(linearIssuesCache)
    .where(eq(linearIssuesCache.workspaceId, workspaceId))

  if (issues.length === 0) return { embedded: 0 }

  const existingCache = await loadCache(workspaceId)
  const existingLinearHashes = new Map(
    existingCache?.linearIssues?.map(i => [i.id, i.hash]) ?? [],
  )

  let embedded = 0
  const newLinearEmbeddings: NonNullable<EmbeddingCache['linearIssues']> = []

  for (const issue of issues) {
    const text = `${issue.title} ${issue.description ?? ''}`.trim()
    const hash = contentHash(text)

    const existing = existingLinearHashes.get(issue.linearIssueId)
    if (existing === hash && existingCache?.linearIssues) {
      const cached = existingCache.linearIssues.find(i => i.id === issue.linearIssueId)
      if (cached) {
        newLinearEmbeddings.push(cached)
        continue
      }
    }

    const result = embedQuery(text)
    newLinearEmbeddings.push({ id: issue.linearIssueId, vector: result.vector, hash })
    embedded++
  }

  // Merge into existing cache (preserve deals/competitors/collateral)
  const base = existingCache ?? {
    version: CACHE_VERSION,
    dims: EMBEDDING_DIMS,
    deals: [],
    competitors: [],
    collateral: [],
  }

  const updatedCache: EmbeddingCache = {
    ...base,
    version: CACHE_VERSION,
    linearIssues: newLinearEmbeddings,
  }

  await saveCache(workspaceId, updatedCache)

  // Persist vectors to linear_issues_cache.embedding — incremental:
  // only write rows that still have a NULL embedding in the DB so that
  // subsequent runs skip the 222 sequential UPDATEs entirely (fast path).
  // Build a set of issue IDs that need a DB write from the in-memory data.
  const nullEmbeddingIds = new Set(
    issues.filter(i => i.embedding === null).map(i => i.linearIssueId),
  )

  for (const { id, vector } of newLinearEmbeddings) {
    if (!nullEmbeddingIds.has(id)) continue // already stored, skip
    await db
      .update(linearIssuesCache)
      .set({ embedding: vector })
      .where(
        and(
          eq(linearIssuesCache.workspaceId, workspaceId),
          eq(linearIssuesCache.linearIssueId, id),
        ),
      )
  }

  if (embedded > 0) {
    console.log(`[semantic] Embedded ${embedded} Linear issues for workspace ${workspaceId.slice(0, 8)}`)
  }

  return { embedded }
}

/**
 * Find the top Linear issues most semantically similar to a given text (e.g. deal signal text).
 * Returns scored results from the workspace's Linear issue embedding cache.
 */
export async function findSimilarLinearIssues(
  workspaceId: string,
  signalText: string,
  opts: { limit?: number; minSimilarity?: number } = {},
): Promise<{ issueId: string; similarity: number }[]> {
  const cache = await loadCache(workspaceId)
  if (!cache?.linearIssues?.length) return []

  const queryVec = embedQuery(signalText).vector
  const limit = opts.limit ?? 20
  const minSim = opts.minSimilarity ?? 0.15

  const results: { issueId: string; similarity: number }[] = []

  for (const issue of cache.linearIssues) {
    const sim = cosineSimilarity(queryVec, issue.vector)
    if (sim >= minSim) {
      results.push({ issueId: issue.id, similarity: Math.round(sim * 1000) / 1000 })
    }
  }

  results.sort((a, b) => b.similarity - a.similarity)
  return results.slice(0, limit)
}
