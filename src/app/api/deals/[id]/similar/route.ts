import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { dbErrResponse, ensureLinksColumn } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

// ── Similarity reason generator ─────────────────────────────────────────────
// Compares the source deal with each similar deal to explain WHY
// the brain thinks they're similar — no LLM call, pure heuristic.

function generateSimilarityReason(
  source: { dealValue: number | null; stage: string; competitors: string[]; description: string | null; dealRisks: string[]; notes: string | null },
  match: { dealValue: number | null; stage: string; competitors: string[]; description: string | null; dealRisks: string[]; prospectCompany: string; notes: string | null },
): string {
  const reasons: string[] = []

  // 1. Shared competitors
  const srcComps = (source.competitors ?? []).map(c => c.toLowerCase())
  const matchComps = (match.competitors ?? []).map(c => c.toLowerCase())
  const sharedComps = srcComps.filter(c => matchComps.includes(c))
  if (sharedComps.length > 0) {
    reasons.push(`competing against ${sharedComps.slice(0, 2).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' & ')}`)
  }

  // 2. Similar deal value range
  if (source.dealValue && match.dealValue) {
    const ratio = Math.min(source.dealValue, match.dealValue) / Math.max(source.dealValue, match.dealValue)
    if (ratio >= 0.5) {
      const bucket = match.dealValue >= 100000 ? 'enterprise' : match.dealValue >= 25000 ? 'mid-market' : 'SMB'
      reasons.push(`similar ${bucket} deal size`)
    }
  }

  // 3. Same or adjacent stage
  const STAGE_IDX: Record<string, number> = {
    prospecting: 0, qualification: 1, discovery: 2, proposal: 3,
    negotiation: 4, closed_won: 5, closed_lost: 5,
  }
  const srcIdx = STAGE_IDX[source.stage] ?? -1
  const matchIdx = STAGE_IDX[match.stage] ?? -1
  if (srcIdx >= 0 && matchIdx >= 0 && Math.abs(srcIdx - matchIdx) <= 1) {
    if (match.stage === 'closed_won') reasons.push('won deal — learn from this')
    else if (match.stage === 'closed_lost') reasons.push('lost deal — avoid same pitfalls')
    else if (source.stage === match.stage) reasons.push('same pipeline stage')
  }

  // 4. Shared risk themes
  const srcRisks = (source.dealRisks ?? []).map(r => r.toLowerCase())
  const matchRisks = (match.dealRisks ?? []).map(r => r.toLowerCase())
  if (srcRisks.length > 0 && matchRisks.length > 0) {
    // Look for keyword overlap in risk strings
    const srcRiskWords = new Set(srcRisks.flatMap(r => r.split(/\W+/).filter(w => w.length > 4)))
    const matchRiskWords = matchRisks.flatMap(r => r.split(/\W+/).filter(w => w.length > 4))
    const sharedRiskWords = matchRiskWords.filter(w => srcRiskWords.has(w))
    if (sharedRiskWords.length >= 2) {
      reasons.push('similar risk profile')
    }
  }

  // 5. Description/notes keyword overlap (lightweight NLP)
  const srcText = `${source.description ?? ''} ${source.notes ?? ''}`.toLowerCase()
  const matchText = `${match.description ?? ''} ${match.notes ?? ''}`.toLowerCase()
  if (srcText.length > 20 && matchText.length > 20) {
    const industry = ['fintech', 'healthcare', 'saas', 'enterprise', 'government', 'education', 'manufacturing', 'retail', 'insurance', 'banking', 'real estate', 'construction', 'legal', 'energy', 'telecom', 'media']
    const sharedIndustry = industry.filter(i => srcText.includes(i) && matchText.includes(i))
    if (sharedIndustry.length > 0) {
      reasons.push(`both in ${sharedIndustry[0]}`)
    }

    const themes = ['compliance', 'integration', 'migration', 'security', 'automation', 'reporting', 'analytics', 'onboarding', 'training', 'api', 'scalability', 'custom', 'pricing', 'poc', 'pilot', 'ramp']
    const sharedThemes = themes.filter(t => srcText.includes(t) && matchText.includes(t))
    if (sharedThemes.length > 0 && reasons.length < 3) {
      reasons.push(`shared focus on ${sharedThemes[0]}`)
    }
  }

  if (reasons.length === 0) {
    return 'Similar deal profile based on AI embedding analysis'
  }

  // Capitalize first reason
  const first = reasons[0].charAt(0).toUpperCase() + reasons[0].slice(1)
  if (reasons.length === 1) return first
  return `${first}, ${reasons.slice(1).join(', ')}`
}

// ── Overlapping risk finder ─────────────────────────────────────────────────
// Finds risks that appear in both deals using keyword overlap.

function findOverlappingRisks(srcRisks: string[], matchRisks: string[]): string[] {
  if (srcRisks.length === 0 || matchRisks.length === 0) return []
  const overlapping: string[] = []
  for (const sr of srcRisks) {
    const srWords = new Set(sr.toLowerCase().split(/\W+/).filter(w => w.length > 3))
    for (const mr of matchRisks) {
      const mrWords = mr.toLowerCase().split(/\W+/).filter(w => w.length > 3)
      const shared = mrWords.filter(w => srWords.has(w))
      if (shared.length >= 2) {
        overlapping.push(sr)
        break
      }
    }
  }
  return overlapping.slice(0, 3)
}

// ── Pre-computed advice generator ───────────────────────────────────────────
// Generates "what to do differently" for closed deals based on their outcome,
// loss reason, and overlapping risks. Pure heuristic — no LLM call.

function generateAdvice(
  similarDeal: { stage: string; lostReason: string | null; dealRisks: any; outcome: string | null; prospectCompany: string },
  sourceDeal: { dealRisks: any; stage: string } | undefined,
  overlappingRisks: string[],
): string | null {
  const outcome = similarDeal.outcome ?? (similarDeal.stage === 'closed_won' ? 'won' : similarDeal.stage === 'closed_lost' ? 'lost' : null)
  if (!outcome) return null

  if (outcome === 'lost') {
    const lossReason = similarDeal.lostReason
    if (lossReason && overlappingRisks.length > 0) {
      return `Address overlapping risks early — ${similarDeal.prospectCompany} was lost due to "${lossReason}" with similar risk factors present in your deal.`
    }
    if (lossReason) {
      return `${similarDeal.prospectCompany} was lost because: "${lossReason}". Proactively address this concern before it surfaces.`
    }
    if (overlappingRisks.length > 0) {
      return `This deal shares ${overlappingRisks.length} risk${overlappingRisks.length > 1 ? 's' : ''} with ${similarDeal.prospectCompany}. Mitigate these early to avoid the same outcome.`
    }
    return `${similarDeal.prospectCompany} was lost at a similar stage. Review what went wrong and ensure you have stronger champion support.`
  }

  if (outcome === 'won') {
    if (overlappingRisks.length > 0) {
      return `${similarDeal.prospectCompany} won despite similar risks — study their approach to risk mitigation for tactics you can replicate.`
    }
    return `${similarDeal.prospectCompany} won with a similar profile — replicate the engagement pattern that led to their close.`
  }

  return null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params
    const limit = 5

    // ── Pass 1: Numerical/TF-IDF matching (existing in-memory approach) ───────
    let numericalMatches: { entityId: string; similarity: number }[] = []
    try {
      const { findSimilarDeals } = await import('@/lib/semantic-search')
      numericalMatches = await findSimilarDeals(workspaceId, dealId, 10)
    } catch {
      // TF-IDF not available — will rely on semantic pass if embeddings exist
    }

    // ── Fetch source deal (needed for both semantic search + reason generation) ─
    await ensureLinksColumn()
    const [sourceDeal] = await db
      .select({
        dealValue: dealLogs.dealValue,
        stage: dealLogs.stage,
        competitors: dealLogs.competitors,
        description: dealLogs.description,
        dealRisks: dealLogs.dealRisks,
        notes: dealLogs.notes,
        dealEmbedding: dealLogs.dealEmbedding,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!sourceDeal) {
      return NextResponse.json({ data: [] })
    }

    // ── Pass 2: Semantic similarity via pgvector (if embedding exists) ─────────
    let semanticMatches: { id: string; similarity: number }[] = []
    if (sourceDeal.dealEmbedding) {
      try {
        const results = await db.execute(sql`
          SELECT id,
                 1 - (deal_embedding <=> ${sourceDeal.dealEmbedding}::vector) as similarity
          FROM deal_logs
          WHERE workspace_id = ${workspaceId}
            AND id != ${dealId}
            AND deal_embedding IS NOT NULL
          ORDER BY deal_embedding <=> ${sourceDeal.dealEmbedding}::vector
          LIMIT 10
        `)
        semanticMatches = (results.rows as any[]).map(r => ({
          id: r.id,
          similarity: Number(r.similarity),
        }))
      } catch (err) {
        console.error('[similar-deals] Semantic search failed:', err)
      }
    }

    // ── Combine scores: numerical (40%) + semantic (60%) ──────────────────────
    const combinedScores = new Map<string, { score: number; matchReasons: string[] }>()

    // Add numerical/TF-IDF matches (40% weight)
    for (const match of numericalMatches) {
      combinedScores.set(match.entityId, {
        score: (match.similarity || 0) * 0.4,
        matchReasons: ['Similar deal profile'],
      })
    }

    // Add semantic matches (60% weight)
    for (const match of semanticMatches) {
      const existing = combinedScores.get(match.id)
      if (existing) {
        existing.score += match.similarity * 0.6
        existing.matchReasons.push('Similar conversation patterns')
      } else {
        combinedScores.set(match.id, {
          score: match.similarity * 0.6,
          matchReasons: ['Similar conversation patterns'],
        })
      }
    }

    // If neither pass produced results, return empty
    if (combinedScores.size === 0) {
      return NextResponse.json({ data: [] })
    }

    // Sort by combined score and take top N
    const sortedEntries = Array.from(combinedScores.entries())
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, limit)

    const ids = sortedEntries.map(([id]) => id)

    // ── Fetch deal details for the top matches ────────────────────────────────
    const deals = await db
      .select({
        id: dealLogs.id,
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        stage: dealLogs.stage,
        dealValue: dealLogs.dealValue,
        conversionScore: dealLogs.conversionScore,
        competitors: dealLogs.competitors,
        description: dealLogs.description,
        dealRisks: dealLogs.dealRisks,
        notes: dealLogs.notes,
        lostReason: dealLogs.lostReason,
        lostDate: dealLogs.lostDate,
        wonDate: dealLogs.wonDate,
        outcome: dealLogs.outcome,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.workspaceId, workspaceId), inArray(dealLogs.id, ids)))

    const dealMap = new Map(deals.map(d => [d.id, d]))
    const data = sortedEntries
      .map(([id, { score, matchReasons }]) => {
        const d = dealMap.get(id)
        if (!d) return null

        // Generate a human-readable heuristic reason for similarity
        const reason = generateSimilarityReason(
          {
            dealValue: sourceDeal.dealValue,
            stage: sourceDeal.stage,
            competitors: sourceDeal.competitors as string[],
            description: sourceDeal.description,
            dealRisks: sourceDeal.dealRisks as string[],
            notes: sourceDeal.notes,
          },
          {
            dealValue: d.dealValue,
            stage: d.stage,
            competitors: d.competitors as string[],
            description: d.description,
            dealRisks: d.dealRisks as string[],
            prospectCompany: d.prospectCompany,
            notes: d.notes,
          },
        )

        // Compute overlapping risks between source deal and this similar deal
        const srcRisks = (sourceDeal.dealRisks as string[] ?? [])
        const matchRisks = (d.dealRisks as string[] ?? [])
        const overlappingRisks = findOverlappingRisks(srcRisks, matchRisks)

        // Generate "what to do differently" advice for closed deals
        const advice = generateAdvice(d, sourceDeal, overlappingRisks)

        return {
          id: d.id,
          dealName: d.dealName,
          prospectCompany: d.prospectCompany,
          stage: d.stage,
          dealValue: d.dealValue,
          conversionScore: d.conversionScore,
          similarity: Math.round(score * 100),
          reason,
          matchReasons,
          lostReason: d.lostReason,
          lostDate: d.lostDate?.toISOString() ?? null,
          wonDate: d.wonDate?.toISOString() ?? null,
          outcome: d.outcome ?? (d.stage === 'closed_won' ? 'won' : d.stage === 'closed_lost' ? 'lost' : null),
          dealRisks: matchRisks,
          overlappingRisks,
          advice,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
