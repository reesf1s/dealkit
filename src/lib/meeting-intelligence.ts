/**
 * Meeting intelligence — extract feature requests from meeting notes
 * and trigger smart matching to issue cache.
 *
 * Flow:
 *   1. Use Claude Haiku to extract features + pain points from notes
 *   2. Store extracted features in note_signals_json
 *   3. Trigger smartMatchDeal() which handles matching against cached issues
 *
 * Called inside next/after() from the meeting-notes endpoint.
 */

import { anthropic } from '@/lib/ai/client'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { smartMatchDeal } from '@/lib/smart-match'


// ─── Types ───────────────────────────────────────────────────────────────────

interface ExtractedFeature {
  title: string
  description: string
  priority: 'blocker' | 'nice-to-have'
  context: 'deal_blocker' | 'nice_to_have' | 'on_roadmap' | 'competitor_advantage' | 'mentioned'
}

interface ExtractionResult {
  features: ExtractedFeature[]
  painPoints: string[]
}

const VALID_CONTEXTS = ['deal_blocker', 'nice_to_have', 'on_roadmap', 'competitor_advantage', 'mentioned'] as const

// ─── Haiku extraction ────────────────────────────────────────────────────────

export async function extractFeaturesFromNotes(notes: string): Promise<ExtractionResult> {
  try {
    const msg = await anthropic.messages.create({
      model: 'gpt-5.4-mini',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Extract product feature requests from these meeting notes.

RULES:
- Each feature title MUST be a concise product feature (3-8 words)
- Think: "what would the Linear issue be titled?"
- Good: "Team co-location analytics", "SSO integration", "Real-time occupancy dashboard"
- Bad: "We need the ability to see teams", "They want better reporting"
- Extract ALL mentioned product features, categorised by context (see below)
- Max 5 features total

context values:
- "deal_blocker": prospect explicitly says it BLOCKS or PREVENTS their decision
- "competitor_advantage": a competitor has this feature and prospect is comparing
- "nice_to_have": prospect wants it but it's not blocking ("would be nice", "ideally")
- "on_roadmap": prospect mentions we already have this planned / on roadmap
- "mentioned": casually mentioned, no strong signal

Return ONLY valid JSON:
{"features":[{"title":"string","description":"string","priority":"blocker"|"nice-to-have","context":"deal_blocker"|"nice_to_have"|"on_roadmap"|"competitor_advantage"|"mentioned"}],"painPoints":["string"]}

Notes:
${notes.slice(0, 3000)}`,
      }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as ExtractionResult

    return {
      features: Array.isArray(parsed.features)
        ? parsed.features.slice(0, 5).map(f => ({
          title: String(f.title ?? '').slice(0, 120),
          description: String(f.description ?? '').slice(0, 300),
          priority: f.priority === 'blocker' ? 'blocker' : 'nice-to-have',
          context: VALID_CONTEXTS.includes(f.context as typeof VALID_CONTEXTS[number])
            ? f.context
            : 'mentioned',
        }))
        : [],
      painPoints: Array.isArray(parsed.painPoints)
        ? parsed.painPoints.slice(0, 5).map(p => String(p).slice(0, 200))
        : [],
    }
  } catch {
    return { features: [], painPoints: [] }
  }
}

// ─── Main: extract features + trigger smart match ────────────────────────────

/**
 * Extract feature requests from meeting notes, store them as product gaps,
 * then trigger smart matching to find/create Linear issues.
 */
export async function extractAndLinkFeatures(
  dealId: string,
  notes: string,
  workspaceId: string,
): Promise<void> {
  try {
    const [deal] = await db
      .select({
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return

    // 1. Extract features via Haiku
    const extraction = await extractFeaturesFromNotes(notes)
    const totalFeatures = extraction.features.length

    if (totalFeatures === 0 && extraction.painPoints.length === 0) {
      console.log(`[meeting-intelligence] ${deal.prospectCompany}: no features extracted`)
      return
    }

    console.log(`[meeting-intelligence] ${deal.prospectCompany}: extracted ${totalFeatures} features`)

    // 2. Store extracted features in note_signals_json as product_gaps
    if (totalFeatures > 0) {
      try {
        // Read existing signals
        const [existing] = await db.execute<{ note_signals_json: string | null }>(
          sql`SELECT note_signals_json FROM deal_logs WHERE id = ${dealId}::uuid LIMIT 1`
        )
        let signals: Record<string, unknown> = {}
        if (existing?.note_signals_json) {
          try {
            signals = typeof existing.note_signals_json === 'string'
              ? JSON.parse(existing.note_signals_json)
              : existing.note_signals_json as Record<string, unknown>
          } catch { /* start fresh */ }
        }

        // Merge new product_gaps with existing
        const existingGaps = Array.isArray(signals.product_gaps) ? signals.product_gaps : []
        const newGaps = extraction.features.map(f => ({
          gap: f.title,
          description: f.description,
          severity: f.priority === 'blocker' ? 'high' : 'medium',
          context: f.context,
        }))

        // Deduplicate by first 30 chars of gap text
        for (const ng of newGaps) {
          const isDupe = existingGaps.some((eg: { gap: string }) =>
            eg.gap?.toLowerCase().slice(0, 30) === ng.gap.toLowerCase().slice(0, 30)
          )
          if (!isDupe) existingGaps.push(ng)
        }

        signals.product_gaps = existingGaps

        await db.execute(
          sql`UPDATE deal_logs SET note_signals_json = ${JSON.stringify(signals)}::text WHERE id = ${dealId}::uuid`
        )

        console.log(`[meeting-intelligence] ${deal.prospectCompany}: stored ${existingGaps.length} product gaps in note_signals_json`)
      } catch (e) {
        console.warn('[meeting-intelligence] Failed to store product gaps:', e)
      }
    }

    // 3. Trigger smart matching for this deal (matches against cached issues)
    const matchResult = await smartMatchDeal(workspaceId, dealId)
    console.log(`[meeting-intelligence] ${deal.prospectCompany}: smart match result — linked=${matchResult.linked}, created=${matchResult.created}`)
  } catch (e) {
    console.error('[meeting-intelligence] extractAndLinkFeatures failed:', e)
  }
}
