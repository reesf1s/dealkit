/**
 * Semantic Search & Similarity Engine
 *
 * Provides high-level operations powered by the embedding engine:
 * - Deal similarity search ("find deals like this one")
 * - Hybrid search (keyword + semantic)
 * - Competitor deduplication via embedding distance
 * - Collateral relevance scoring
 * - Auto-embedding on brain rebuild
 *
 * Storage: PostgreSQL with pgvector extension.
 * Vectors are stored in a dedicated `embeddings` table keyed by (entity_type, entity_id).
 * Index: IVFFlat for fast approximate nearest-neighbour search.
 */

import { db } from '@/lib/db'
import { sql, eq, and } from 'drizzle-orm'
import {
  embedText,
  embedTexts,
  getEmbeddingProvider,
  buildDealEmbeddingText,
  buildCompetitorEmbeddingText,
  buildCollateralEmbeddingText,
  cosineSimilarity,
  normalise,
} from '@/lib/embeddings'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EntityType = 'deal' | 'competitor' | 'collateral' | 'case_study' | 'product_gap'

export interface SimilarEntity {
  entityId: string
  entityType: EntityType
  similarity: number
  metadata?: Record<string, unknown>
}

export interface SemanticSearchResult {
  entityId: string
  entityType: EntityType
  similarity: number
  title: string
  subtitle?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema migration (lazy, idempotent)
// ─────────────────────────────────────────────────────────────────────────────

let _migrated = false

/**
 * Ensure pgvector extension and embeddings table exist.
 * Runs once per cold start — idempotent.
 */
export async function ensureEmbeddingsSchema(): Promise<boolean> {
  if (_migrated) return true
  try {
    // Enable pgvector extension
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)

    // Create embeddings table — stores all entity embeddings in one table
    // We use vector(1024) as the max dimension (Voyage-3, mxbai-embed-large)
    // Smaller vectors (512d, 768d) are zero-padded to 1024 for uniform storage
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS embeddings (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        entity_type     text NOT NULL,
        entity_id       uuid NOT NULL,
        embedding       vector(1024) NOT NULL,
        model           text NOT NULL,
        dimensions      integer NOT NULL,
        content_hash    text NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT NOW(),
        updated_at      timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE(workspace_id, entity_type, entity_id)
      )
    `)

    // Indexes for fast lookup and similarity search
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_embeddings_workspace_type
      ON embeddings(workspace_id, entity_type)
    `)

    // IVFFlat index for approximate nearest-neighbour search
    // Lists = sqrt(expected_rows) ~ 10 for small datasets, scales automatically
    // This index enables <=> (cosine distance) operator in pgvector
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine
      ON embeddings USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 10)
    `)

    _migrated = true
    return true
  } catch (err) {
    console.error('[semantic] Failed to create embeddings schema:', err)
    // pgvector not installed — embeddings are disabled
    _migrated = false
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Content hashing (for skip-if-unchanged)
// ─────────────────────────────────────────────────────────────────────────────

/** Fast content hash to detect if text changed since last embedding. */
function contentHash(text: string): string {
  // Simple FNV-1a 32-bit hash — not cryptographic, just change detection
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return hash.toString(36)
}

// ─────────────────────────────────────────────────────────────────────────────
// Vector padding (uniform storage at 1024d)
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_DIMS = 1024

/** Pad a vector to 1024 dimensions for uniform pgvector storage. */
function padVector(v: number[], sourceDims: number): number[] {
  if (sourceDims >= STORAGE_DIMS) return v.slice(0, STORAGE_DIMS)
  const padded = new Array(STORAGE_DIMS).fill(0)
  for (let i = 0; i < v.length; i++) padded[i] = v[i]
  return padded
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: upsert embeddings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert an embedding for a single entity.
 * Skips re-embedding if content hasn't changed (by hash).
 * Returns true if embedding was created/updated, false if skipped or unavailable.
 */
export async function upsertEmbedding(
  workspaceId: string,
  entityType: EntityType,
  entityId: string,
  text: string,
): Promise<boolean> {
  const provider = await getEmbeddingProvider()
  if (!provider) return false

  const schemaOk = await ensureEmbeddingsSchema()
  if (!schemaOk) return false

  const hash = contentHash(text)

  // Check if embedding already exists with same hash
  const existing = await db.execute<{ content_hash: string }>(sql`
    SELECT content_hash FROM embeddings
    WHERE workspace_id = ${workspaceId}
      AND entity_type = ${entityType}
      AND entity_id = ${entityId}
    LIMIT 1
  `)
  if (existing[0]?.content_hash === hash) return false // unchanged

  // Generate embedding
  const result = await embedText(text)
  if (!result) return false

  const paddedVector = padVector(result.vector, result.dimensions)
  const vectorStr = `[${paddedVector.join(',')}]`

  await db.execute(sql`
    INSERT INTO embeddings (workspace_id, entity_type, entity_id, embedding, model, dimensions, content_hash)
    VALUES (${workspaceId}, ${entityType}, ${entityId}, ${vectorStr}::vector, ${result.model}, ${result.dimensions}, ${hash})
    ON CONFLICT (workspace_id, entity_type, entity_id)
    DO UPDATE SET
      embedding = ${vectorStr}::vector,
      model = ${result.model},
      dimensions = ${result.dimensions},
      content_hash = ${hash},
      updated_at = NOW()
  `)

  return true
}

/**
 * Batch upsert embeddings for multiple entities of the same type.
 * Only re-embeds entities whose content has changed.
 * Returns count of embeddings created/updated.
 */
export async function batchUpsertEmbeddings(
  workspaceId: string,
  entityType: EntityType,
  entities: { id: string; text: string }[],
): Promise<number> {
  if (entities.length === 0) return 0

  const provider = await getEmbeddingProvider()
  if (!provider) return 0

  const schemaOk = await ensureEmbeddingsSchema()
  if (!schemaOk) return 0

  // Load existing hashes for dedup
  const existingRows = await db.execute<{ entity_id: string; content_hash: string }>(sql`
    SELECT entity_id, content_hash FROM embeddings
    WHERE workspace_id = ${workspaceId} AND entity_type = ${entityType}
  `)
  const existingHashes = new Map(existingRows.map(r => [r.entity_id, r.content_hash]))

  // Filter to only changed entities
  const toEmbed: { id: string; text: string; hash: string }[] = []
  for (const e of entities) {
    const hash = contentHash(e.text)
    if (existingHashes.get(e.id) === hash) continue
    toEmbed.push({ ...e, hash })
  }

  if (toEmbed.length === 0) return 0

  // Batch embed
  const texts = toEmbed.map(e => e.text)
  const results = await embedTexts(texts)
  if (!results) return 0

  // Upsert all
  let count = 0
  for (let i = 0; i < toEmbed.length; i++) {
    const { id, hash } = toEmbed[i]
    const result = results[i]
    const paddedVector = padVector(result.vector, result.dimensions)
    const vectorStr = `[${paddedVector.join(',')}]`

    try {
      await db.execute(sql`
        INSERT INTO embeddings (workspace_id, entity_type, entity_id, embedding, model, dimensions, content_hash)
        VALUES (${workspaceId}, ${entityType}, ${id}, ${vectorStr}::vector, ${result.model}, ${result.dimensions}, ${hash})
        ON CONFLICT (workspace_id, entity_type, entity_id)
        DO UPDATE SET
          embedding = ${vectorStr}::vector,
          model = ${result.model},
          dimensions = ${result.dimensions},
          content_hash = ${hash},
          updated_at = NOW()
      `)
      count++
    } catch (err) {
      console.error(`[semantic] Failed to upsert embedding for ${entityType}:${id}:`, err)
    }
  }

  return count
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic similarity search (pgvector)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find entities semantically similar to a query text.
 * Uses pgvector's IVFFlat index for fast approximate nearest-neighbour search.
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
  const provider = await getEmbeddingProvider()
  if (!provider) return []

  const schemaOk = await ensureEmbeddingsSchema()
  if (!schemaOk) return []

  const result = await embedText(query)
  if (!result) return []

  const paddedQuery = padVector(result.vector, result.dimensions)
  const vectorStr = `[${paddedQuery.join(',')}]`
  const limit = opts.limit ?? 10
  const minSim = opts.minSimilarity ?? 0.3

  // pgvector cosine distance: 1 - cosine_similarity
  // So similarity = 1 - distance
  const typeFilter = opts.entityTypes?.length
    ? sql`AND entity_type = ANY(${opts.entityTypes})`
    : sql``

  const rows = await db.execute<{
    entity_id: string
    entity_type: EntityType
    similarity: number
  }>(sql`
    SELECT
      entity_id,
      entity_type,
      1 - (embedding <=> ${vectorStr}::vector) as similarity
    FROM embeddings
    WHERE workspace_id = ${workspaceId}
      ${typeFilter}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `)

  return rows
    .filter(r => r.similarity >= minSim)
    .map(r => ({
      entityId: r.entity_id,
      entityType: r.entity_type,
      similarity: Math.round(r.similarity * 1000) / 1000,
    }))
}

/**
 * Find deals similar to a specific deal.
 * Useful for "deals like this" feature and win pattern matching.
 */
export async function findSimilarDeals(
  workspaceId: string,
  dealId: string,
  limit = 5,
): Promise<SimilarEntity[]> {
  const schemaOk = await ensureEmbeddingsSchema()
  if (!schemaOk) return []

  // Get the deal's embedding
  const rows = await db.execute<{ embedding: string }>(sql`
    SELECT embedding::text FROM embeddings
    WHERE workspace_id = ${workspaceId}
      AND entity_type = 'deal'
      AND entity_id = ${dealId}
    LIMIT 1
  `)
  if (rows.length === 0) return []

  // Parse the vector
  const vectorStr = rows[0].embedding

  // Find nearest neighbours (excluding self)
  const results = await db.execute<{
    entity_id: string
    entity_type: EntityType
    similarity: number
  }>(sql`
    SELECT
      entity_id,
      entity_type,
      1 - (embedding <=> ${vectorStr}::vector) as similarity
    FROM embeddings
    WHERE workspace_id = ${workspaceId}
      AND entity_type = 'deal'
      AND entity_id != ${dealId}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `)

  return results
    .filter(r => r.similarity >= 0.3)
    .map(r => ({
      entityId: r.entity_id,
      entityType: r.entity_type as EntityType,
      similarity: Math.round(r.similarity * 1000) / 1000,
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Competitor deduplication
// ─────────────────────────────────────────────────────────────────────────────

export interface CompetitorDuplicate {
  existingId: string
  existingName: string
  newName: string
  similarity: number
}

/**
 * Check if a new competitor name is semantically a duplicate of existing competitors.
 * Returns potential matches above threshold.
 * Used during auto-create in brain rebuild to prevent "Salesforce" vs "SFDC" duplicates.
 */
export async function findCompetitorDuplicates(
  workspaceId: string,
  newNames: string[],
  threshold = 0.82,
): Promise<CompetitorDuplicate[]> {
  if (newNames.length === 0) return []

  const provider = await getEmbeddingProvider()
  if (!provider) return []

  const schemaOk = await ensureEmbeddingsSchema()
  if (!schemaOk) return []

  // Get existing competitor embeddings
  const existingRows = await db.execute<{
    entity_id: string
    embedding: string
  }>(sql`
    SELECT entity_id, embedding::text FROM embeddings
    WHERE workspace_id = ${workspaceId} AND entity_type = 'competitor'
  `)
  if (existingRows.length === 0) return []

  // Embed new names
  const results = await embedTexts(newNames.map(n => `Competitor: ${n}`))
  if (!results) return []

  // Load competitor names
  const { competitors } = await import('@/lib/db/schema')
  const compRows = await db
    .select({ id: competitors.id, name: competitors.name })
    .from(competitors)
    .where(eq(competitors.workspaceId, workspaceId))
  const nameMap = new Map(compRows.map(c => [c.id, c.name]))

  // Parse existing vectors
  const existingVectors = existingRows.map(r => {
    const nums = r.embedding.replace(/[\[\]]/g, '').split(',').map(Number)
    return { id: r.entity_id, vector: nums }
  })

  // Find duplicates
  const duplicates: CompetitorDuplicate[] = []
  for (let i = 0; i < newNames.length; i++) {
    const newVec = padVector(results[i].vector, results[i].dimensions)
    for (const existing of existingVectors) {
      const sim = cosineSimilarity(newVec, existing.vector)
      if (sim >= threshold) {
        duplicates.push({
          existingId: existing.id,
          existingName: nameMap.get(existing.id) ?? existing.id,
          newName: newNames[i],
          similarity: Math.round(sim * 1000) / 1000,
        })
      }
    }
  }

  return duplicates
}

// ─────────────────────────────────────────────────────────────────────────────
// Brain rebuild integration — embed all workspace entities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Embed all workspace entities after a brain rebuild.
 * Called as a fire-and-forget background task.
 *
 * Embeds:
 * - All deal logs (with composite text: name, company, description, notes, risks)
 * - All competitors (name, description, strengths, weaknesses)
 * - All ready collateral (title, type, content sections)
 *
 * Uses content hashing to skip unchanged entities — typically only
 * the recently-modified deal triggers a new embedding.
 */
export async function embedWorkspaceEntities(workspaceId: string): Promise<{
  deals: number
  competitors: number
  collateral: number
} | null> {
  const provider = await getEmbeddingProvider()
  if (!provider) return null

  const schemaOk = await ensureEmbeddingsSchema()
  if (!schemaOk) return null

  const { dealLogs, competitors, collateral } = await import('@/lib/db/schema')

  // Load all entities in parallel
  const [deals, comps, colls] = await Promise.all([
    db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)),
    db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)),
    db.select().from(collateral).where(
      and(eq(collateral.workspaceId, workspaceId), eq(collateral.status, 'ready'))
    ),
  ])

  // Build embedding texts
  const dealTexts = deals.map(d => ({
    id: d.id,
    text: buildDealEmbeddingText({
      dealName: d.dealName,
      prospectCompany: d.prospectCompany,
      description: d.description,
      aiSummary: d.aiSummary,
      meetingNotes: d.meetingNotes,
      notes: d.notes,
      nextSteps: d.nextSteps,
      lostReason: d.lostReason,
      dealRisks: (d.dealRisks as string[]) ?? [],
      competitors: (d.competitors as string[]) ?? [],
    }),
  }))

  const compTexts = comps.map(c => ({
    id: c.id,
    text: buildCompetitorEmbeddingText({
      name: c.name,
      description: c.description,
      notes: c.notes,
      strengths: (c.strengths as string[]) ?? [],
      weaknesses: (c.weaknesses as string[]) ?? [],
      keyFeatures: (c.keyFeatures as string[]) ?? [],
    }),
  }))

  const collTexts = colls.map(c => ({
    id: c.id,
    text: buildCollateralEmbeddingText({
      title: c.title,
      type: c.type,
      customTypeName: c.customTypeName,
      content: c.content as any,
    }),
  }))

  // Batch embed all (with dedup via content hash)
  const [dealCount, compCount, collCount] = await Promise.all([
    batchUpsertEmbeddings(workspaceId, 'deal', dealTexts),
    batchUpsertEmbeddings(workspaceId, 'competitor', compTexts),
    batchUpsertEmbeddings(workspaceId, 'collateral', collTexts),
  ])

  const total = dealCount + compCount + collCount
  if (total > 0) {
    console.log(`[semantic] Embedded ${dealCount} deals, ${compCount} competitors, ${collCount} collateral for workspace ${workspaceId.slice(0, 8)}`)
  }

  return { deals: dealCount, competitors: compCount, collateral: collCount }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hybrid search (keyword + semantic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hybrid search combining keyword (ilike) and semantic similarity.
 * Returns unified results ranked by a weighted score.
 *
 * Used by search_workspace tool to find semantically relevant entities
 * even when the query doesn't match exact keywords.
 */
export async function hybridSearch(
  workspaceId: string,
  query: string,
  opts: {
    entityTypes?: EntityType[]
    limit?: number
    keywordWeight?: number  // 0-1, default 0.4
    semanticWeight?: number // 0-1, default 0.6
  } = {},
): Promise<SemanticSearchResult[]> {
  const { dealLogs, competitors: competitorsTable, caseStudies, productGaps } = await import('@/lib/db/schema')
  const { ilike, or } = await import('drizzle-orm')

  const limit = opts.limit ?? 10
  const kwWeight = opts.keywordWeight ?? 0.4
  const semWeight = opts.semanticWeight ?? 0.6
  const pattern = `%${query}%`

  // Run keyword search and semantic search in parallel
  const types = opts.entityTypes ?? ['deal', 'competitor', 'collateral', 'case_study', 'product_gap']

  const [semanticResults, keywordDeals, keywordComps, keywordCases, keywordGaps] = await Promise.all([
    semanticSearch(workspaceId, query, { entityTypes: types, limit: limit * 2, minSimilarity: 0.25 }),

    types.includes('deal')
      ? db.select({ id: dealLogs.id, name: dealLogs.dealName, company: dealLogs.prospectCompany })
          .from(dealLogs)
          .where(and(eq(dealLogs.workspaceId, workspaceId), or(ilike(dealLogs.dealName, pattern), ilike(dealLogs.prospectCompany, pattern))))
          .limit(limit)
      : Promise.resolve([]),

    types.includes('competitor')
      ? db.select({ id: competitorsTable.id, name: competitorsTable.name })
          .from(competitorsTable)
          .where(and(eq(competitorsTable.workspaceId, workspaceId), ilike(competitorsTable.name, pattern)))
          .limit(limit)
      : Promise.resolve([]),

    types.includes('case_study')
      ? db.select({ id: caseStudies.id, name: caseStudies.customerName })
          .from(caseStudies)
          .where(and(eq(caseStudies.workspaceId, workspaceId), ilike(caseStudies.customerName, pattern)))
          .limit(limit)
      : Promise.resolve([]),

    types.includes('product_gap')
      ? db.select({ id: productGaps.id, name: productGaps.title })
          .from(productGaps)
          .where(and(eq(productGaps.workspaceId, workspaceId), ilike(productGaps.title, pattern)))
          .limit(limit)
      : Promise.resolve([]),
  ])

  // Build keyword hit set
  const keywordHits = new Map<string, { type: EntityType; title: string; subtitle?: string }>()
  for (const d of keywordDeals) keywordHits.set(d.id, { type: 'deal', title: d.name, subtitle: d.company })
  for (const c of keywordComps) keywordHits.set(c.id, { type: 'competitor', title: c.name })
  for (const c of keywordCases) keywordHits.set(c.id, { type: 'case_study', title: c.name })
  for (const g of keywordGaps) keywordHits.set(g.id, { type: 'product_gap', title: g.name })

  // Merge and score
  const merged = new Map<string, SemanticSearchResult & { score: number }>()

  // Semantic results
  for (const sr of semanticResults) {
    const kw = keywordHits.get(sr.entityId)
    const kwScore = kw ? 1.0 : 0.0
    const score = (kwScore * kwWeight) + (sr.similarity * semWeight)
    merged.set(sr.entityId, {
      entityId: sr.entityId,
      entityType: sr.entityType,
      similarity: sr.similarity,
      title: kw?.title ?? sr.entityId,
      subtitle: kw?.subtitle,
      score,
    })
  }

  // Keyword-only results (not in semantic results)
  for (const [id, kw] of keywordHits) {
    if (!merged.has(id)) {
      merged.set(id, {
        entityId: id,
        entityType: kw.type,
        similarity: 0,
        title: kw.title,
        subtitle: kw.subtitle,
        score: kwWeight, // full keyword score, zero semantic
      })
    }
  }

  // Sort by combined score
  const results = [...merged.values()]
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, limit).map(({ score: _s, ...rest }) => rest)
}
