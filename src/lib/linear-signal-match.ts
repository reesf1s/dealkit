/**
 * Linear signal matching — finds relevant Linear issues for at-risk deals.
 *
 * Algorithm:
 * 1. Extract "objection signal text" from deal (risks + notes + meetingNotes + lostReason)
 * 2. Embed using TF-IDF embedQuery (same system as the rest of Halvex)
 * 3. Cosine similarity against linear_issues_cache embeddings
 * 4. Score ≥ 80 → auto-confirm link, 60-79 → suggested, <60 → discard
 * 5. Upsert results into deal_linear_links
 *
 * All operations are workspace-scoped. Never touches cross-workspace data.
 */

import { db } from '@/lib/db'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { dealLogs, dealLinearLinks, linearIssuesCache, linearIntegrations, mcpActionLog } from '@/lib/db/schema'
import { findMatchingIssues } from '@/lib/deal-linear-matcher'
import { updateIssueDescription, getIssue } from '@/lib/linear-client'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Score ≥ this → auto-confirm (scaled 0-100) */
const AUTO_CONFIRM_THRESHOLD = 80

/** Score ≥ this → suggest for rep review.
 * Set to 15 because TF-IDF cosine similarity scores are typically
 * lower than dense neural embeddings — 0.15 is a genuine keyword overlap at this scale.
 * This ensures successCriteria keyword matches (e.g. Atlassian) are not filtered out.
 */
const SUGGEST_THRESHOLD = 15

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert an mcp_action_log row only if an identical entry (same workspace,
 * action_type, deal_id, linear_issue_id) has NOT been logged in the past 60 s.
 * This prevents duplicate audit rows when the cron or webhook fires multiple
 * times for the same event within a short window.
 */
async function logActionDeduped(values: {
  workspaceId: string
  actionType: string
  dealId?: string | null
  linearIssueId?: string | null
  triggeredBy?: string | null
  payload?: Record<string, unknown> | null
  result?: Record<string, unknown> | null
  status?: string
}): Promise<void> {
  try {
    // Check for a duplicate in the last 60 seconds
    const recent = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*) AS count
          FROM mcp_action_log
          WHERE workspace_id = ${values.workspaceId}::uuid
            AND action_type = ${values.actionType}
            AND deal_id = ${values.dealId ?? null}::uuid
            AND linear_issue_id = ${values.linearIssueId ?? null}
            AND created_at > NOW() - INTERVAL '60 seconds'
          LIMIT 1`
    )

    if (parseInt(recent[0]?.count ?? '0', 10) > 0) return

    await db.insert(mcpActionLog).values({
      workspaceId: values.workspaceId,
      actionType: values.actionType,
      dealId: values.dealId ?? undefined,
      linearIssueId: values.linearIssueId ?? undefined,
      triggeredBy: values.triggeredBy ?? undefined,
      payload: values.payload ?? undefined,
      result: values.result ?? undefined,
      status: values.status ?? 'complete',
    })
  } catch (err) {
    // Audit log is non-fatal — don't block matching if it fails
    console.warn('[linear-signal-match] logActionDeduped failed (non-fatal):', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract deal signal text for embedding.
 * Concatenates risk-oriented fields that represent objections/gaps.
 * Includes successCriteria — this is critical because many deals capture
 * product requirements in the success criteria field, not just in notes.
 */
export function extractDealSignalText(deal: {
  notes: string | null
  meetingNotes: string | null
  dealRisks: unknown
  lostReason: string | null
  description: string | null
  successCriteria?: string | null
}): string {
  const risks = Array.isArray(deal.dealRisks)
    ? (deal.dealRisks as string[]).join(' ')
    : ''

  return [
    risks,
    deal.successCriteria ?? '',
    deal.notes ?? '',
    deal.meetingNotes ?? '',
    deal.lostReason ?? '',
    deal.description ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Core match logic
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchResult {
  linked: number    // auto-confirmed
  suggested: number
}

/**
 * Run signal matching for a single deal against all workspace Linear issues.
 * Upserts deal_linear_links. Does not overwrite manually-set links or dismissed links.
 * Writes audit entries to mcp_action_log for every link created or updated.
 */
export async function matchDealToIssues(
  workspaceId: string,
  dealId: string,
  triggeredBy: 'cron' | 'user' | 'webhook' = 'cron',
): Promise<MatchResult> {
  const [deal] = await db
    .select({
      id: dealLogs.id,
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      notes: dealLogs.notes,
      meetingNotes: dealLogs.meetingNotes,
      dealRisks: dealLogs.dealRisks,
      lostReason: dealLogs.lostReason,
      description: dealLogs.description,
      successCriteria: dealLogs.successCriteria,
      stage: dealLogs.stage,
    })
    .from(dealLogs)
    .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
    .limit(1)

  if (!deal) return { linked: 0, suggested: 0 }

  const signalText = extractDealSignalText(deal)
  if (!signalText) return { linked: 0, suggested: 0 }

  // Find similar issues — pgvector primary, TF-IDF fallback
  const similar = await findMatchingIssues(dealId, workspaceId, deal, {
    limit: 25,
    minSimilarity: SUGGEST_THRESHOLD / 100,
  })

  if (similar.length === 0) return { linked: 0, suggested: 0 }

  // Load issue metadata for all matches
  const issueIds = similar.map(s => s.issueId)
  const cachedIssues = await db
    .select()
    .from(linearIssuesCache)
    .where(
      and(
        eq(linearIssuesCache.workspaceId, workspaceId),
        inArray(linearIssuesCache.linearIssueId, issueIds),
      ),
    )

  const issueMap = new Map(cachedIssues.map(i => [i.linearIssueId, i]))

  let linked = 0
  let suggested = 0

  for (const match of similar) {
    const issue = issueMap.get(match.issueId)
    if (!issue) continue

    const scoreInt = Math.round(match.similarity * 100)
    const newStatus = scoreInt >= AUTO_CONFIRM_THRESHOLD ? 'confirmed' : 'suggested'

    // Only upsert 'suggested' or 'confirmed' status — never overwrite 'dismissed' or 'manual'
    const existingLinks = await db
      .select()
      .from(dealLinearLinks)
      .where(
        and(
          eq(dealLinearLinks.dealId, dealId),
          eq(dealLinearLinks.linearIssueId, match.issueId),
        ),
      )
      .limit(1)

    const existing = existingLinks[0]

    if (existing) {
      // Never downgrade dismissed/manual links
      if (existing.status === 'dismissed' || existing.linkType === 'manual') continue

      await db
        .update(dealLinearLinks)
        .set({
          relevanceScore: scoreInt,
          status: newStatus,
          linearIssueUrl: issue.linearIssueUrl,
          linearTitle: issue.title,
          updatedAt: new Date(),
        })
        .where(eq(dealLinearLinks.id, existing.id))
    } else {
      await db.insert(dealLinearLinks).values({
        workspaceId,
        dealId,
        linearIssueId: match.issueId,
        linearIssueUrl: issue.linearIssueUrl,
        linearTitle: issue.title,
        relevanceScore: scoreInt,
        linkType: 'feature_gap',
        status: newStatus,
      })

      // Proactive Slack notification for NEW high-relevance links (≥ 80)
      if (scoreInt >= AUTO_CONFIRM_THRESHOLD) {
        import('./slack-notify').then(({ notifyNewIssueLink }) => {
          notifyNewIssueLink(workspaceId, {
            dealId,
            dealName: deal.dealName,
            company: deal.prospectCompany,
            linearIssueId: match.issueId,
            linearTitle: issue.title ?? match.issueId,
            linearIssueUrl: issue.linearIssueUrl,
            relevanceScore: scoreInt,
          }).catch(err => console.error('[linear-signal-match] Slack notify failed:', err))
        }).catch(() => { /* non-fatal */ })
      }
    }

    // Audit log — deduplicated to prevent repeat entries within 60 s
    await logActionDeduped({
      workspaceId,
      actionType: 'link_created',
      dealId,
      linearIssueId: match.issueId,
      triggeredBy,
      payload: {
        score: scoreInt,
        signalText: signalText.slice(0, 200),
        matchSource: match.source,
        linear_issue_identifier: match.issueId,
      },
      result: {
        status: newStatus,
        issueTitle: issue.title,
        linear_issue_identifier: match.issueId,
        linear_issue_title: issue.title,
      },
      status: 'complete',
    })

    if (newStatus === 'confirmed') linked++
    else suggested++
  }

  return { linked, suggested }
}

/**
 * Run signal matching for all open (non-closed) deals in a workspace.
 * Used by the nightly cron and the manual trigger endpoint.
 */
export async function matchAllOpenDeals(
  workspaceId: string,
  triggeredBy: 'cron' | 'user' = 'cron',
): Promise<MatchResult> {
  // Require a linear integration to exist
  const [integration] = await db
    .select({ id: linearIntegrations.id })
    .from(linearIntegrations)
    .where(eq(linearIntegrations.workspaceId, workspaceId))
    .limit(1)

  if (!integration) return { linked: 0, suggested: 0 }

  const openDeals = await db
    .select({ id: dealLogs.id })
    .from(dealLogs)
    .where(
      and(
        eq(dealLogs.workspaceId, workspaceId),
        // Exclude closed deals
        inArray(dealLogs.stage, [
          'prospecting',
          'qualification',
          'discovery',
          'proposal',
          'negotiation',
        ]),
      ),
    )

  // Clear stale suggested (unconfirmed) links before re-running so old
  // suggestions don't persist after issues are updated or deals change.
  // Only clears status='suggested' — never touches 'confirmed', 'in_cycle', or 'deployed'.
  if (openDeals.length > 0) {
    const dealIds = openDeals.map(d => d.id)
    await db.delete(dealLinearLinks).where(
      and(
        eq(dealLinearLinks.workspaceId, workspaceId),
        inArray(dealLinearLinks.dealId, dealIds),
        eq(dealLinearLinks.status, 'suggested'),
      )
    )
  }

  let totalLinked = 0
  let totalSuggested = 0

  for (const deal of openDeals) {
    const result = await matchDealToIssues(workspaceId, deal.id, triggeredBy)
    totalLinked += result.linked
    totalSuggested += result.suggested
  }

  return { linked: totalLinked, suggested: totalSuggested }
}

/**
 * Build the Halvex Intelligence section for a Linear issue description.
 * Called when a link is confirmed.
 */
export function buildHalvexSection(deals: {
  dealName: string
  prospectCompany: string
  stage: string
  dealValue: number | null
}[]): string {
  if (deals.length === 0) return ''

  const lines = deals.map(d => {
    const value = d.dealValue ? ` · $${(d.dealValue / 100).toLocaleString()}` : ''
    return `- **${d.dealName}** (${d.prospectCompany}) — ${d.stage}${value}`
  })

  return [
    `_Linked to ${deals.length} deal${deals.length !== 1 ? 's' : ''} in Halvex:_`,
    ...lines,
    '',
    `_Last updated: ${new Date().toISOString().slice(0, 10)}_`,
  ].join('\n')
}

/**
 * After a link is confirmed, update the Linear issue description with deal context.
 * Gathers all confirmed deals for this issue, then writes the Halvex section.
 * Silently no-ops if Linear integration is missing.
 */
export async function writeHalvexSectionToLinear(
  workspaceId: string,
  linearIssueId: string,
): Promise<void> {
  const [integration] = await db
    .select()
    .from(linearIntegrations)
    .where(eq(linearIntegrations.workspaceId, workspaceId))
    .limit(1)

  if (!integration) return

  let apiKey: string
  try {
    apiKey = decrypt(integration.apiKeyEnc, getEncryptionKey())
  } catch {
    return
  }

  // Get all confirmed links for this issue
  const confirmedLinks = await db
    .select({ dealId: dealLinearLinks.dealId })
    .from(dealLinearLinks)
    .where(
      and(
        eq(dealLinearLinks.workspaceId, workspaceId),
        eq(dealLinearLinks.linearIssueId, linearIssueId),
        eq(dealLinearLinks.status, 'confirmed'),
      ),
    )

  if (confirmedLinks.length === 0) return

  const dealIds = confirmedLinks.map(l => l.dealId)
  const deals = await db
    .select({
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      stage: dealLogs.stage,
      dealValue: dealLogs.dealValue,
    })
    .from(dealLogs)
    .where(and(eq(dealLogs.workspaceId, workspaceId), inArray(dealLogs.id, dealIds)))

  const halvexSection = buildHalvexSection(deals)

  try {
    // getIssue accepts both UUID and identifier (e.g. "ENG-36") — Linear API handles both.
    const issueData = await getIssue(apiKey, linearIssueId)
    if (!issueData) return

    await updateIssueDescription(apiKey, issueData.id, halvexSection)
  } catch (err) {
    console.error('[linear-signal-match] Failed to update Linear issue description:', err)
  }
}
