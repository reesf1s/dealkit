/**
 * Smart deal-to-Linear matching — quality over quantity.
 *
 * Strategy:
 * 1. Extract product gaps from deal's note_signals_json (already done by meeting notes processing)
 * 2. For each product gap, search Linear issues by:
 *    a. Direct title substring match (highest confidence)
 *    b. Keyword overlap scoring (native, no API)
 * 3. If no match: create the issue on Linear and link it
 * 4. Max 5 links per deal — only genuine product blockers
 *
 * No LLM calls during matching — all native algorithms.
 * LLM is only used for issue creation descriptions (optional).
 */

import { db } from '@/lib/db'
import { eq, and, sql } from 'drizzle-orm'
import { dealLogs, dealLinearLinks, linearIssuesCache, linearIntegrations } from '@/lib/db/schema'
import { createIssue } from '@/lib/linear-client'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'

const MAX_LINKS_PER_DEAL = 5

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductGap {
  gap: string
  quote?: string
  severity?: string
}

interface MatchResult {
  linked: number
  created: number
  dealName: string
}

// ─── Native keyword scoring (no LLM, no API) ────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  )
}

/**
 * Score how well a gap description matches a Linear issue title+description.
 * Returns 0-100. Pure keyword overlap — no API calls.
 */
function keywordScore(gapText: string, issueTitle: string, issueDesc: string | null): number {
  const gapTokens = tokenize(gapText)
  const issueTokens = tokenize(`${issueTitle} ${issueDesc ?? ''}`)

  if (gapTokens.size === 0 || issueTokens.size === 0) return 0

  let matches = 0
  for (const token of gapTokens) {
    if (issueTokens.has(token)) matches++
    // Also check if the token is a substring of any issue token (partial match)
    else {
      for (const iToken of issueTokens) {
        if (iToken.includes(token) || token.includes(iToken)) {
          matches += 0.5
          break
        }
      }
    }
  }

  // Jaccard-like score weighted towards gap coverage
  const coverage = matches / gapTokens.size
  return Math.round(coverage * 100)
}

// ─── Main matching function ──────────────────────────────────────────────────

/**
 * Match a single deal to Linear issues using its extracted product gaps.
 * Only links genuine product blockers — not sales/competitor issues.
 */
export async function smartMatchDeal(
  workspaceId: string,
  dealId: string,
): Promise<MatchResult> {
  // 1. Load deal with its extracted gaps
  const [deal] = await db
    .select({
      id: dealLogs.id,
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      meetingNotes: dealLogs.meetingNotes,
      description: dealLogs.description,
      notes: dealLogs.notes,
    })
    .from(dealLogs)
    .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
    .limit(1)

  if (!deal) return { linked: 0, created: 0, dealName: '' }

  // 2. Extract product gaps from multiple sources
  let productGaps: ProductGap[] = []

  // Source A: note_signals_json (extracted by meeting notes processing)
  try {
    const [signalsRow] = await db.execute<{ note_signals_json: string | null }>(
      sql`SELECT note_signals_json FROM deal_logs WHERE id = ${dealId}::uuid LIMIT 1`
    )
    if (signalsRow?.note_signals_json) {
      const signals = typeof signalsRow.note_signals_json === 'string'
        ? JSON.parse(signalsRow.note_signals_json)
        : signalsRow.note_signals_json
      const gaps = (signals?.product_gaps ?? []).filter((g: ProductGap) => g.gap?.trim())
      productGaps.push(...gaps)
    }
  } catch { /* non-fatal */ }

  // Source B: success_criteria (often contains specific product requirements)
  try {
    const [scRow] = await db.execute<{ success_criteria: string | null }>(
      sql`SELECT success_criteria FROM deal_logs WHERE id = ${dealId}::uuid LIMIT 1`
    )
    if (scRow?.success_criteria) {
      // Split by newlines or bullet points — each line is a criterion
      const lines = scRow.success_criteria
        .split(/[\n\r]+/)
        .map(l => l.replace(/^[\s*\-•]+/, '').trim())
        .filter(l => l.length > 10 && l.length < 200)
      for (const line of lines) {
        // Avoid duplicating gaps we already have
        const isDupe = productGaps.some(g => g.gap.toLowerCase().includes(line.toLowerCase().slice(0, 30)))
        if (!isDupe) {
          productGaps.push({ gap: line, severity: 'medium' })
        }
      }
    }
  } catch { /* non-fatal */ }

  // If no extracted gaps, try to find product-related keywords in notes
  if (productGaps.length === 0) {
    const allText = [deal.notes, deal.meetingNotes, deal.description].filter(Boolean).join(' ')
    // Look for product-signal keywords
    const productKeywords = ['integration', 'feature', 'api', 'dashboard', 'reporting', 'analytics',
      'automation', 'workflow', 'sync', 'import', 'export', 'sso', 'security', 'compliance',
      'booking', 'occupancy', 'sensor', 'space', 'allocation', 'scheduling', 'calendar']
    const found = productKeywords.filter(kw => allText.toLowerCase().includes(kw))
    if (found.length > 0) {
      // Create synthetic gaps from keyword context
      for (const kw of found.slice(0, 3)) {
        // Find the sentence containing this keyword
        const sentences = allText.split(/[.!?\n]+/).filter(s => s.toLowerCase().includes(kw))
        if (sentences.length > 0) {
          productGaps.push({ gap: sentences[0].trim().slice(0, 150), severity: 'medium' })
        }
      }
    }
  }

  if (productGaps.length === 0) {
    console.log(`[smart-match] ${deal.prospectCompany}: no product gaps found — skipping`)
    return { linked: 0, created: 0, dealName: deal.dealName }
  }

  console.log(`[smart-match] ${deal.prospectCompany}: ${productGaps.length} product gaps to match`)

  // 3. Load all Linear issues for this workspace
  const issues = await db
    .select({
      linearIssueId: linearIssuesCache.linearIssueId,
      title: linearIssuesCache.title,
      description: linearIssuesCache.description,
      linearIssueUrl: linearIssuesCache.linearIssueUrl,
      status: linearIssuesCache.status,
      priority: linearIssuesCache.priority,
    })
    .from(linearIssuesCache)
    .where(eq(linearIssuesCache.workspaceId, workspaceId))

  // 4. Load Linear integration for issue creation
  const [integration] = await db
    .select({ apiKeyEnc: linearIntegrations.apiKeyEnc, teamId: linearIntegrations.teamId })
    .from(linearIntegrations)
    .where(eq(linearIntegrations.workspaceId, workspaceId))
    .limit(1)

  let linearApiKey: string | null = null
  if (integration) {
    try { linearApiKey = decrypt(integration.apiKeyEnc, getEncryptionKey()) } catch { /* non-fatal */ }
  }

  // 5. Match each gap to Linear issues
  let linked = 0
  let created = 0

  for (const gap of productGaps.slice(0, MAX_LINKS_PER_DEAL)) {
    const gapText = gap.gap

    // Strategy A: Direct title substring match
    const titleLower = gapText.toLowerCase()
    // Find issues where the gap text appears in the title or vice versa
    let bestMatch: typeof issues[0] | null = null
    let bestScore = 0

    for (const issue of issues) {
      // Direct substring: "Appspace integration" in "Appspace integration setup"
      const issueTitleLower = issue.title.toLowerCase()
      if (issueTitleLower.includes(titleLower) || titleLower.includes(issueTitleLower)) {
        bestMatch = issue
        bestScore = 95
        break
      }

      // Keyword scoring
      const score = keywordScore(gapText, issue.title, issue.description)
      if (score > bestScore && score >= 40) {
        bestScore = score
        bestMatch = issue
      }
    }

    if (bestMatch && bestScore >= 40) {
      // Link it — check for existing first
      const [existing] = await db
        .select({ id: dealLinearLinks.id })
        .from(dealLinearLinks)
        .where(and(
          eq(dealLinearLinks.dealId, dealId),
          eq(dealLinearLinks.linearIssueId, bestMatch.linearIssueId),
        ))
        .limit(1)

      if (!existing) {
        await db.insert(dealLinearLinks).values({
          workspaceId,
          dealId,
          linearIssueId: bestMatch.linearIssueId,
          linearIssueUrl: bestMatch.linearIssueUrl,
          linearTitle: bestMatch.title,
          relevanceScore: bestScore,
          linkType: 'feature_gap',
          status: 'suggested',
          addressesRisk: gapText.slice(0, 200),
        }).onConflictDoNothing()
        linked++
        console.log(`[smart-match] ${deal.prospectCompany}: "${gapText}" → ${bestMatch.linearIssueId} (${bestMatch.title}) [score=${bestScore}]`)
      }
    } else if (linearApiKey && integration) {
      // No match — create the issue on Linear
      try {
        const newIssue = await createIssue(linearApiKey, integration.teamId, {
          title: gapText.slice(0, 120),
          description: `**Product gap from ${deal.prospectCompany} deal**\n\n${gap.quote ? `> "${gap.quote}"\n\n` : ''}Severity: ${gap.severity ?? 'medium'}\n\n---\n*Auto-created by Halvex from deal meeting notes*`,
          priority: gap.severity === 'high' ? 2 : 3,
        })

        // Cache the new issue
        await db.insert(linearIssuesCache).values({
          workspaceId,
          linearIssueId: newIssue.identifier,
          linearIssueUrl: newIssue.url,
          title: newIssue.title,
          description: newIssue.description,
          status: newIssue.state.name,
          priority: newIssue.priority,
        }).onConflictDoNothing()

        // Link to deal
        await db.insert(dealLinearLinks).values({
          workspaceId,
          dealId,
          linearIssueId: newIssue.identifier,
          linearIssueUrl: newIssue.url,
          linearTitle: newIssue.title,
          relevanceScore: 100,
          linkType: 'feature_gap',
          status: 'suggested',
          addressesRisk: gapText.slice(0, 200),
        }).onConflictDoNothing()

        created++
        console.log(`[smart-match] ${deal.prospectCompany}: created ${newIssue.identifier} — "${gapText}"`)
      } catch (e) {
        console.warn(`[smart-match] Failed to create issue for "${gapText}":`, e)
      }
    } else {
      console.log(`[smart-match] ${deal.prospectCompany}: no match for "${gapText}" and no Linear API key to create`)
    }
  }

  return { linked, created, dealName: deal.dealName }
}

// ─── Batch match all open deals ──────────────────────────────────────────────

export async function smartMatchAllDeals(workspaceId: string): Promise<{
  totalLinked: number
  totalCreated: number
  results: MatchResult[]
}> {
  // Wipe all auto-generated links so rematch starts fresh.
  // Keep only manual links (user explicitly created these).
  // This means resync always fixes previous mistakes.
  await db.delete(dealLinearLinks).where(and(
    eq(dealLinearLinks.workspaceId, workspaceId),
    sql`${dealLinearLinks.linkType} != 'manual'`,
  ))

  const openDeals = await db
    .select({ id: dealLogs.id })
    .from(dealLogs)
    .where(and(
      eq(dealLogs.workspaceId, workspaceId),
      sql`${dealLogs.stage} NOT IN ('closed_won', 'closed_lost')`,
    ))

  let totalLinked = 0
  let totalCreated = 0
  const results: MatchResult[] = []

  // Process sequentially — each deal is fast (no API calls for matching)
  for (const deal of openDeals) {
    const result = await smartMatchDeal(workspaceId, deal.id)
    totalLinked += result.linked
    totalCreated += result.created
    results.push(result)
  }

  console.log(`[smart-match] Complete: ${totalLinked} linked, ${totalCreated} created across ${openDeals.length} deals`)
  return { totalLinked, totalCreated, results }
}
