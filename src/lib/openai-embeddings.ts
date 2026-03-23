/**
 * Voyage AI Embedding Engine — pgvector-backed semantic search.
 *
 * Uses voyage-3-lite (1024 dims) — Anthropic's recommended embedding partner.
 * First 200M tokens free. $0.02 per 1M tokens after.
 *
 * Columns: deal_logs.note_embedding, deal_logs.deal_embedding (vector(1024))
 * Indexes: HNSW with cosine distance for fast ANN search.
 *
 * Requires VOYAGE_API_KEY in environment variables.
 * Get one at: https://dash.voyageai.com/
 */

const EMBEDDING_MODEL = 'voyage-3-lite'
const EMBEDDING_DIMENSIONS = 1024

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY not set — embeddings disabled')
  }

  const truncated = text.slice(0, 100000) // voyage-3-lite supports 32K tokens

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: [truncated],
      input_type: 'document',
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('[embeddings] Voyage AI error:', err)
    throw new Error(`Embedding generation failed: ${response.status}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY not set — embeddings disabled')
  }

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: [text.slice(0, 10000)],
      input_type: 'query',
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('[embeddings] Voyage AI error:', err)
    throw new Error(`Query embedding failed: ${response.status}`)
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
