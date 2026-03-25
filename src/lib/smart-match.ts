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

// ─── Native smart scoring (no LLM, no API) ──────────────────────────────────

/** Domain-specific synonym groups — native IP, no API needed */
const SYNONYM_GROUPS: string[][] = [
  ['team', 'teams', 'group', 'groups', 'department', 'org'],
  ['desk', 'seat', 'workstation', 'workspace', 'station'],
  ['area', 'zone', 'section', 'region', 'floor', 'neighbourhood', 'neighborhood'],
  ['sit', 'sitting', 'seated', 'location', 'co-location', 'colocation', 'colocate'],
  ['next', 'near', 'nearby', 'adjacent', 'proximity', 'close'],
  ['predict', 'predictability', 'predictable', 'pattern', 'patterns', 'consistency', 'consistent'],
  ['attend', 'attendance', 'presence', 'visit', 'visiting', 'frequency'],
  ['analyse', 'analyze', 'analysis', 'analytics', 'insight', 'insights', 'report'],
  ['integrate', 'integration', 'connect', 'connection', 'sync', 'synchronize'],
  ['book', 'booking', 'reserve', 'reservation', 'schedule', 'scheduling'],
  ['occupy', 'occupancy', 'utilisation', 'utilization', 'usage', 'capacity'],
  ['allocate', 'allocation', 'assign', 'assignment', 'distribute', 'distribution'],
  ['space', 'spaces', 'room', 'rooms', 'office', 'floor', 'building'],
  ['employee', 'employees', 'people', 'person', 'staff', 'user', 'users', 'worker'],
  ['dashboard', 'panel', 'view', 'screen', 'display', 'overview'],
  ['forecast', 'forecasting', 'predict', 'prediction', 'projection', 'estimate'],
  ['sensor', 'sensors', 'iot', 'device', 'devices', 'hardware'],
  ['api', 'endpoint', 'interface', 'webhook', 'rest'],
  ['sso', 'authentication', 'auth', 'login', 'saml', 'oauth'],
  ['security', 'compliance', 'soc', 'gdpr', 'privacy', 'encryption'],
  ['import', 'export', 'upload', 'download', 'ingest', 'ingestion'],
  ['fix', 'bug', 'issue', 'error', 'broken', 'repair'],
  ['create', 'add', 'new', 'build', 'implement'],
]

/** Build a lookup: word → canonical group index */
const synonymLookup = new Map<string, number>()
SYNONYM_GROUPS.forEach((group, idx) => {
  for (const word of group) synonymLookup.set(word, idx)
})

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
}

/** Generate bigrams from tokens */
function bigrams(tokens: string[]): string[] {
  const result: string[] = []
  for (let i = 0; i < tokens.length - 1; i++) {
    result.push(`${tokens[i]} ${tokens[i + 1]}`)
  }
  return result
}

/** Generate character trigrams for fuzzy matching */
function charTrigrams(text: string): Set<string> {
  const s = new Set<string>()
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (let i = 0; i <= clean.length - 3; i++) {
    s.add(clean.slice(i, i + 3))
  }
  return s
}

/**
 * Multi-signal scoring: combines keyword, synonym, bigram, and fuzzy matching.
 * Returns 0-100. Pure native algorithms — zero API calls.
 *
 * This is Halvex's core matching IP.
 */
function scoreMatch(gapText: string, issueTitle: string, issueDesc: string | null): number {
  const gapTokens = tokenize(gapText)
  const titleTokens = tokenize(issueTitle)
  const descTokens = tokenize(issueDesc ?? '')
  const allIssueTokens = [...titleTokens, ...descTokens]

  if (gapTokens.length === 0 || allIssueTokens.length === 0) return 0

  const gapSet = new Set(gapTokens)
  const titleSet = new Set(titleTokens)
  const allSet = new Set(allIssueTokens)

  // ── Signal 1: Exact keyword overlap (weighted) ────────────────────────
  let titleHits = 0
  let descHits = 0
  for (const token of gapSet) {
    if (titleSet.has(token)) titleHits++
    else if (allSet.has(token)) descHits++
  }
  // Title matches are worth 2x
  const keywordScore = gapSet.size > 0
    ? ((titleHits * 2 + descHits) / (gapSet.size * 2)) * 100
    : 0

  // ── Signal 2: Synonym expansion ───────────────────────────────────────
  let synonymHits = 0
  for (const gapToken of gapSet) {
    if (titleSet.has(gapToken) || allSet.has(gapToken)) continue // already counted
    const gapGroup = synonymLookup.get(gapToken)
    if (gapGroup === undefined) continue
    for (const issueToken of allSet) {
      if (synonymLookup.get(issueToken) === gapGroup) {
        synonymHits++
        break
      }
    }
  }
  const synonymScore = gapSet.size > 0 ? (synonymHits / gapSet.size) * 80 : 0

  // ── Signal 3: Bigram overlap (phrase matching) ────────────────────────
  const gapBigrams = new Set(bigrams(gapTokens))
  const issueBigrams = new Set(bigrams(allIssueTokens))
  let bigramHits = 0
  for (const bg of gapBigrams) {
    if (issueBigrams.has(bg)) bigramHits++
  }
  const bigramScore = gapBigrams.size > 0 ? (bigramHits / gapBigrams.size) * 100 : 0

  // ── Signal 4: Character trigram similarity (fuzzy) ────────────────────
  const gapTrigrams = charTrigrams(gapText)
  const issueTrigrams = charTrigrams(`${issueTitle} ${issueDesc ?? ''}`)
  let trigramOverlap = 0
  for (const tg of gapTrigrams) {
    if (issueTrigrams.has(tg)) trigramOverlap++
  }
  const trigramScore = gapTrigrams.size > 0
    ? (trigramOverlap / Math.max(gapTrigrams.size, issueTrigrams.size)) * 100
    : 0

  // ── Weighted combination ──────────────────────────────────────────────
  // Keyword is most important, synonym gives credit for conceptual overlap,
  // bigram catches phrases, trigram catches fuzzy/partial matches
  const combined = (
    keywordScore * 0.40 +
    synonymScore * 0.25 +
    bigramScore * 0.20 +
    trigramScore * 0.15
  )

  return Math.round(combined)
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

      // Multi-signal scoring (keyword + synonym + bigram + fuzzy)
      const score = scoreMatch(gapText, issue.title, issue.description)
      if (score > bestScore && score >= 25) {
        bestScore = score
        bestMatch = issue
      }
    }

    if (bestMatch && bestScore >= 25) {
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
