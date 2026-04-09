/**
 * GET /api/dashboard/summary
 * Returns the "Revenue at Risk" panel data for the Today tab.
 *
 * Urgency algorithm (no LLM):
 *   urgency = (1 - winProb) × dealValue × ln(daysStale + 1) × riskMultiplier
 *
 * Focus bullets: Haiku-generated, cached for 1 hour per workspace.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq, and, not, inArray } from 'drizzle-orm'
import { dbErrResponse } from '@/lib/api-helpers'

// In-memory focus bullet cache keyed by workspaceId
const focusCache: Record<string, { bullets: string[]; builtAt: number }> = {}
const FOCUS_CACHE_TTL = 60 * 60 * 1000 // 1 hour

function computeUrgency(
  deal: { conversionScore: number | null; dealValue: number | null; updatedAt: string | Date },
  hasGapPriority: boolean,
): number {
  const winProb = deal.conversionScore ? deal.conversionScore / 100 : 0.5
  const value = deal.dealValue || 0
  const daysStale = Math.floor(
    (Date.now() - new Date(deal.updatedAt).getTime()) / 86400000,
  )
  const riskMultiplier = hasGapPriority ? 1.3 : 1.0
  return (1 - winProb) * value * Math.log(daysStale + 1) * riskMultiplier
}

function computeTopAction(deal: {
  updatedAt: string | Date
  contacts: unknown
  todos: unknown
  dealRisks: unknown
}, linearIssueLinked: boolean): string {
  const daysStale = Math.floor(
    (Date.now() - new Date(deal.updatedAt).getTime()) / 86400000,
  )
  if (daysStale > 14) return 'Follow up now'
  const contacts = Array.isArray(deal.contacts) ? deal.contacts : []
  if (contacts.length === 0) return 'Add primary contact'
  const todos = Array.isArray(deal.todos) ? deal.todos : (deal.todos as any)?.items ?? []
  const pending = todos.filter((t: any) => !t.completed && !t.done)
  if (pending.length > 0) return pending[0].text ?? pending[0].title ?? 'Complete pending task'
  const risks = Array.isArray(deal.dealRisks) ? deal.dealRisks : []
  const hasCompetitor = risks.some((r: string) =>
    /compet|rival|vs\s/i.test(r),
  )
  if (hasCompetitor) return 'Prepare battlecard'
  if (linearIssueLinked) return 'Share roadmap update'
  return 'Review deal'
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const brain = await getWorkspaceBrain(workspaceId)

    // Load open deals
    const CLOSED = ['closed_won', 'closed_lost'] as const
    const openDeals = await db
      .select({
        id: dealLogs.id,
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        stage: dealLogs.stage,
        dealValue: dealLogs.dealValue,
        conversionScore: dealLogs.conversionScore,
        updatedAt: dealLogs.updatedAt,
        contacts: dealLogs.contacts,
        todos: dealLogs.todos,
        dealRisks: dealLogs.dealRisks,
      })
      .from(dealLogs)
      .where(
        and(
          eq(dealLogs.workspaceId, workspaceId),
          not(inArray(dealLogs.stage, CLOSED)),
        ),
      )

    // Build top deals sorted by urgency
    const scored = openDeals.map(deal => {
      // Check if deal appears in brain's urgent list
      const isUrgent = (brain?.urgentDeals ?? []).some(u => u.dealId === deal.id)
      const urgencyScore = computeUrgency(deal, isUrgent)

      // Risk level
      const riskLevel =
        urgencyScore > 50000 ? 'high'
        : urgencyScore > 10000 ? 'medium'
        : 'low'

      // Primary blocker from deal risks
      const primaryBlocker = Array.isArray(deal.dealRisks) && (deal.dealRisks as string[]).length > 0
        ? ((deal.dealRisks as string[])[0] ?? '').slice(0, 60)
        : null

      const topAction = computeTopAction(deal, false)

      return {
        id: deal.id,
        name: deal.dealName,
        company: deal.prospectCompany,
        value: deal.dealValue ?? 0,
        stage: deal.stage,
        urgencyScore,
        primaryBlocker,
        topAction,
        riskLevel: riskLevel as 'high' | 'medium' | 'low',
        daysStale: Math.floor(
          (Date.now() - new Date(deal.updatedAt).getTime()) / 86400000,
        ),
      }
    })

    scored.sort((a, b) => b.urgencyScore - a.urgencyScore)
    const topDeals = scored.slice(0, 8)

    // Revenue at risk = sum of (1 - winProb) × value for all open deals
    const revenueAtRisk = openDeals.reduce((acc, deal) => {
      const winProb = deal.conversionScore ? deal.conversionScore / 100 : 0.5
      return acc + (1 - winProb) * (deal.dealValue ?? 0)
    }, 0)

    // Focus bullets — cached per workspace for 1 hour
    let focusBullets: string[] = []
    const cached = focusCache[workspaceId]
    if (cached && Date.now() - cached.builtAt < FOCUS_CACHE_TTL) {
      focusBullets = cached.bullets
    } else if (topDeals.length > 0) {
      try {
        const { createOpenAI } = await import('@ai-sdk/openai')
        const { generateText } = await import('ai')
        const anthropic = createOpenAI()
        const context = topDeals
          .slice(0, 4)
          .map(
            (d, i) =>
              `${i + 1}. ${d.company} (${d.stage}, ${d.riskLevel} risk${d.primaryBlocker ? ', blocker: ' + d.primaryBlocker : ''}) — suggested: ${d.topAction}`,
          )
          .join('\n')
        const { text } = await generateText({
          model: anthropic('gpt-5.4-mini'),
          prompt: `You are a sales intelligence assistant. Given these top at-risk deals, write exactly 4 concise action bullets (max 12 words each, start with a verb). Return just the 4 bullets, one per line, no numbering.\n\n${context}`,
          providerOptions: {
            openai: {
              maxCompletionTokens: 150,
            },
          },
        })
        focusBullets = text
          .split('\n')
          .map(l => l.replace(/^[-•*]\s*/, '').trim())
          .filter(Boolean)
          .slice(0, 4)
        focusCache[workspaceId] = { bullets: focusBullets, builtAt: Date.now() }
      } catch {
        // Graceful degradation — use computed actions
        focusBullets = topDeals
          .slice(0, 4)
          .map(d => `${d.topAction}: ${d.company}`)
      }
    }

    return NextResponse.json({
      data: {
        revenueAtRisk: Math.round(revenueAtRisk),
        dealsAtRisk: scored.filter(d => d.riskLevel !== 'low').length,
        topDeals,
        focusBullets,
      },
    })
  } catch (err) {
    return dbErrResponse(err)
  }
}
