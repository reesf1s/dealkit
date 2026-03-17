/**
 * Embedding Engine — unified interface for generating text embeddings.
 *
 * Providers:
 * 1. Ollama (local) — primary provider. Free, private, runs on your infra.
 *    Default model: Qwen3-embedding (best local embedding model, 1024d)
 *    Also supports: nomic-embed-text, mxbai-embed-large, bge-large, snowflake-arctic-embed
 * 2. Voyage AI (cloud) — optional, if you add a VOYAGE_API_KEY
 * 3. Fallback — returns null (callers handle gracefully, keyword search still works)
 *
 * Anthropic's Claude API is used for LLM reasoning throughout DealKit but does
 * NOT have an embeddings endpoint. Embeddings are a separate concern — Ollama
 * provides them locally for free via Qwen3-embedding.
 *
 * All vectors are normalised to unit length for cosine similarity via dot product.
 *
 * Environment variables:
 *   OLLAMA_BASE_URL      — e.g. "http://localhost:11434" (required for embeddings)
 *   OLLAMA_EMBED_MODEL   — model name, default "qwen3-embedding" (1024d)
 *   VOYAGE_API_KEY       — Voyage AI API key (optional cloud alternative)
 *   VOYAGE_MODEL         — model name, default "voyage-3-lite" (512d)
 *   EMBEDDING_PROVIDER   — force provider: "ollama" | "voyage" | "auto" (default)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbeddingResult {
  vector: number[]
  model: string
  dimensions: number
  provider: 'ollama' | 'voyage'
  tokensUsed?: number
}

export interface EmbeddingProvider {
  name: 'ollama' | 'voyage'
  dimensions: number
  model: string
  embed(texts: string[]): Promise<number[][]>
  isAvailable(): Promise<boolean>
}

// ─────────────────────────────────────────────────────────────────────────────
// Vector math utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Cosine similarity between two vectors (assumes unit-normalised). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

/** L2-normalise a vector to unit length. */
export function normalise(v: number[]): number[] {
  let norm = 0
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i]
  norm = Math.sqrt(norm)
  if (norm === 0) return v
  return v.map(x => x / norm)
}

/** Find top-K most similar vectors by cosine similarity. */
export function topKSimilar(
  query: number[],
  candidates: { id: string; vector: number[] }[],
  k: number,
  minSimilarity = 0.0,
): { id: string; similarity: number }[] {
  const scored = candidates
    .map(c => ({ id: c.id, similarity: cosineSimilarity(query, c.vector) }))
    .filter(c => c.similarity >= minSimilarity)
  scored.sort((a, b) => b.similarity - a.similarity)
  return scored.slice(0, k)
}

// ─────────────────────────────────────────────────────────────────────────────
// Ollama provider (local, privacy-preserving, free)
// ─────────────────────────────────────────────────────────────────────────────

function createOllamaProvider(): EmbeddingProvider {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  const model = process.env.OLLAMA_EMBED_MODEL ?? 'qwen3-embedding'

  // Dimension map for common models (Qwen3-embedding is the best local model for retrieval)
  const DIMS: Record<string, number> = {
    'qwen3-embedding': 1024,
    'nomic-embed-text': 768,
    'mxbai-embed-large': 1024,
    'all-minilm': 384,
    'snowflake-arctic-embed': 1024,
    'bge-large': 1024,
    'bge-small': 384,
  }
  const dimensions = DIMS[model] ?? 1024

  return {
    name: 'ollama',
    model,
    dimensions,

    async isAvailable(): Promise<boolean> {
      if (!process.env.OLLAMA_BASE_URL) return false
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 2000)
        const res = await fetch(`${baseUrl}/api/tags`, { signal: ctrl.signal })
        clearTimeout(timer)
        if (!res.ok) return false
        const data = await res.json() as { models?: { name: string }[] }
        // Check if the target model is pulled
        return (data.models ?? []).some(m => m.name.startsWith(model))
      } catch {
        return false
      }
    },

    async embed(texts: string[]): Promise<number[][]> {
      // Ollama supports batch embedding via /api/embed (v0.4+)
      const res = await fetch(`${baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: texts }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Ollama embed failed (${res.status}): ${errText}`)
      }

      const data = await res.json() as { embeddings: number[][] }
      return data.embeddings.map(normalise)
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Voyage AI provider (cloud, optional — requires separate VOYAGE_API_KEY)
// ─────────────────────────────────────────────────────────────────────────────

function createVoyageProvider(): EmbeddingProvider {
  const apiKey = process.env.VOYAGE_API_KEY
  const model = process.env.VOYAGE_MODEL ?? 'voyage-3-lite'

  const DIMS: Record<string, number> = {
    'voyage-3-lite': 512,
    'voyage-3': 1024,
    'voyage-code-3': 1024,
    'voyage-finance-2': 1024,
  }
  const dimensions = DIMS[model] ?? 512

  return {
    name: 'voyage',
    model,
    dimensions,

    async isAvailable(): Promise<boolean> {
      return !!apiKey
    },

    async embed(texts: string[]): Promise<number[][]> {
      if (!apiKey) throw new Error('VOYAGE_API_KEY not set')

      // Voyage supports up to 128 texts per batch
      const batchSize = 128
      const allEmbeddings: number[][] = []

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize)
        const res = await fetch('https://api.voyageai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            input: batch,
            input_type: 'document',
          }),
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          throw new Error(`Voyage embed failed (${res.status}): ${errText}`)
        }

        const data = await res.json() as {
          data: { embedding: number[] }[]
          usage?: { total_tokens: number }
        }
        allEmbeddings.push(...data.data.map(d => normalise(d.embedding)))
      }

      return allEmbeddings
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider resolution & caching
// ─────────────────────────────────────────────────────────────────────────────

let _cachedProvider: EmbeddingProvider | null = null
let _providerCheckedAt = 0
const PROVIDER_CACHE_TTL = 60_000 // re-check availability every 60s

/**
 * Get the active embedding provider. Returns null if no provider is available.
 *
 * Resolution order (auto mode):
 * 1. Ollama/Qwen local (primary — free, private, no API costs)
 * 2. Voyage AI (optional cloud fallback — requires VOYAGE_API_KEY)
 *
 * Note: Anthropic's Claude API does NOT have an embeddings endpoint.
 * Claude is used for LLM reasoning throughout DealKit. Embeddings are
 * a separate concern handled by Ollama (local) or Voyage (cloud).
 */
export async function getEmbeddingProvider(): Promise<EmbeddingProvider | null> {
  const now = Date.now()
  if (_cachedProvider && now - _providerCheckedAt < PROVIDER_CACHE_TTL) {
    return _cachedProvider
  }

  const forced = process.env.EMBEDDING_PROVIDER as 'ollama' | 'voyage' | 'auto' | undefined
  const providers: EmbeddingProvider[] = []

  if (forced === 'ollama') {
    providers.push(createOllamaProvider())
  } else if (forced === 'voyage') {
    providers.push(createVoyageProvider())
  } else {
    // Auto: local first (free), then cloud if available
    providers.push(createOllamaProvider(), createVoyageProvider())
  }

  for (const p of providers) {
    if (await p.isAvailable()) {
      _cachedProvider = p
      _providerCheckedAt = now
      console.log(`[embeddings] Using provider: ${p.name} (${p.model}, ${p.dimensions}d)`)
      return p
    }
  }

  _cachedProvider = null
  _providerCheckedAt = now
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Embed a single text string. Returns null if no provider is available.
 */
export async function embedText(text: string): Promise<EmbeddingResult | null> {
  const provider = await getEmbeddingProvider()
  if (!provider) return null

  const [vector] = await provider.embed([text])
  return {
    vector,
    model: provider.model,
    dimensions: provider.dimensions,
    provider: provider.name,
  }
}

/**
 * Embed multiple texts in a single batch. Returns null if no provider is available.
 * Texts are truncated to ~8000 chars to stay within model context limits.
 */
export async function embedTexts(texts: string[]): Promise<EmbeddingResult[] | null> {
  if (texts.length === 0) return []
  const provider = await getEmbeddingProvider()
  if (!provider) return null

  // Truncate long texts
  const MAX_CHARS = 8000
  const truncated = texts.map(t => t.length > MAX_CHARS ? t.slice(0, MAX_CHARS) : t)

  const vectors = await provider.embed(truncated)
  return vectors.map(vector => ({
    vector,
    model: provider.model,
    dimensions: provider.dimensions,
    provider: provider.name,
  }))
}

/**
 * Build a composite text for deal embedding — combines all rich text fields.
 */
export function buildDealEmbeddingText(deal: {
  dealName: string
  prospectCompany: string
  description?: string | null
  aiSummary?: string | null
  meetingNotes?: string | null
  notes?: string | null
  nextSteps?: string | null
  lostReason?: string | null
  dealRisks?: string[]
  competitors?: string[]
}): string {
  const parts = [
    `Deal: ${deal.dealName}`,
    `Company: ${deal.prospectCompany}`,
  ]
  if (deal.description) parts.push(`Description: ${deal.description}`)
  if (deal.aiSummary) parts.push(`Summary: ${deal.aiSummary}`)
  if (deal.dealRisks?.length) parts.push(`Risks: ${deal.dealRisks.join('; ')}`)
  if (deal.competitors?.length) parts.push(`Competitors: ${deal.competitors.join(', ')}`)
  if (deal.nextSteps) parts.push(`Next steps: ${deal.nextSteps}`)
  if (deal.lostReason) parts.push(`Lost reason: ${deal.lostReason}`)
  // Meeting notes are often the richest signal — take last ~3000 chars
  if (deal.meetingNotes) {
    const notes = deal.meetingNotes.length > 3000
      ? deal.meetingNotes.slice(-3000)
      : deal.meetingNotes
    parts.push(`Meeting notes: ${notes}`)
  }
  if (deal.notes) {
    const notes = deal.notes.length > 1500
      ? deal.notes.slice(-1500)
      : deal.notes
    parts.push(`Notes: ${notes}`)
  }
  return parts.join('\n')
}

/**
 * Build embedding text for a competitor record.
 */
export function buildCompetitorEmbeddingText(comp: {
  name: string
  description?: string | null
  notes?: string | null
  strengths?: string[]
  weaknesses?: string[]
  keyFeatures?: string[]
}): string {
  const parts = [`Competitor: ${comp.name}`]
  if (comp.description) parts.push(`Description: ${comp.description}`)
  if (comp.strengths?.length) parts.push(`Strengths: ${comp.strengths.join('; ')}`)
  if (comp.weaknesses?.length) parts.push(`Weaknesses: ${comp.weaknesses.join('; ')}`)
  if (comp.keyFeatures?.length) parts.push(`Key features: ${comp.keyFeatures.join('; ')}`)
  if (comp.notes) parts.push(`Notes: ${comp.notes}`)
  return parts.join('\n')
}

/**
 * Build embedding text for collateral content.
 */
export function buildCollateralEmbeddingText(item: {
  title: string
  type: string
  customTypeName?: string | null
  content?: { sections?: { heading: string; content: string }[] } | null
}): string {
  const parts = [`${item.customTypeName ?? item.type}: ${item.title}`]
  const sections = (item.content as any)?.sections
  if (Array.isArray(sections)) {
    for (const s of sections.slice(0, 6)) {
      parts.push(`## ${s.heading}\n${s.content}`)
    }
  }
  return parts.join('\n')
}
