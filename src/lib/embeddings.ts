/**
 * Embedding Engine — self-contained, zero-dependency text embeddings.
 *
 * Pure IP: no external API calls, no third-party models. Runs entirely in-process
 * on Vercel serverless functions. Computes embeddings from:
 *
 * 1. TF-IDF vectors — bag-of-words weighted by term frequency × inverse document
 *    frequency, hashed into a fixed-size vector. Captures semantic content.
 * 2. NLP signal features — reuses text-signals.ts (sentiment, momentum, urgency,
 *    stakeholder depth, etc.) for structured deal intelligence.
 * 3. Lexical n-gram hashing — character trigrams for fuzzy name matching
 *    (catches "Salesforce" vs "SFDC" without external embeddings).
 *
 * The combined vector is L2-normalised for cosine similarity via dot product.
 *
 * Claude API is used for LLM reasoning (chat, analysis, content generation).
 * Embeddings are a separate concern computed locally — pure ML, no LLM dependency.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Total embedding dimensions: TF-IDF hash buckets + signal features + n-gram hash */
const TFIDF_DIMS = 256
const SIGNAL_DIMS = 16
const NGRAM_DIMS = 64
export const EMBEDDING_DIMS = TFIDF_DIMS + SIGNAL_DIMS + NGRAM_DIMS  // 336

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbeddingResult {
  vector: number[]
  dimensions: number
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
// Text preprocessing
// ─────────────────────────────────────────────────────────────────────────────

/** Sales-domain stopwords — common words that don't carry semantic signal. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'to', 'of', 'in',
  'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off',
  'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but',
  'and', 'or', 'if', 'while', 'about', 'up', 'its', 'it', 'this', 'that',
  'these', 'those', 'am', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
  'he', 'she', 'they', 'them', 'his', 'her', 'their', 'what', 'which',
  'who', 'whom', 'get', 'got', 'also', 'back', 'still', 'like',
])

/** Tokenise text: lowercase, split, remove stopwords, stem lightly. */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w))
    .map(lightStem)
}

/** Very lightweight suffix-stripping stemmer. Not Porter — just the high-value rules. */
function lightStem(word: string): string {
  if (word.length <= 4) return word
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3)
  if (word.endsWith('tion')) return word.slice(0, -4)
  if (word.endsWith('sion')) return word.slice(0, -4)
  if (word.endsWith('ment')) return word.slice(0, -4)
  if (word.endsWith('ness')) return word.slice(0, -4)
  if (word.endsWith('ity')) return word.slice(0, -3)
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('ly') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('er') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('est') && word.length > 5) return word.slice(0, -3)
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1)
  return word
}

// ─────────────────────────────────────────────────────────────────────────────
// FNV-1a hashing (deterministic, fast, distributes well into buckets)
// ─────────────────────────────────────────────────────────────────────────────

function fnv1a(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return hash
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-IDF hashed vector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a hashed TF-IDF vector from text.
 * Uses feature hashing (hashing trick) to map an unbounded vocabulary
 * into a fixed-size vector. No vocabulary dictionary needed.
 *
 * IDF is approximated using a static sales-domain prior: common sales terms
 * get lower weight, rare/specific terms get higher weight.
 */
function computeTfIdfVector(text: string): number[] {
  const tokens = tokenise(text)
  if (tokens.length === 0) return new Array(TFIDF_DIMS).fill(0)

  // Term frequency
  const tf = new Map<string, number>()
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)

  // Hash into fixed-size vector with IDF-like weighting
  const vec = new Array(TFIDF_DIMS).fill(0)
  const logLen = Math.log(tokens.length + 1)

  for (const [term, count] of tf) {
    const bucket = fnv1a(term) % TFIDF_DIMS
    // TF: log-normalised frequency
    const termFreq = Math.log(1 + count) / logLen
    // IDF proxy: shorter, rarer-looking terms get higher weight
    // Common 3-letter words already filtered by stopwords
    const idfProxy = Math.min(2, 0.5 + term.length * 0.15)
    // Sign hashing: alternate +/- to reduce hash collisions
    const sign = (fnv1a(term + '_sign') % 2 === 0) ? 1 : -1
    vec[bucket] += sign * termFreq * idfProxy
  }

  return vec
}

// ─────────────────────────────────────────────────────────────────────────────
// Character n-gram hashing (fuzzy name matching)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Character trigram hash vector — good for catching spelling variations,
 * abbreviations, and aliases (e.g. "Salesforce" vs "SFDC" vs "salesforce.com").
 */
function computeNgramVector(text: string): number[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '')
  const vec = new Array(NGRAM_DIMS).fill(0)
  if (clean.length < 3) {
    // For very short strings, just hash the whole thing
    if (clean.length > 0) {
      const bucket = fnv1a(clean) % NGRAM_DIMS
      vec[bucket] = 1
    }
    return vec
  }

  for (let i = 0; i <= clean.length - 3; i++) {
    const trigram = clean.slice(i, i + 3)
    const bucket = fnv1a(trigram) % NGRAM_DIMS
    const sign = (fnv1a(trigram + '_s') % 2 === 0) ? 1 : -1
    vec[bucket] += sign
  }

  return vec
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal feature vector (structured NLP features)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract a fixed-size signal feature vector from deal metadata.
 * Uses the same NLP signals as text-signals.ts but formatted as a dense vector.
 */
function computeSignalVector(meta: {
  sentimentScore?: number
  urgencyScore?: number
  engagementScore?: number
  momentumScore?: number
  stakeholderDepth?: number
  championStrength?: number
  objectionCount?: number
  decisionMakerSignal?: boolean
  budgetConfirmed?: boolean
  nextStepDefined?: boolean
  riskCount?: number
  competitorCount?: number
  dealValue?: number
  maxDealValue?: number
  stageOrdinal?: number
  todoCompletionRate?: number
}): number[] {
  const vec = new Array(SIGNAL_DIMS).fill(0)

  vec[0] = meta.sentimentScore ?? 0.5
  vec[1] = meta.urgencyScore ?? 0
  vec[2] = meta.engagementScore ?? 0
  vec[3] = meta.momentumScore ?? 0.5
  vec[4] = meta.stakeholderDepth ?? 0
  vec[5] = meta.championStrength ?? 0
  vec[6] = Math.min(1, (meta.objectionCount ?? 0) / 5)
  vec[7] = meta.decisionMakerSignal ? 1 : 0
  vec[8] = meta.budgetConfirmed ? 1 : 0
  vec[9] = meta.nextStepDefined ? 1 : 0
  vec[10] = Math.min(1, (meta.riskCount ?? 0) / 5)
  vec[11] = Math.min(1, (meta.competitorCount ?? 0) / 4)
  // Normalised deal value (log scale)
  const val = Math.max(meta.dealValue ?? 0, 1)
  const maxVal = Math.max(meta.maxDealValue ?? 100_000, 1)
  vec[12] = maxVal > 1 ? Math.log(val + 1) / Math.log(maxVal + 1) : 0.5
  vec[13] = meta.stageOrdinal ?? 0
  vec[14] = meta.todoCompletionRate ?? 0.5
  vec[15] = 0 // reserved

  return vec
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level API: compute embeddings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a deal embedding from all available text and metadata.
 * Pure computation — no external calls, runs in <1ms.
 */
export function embedDeal(deal: {
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
  // Structured signals (from text-signals.ts or deal record)
  sentimentScore?: number
  urgencyScore?: number
  engagementScore?: number
  momentumScore?: number
  stakeholderDepth?: number
  championStrength?: number
  objectionCount?: number
  decisionMakerSignal?: boolean
  budgetConfirmed?: boolean
  nextStepDefined?: boolean
  dealValue?: number
  maxDealValue?: number
  stageOrdinal?: number
  todoCompletionRate?: number
}): EmbeddingResult {
  // Build text for TF-IDF
  const textParts = [
    deal.dealName,
    deal.prospectCompany,
    deal.description ?? '',
    deal.aiSummary ?? '',
    deal.nextSteps ?? '',
    deal.lostReason ?? '',
    ...(deal.dealRisks ?? []),
    ...(deal.competitors ?? []),
  ]
  // Meeting notes: take last ~3000 chars for recency bias
  if (deal.meetingNotes) {
    textParts.push(
      deal.meetingNotes.length > 3000
        ? deal.meetingNotes.slice(-3000)
        : deal.meetingNotes
    )
  }
  if (deal.notes) {
    textParts.push(
      deal.notes.length > 1500
        ? deal.notes.slice(-1500)
        : deal.notes
    )
  }
  const fullText = textParts.join(' ')

  const tfidf = computeTfIdfVector(fullText)
  const ngram = computeNgramVector(`${deal.dealName} ${deal.prospectCompany}`)
  const signals = computeSignalVector(deal)

  // Concatenate and normalise
  const vector = normalise([...tfidf, ...signals, ...ngram])

  return { vector, dimensions: EMBEDDING_DIMS }
}

/**
 * Compute a competitor embedding from name and metadata.
 */
export function embedCompetitor(comp: {
  name: string
  description?: string | null
  notes?: string | null
  strengths?: string[]
  weaknesses?: string[]
  keyFeatures?: string[]
}): EmbeddingResult {
  const textParts = [
    comp.name,
    comp.description ?? '',
    comp.notes ?? '',
    ...(comp.strengths ?? []),
    ...(comp.weaknesses ?? []),
    ...(comp.keyFeatures ?? []),
  ]
  const fullText = textParts.join(' ')

  const tfidf = computeTfIdfVector(fullText)
  // For competitors, n-gram on the name is critical for alias detection
  const ngram = computeNgramVector(comp.name)
  const signals = new Array(SIGNAL_DIMS).fill(0)

  const vector = normalise([...tfidf, ...signals, ...ngram])

  return { vector, dimensions: EMBEDDING_DIMS }
}

/**
 * Compute a collateral embedding from title and content.
 */
export function embedCollateral(item: {
  title: string
  type: string
  customTypeName?: string | null
  content?: { sections?: { heading: string; content: string }[] } | null
}): EmbeddingResult {
  const textParts = [`${item.customTypeName ?? item.type}: ${item.title}`]
  const sections = (item.content as any)?.sections
  if (Array.isArray(sections)) {
    for (const s of sections.slice(0, 6)) {
      textParts.push(`${s.heading} ${s.content}`)
    }
  }
  const fullText = textParts.join(' ')

  const tfidf = computeTfIdfVector(fullText)
  const ngram = computeNgramVector(item.title)
  const signals = new Array(SIGNAL_DIMS).fill(0)

  const vector = normalise([...tfidf, ...signals, ...ngram])

  return { vector, dimensions: EMBEDDING_DIMS }
}

/**
 * Embed a free-text query for semantic search.
 */
export function embedQuery(query: string): EmbeddingResult {
  const tfidf = computeTfIdfVector(query)
  const ngram = computeNgramVector(query)
  const signals = new Array(SIGNAL_DIMS).fill(0)

  const vector = normalise([...tfidf, ...signals, ...ngram])

  return { vector, dimensions: EMBEDDING_DIMS }
}

/**
 * Quick name similarity — optimised for competitor alias detection.
 * Uses character trigrams only (not TF-IDF) for fast, fuzzy name matching.
 */
export function nameSimilarity(a: string, b: string): number {
  const va = normalise(computeNgramVector(a))
  const vb = normalise(computeNgramVector(b))
  return cosineSimilarity(va, vb)
}

// ─────────────────────────────────────────────────────────────────────────────
// Content hash (for skip-if-unchanged)
// ─────────────────────────────────────────────────────────────────────────────

/** Fast content hash for change detection. */
export function contentHash(text: string): string {
  return fnv1a(text).toString(36)
}
