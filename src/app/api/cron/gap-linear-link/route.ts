/**
 * GET /api/cron/gap-linear-link
 * Daily at 5 AM UTC — matches high-priority product gaps to Linear issues
 * and sends Slack DM suggestions when a confident match is found.
 *
 * Runs after linear-match (4 AM) which syncs Linear issues into the cache.
 *
 * Algorithm:
 * 1. For each workspace with Linear connected + product gaps with status 'open' | 'in_review'
 * 2. Tokenize each gap's title into keywords
 * 3. Score Linear issues by keyword overlap against gap title + description
 * 4. Score ≥ 35% keyword overlap → send Slack DM suggestion (once per gap/issue pair per week)
 *
 * Secured by CRON_SECRET.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 180

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { linearIntegrations, linearIssuesCache, productGaps } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { notifyGapLinearSuggestion } from '@/lib/slack-notify'
import { getWorkspaceBrain } from '@/lib/workspace-brain'

// ─────────────────────────────────────────────────────────────────────────────
// Simple keyword scorer
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','can','need','want',
  'our','us','we','you','your','they','their','it','its','this','that',
  'as','by','from','up','about','into','through','during','feature','request',
  'support','add','allow','enable','make','use','get','set','create',
])

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t))
  )
}

function keywordOverlap(gapTokens: Set<string>, issueText: string): number {
  if (gapTokens.size === 0) return 0
  const issueTokens = tokenize(issueText)
  let matches = 0
  for (const token of gapTokens) {
    if (issueTokens.has(token)) matches++
  }
  return matches / gapTokens.size
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

const MATCH_THRESHOLD = 0.35  // 35% keyword overlap = confident match

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Workspaces with Linear connected
    const integrations = await db
      .select({ workspaceId: linearIntegrations.workspaceId })
      .from(linearIntegrations)

    let totalMatches = 0
    let totalGapsScanned = 0

    for (const { workspaceId } of integrations) {
      try {
        // Load high-priority open gaps for this workspace
        const gaps = await db
          .select({
            id: productGaps.id,
            title: productGaps.title,
            description: productGaps.description,
            priority: productGaps.priority,
            affectedRevenue: productGaps.affectedRevenue,
          })
          .from(productGaps)
          .where(
            and(
              eq(productGaps.workspaceId, workspaceId),
              inArray(productGaps.status, ['open', 'in_review']),
            )
          )

        if (gaps.length === 0) continue

        // Load all Linear issues in cache for this workspace
        const issues = await db
          .select({
            linearIssueId: linearIssuesCache.linearIssueId,
            linearIssueUrl: linearIssuesCache.linearIssueUrl,
            title: linearIssuesCache.title,
            description: linearIssuesCache.description,
            status: linearIssuesCache.status,
          })
          .from(linearIssuesCache)
          .where(eq(linearIssuesCache.workspaceId, workspaceId))

        if (issues.length === 0) continue

        // Load brain for revenueAtRisk + dealsBlocked from productGapPriority
        const brain = await getWorkspaceBrain(workspaceId)

        for (const gap of gaps) {
          totalGapsScanned++
          const gapTokens = tokenize(`${gap.title} ${gap.description ?? ''}`)

          let bestScore = 0
          let bestIssue: typeof issues[0] | null = null

          for (const issue of issues) {
            // Skip issues already done
            if (issue.status === 'Done' || issue.status === 'Cancelled') continue

            const score = keywordOverlap(gapTokens, `${issue.title} ${issue.description ?? ''}`)
            if (score > bestScore) {
              bestScore = score
              bestIssue = issue
            }
          }

          if (bestScore >= MATCH_THRESHOLD && bestIssue) {
            // Find revenue context from brain
            const brainGap = brain?.productGapPriority?.find(g => g.gapId === gap.id)
            const revenueAtRisk = brainGap?.revenueAtRisk ?? gap.affectedRevenue ?? 0
            const dealsBlocked = brainGap?.dealsBlocked ?? 0

            // Only notify for high-impact gaps (high/critical priority OR revenue at risk)
            if (gap.priority !== 'low' || revenueAtRisk > 0) {
              await notifyGapLinearSuggestion(workspaceId, {
                gapTitle: gap.title,
                gapId: gap.id,
                linearIssueId: bestIssue.linearIssueId,
                linearTitle: bestIssue.title,
                linearIssueUrl: bestIssue.linearIssueUrl ?? null,
                revenueAtRisk,
                dealsBlocked,
              })
              totalMatches++
            }
          }
        }
      } catch (err) {
        console.error(`[cron/gap-linear-link] workspace=${workspaceId}`, err)
      }
    }

    console.log(`[cron/gap-linear-link] matched=${totalMatches} gapsScanned=${totalGapsScanned}`)
    return NextResponse.json({ ok: true, totalMatches, totalGapsScanned })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/gap-linear-link] failed:', msg)
    return NextResponse.json({ ok: false, error: msg })
  }
}
