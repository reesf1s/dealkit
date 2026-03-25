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
function linearStatusToLoopStatus(linearStatus: string | null): string {
  if (!linearStatus) return 'identified'
  const s = linearStatus.toLowerCase()
  if (s === 'done' || s === 'completed' || s === 'cancelled' || s === 'canceled') return 'shipped'
  if (s === 'in progress') return 'in_progress'
  if (s === 'in review') return 'in_review'
  if (['in qa', 'rfqa', 'started'].includes(s)) return 'in_cycle'
  return 'identified'
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductGap {
  gap: string
  description?: string
  quote?: string
  severity?: string
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
    'sitting': 'sit', 'seated': 'sit', 'sat': 'sit',
    'preferences': 'prefer', 'preferred': 'prefer',
    'predictability': 'predict', 'predictable': 'predict',
    'attendance': 'attend', 'attending': 'attend',
    'consistency': 'consist', 'consistent': 'consist',
    'occupancy': 'occupy', 'occupied': 'occupy',
    'allocation': 'allocat', 'allocated': 'allocat',
    'utilisation': 'util', 'utilization': 'util',
    'neighbourhood': 'neighbor', 'neighborhood': 'neighbor',
    'colocation': 'colocat', 'co-location': 'colocat',
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
  [/sit next to/gi, 'colocat proximity'],
  [/next to each other/gi, 'colocat proximity'],
  [/same desk area/gi, 'desk consist'],
  [/break\s*down\s*by/gi, 'segment breakdown'],
  [/how often/gi, 'frequency'],
  [/come in to/gi, 'attend'],
  [/work from home/gi, 'remote wfh'],
  [/in the office/gi, 'attend onsit'],
  [/real[\s-]?time/gi, 'realtim live'],
  [/single sign[\s-]?on/gi, 'sso auth'],
  [/two[\s-]?factor/gi, 'mfa auth'],
  [/day of the week/gi, 'weekday'],
  [/per\s*cent\w*/gi, 'percentag'],
  [/broken down/gi, 'segment breakdown'],
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

// ─── Synonym dictionary (50+ groups) ─────────────────────────────────────────

const SYNONYM_GROUPS: string[][] = [
  // Workplace & space
  ['team', 'group', 'department', 'org'],
  ['desk', 'seat', 'workstat', 'station'],
  ['area', 'zone', 'section', 'region', 'neighbor'],
  ['sit', 'seat', 'locat', 'colocat', 'proxim'],
  ['space', 'room', 'offic', 'floor', 'build'],
  ['employ', 'people', 'person', 'staff', 'user', 'worker'],
  ['occupy', 'occupanc', 'util', 'usag', 'capac'],
  ['allocat', 'assign', 'distribut'],
  // Behaviour & analytics
  ['predict', 'pattern', 'consist', 'trend'],
  ['attend', 'presenc', 'visit', 'frequenc'],
  ['analys', 'analyz', 'analyt', 'insight', 'report'],
  ['compare', 'comparison', 'versus', 'benchmark', 'correlat'],
  ['segment', 'breakdown', 'categor', 'group'],
  // Tech & integrations
  ['integrat', 'connect', 'sync', 'synchron'],
  ['book', 'reserv', 'schedul'],
  ['dashboard', 'panel', 'view', 'screen', 'display', 'overview'],
  ['forecast', 'project', 'estimat'],
  ['sensor', 'iot', 'devic', 'hardwar'],
  ['api', 'endpoint', 'webhook', 'rest'],
  ['sso', 'authent', 'auth', 'login', 'saml', 'oauth'],
  ['secur', 'complianc', 'soc', 'gdpr', 'privac', 'encrypt'],
  ['import', 'export', 'upload', 'download', 'ingest'],
  ['fix', 'bug', 'error', 'broken', 'repair'],
  ['creat', 'add', 'build', 'implement'],
  ['automat', 'workflow', 'trigger', 'rule'],
  ['notif', 'alert', 'email', 'remind'],
  ['permiss', 'role', 'access', 'rbac'],
  ['custom', 'config', 'configur', 'setting', 'prefer'],
  ['mobil', 'app', 'ios', 'android', 'phone'],
  ['map', 'floorplan', 'layout', 'visual'],
  ['survey', 'feedback', 'nps', 'satisfact', 'rat'],
  ['cost', 'pric', 'spend', 'budget', 'expens', 'roi'],
  ['migrat', 'transfer', 'transit'],
  ['test', 'trial', 'pilot', 'poc', 'evaluat'],
  ['scal', 'growth', 'enterpris', 'perform'],
  ['data', 'dataset', 'record', 'entri', 'tabl'],
  ['filter', 'search', 'query', 'find', 'sort'],
  ['plan', 'scenario', 'model', 'simulat'],
  ['hybrid', 'flexibl', 'flex', 'remote', 'wfh', 'onsit'],
  ['badg', 'swip', 'checkin', 'entry'],
  ['wayfind', 'navigat', 'direct', 'locat'],
  ['amen', 'facil', 'servic'],
  ['visitor', 'guest', 'contractor', 'extern', 'recept'],
  ['calendar', 'outlook', 'gcal', 'ical', 'event', 'meet'],
  ['slack', 'chat', 'messag', 'communicat'],
  ['week', 'weekday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  ['heatmap', 'heat', 'thermal', 'densit'],
  ['realtim', 'live', 'stream', 'instant'],
  ['percentag', 'ratio', 'proport', 'rate'],
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
function scoreMatch(gapText: string, issueTitle: string, issueDesc: string | null): number {
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

  // If no extracted gaps, use Haiku to extract them from raw meeting notes
  // This costs ~$0.001 per deal and only runs once (result is stored)
  if (productGaps.length === 0) {
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
        if (combined > bestScore && combined >= 20) {
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

    if (bestMatch && bestScore >= 20) {
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
        // Set status based on actual Linear issue state
        const loopStatus = linearStatusToLoopStatus(bestMatch.status)
        await db.insert(dealLinearLinks).values({
          workspaceId,
          dealId,
          linearIssueId: bestMatch.linearIssueId,
          linearIssueUrl: bestMatch.linearIssueUrl,
          linearTitle: bestMatch.title,
          relevanceScore: bestScore,
          linkType: 'feature_gap',
          status: loopStatus,
          addressesRisk: gapText.slice(0, 200),
        }).onConflictDoNothing()
        linked++
        console.log(`[smart-match] ${deal.prospectCompany}: "${gapText}" → ${bestMatch.linearIssueId} (${bestMatch.title}) [score=${bestScore}, linearStatus=${bestMatch.status}, loopStatus=${loopStatus}]`)
      }
    } else if (linearApiKey && integration) {
      // No match — create the issue on Linear if it looks like a real product feature
      const isRealFeature = gapText.length >= 15 && gapText.length <= 150
        && !/^(page \d|what success|the poc|gospace lead|drew proposed|\[?\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i.test(gapText)
        && !gapText.includes('...')
        && !/^(need the ability|need to|we need|they need|please let me)/i.test(gapText)

      if (isRealFeature) {
        try {
          const newIssue = await createIssue(linearApiKey, integration.teamId, {
            title: gapText.slice(0, 120),
            description: `**Product gap from ${deal.prospectCompany} deal**\n\n${gap.quote ? `> "${gap.quote}"\n\n` : ''}Severity: ${gap.severity ?? 'medium'}\n\n---\n*Auto-created by Halvex — matched to deal blocker*`,
            priority: gap.severity === 'high' ? 2 : 3,
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
          addressesRisk: gapText.slice(0, 200),
        }).onConflictDoNothing()

        created++
        console.log(`[smart-match] ${deal.prospectCompany}: created ${newIssue.identifier} — "${gapText}"`)
      } catch (e) {
        console.warn(`[smart-match] Failed to create issue for "${gapText}":`, e)
      }
      } else {
        console.log(`[smart-match] ${deal.prospectCompany}: no match for "${gapText.slice(0, 50)}" — skipped (not a clear feature)`)
      }
    } else {
      console.log(`[smart-match] ${deal.prospectCompany}: no match for "${gapText.slice(0, 50)}" — no Linear API key`)
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
  // Wipe only unconfirmed auto-generated links.
  // Preserve: manual links, and auto-links that have progressed (in_progress, in_review, in_cycle, shipped).
  await db.delete(dealLinearLinks).where(and(
    eq(dealLinearLinks.workspaceId, workspaceId),
    sql`${dealLinearLinks.linkType} != 'manual'`,
    sql`${dealLinearLinks.status} IN ('suggested', 'identified')`,
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

  // Sync ALL link statuses from Linear cache (catches any status changes since link creation)
  try {
    await db.execute(sql`
      UPDATE deal_linear_links dll
      SET status = CASE
        WHEN lic.status IN ('Done', 'Completed') THEN 'shipped'
        WHEN lic.status = 'In Progress' THEN 'in_progress'
        WHEN lic.status = 'In Review' THEN 'in_review'
        WHEN lic.status IN ('In QA', 'RFQA') THEN 'in_cycle'
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

  console.log(`[smart-match] Complete: ${totalLinked} linked, ${totalCreated} created across ${openDeals.length} deals`)
  return { totalLinked, totalCreated, results }
}
