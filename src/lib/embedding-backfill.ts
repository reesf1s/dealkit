/**
 * Embedding Backfill — generates embeddings for deals that don't have them yet.
 *
 * Called as a background task during brain rebuilds. Non-fatal: if OPENAI_API_KEY
 * is not set or the API fails, it logs an error and moves on.
 *
 * Rate-limited to ~5 requests/second (200ms between calls) to avoid hitting
 * OpenAI rate limits.
 */

import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { generateEmbedding, generateDealEmbedding } from './openai-embeddings'

export async function backfillEmbeddings(workspaceId: string): Promise<number> {
  // Bail early if no API key configured
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[embeddings] Skipping backfill — OPENAI_API_KEY not set')
    return 0
  }

  const deals = await db.select({
    id: dealLogs.id,
    dealName: dealLogs.dealName,
    prospectCompany: dealLogs.prospectCompany,
    stage: dealLogs.stage,
    meetingNotes: dealLogs.meetingNotes,
    hubspotNotes: dealLogs.hubspotNotes,
    intentSignals: dealLogs.intentSignals,
    dealEmbedding: dealLogs.dealEmbedding,
  })
    .from(dealLogs)
    .where(and(
      eq(dealLogs.workspaceId, workspaceId),
      isNull(dealLogs.dealEmbedding),
    ))

  let count = 0
  for (const deal of deals) {
    const noteText = [deal.meetingNotes, deal.hubspotNotes].filter(Boolean).join('\n')
    if (noteText.length < 50) continue // Skip trivial notes

    try {
      const noteEmb = await generateEmbedding(noteText)
      const dealEmb = await generateDealEmbedding({
        name: deal.dealName || '',
        company: deal.prospectCompany || '',
        stage: deal.stage || '',
        meetingNotes: noteText,
        signals: deal.intentSignals as any,
      })

      await db.update(dealLogs).set({
        noteEmbedding: JSON.stringify(noteEmb),
        dealEmbedding: JSON.stringify(dealEmb),
      }).where(eq(dealLogs.id, deal.id))

      count++
      // Rate limit: 200ms between calls
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`[embeddings] Backfill failed for ${deal.id}:`, err)
    }
  }

  console.log(`[embeddings] Backfilled ${count} deals for workspace ${workspaceId}`)
  return count
}
