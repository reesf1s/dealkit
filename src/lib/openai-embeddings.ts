/**
 * OpenAI Embedding Engine — pgvector-backed semantic search.
 *
 * Uses text-embedding-3-small (1536 dims) for high-quality dense vectors
 * stored in Postgres via pgvector. Complements the local TF-IDF embeddings
 * in embeddings.ts with OpenAI-quality semantic understanding.
 *
 * Columns: deal_logs.note_embedding, deal_logs.deal_embedding (vector(1536))
 * Indexes: HNSW with cosine distance for fast ANN search.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

export async function generateEmbedding(text: string): Promise<number[]> {
  const truncated = text.slice(0, 30000) // ~8000 tokens

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: truncated,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('[embeddings] OpenAI error:', err)
    throw new Error(`Embedding generation failed: ${response.status}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

export async function generateDealEmbedding(deal: {
  name: string
  company: string
  stage: string
  meetingNotes: string
  signals?: any
}): Promise<number[]> {
  const parts = [
    `Deal: ${deal.name} at ${deal.company}`,
    `Stage: ${deal.stage}`,
    deal.meetingNotes ? `Notes: ${deal.meetingNotes}` : '',
    deal.signals?.championIdentified ? 'Champion identified' : '',
    deal.signals?.budgetConfirmed ? 'Budget confirmed' : '',
  ].filter(Boolean)

  return generateEmbedding(parts.join('\n'))
}

// Vector similarity search helper
export function vectorSearchSQL(embedding: number[], column: string, limit: number) {
  return `
    SELECT *, 1 - (${column} <=> '${JSON.stringify(embedding)}'::vector) as similarity
    FROM deal_logs
    ORDER BY ${column} <=> '${JSON.stringify(embedding)}'::vector
    LIMIT ${limit}
  `
}
