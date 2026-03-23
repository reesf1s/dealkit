/**
 * OpenAI Embedding Engine — pgvector-backed semantic search.
 *
 * Uses text-embedding-3-small (1536 dims). Standard choice.
 * Set OPENAI_API_KEY in Vercel environment variables.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small'

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set — embeddings disabled')
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 30000),
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

// Alias for query vs document — OpenAI doesn't distinguish, but keeping
// the interface so we can swap providers later without changing callers.
export const generateQueryEmbedding = generateEmbedding

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
