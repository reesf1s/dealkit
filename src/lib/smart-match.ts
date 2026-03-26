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
import { dealLogs, dealLinearLinks, linearIssuesCache, linearIntegrations, productGaps as productGapsTable } from '@/lib/db/schema'
import { createIssue } from '@/lib/linear-client'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'
import { generateEmbedding } from '@/lib/openai-embeddings'

const MAX_LINKS_PER_DEAL = 5

// ─── Cosine similarity for vector matching ──────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * Map a Linear issue status to our loop status.
 * Linear states: Triage, Backlog, Todo, In Progress, In Review, In QA, RFQA, Done, Cancelled
 * Our states: identified, in_cycle, shipped
 */
export function linearStatusToLoopStatus(linearStatus: string | null): string {
  if (!linearStatus) return 'identified'
  const s = linearStatus.toLowerCase()
  if (s === 'done' || s === 'completed') return 'shipped'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  if (s === 'in progress' || s === 'in qa' || s === 'rfqa' || s === 'started') return 'in_progress'
  if (s === 'in review') return 'in_review'
  // Todo, Backlog, Triage = identified (not yet being worked on)
  return 'identified'
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductGap {
  gap: string
  description?: string
  quote?: string
  severity?: string
  context?: 'deal_blocker' | 'nice_to_have' | 'on_roadmap' | 'competitor_advantage' | 'mentioned'
  source?: 'signals' | 'criteria' | 'product_gaps_table' | 'haiku'
}

// Map gap context to Linear priority number
const CONTEXT_PRIORITY: Record<string, number> = {
  deal_blocker: 1,         // Urgent
  competitor_advantage: 2, // High
  nice_to_have: 3,         // Medium
  mentioned: 4,            // Low
  // on_roadmap → gaps are skipped before reaching creation
}

interface MatchResult {
  linked: number
  created: number
  dealName: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// HALVEX MATCHING ENGINE V2 — Core IP
// Native NLP: stemming, stop words, concept phrases, synonym expansion
// Zero LLM/API calls. All deterministic string algorithms.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Stop words — removed before scoring to reduce noise ─────────────────────

const STOP_WORDS = new Set([
  // Question words
  'what', 'how', 'does', 'which', 'where', 'when', 'who', 'why', 'whom',
  // Articles & determiners
  'the', 'this', 'that', 'these', 'those', 'each', 'every', 'other', 'another',
  // Pronouns
  'you', 'your', 'yours', 'our', 'ours', 'they', 'their', 'them', 'its',
  // Common verbs (low signal)
  'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having',
  'do', 'did', 'done', 'will', 'would', 'could', 'should', 'can', 'may', 'might',
  'shall', 'must', 'need', 'want', 'like', 'get', 'got', 'let', 'make', 'made',
  // Prepositions
  'for', 'with', 'from', 'into', 'through', 'during', 'between', 'across',
  'about', 'above', 'below', 'after', 'before', 'around', 'against', 'along',
  // Conjunctions
  'and', 'but', 'not', 'also', 'then', 'than', 'both', 'either', 'neither',
  // Filler
  'very', 'just', 'much', 'many', 'some', 'any', 'all', 'more', 'most',
  'only', 'still', 'already', 'even', 'well', 'really', 'quite', 'too',
  // Domain low-signal
  'able', 'example', 'using', 'used', 'currently', 'specific', 'based',
])

// ─── Native stemmer — lightweight suffix stripping ───────────────────────────

function stem(word: string): string {
  if (word.length < 4) return word
  let w = word

  // Irregular forms
  const irregulars: Record<string, string> = {
    'preferences': 'prefer', 'preferred': 'prefer',
    'predictability': 'predict', 'predictable': 'predict',
    'consistency': 'consist', 'consistent': 'consist',
    'utilisation': 'util', 'utilization': 'util',
    'allocation': 'allocat', 'allocated': 'allocat',
    'authentication': 'authent', 'authenticating': 'authent',
    'customization': 'custom', 'customizable': 'custom', 'customisation': 'custom',
    'synchronization': 'synchron', 'synchronisation': 'synchron',
    'notification': 'notif', 'notifications': 'notif',
  }
  if (irregulars[w]) return irregulars[w]

  // Suffix rules (longest first)
  if (w.endsWith('ability') || w.endsWith('ibility')) w = w.slice(0, -5) // "predict+abil" -> "predict"
  else if (w.endsWith('ation') || w.endsWith('ition')) w = w.slice(0, -4) // "alloc+ation" -> "alloc"
  else if (w.endsWith('tion') || w.endsWith('sion')) w = w.slice(0, -3)
  else if (w.endsWith('ance') || w.endsWith('ence')) w = w.slice(0, -3) // "attend+ance" -> "attend"
  else if (w.endsWith('ment') || w.endsWith('ness')) w = w.slice(0, -4)
  else if (w.endsWith('able') || w.endsWith('ible')) w = w.slice(0, -4)
  else if (w.endsWith('ive') || w.endsWith('ous') || w.endsWith('ful')) w = w.slice(0, -3)
  else if (w.endsWith('less')) w = w.slice(0, -4)
  else if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3)
  else if (w.endsWith('ize') || w.endsWith('ise')) w = w.slice(0, -3)
  else if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y'
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2)
  else if (w.endsWith('er') && w.length > 4) w = w.slice(0, -2)
  else if (w.endsWith('ly') && w.length > 4) w = w.slice(0, -2)
  else if (w.endsWith('es') && w.length > 4) w = w.slice(0, -2)
  else if (w.endsWith('s') && w.length > 3 && !w.endsWith('ss')) w = w.slice(0, -1)

  return w.length >= 3 ? w : word // don't over-stem
}

// ─── Concept phrase preprocessing ────────────────────────────────────────────

const CONCEPT_PHRASES: [RegExp, string][] = [
  // Auth
  [/single sign[\s-]?on/gi, 'sso authent'],
  [/two[\s-]?factor/gi, 'mfa authent'],
  [/multi[\s-]?factor/gi, 'mfa authent'],
  [/role[\s-]?based/gi, 'rbac permiss'],
  // Data operations (kept separate: export ≠ import)
  [/(?:bulk|data|csv)\s*export/gi, 'export csv'],
  [/export\s*(?:to\s*)?(?:csv|excel|spreadsheet)/gi, 'export csv'],
  [/(?:bulk|data|csv)\s*import/gi, 'import ingest'],
  // Real-time & streaming
  [/real[\s-]?time/gi, 'realtim live'],
  // Analytics breakdown
  [/break\s*down\s*by/gi, 'segment breakdown'],
  [/broken down/gi, 'segment breakdown'],
  // Misc SaaS
  [/audit\s*log/gi, 'audit secur'],
  [/open\s*api/gi, 'api endpoint'],
  [/white[\s-]?label/gi, 'custom brand'],
  [/custom\s*field/gi, 'custom configur'],
  [/per\s*cent\w*/gi, 'percent rate'],
]

function applyConceptPhrases(text: string): string {
  let result = text
  for (const [pattern, replacement] of CONCEPT_PHRASES) {
    result = result.replace(pattern, replacement)
  }
  return result
}

// ─── Tokenizer with stemming + stop words ────────────────────────────────────

function tokenize(text: string): string[] {
  // 1. Apply concept phrases
  let processed = applyConceptPhrases(text)
  // 2. Lowercase
  processed = processed.toLowerCase()
  // 3. Expand hyphenated words: "co-location" → "co location colocation"
  processed = processed.replace(/(\w+)-(\w+)/g, (_, a, b) => `${a} ${b} ${a}${b}`)
  // 4. Strip remaining punctuation
  processed = processed.replace(/[^a-z0-9\s]/g, ' ')
  // 5. Split, filter stop words, stem
  return processed
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .map(stem)
    .filter(w => w.length >= 3)
}

// ─── Synonym dictionary — domain-agnostic SaaS product gaps ──────────────────
// IMPORTANT: import and export are in SEPARATE groups — they are opposite operations.

const SYNONYM_GROUPS: string[][] = [
  // Auth & SSO
  ['sso', 'saml', 'oauth', 'oidc', 'okta', 'authent', 'auth', 'login', 'singl'],
  // MFA / two-factor
  ['mfa', '2fa', 'totp', 'multifactor', 'twofactor'],
  // Permissions & RBAC
  ['permiss', 'role', 'rbac', 'access', 'entitl', 'privileg'],
  // Integrations & connectors (NOT import/export)
  ['integrat', 'connect', 'plugin', 'addon', 'extens', 'embed'],
  // Sync
  ['sync', 'synchron', 'replic', 'mirror'],
  // API & webhooks
  ['api', 'rest', 'graphql', 'endpoint', 'webhook', 'sdk'],
  // Data EXPORT — do NOT combine with import
  ['export', 'download', 'csv', 'spreadsheet', 'extract', 'output'],
  // Data IMPORT — do NOT combine with export
  ['import', 'upload', 'ingest', 'input', 'load'],
  // Reporting & analytics
  ['report', 'analyt', 'analys', 'insight', 'metric', 'statist'],
  // Dashboards & views
  ['dashboard', 'panel', 'view', 'overview', 'summar', 'screen', 'display'],
  // Charts & visualization
  ['chart', 'graph', 'visual', 'plot'],
  // Segmentation & filtering
  ['segment', 'breakdown', 'categor', 'filter', 'group', 'slice'],
  // Search & discovery
  ['search', 'find', 'lookup', 'discov', 'queri'],
  // Forecasting & trends
  ['forecast', 'predict', 'trend', 'estimat', 'project'],
  // Notifications & alerts
  ['notif', 'alert', 'remind', 'warn', 'digest'],
  // Messaging & communication channels
  ['email', 'slack', 'messag', 'communicat', 'sms', 'chat'],
  // Billing & subscriptions
  ['bill', 'invoic', 'payment', 'subscript', 'pric', 'charg'],
  // Plans & quotas
  ['plan', 'tier', 'quota', 'limit', 'entitl'],
  // User & member management
  ['user', 'employ', 'member', 'person', 'staff'],
  // Teams & orgs
  ['team', 'group', 'department', 'org'],
  // Workspace & tenant
  ['workspace', 'tenant', 'account', 'compan'],
  // Workflows & automations
  ['automat', 'workflow', 'rule', 'trigger', 'action'],
  // Approvals & review
  ['approv', 'review', 'approv', 'sign'],
  // Sort & ordering
  ['sort', 'rank', 'order'],
  // Security & compliance
  ['secur', 'complianc', 'gdpr', 'hipaa', 'privac', 'encrypt', 'audit', 'soc'],
  // Mobile & native apps
  ['mobil', 'ios', 'android', 'nativ', 'app'],
  // Performance & scalability
  ['scal', 'perform', 'speed', 'latenc', 'fast'],
  // Data & records
  ['data', 'record', 'entri', 'dataset', 'tabl'],
  // Configuration & settings
  ['custom', 'configur', 'config', 'setting', 'prefer'],
  // Bugs & fixes
  ['fix', 'bug', 'error', 'broken', 'repair', 'issu'],
  // Building & implementing features
  ['creat', 'add', 'build', 'implement', 'develop'],
  // Calendar & scheduling
  ['calendar', 'schedul', 'event', 'appoint', 'meet'],
  // CRM & pipeline
  ['crm', 'pipeline', 'opportunit', 'lead', 'deal'],
  // Contacts & prospects
  ['contact', 'prospect', 'customer', 'client'],
  // Real-time & streaming
  ['realtim', 'live', 'stream', 'instant'],
  // Comparison & benchmarking
  ['compare', 'comparison', 'versus', 'benchmark', 'correlat'],
  // Migration & transfer
  ['migrat', 'transfer', 'transit'],
  // Survey & feedback
  ['survey', 'feedback', 'nps', 'satisfact'],
  // Cost & ROI
  ['cost', 'pric', 'spend', 'budget', 'expens', 'roi'],
]

/** Build a lookup: stemmed word → group index */
const synonymLookup = new Map<string, number>()
SYNONYM_GROUPS.forEach((group, idx) => {
  for (const word of group) synonymLookup.set(word, idx)
})

// ─── Bigrams & trigrams ──────────────────────────────────────────────────────

function bigrams(tokens: string[]): string[] {
  const result: string[] = []
  for (let i = 0; i < tokens.length - 1; i++) {
    result.push(`${tokens[i]} ${tokens[i + 1]}`)
  }
  return result
}

function charTrigrams(text: string): Set<string> {
  const s = new Set<string>()
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (let i = 0; i <= clean.length - 3; i++) {
    s.add(clean.slice(i, i + 3))
  }
  return s
}

// ─── Core scoring function ───────────────────────────────────────────────────

/**
 * Halvex Match Score V2 — 4-signal native NLP scoring.
 *
 * Signals:
 * 1. Keyword overlap (45%) — stemmed tokens, title hits 2x
 * 2. Synonym expansion (35%) — 50+ domain synonym groups on stemmed tokens
 * 3. Bigram phrases (10%) — adjacent stemmed token pair matching
 * 4. Character trigrams (10%) — fuzzy partial string similarity
 *
 * Returns 0-100. Zero API calls. All native algorithms.
 */
export function scoreMatch(gapText: string, issueTitle: string, issueDesc: string | null): number {
  const gapTokens = tokenize(gapText)
  const titleTokens = tokenize(issueTitle)
  const descTokens = tokenize(issueDesc ?? '')
  const allIssueTokens = [...titleTokens, ...descTokens]

  if (gapTokens.length === 0 || allIssueTokens.length === 0) return 0

  const gapSet = new Set(gapTokens)
  const titleSet = new Set(titleTokens)
  const allSet = new Set(allIssueTokens)

  // ── Signal 1: Stemmed keyword overlap (45%) ───────────────────────────
  let titleHits = 0
  let descHits = 0
  for (const token of gapSet) {
    if (titleSet.has(token)) titleHits++
    else if (allSet.has(token)) descHits++
  }
  const keywordScore = gapSet.size > 0
    ? ((titleHits * 2 + descHits) / (gapSet.size * 2)) * 100
    : 0

  // ── Signal 2: Synonym expansion (35%) ─────────────────────────────────
  let synonymHits = 0
  for (const gapToken of gapSet) {
    if (titleSet.has(gapToken) || allSet.has(gapToken)) continue
    const gapGroup = synonymLookup.get(gapToken)
    if (gapGroup === undefined) continue
    for (const issueToken of allSet) {
      if (synonymLookup.get(issueToken) === gapGroup) {
        synonymHits++
        break
      }
    }
  }
  const synonymScore = gapSet.size > 0 ? (synonymHits / gapSet.size) * 100 : 0

  // ── Signal 3: Bigram phrases (10%) ────────────────────────────────────
  const gapBigrams = new Set(bigrams(gapTokens))
  const issueBigrams = new Set(bigrams(allIssueTokens))
  let bigramHits = 0
  for (const bg of gapBigrams) {
    if (issueBigrams.has(bg)) bigramHits++
  }
  const bigramScore = gapBigrams.size > 0 ? (bigramHits / gapBigrams.size) * 100 : 0

  // ── Signal 4: Character trigrams (10%) ────────────────────────────────
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
  const combined = (
    keywordScore * 0.45 +
    synonymScore * 0.35 +
    bigramScore * 0.10 +
    trigramScore * 0.10
  )

  // Minimum absolute match guard: require ≥2 meaningful token hits
  const totalHits = titleHits + descHits + synonymHits
  if (totalHits < 2 && combined < 40) return 0

  return Math.round(combined)
}

// ─── isRealFeature guard ──────────────────────────────────────────────────────

/**
 * Returns true if the gap text looks like a genuine product feature request
 * (not a meeting note artifact, date string, or vague meta-request).
 */
export function checkIsRealFeature(gapText: string): boolean {
  return gapText.length >= 10 && gapText.length <= 150
    && !/^(page \d|what success|the poc|gospace lead|drew proposed|\[?\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i.test(gapText)
    && !gapText.includes('...')
    && !/^(need the ability|need to|we need|they need|please let me)/i.test(gapText)
}

// ─── Main matching function ──────────────────────────────────────────────────

/**
 * Match a single deal to Linear issues using its extracted product gaps.
 * Only links genuine product blockers — not sales/competitor issues.
 */
export async function smartMatchDeal(
  workspaceId: string,
  dealId: string,
  options: { skipHaiku?: boolean } = {},
): Promise<MatchResult> {
  // 1. Load deal with its extracted gaps
  const [deal] = await db
    .select({
      id: dealLogs.id,
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      dealValue: dealLogs.dealValue,
      stage: dealLogs.stage,
      meetingNotes: dealLogs.meetingNotes,
      description: dealLogs.description,
      notes: dealLogs.notes,
    })
    .from(dealLogs)
    .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
    .limit(1)

  if (!deal) return { linked: 0, created: 0, dealName: '' }

  // Prune stale system-generated 'suggested' links before re-matching
  // (matchAllOpenDeals does this globally; smartMatchDeal must do it per-deal)
  try {
    await db.execute(sql`
      DELETE FROM deal_linear_links
      WHERE deal_id = ${dealId}::uuid
        AND workspace_id = ${workspaceId}
        AND status = 'suggested'
        AND link_type = 'feature_gap'
    `)
  } catch { /* non-fatal */ }

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
      const gaps = (signals?.product_gaps ?? []).filter((g: ProductGap) => g.gap?.trim()).map((g: ProductGap) => ({ ...g, source: 'signals' as const }))
      productGaps.push(...gaps)
    }
  } catch { /* non-fatal */ }
  console.log(`[smart-match DEBUG] ${deal.prospectCompany}: Source A (note_signals_json): ${productGaps.filter(g => g.source === 'signals').length} gaps`)

  // Source B: success_criteria — only use SHORT lines that look like feature titles
  try {
    const [scRow] = await db.execute<{ success_criteria: string | null }>(
      sql`SELECT success_criteria FROM deal_logs WHERE id = ${dealId}::uuid LIMIT 1`
    )
    if (scRow?.success_criteria) {
      const lines = scRow.success_criteria
        .split(/[\n\r]+/)
        .map(l => l.replace(/^[\s*\-•\d.]+/, '').trim())
        .filter(l => {
          if (l.length < 15 || l.length > 100) return false // must be concise feature-length
          // Skip paragraphs that are criteria descriptions, not feature titles
          if (/^(if successful|success criteria|the poc|please let|we will|they want|ensure that)/i.test(l)) return false
          if (/recurring contract|commercial terms|procurement/i.test(l)) return false
          return true
        })
      for (const line of lines.slice(0, 3)) { // max 3 from success criteria
        const isDupe = productGaps.some(g => g.gap.toLowerCase().includes(line.toLowerCase().slice(0, 30)))
        if (!isDupe) {
          productGaps.push({ gap: line.slice(0, 100), severity: 'medium', source: 'criteria' })
        }
      }
    }
  } catch { /* non-fatal */ }
  console.log(`[smart-match DEBUG] ${deal.prospectCompany}: Source B (success_criteria): ${productGaps.filter(g => g.source === 'criteria').length} gaps`)

  // Source D: ALL open product gaps for this workspace (curated from analyze-notes)
  // Load workspace-wide, then filter to gaps relevant to this deal
  try {
    const pgRows = await db
      .select({ title: productGapsTable.title, description: productGapsTable.description, sourceDeals: productGapsTable.sourceDeals })
      .from(productGapsTable)
      .where(and(
        eq(productGapsTable.workspaceId, workspaceId),
        sql`${productGapsTable.status} NOT IN ('wont_fix', 'shipped')`,
      ))
    let added = 0
    for (const pg of pgRows) {
      if (!pg.title || pg.title.length < 10) continue
      // Include if: gap is from this deal, or gap has no source (general), or gap has sources (any deal)
      const sources = Array.isArray(pg.sourceDeals) ? pg.sourceDeals as string[] : []
      const isForThisDeal = sources.length === 0 || sources.includes(dealId)
      if (!isForThisDeal) continue

      const isDupe = productGaps.some(g => g.gap.toLowerCase().slice(0, 30) === pg.title!.toLowerCase().slice(0, 30))
      if (!isDupe) {
        productGaps.push({ gap: pg.title, description: pg.description ?? '', severity: 'high', source: 'product_gaps_table' })
        added++
      }
    }
    console.log(`[smart-match DEBUG] ${deal.prospectCompany}: Source D (product_gaps_table): ${added} gaps added (${pgRows.length} total workspace gaps, ${pgRows.length - added} skipped as dupe or not for this deal)`)
  } catch { /* non-fatal */ }

  // If no extracted gaps, use Haiku to extract them from raw meeting notes
  // This costs ~$0.001 per deal and only runs once (result is stored)
  // Skipped during batch rematch to avoid timeouts — only runs on single-deal matching
  if (productGaps.length === 0 && !options.skipHaiku) {
    const allText = [deal.meetingNotes, deal.notes, deal.description].filter(Boolean).join('\n\n')
    if (allText.length > 50) {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.error(`[smart-match] ${deal.prospectCompany}: ANTHROPIC_API_KEY not set — cannot extract gaps from ${allText.length} chars of notes`)
      } else {
      console.log(`[smart-match] ${deal.prospectCompany}: no pre-extracted gaps — running Haiku extraction on ${allText.length} chars of notes`)
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Extract product feature requests from these meeting notes that BLOCK the deal.

RULES:
- Each feature title MUST be a concise product feature (3-8 words), like a Linear issue title
- Good: "Team co-location analytics", "SSO integration", "Real-time sensor dashboard"
- Bad: "They want better reporting", "Need the ability to see teams"
- ONLY features that BLOCK the deal — not nice-to-haves, not pricing, not procurement
- If no blocking product features exist, return empty features array
- Max 5 features

Return ONLY valid JSON:
{"features":[{"title":"string","description":"string","priority":"blocker"|"nice-to-have"}]}

Notes (truncated):
${allText.slice(0, 4000)}`,
          }],
        })
        const raw = (msg.content[0] as { type: string; text: string }).text.trim()
        const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
        const parsed = JSON.parse(cleaned)
        const features = Array.isArray(parsed.features) ? parsed.features : []

        for (const f of features.slice(0, 5)) {
          const title = String(f.title ?? '').trim()
          if (title.length >= 10 && title.length <= 120) {
            productGaps.push({
              gap: title,
              description: String(f.description ?? ''),
              severity: f.priority === 'blocker' ? 'high' : 'medium',
            })
          }
        }

        // Store the extracted gaps so we don't need to re-extract
        if (productGaps.length > 0) {
          try {
            const existingSignals: Record<string, unknown> = {}
            const [row] = await db.execute<{ note_signals_json: string | null }>(
              sql`SELECT note_signals_json FROM deal_logs WHERE id = ${dealId}::uuid LIMIT 1`
            )
            if (row?.note_signals_json) {
              try {
                Object.assign(existingSignals, typeof row.note_signals_json === 'string'
                  ? JSON.parse(row.note_signals_json) : row.note_signals_json)
              } catch { /* start fresh */ }
            }
            existingSignals.product_gaps = productGaps.map(g => ({ gap: g.gap, description: g.description, severity: g.severity }))
            await db.execute(
              sql`UPDATE deal_logs SET note_signals_json = ${JSON.stringify(existingSignals)}::text WHERE id = ${dealId}::uuid`
            )
            console.log(`[smart-match] ${deal.prospectCompany}: stored ${productGaps.length} Haiku-extracted gaps`)
          } catch { /* non-fatal */ }
        }
      } catch (e) {
        console.error(`[smart-match] Haiku extraction FAILED for ${deal.prospectCompany} (${allText.length} chars):`, e instanceof Error ? e.message : e)
      }
      } // end ANTHROPIC_API_KEY check
    }
  }
  console.log(`[smart-match DEBUG] ${deal.prospectCompany}: Source C (haiku): ${productGaps.filter(g => g.source === 'haiku').length} gaps`)
  console.log(`[smart-match DEBUG] ${deal.prospectCompany}: Total gaps after dedup (A+B+C+D): ${productGaps.length}`)

  // Filter out on_roadmap gaps — already planned, no need to create Linear issues
  const onRoadmapGaps = productGaps.filter(g => g.context === 'on_roadmap')
  const onRoadmapCount = onRoadmapGaps.length
  if (onRoadmapCount > 0) {
    for (const og of onRoadmapGaps) {
      console.log(`[smart-match DEBUG] ${deal.prospectCompany}: FILTERED on_roadmap: "${og.gap.slice(0, 80)}"`)
    }
    console.log(`[smart-match] ${deal.prospectCompany}: skipping ${onRoadmapCount} on_roadmap gap(s)`)
    productGaps = productGaps.filter(g => g.context !== 'on_roadmap')
  }

  if (productGaps.length === 0) {
    console.log(`[smart-match] ${deal.prospectCompany}: no product gaps found — skipping`)
    return { linked: 0, created: 0, dealName: deal.dealName }
  }

  console.log(`[smart-match] ${deal.prospectCompany}: ${productGaps.length} gaps to match. First gap: "${(productGaps[0]?.gap ?? '').slice(0, 80)}"`)

  // 3. Load all Linear issues for this workspace (filter out garbage)
  const allIssues = await db
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

  // Filter out issues that look like meeting note fragments or garbage
  const issues = allIssues.filter(issue => {
    const t = issue.title
    if (t.length < 8) return false   // too short to be a real issue
    if (t.length > 200) return false  // likely a pasted paragraph, not a title
    // Skip issues that start with common meeting note patterns
    if (/^(page \d|what success|the poc|gospace lead|drew proposed|\[?\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i.test(t)) return false
    // Skip cancelled/duplicate
    if (issue.status === 'Canceled' || issue.status === 'Cancelled' || issue.status === 'Duplicate') return false
    return true
  })

  console.log(`[smart-match] ${deal.prospectCompany}: ${issues.length} issues in cache (${allIssues.length} total, ${allIssues.length - issues.length} filtered)`)

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

  // 5. Load issue embeddings for vector matching
  // CRITICAL: Read pgvector_embedding (1536-dim OpenAI), NOT embedding (336-dim TF-IDF).
  // Gap text is embedded with OpenAI (1536-dim). Dimensions must match for cosine similarity.
  type IssueWithEmbed = typeof issues[0] & { embedding: number[] | null }
  const issueEmbeddings: IssueWithEmbed[] = []
  try {
    const embRows = await db.execute<{ linear_issue_id: string; pgvec: string | null }>(
      sql`SELECT linear_issue_id, pgvector_embedding::text as pgvec FROM linear_issues_cache WHERE workspace_id = ${workspaceId} AND pgvector_embedding IS NOT NULL`
    )
    const embedMap = new Map<string, number[]>()
    for (const row of embRows) {
      if (row.pgvec) {
        try {
          // Postgres vector format: [0.1,0.2,...] — same as JSON array
          embedMap.set(row.linear_issue_id, JSON.parse(row.pgvec))
        } catch { /* skip malformed */ }
      }
    }
    for (const issue of issues) {
      issueEmbeddings.push({ ...issue, embedding: embedMap.get(issue.linearIssueId) ?? null })
    }
    const withEmbed = issueEmbeddings.filter(i => i.embedding !== null).length
    const sampleDim = issueEmbeddings.find(i => i.embedding)?.embedding?.length ?? 0
    console.log(`[smart-match] ${deal.prospectCompany}: loaded ${withEmbed}/${issues.length} OpenAI embeddings (${sampleDim}-dim)`)
  } catch (e) {
    console.warn('[smart-match] Failed to load pgvector embeddings, falling back to keyword-only:', e)
    for (const issue of issues) {
      issueEmbeddings.push({ ...issue, embedding: null })
    }
  }

  const hasAnyEmbeddings = issueEmbeddings.some(i => i.embedding !== null)

  // 6. Match each gap to Linear issues using vector + keyword hybrid
  let linked = 0
  let created = 0

  for (const gap of productGaps.slice(0, MAX_LINKS_PER_DEAL)) {
    const gapText = gap.gap

    // Strategy A: Direct title substring match (instant, no API)
    const titleLower = gapText.toLowerCase()
    let bestMatch: typeof issueEmbeddings[0] | null = null
    let bestScore = 0
    let matchMethod = ''

    for (const issue of issueEmbeddings) {
      const issueTitleLower = issue.title.toLowerCase()
      if (issueTitleLower.includes(titleLower) || titleLower.includes(issueTitleLower)) {
        bestMatch = issue
        bestScore = 95
        matchMethod = 'substring'
        break
      }
    }

    // Strategy B: Hybrid vector + keyword scoring
    if (!bestMatch || bestScore < 95) {
      // Embed the gap text (1 API call, ~$0.00001)
      let gapEmbedding: number[] | null = null
      if (hasAnyEmbeddings) {
        try {
          gapEmbedding = await generateEmbedding(gapText)
        } catch (e) {
          console.warn(`[smart-match] Failed to embed gap "${gapText.slice(0, 40)}":`, e)
        }
      }

      const topScores: { id: string; title: string; score: number; vecScore: number; nlpScore: number }[] = []

      for (const issue of issueEmbeddings) {
        // Vector similarity (primary signal: 60%)
        let vecScore = 0
        if (gapEmbedding && issue.embedding) {
          const sim = cosineSimilarity(gapEmbedding, issue.embedding)
          vecScore = Math.max(0, sim * 100) // 0-100 scale
        }

        // Native NLP score (secondary signal: 40%)
        const nlpScore = scoreMatch(gapText, issue.title, issue.description)

        // Hybrid: 60% vector, 40% NLP (or 100% NLP if no vectors)
        const combined = gapEmbedding && issue.embedding
          ? vecScore * 0.6 + nlpScore * 0.4
          : nlpScore

        topScores.push({ id: issue.linearIssueId, title: issue.title.slice(0, 40), score: combined, vecScore, nlpScore })
        // Threshold: 25 for NLP-only (workspace-specific gaps rarely get 40+ without vectors),
        // 40 for hybrid (vectors are more reliable so we can demand higher confidence)
        const threshold = (gapEmbedding && issue.embedding) ? 40 : 25
        if (combined > bestScore && combined >= threshold) {
          bestScore = combined
          bestMatch = issue
          matchMethod = gapEmbedding ? 'hybrid' : 'nlp'
        }
      }

      // Log top 3
      topScores.sort((a, b) => b.score - a.score)
      const top3 = topScores.slice(0, 3).map(s => `${s.id}(v${Math.round(s.vecScore)}+n${Math.round(s.nlpScore)}=${Math.round(s.score)})`).join(', ')
      console.log(`[smart-match] ${deal.prospectCompany} gap "${gapText.slice(0, 50)}" → best=${Math.round(bestScore)} [${matchMethod}], top3=[${top3}]`)
    }

    // ── Three-tier matching: high confidence → medium with conflict check → create ──

    // Product name conflict detection for medium-confidence matches
    let conflictDetected = false
    if (bestMatch && bestScore >= 40 && bestScore < 60) {
      const gapWords = gapText.toLowerCase().split(/\s+/)
      const issueWords = bestMatch.title.toLowerCase().split(/\s+/)
      for (const keyword of ['integration', 'connector', 'sync', 'plugin', 'api', 'dashboard', 'platform']) {
        const gapIdx = gapWords.indexOf(keyword)
        const issueIdx = issueWords.indexOf(keyword)
        if (gapIdx > 0 && issueIdx > 0) {
          const gapProduct = gapWords[gapIdx - 1]
          const issueProduct = issueWords[issueIdx - 1]
          if (gapProduct !== issueProduct && gapProduct.length > 3 && issueProduct.length > 3) {
            console.log(`[smart-match] Product conflict: "${gapProduct} ${keyword}" vs "${issueProduct} ${keyword}" — creating instead (score ${Math.round(bestScore)})`)
            conflictDetected = true
            break
          }
        }
      }
    }

    // For curated productGaps table entries: require ≥60 to link (otherwise create)
    // For signals/criteria/haiku sources: ≥25 is enough — NLP-only can reliably detect
    // keyword overlap at 25+, and false positives are better than zero links
    const linkThreshold = gap.source === 'product_gaps_table' ? 60 : 25

    let didLink = false
    if (bestMatch && bestScore >= linkThreshold && !conflictDetected) {
      const [existing] = await db
        .select({ id: dealLinearLinks.id })
        .from(dealLinearLinks)
        .where(and(
          eq(dealLinearLinks.dealId, dealId),
          eq(dealLinearLinks.linearIssueId, bestMatch.linearIssueId),
        ))
        .limit(1)

      if (!existing) {
        const loopStatus = linearStatusToLoopStatus(bestMatch.status)
        await db.insert(dealLinearLinks).values({
          workspaceId,
          dealId,
          linearIssueId: bestMatch.linearIssueId,
          linearIssueUrl: bestMatch.linearIssueUrl,
          linearTitle: bestMatch.title,
          relevanceScore: Math.round(bestScore),
          linkType: 'feature_gap',
          status: loopStatus,
          addressesRisk: (gap.description ? gap.description.slice(0, 150) : `Product gap identified in ${deal.prospectCompany} deal`),
        }).onConflictDoNothing()
        linked++
        didLink = true
        console.log(`[smart-match] LINKED: ${deal.prospectCompany}: "${gapText.slice(0,50)}" → ${bestMatch.linearIssueId} (${bestMatch.title.slice(0,40)}) [score=${Math.round(bestScore)}, status=${loopStatus}]`)
      } else {
        didLink = true // already linked, don't create duplicate
      }
    }

    // Tier 3: No confident match → CREATE new Linear issue
    if (!didLink) {
      console.log(`[smart-match DEBUG] ${deal.prospectCompany}: creation gate for "${gapText.slice(0, 60)}" — linearApiKey=${!!linearApiKey}, integration=${!!integration}, isRealFeature=${checkIsRealFeature(gapText)}`)
    }
    if (!didLink && linearApiKey && integration) {
      if (checkIsRealFeature(gapText)) {
        try {
          // Map context to Linear priority; fall back to severity-based priority
          const linearPriority = gap.context && CONTEXT_PRIORITY[gap.context] !== undefined
            ? CONTEXT_PRIORITY[gap.context]
            : (gap.severity === 'high' ? 2 : 3)

          // Build rich deal context block
          const dealContextLines = [
            `**Deal:** ${deal.dealName}`,
            `**Company:** ${deal.prospectCompany}`,
            deal.dealValue ? `**Deal value:** $${Number(deal.dealValue).toLocaleString()}` : null,
            deal.stage ? `**Stage:** ${deal.stage}` : null,
            `**Blocker:** ${gap.context === 'deal_blocker' ? 'Yes' : 'No'}`,
          ].filter(Boolean).join('\n')

          const issueDescription = `**Product gap from ${deal.prospectCompany} deal**\n\n` +
            (gap.description ? `${gap.description}\n\n` : '') +
            (gap.quote ? `> "${gap.quote}"\n\n` : '') +
            `**Deal context:**\n${dealContextLines}\n\n` +
            `---\n*Auto-created by DealKit — product gap from sales intelligence*`

          const newIssue = await createIssue(linearApiKey, integration.teamId, {
            title: gapText.slice(0, 120),
            description: issueDescription,
            priority: linearPriority,
          })
          await db.insert(linearIssuesCache).values({
            workspaceId,
            linearIssueId: newIssue.identifier,
            linearIssueUrl: newIssue.url,
            title: newIssue.title,
            description: newIssue.description,
            status: newIssue.state.name,
            priority: newIssue.priority,
          }).onConflictDoNothing()
          await db.insert(dealLinearLinks).values({
            workspaceId,
            dealId,
          linearIssueId: newIssue.identifier,
          linearIssueUrl: newIssue.url,
          linearTitle: newIssue.title,
          relevanceScore: 100,
          linkType: 'feature_gap',
          status: 'identified',
          addressesRisk: (gap.description ? gap.description.slice(0, 150) : `Product gap identified in ${deal.prospectCompany} deal`),
        }).onConflictDoNothing()

        created++
        console.log(`[smart-match] ${deal.prospectCompany}: created ${newIssue.identifier} — "${gapText}"`)
      } catch (e) {
        console.warn(`[smart-match] Failed to create issue for "${gapText}":`, e)
      }
      } else {
        const _len = gapText.length
        const _tooShort = _len < 10
        const _tooLong = _len > 150
        const _badPrefix = /^(page \d|what success|the poc|gospace lead|drew proposed|\[?\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i.test(gapText)
        const _hasDots = gapText.includes('...')
        const _needPrefix = /^(need the ability|need to|we need|they need|please let me)/i.test(gapText)
        console.log(`[smart-match DEBUG] ${deal.prospectCompany}: isRealFeature FAILED "${gapText.slice(0, 60)}" — len=${_len}(tooShort=${_tooShort},tooLong=${_tooLong}), badPrefix=${_badPrefix}, hasDots=${_hasDots}, needPrefix=${_needPrefix}`)
        console.log(`[smart-match] ${deal.prospectCompany}: no match for "${gapText.slice(0, 50)}" — skipped (not a clear feature)`)
      }
    } else if (!didLink) {
      console.log(`[smart-match] ${deal.prospectCompany}: gap "${gapText.slice(0, 50)}" — no match (best=${Math.round(bestScore)}) and ${linearApiKey ? 'creation guard blocked' : 'no Linear API key'}`)
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
  // NON-DESTRUCTIVE: match all deals first, THEN clean up orphaned auto-links.
  // This prevents data loss if the function times out halfway.

  // Load deals with meetingNotes + note_signals_json so we know which need extraction
  const openDealsRaw = await db.execute<{
    id: string
    meeting_notes: string | null
    note_signals_json: string | null
  }>(sql`
    SELECT id, meeting_notes, note_signals_json
    FROM deal_logs
    WHERE workspace_id = ${workspaceId}
      AND stage NOT IN ('closed_won', 'closed_lost')
  `)

  function hasProductGaps(signalsJson: string | null): boolean {
    if (!signalsJson) return false
    try {
      const s = typeof signalsJson === 'string' ? JSON.parse(signalsJson) : signalsJson
      return Array.isArray(s?.product_gaps) && s.product_gaps.length > 0
    } catch { return false }
  }

  // Partition: deals that need Haiku extraction vs those that already have gaps
  const needsExtraction = openDealsRaw.filter(
    d => !hasProductGaps(d.note_signals_json) && (d.meeting_notes?.length ?? 0) > 100
  )
  const extractionIds = new Set(needsExtraction.map(d => d.id))

  const phase2Count = openDealsRaw.length - needsExtraction.length
  console.log(`[smart-match] ${openDealsRaw.length} open deals found — ${needsExtraction.length} need Haiku extraction (phase 1), ${phase2Count} have existing gaps (phase 2)`)

  let totalLinked = 0
  let totalCreated = 0
  const results: MatchResult[] = []

  // Phase 1: Extract + match for deals without gaps (parallel batches of 5)
  for (let i = 0; i < needsExtraction.length; i += 5) {
    const batch = needsExtraction.slice(i, i + 5)
    const batchResults = await Promise.allSettled(
      batch.map(d => smartMatchDeal(workspaceId, d.id, { skipHaiku: false }))
    )
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        totalLinked += r.value.linked
        totalCreated += r.value.created
        results.push(r.value)
      } else {
        console.warn('[smart-match] Batch extraction deal failed:', r.reason instanceof Error ? r.reason.message : r.reason)
      }
    }
  }

  // Phase 2: Match-only for deals that already have gaps (skipHaiku: fast path)
  console.log(`[smart-match] Phase 2: processing ${phase2Count} deals with existing gaps`)
  for (const deal of openDealsRaw) {
    if (extractionIds.has(deal.id)) continue // already processed in phase 1
    try {
      const result = await smartMatchDeal(workspaceId, deal.id, { skipHaiku: true })
      totalLinked += result.linked
      totalCreated += result.created
      results.push(result)
    } catch (e) {
      console.warn(`[smart-match] Deal ${deal.id} failed:`, e instanceof Error ? e.message : e)
    }
  }

  // Sync ALL link statuses from Linear cache (catches any status changes since link creation)
  try {
    await db.execute(sql`
      UPDATE deal_linear_links dll
      SET status = CASE
        WHEN lic.status IN ('Done', 'Completed') THEN 'shipped'
        WHEN lic.status IN ('Cancelled', 'Canceled') THEN 'cancelled'
        WHEN lic.status = 'In Progress' THEN 'in_progress'
        WHEN lic.status = 'In Review' THEN 'in_review'
        WHEN lic.status IN ('In QA', 'RFQA', 'Started') THEN 'in_progress'
        ELSE dll.status
      END,
      updated_at = NOW()
      FROM linear_issues_cache lic
      WHERE lic.linear_issue_id = dll.linear_issue_id
        AND lic.workspace_id = dll.workspace_id
        AND dll.workspace_id = ${workspaceId}
    `)
    console.log(`[smart-match] Synced link statuses from Linear cache`)
  } catch (e) {
    console.warn('[smart-match] Status sync failed:', e)
  }

  console.log(`[smart-match] Complete: ${totalLinked} linked, ${totalCreated} created across ${openDealsRaw.length} deals`)
  return { totalLinked, totalCreated, results }
}

// ─── Lightweight status sync (safe for background/webhook/cron) ─────────────

/**
 * Sync deal_linear_links statuses from linear_issues_cache.
 * Does NOT wipe or re-match — only updates statuses on existing links.
 * Safe to call from sync, webhooks, cron jobs.
 */
export async function syncLoopStatuses(workspaceId: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE deal_linear_links dll
      SET status = CASE
        WHEN lic.status IN ('Done', 'Completed') THEN 'shipped'
        WHEN lic.status IN ('Cancelled', 'Canceled') THEN 'cancelled'
        WHEN lic.status = 'In Progress' THEN 'in_progress'
        WHEN lic.status = 'In Review' THEN 'in_review'
        WHEN lic.status IN ('In QA', 'RFQA', 'Started') THEN 'in_progress'
        ELSE dll.status
      END,
      updated_at = NOW()
      FROM linear_issues_cache lic
      WHERE lic.linear_issue_id = dll.linear_issue_id
        AND lic.workspace_id = dll.workspace_id
        AND dll.workspace_id = ${workspaceId}
    `)
    console.log(`[smart-match] syncLoopStatuses: updated for workspace ${workspaceId.slice(0, 8)}`)
  } catch (e) {
    console.warn('[smart-match] syncLoopStatuses failed:', e)
  }
}
