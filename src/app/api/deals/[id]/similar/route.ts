import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params

    // Dynamic import — semantic search may not be available if pgvector isn't installed
    let similar: { entityId: string; similarity: number }[]
    try {
      const { findSimilarDeals } = await import('@/lib/semantic-search')
      similar = await findSimilarDeals(workspaceId, dealId, 5)
    } catch {
      return NextResponse.json({ data: [], message: 'Semantic search not available' })
    }

    if (similar.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Fetch source deal for comparison
    await ensureLinksColumn()
    const [sourceDeal] = await db
      .select({
        dealValue: dealLogs.dealValue,
        stage: dealLogs.stage,
        competitors: dealLogs.competitors,
        description: dealLogs.description,
        dealRisks: dealLogs.dealRisks,
        notes: dealLogs.notes,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    // Fetch deal details for similar deals (with extra fields for reason generation)
    const ids = similar.map(s => s.entityId)
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
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.workspaceId, workspaceId), inArray(dealLogs.id, ids)))

    const dealMap = new Map(deals.map(d => [d.id, d]))
    const data = similar
      .map(s => {
        const d = dealMap.get(s.entityId)
        if (!d) return null

        // Generate a human-readable reason for similarity
        const reason = sourceDeal
          ? generateSimilarityReason(
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
          : undefined

        return {
          id: d.id,
          dealName: d.dealName,
          prospectCompany: d.prospectCompany,
          stage: d.stage,
          dealValue: d.dealValue,
          conversionScore: d.conversionScore,
          similarity: Math.round(s.similarity * 100),
          reason,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
