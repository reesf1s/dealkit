/**
 * GET /api/deals/ai-snapshots
 *
 * Returns a one-sentence AI status snapshot for every open deal in the workspace.
 * Snapshots are generated in a single batch LLM call, then cached in ai_summary.
 *
 * Cache strategy:
 *   - If a deal already has ai_summary, return it immediately (free)
 *   - If not, generate in batch for all missing ones, write back, then return
 *   - ?force=true regenerates all (clears existing summaries first in memory)
 *
 * Response: { snapshots: { [dealId]: string } }
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, not, inArray, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { gptMini } from '@/lib/ai/client'
import { generateText } from 'ai'
import { getManualBriefOverride } from '@/lib/brief-override'
import { getEffectiveDealSummary } from '@/lib/effective-deal-summary'

const CLOSED = ['closed_won', 'closed_lost'] as const

function extractLatestNote(notes: unknown): string | null {
  if (typeof notes !== 'string' || !notes.trim()) return null
  const sections = notes.split(/\n---\n/).filter(s => s.trim())
  if (!sections.length) return null
  const last = sections[sections.length - 1].trim()
  return last.length > 500 ? last.slice(0, 500) + '…' : last
}

function daysStale(updatedAt: string | Date): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
}

function scoreToHealth(score: number | null, stale: number): 'improving' | 'at_risk' | 'stable' | 'new' {
  if (score == null) return 'new'
  if (stale > 21 || score < 30) return 'at_risk'
  if (score >= 70 && stale < 7) return 'improving'
  if (stale > 14 || score < 45) return 'at_risk'
  return 'stable'
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const force = req.nextUrl.searchParams.get('force') === 'true'

    // Load all open deals
    const openDeals = await db.select({
      id: dealLogs.id,
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      stage: dealLogs.stage,
      dealValue: dealLogs.dealValue,
      conversionScore: dealLogs.conversionScore,
      updatedAt: dealLogs.updatedAt,
      meetingNotes: dealLogs.meetingNotes,
      dealRisks: dealLogs.dealRisks,
      nextSteps: dealLogs.nextSteps,
      contacts: dealLogs.contacts,
      aiSummary: dealLogs.aiSummary,
      dealReview: dealLogs.dealReview,
    }).from(dealLogs).where(
      and(
        eq(dealLogs.workspaceId, workspaceId),
        not(inArray(dealLogs.stage, [...CLOSED])),
      )
    )

    if (!openDeals.length) {
      return NextResponse.json({ snapshots: {} })
    }

    // Build result — use the same summary users see elsewhere when available.
    const result: Record<string, string> = {}
    const health: Record<string, 'improving' | 'at_risk' | 'stable' | 'new'> = {}

    const needsGeneration = force
      ? openDeals.filter(d => !getManualBriefOverride(d.dealReview as Record<string, unknown> | null | undefined))
      : openDeals.filter(d => !getEffectiveDealSummary(d))

    for (const d of openDeals) {
      const stale = daysStale(d.updatedAt)
      health[d.id] = scoreToHealth(d.conversionScore, stale)
      const effectiveSummary = getEffectiveDealSummary(d)
      if (effectiveSummary) {
        result[d.id] = effectiveSummary
      }
    }

    // Generate for deals that need it
    if (needsGeneration.length > 0) {
      const dealData = needsGeneration.map(d => {
        const stale = daysStale(d.updatedAt)
        const latestNote = extractLatestNote(d.meetingNotes)
        const risks = Array.isArray(d.dealRisks)
          ? (d.dealRisks as Array<string | { risk: string }>)
              .slice(0, 2)
              .map(r => (typeof r === 'string' ? r : r.risk))
              .join('; ')
          : null
        const contacts = Array.isArray(d.contacts)
          ? (d.contacts as Array<{ name: string; title?: string }>)
              .slice(0, 2)
              .map(c => c.title ? `${c.name} (${c.title})` : c.name)
              .join(', ')
          : null

        return {
          id: d.id,
          company: d.prospectCompany ?? d.dealName ?? 'Unknown',
          stage: (d.stage ?? '').replace(/_/g, ' '),
          score: d.conversionScore ?? null,
          value: d.dealValue ? `£${Number(d.dealValue).toLocaleString()}` : null,
          stale_days: stale,
          latest_note: latestNote,
          risks,
          next_steps: d.nextSteps ?? null,
          contacts,
        }
      })

      try {
        const { text } = await generateText({
          model: gptMini,
          prompt: `You are a sales intelligence analyst who writes ultra-concise deal status updates.

For each deal below, write ONE sentence (max 110 characters) that tells a busy sales rep:
1. What's happening right now (based on latest_note if available)
2. The single biggest blocker or opportunity
3. What to do next (specific, not generic)

Return ONLY a valid JSON object. Keys are deal IDs, values are single sentences.

RULES:
- Use real names and companies from the data
- If latest_note exists, it is the ground truth — use it
- If stale_days > 14, mention the silence: "Silent for X days — call [contact] directly"
- If there's a competitor in risks, mention it: "Competitor [X] in play — run battlecard call"
- Be specific: "Send contract to Sarah" not "Follow up with stakeholder"
- If no data at all, write: "No notes yet — log your first call update"
- Max 110 chars per entry

Deals:
${JSON.stringify(dealData, null, 2)}`,
          providerOptions: {
            openai: { maxCompletionTokens: Math.min(150 * dealData.length, 2000) },
          },
        })

        // Parse JSON from response
        let generated: Record<string, string> = {}
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            generated = JSON.parse(jsonMatch[0])
          } catch {
            // Fallback: skip generation, use defaults
          }
        }

        // Write back to DB + merge into result
        const writes = needsGeneration
          .filter(d => generated[d.id])
          .map(d =>
            db.update(dealLogs)
              .set({ aiSummary: generated[d.id] })
              .where(eq(dealLogs.id, d.id))
          )
        if (writes.length > 0) {
          await Promise.allSettled(writes)
        }

        // Merge into result
        for (const d of needsGeneration) {
          if (generated[d.id]) {
            result[d.id] = generated[d.id]
          } else {
            // Fallback for deals where generation failed
            const stale = daysStale(d.updatedAt)
            if (stale > 14) {
              result[d.id] = `No contact in ${stale} days — follow up to keep this moving.`
            } else if (d.nextSteps) {
              result[d.id] = d.nextSteps.slice(0, 110)
            } else {
              result[d.id] = 'No notes yet — log your first call update.'
            }
          }
        }
      } catch (err) {
        console.error('[ai-snapshots] generation error:', err)
        // Fallback: compute simple heuristic summaries
        for (const d of needsGeneration) {
          const stale = daysStale(d.updatedAt)
          if (stale > 14) {
            result[d.id] = `No contact in ${stale} days — follow up to keep this moving.`
          } else if (d.nextSteps) {
            result[d.id] = d.nextSteps.slice(0, 110)
          } else {
            result[d.id] = 'Add meeting notes to get AI deal intelligence.'
          }
        }
      }
    }

    return NextResponse.json({ snapshots: result, health })
  } catch (e) {
    console.error('[ai-snapshots] error:', e)
    return NextResponse.json({ snapshots: {}, health: {} })
  }
}
