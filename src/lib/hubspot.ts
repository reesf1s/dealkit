/**
 * HubSpot CRM Integration — Private App token auth
 *
 * Uses HubSpot Private Apps (long-lived token, no OAuth needed).
 * Users create a private app inside their HubSpot account → copy the token → paste into SellSight.
 *
 * How to get a token:
 *   HubSpot CRM → Settings (gear icon) → Integrations → Private Apps → Create private app
 *   Required scopes: crm.objects.deals.read, crm.objects.contacts.read, crm.objects.companies.read
 *   (No extra scopes needed for emails/notes — we use the Engagements v1 API which is
 *    covered by crm.objects.contacts.read)
 *   Copy the access token and paste it into SellSight Settings → Integrations.
 *
 * Stage strategy:
 *   Closed stages are normalised to closed_won / closed_lost so the ML model can use them.
 *   All other stages keep their native HubSpot stage ID — the pipeline config is rebuilt from
 *   the real HubSpot pipeline on every sync so column labels & order stay in sync.
 */

import { db } from '@/lib/db'
import { hubspotIntegrations } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

// ─── Table migration (run once per process) ───────────────────────────────────

let schemaMigrated = false
export async function ensureHubspotSchema() {
  if (schemaMigrated) return
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS hubspot_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL DEFAULT '',
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '100 years',
        portal_id TEXT NOT NULL DEFAULT '',
        last_sync_at TIMESTAMP WITH TIME ZONE,
        deals_imported INTEGER NOT NULL DEFAULT 0,
        sync_error TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `)
    await db.execute(sql`
      ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS hubspot_deal_id TEXT UNIQUE
    `)
    await db.execute(sql`
      ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS hubspot_stage_label TEXT
    `)
  } catch { /* already exists */ }
  schemaMigrated = true
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HS_API = 'https://api.hubapi.com'

// Stage colours assigned left→right across the pipeline
const PIPELINE_COLORS = ['#6B7280', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#F97316']

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HubspotIntegration {
  id: string
  workspaceId: string
  accessToken: string
  portalId: string
  lastSyncAt: Date | null
  dealsImported: number
  syncError: string | null
}

export interface HubspotDealRaw {
  id: string
  properties: {
    dealname?: string
    amount?: string
    closedate?: string
    dealstage?: string
    description?: string
    hs_lastmodifieddate?: string
  }
  associations?: {
    contacts?: { results: { id: string; type: string }[] }
    companies?: { results: { id: string; type: string }[] }
  }
}

export interface MappedDeal {
  hubspotDealId: string
  dealName: string
  prospectCompany: string
  prospectName: string | null
  prospectTitle: string | null
  contacts: { name: string; email?: string; title?: string }[]
  dealValue: number | null
  stage: string
  hubspotStageLabel: string | null  // real display name from HubSpot pipeline, e.g. "Proposal Sent"
  description: string | null
  closeDate: Date | null
  updatedAt: Date
}

export interface HubspotPipelineStage {
  id: string
  label: string
  displayOrder: number
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function getHubspotIntegration(workspaceId: string): Promise<HubspotIntegration | null> {
  await ensureHubspotSchema()
  const [row] = await db
    .select()
    .from(hubspotIntegrations)
    .where(eq(hubspotIntegrations.workspaceId, workspaceId))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    accessToken: row.accessToken,
    portalId: row.portalId,
    lastSyncAt: row.lastSyncAt ? new Date(row.lastSyncAt) : null,
    dealsImported: row.dealsImported,
    syncError: row.syncError ?? null,
  }
}

/** Save a private app token. Validates it against HubSpot before saving. */
export async function connectWithToken(workspaceId: string, token: string): Promise<{ portalId: string }> {
  await ensureHubspotSchema()
  // Validate token by calling HubSpot token info endpoint
  const res = await fetch(`${HS_API}/oauth/v1/access-tokens/${token}`)
  if (!res.ok) {
    // Private app tokens don't go through /oauth/v1/access-tokens — validate by making a real API call instead
    const testRes = await fetch(`${HS_API}/crm/v3/objects/deals?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!testRes.ok) throw new Error('Invalid token — make sure you copied the full private app access token from HubSpot')
    // Token works — extract portal ID from response headers or default to 'private'
    const portalId = testRes.headers.get('x-hubspot-account-id') ?? 'private'
    await db
      .insert(hubspotIntegrations)
      .values({ workspaceId, accessToken: token, refreshToken: '', expiresAt: new Date('2099-01-01'), portalId })
      .onConflictDoUpdate({
        target: hubspotIntegrations.workspaceId,
        set: { accessToken: token, portalId, syncError: null, updatedAt: new Date() },
      })
    return { portalId }
  }
  const info = await res.json() as { hub_id?: number }
  const portalId = String(info.hub_id ?? 'private')
  await db
    .insert(hubspotIntegrations)
    .values({ workspaceId, accessToken: token, refreshToken: '', expiresAt: new Date('2099-01-01'), portalId })
    .onConflictDoUpdate({
      target: hubspotIntegrations.workspaceId,
      set: { accessToken: token, portalId, syncError: null, updatedAt: new Date() },
    })
  return { portalId }
}

export async function getValidToken(workspaceId: string): Promise<string> {
  const integration = await getHubspotIntegration(workspaceId)
  if (!integration) throw new Error('HubSpot not connected for this workspace')
  return integration.accessToken
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

async function hsPost(path: string, token: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${HS_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HubSpot POST ${path} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function hsGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${HS_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`HubSpot GET ${path} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// ─── HubSpot API calls ────────────────────────────────────────────────────────

const DEAL_PROPS = [
  'dealname', 'amount', 'closedate', 'dealstage', 'description', 'hs_lastmodifieddate',
].join(',')

export async function fetchAllHubspotDeals(token: string): Promise<HubspotDealRaw[]> {
  const deals: HubspotDealRaw[] = []
  let after: string | undefined
  do {
    const params = new URLSearchParams({ limit: '100', properties: DEAL_PROPS, associations: 'contacts,companies' })
    if (after) params.set('after', after)
    const data = await hsGet(`/crm/v3/objects/deals?${params}`, token) as {
      results: HubspotDealRaw[]
      paging?: { next?: { after: string } }
    }
    deals.push(...(data.results ?? []))
    after = data.paging?.next?.after
  } while (after)
  return deals
}

export async function fetchContacts(token: string, contactIds: string[]): Promise<{
  id: string; name: string; email?: string; title?: string
}[]> {
  if (contactIds.length === 0) return []
  const res = await fetch(`${HS_API}/crm/v3/objects/contacts/batch/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: contactIds.map(id => ({ id })), properties: ['firstname', 'lastname', 'email', 'jobtitle'] }),
  })
  if (!res.ok) return []
  const data = await res.json() as {
    results: { id: string; properties: { firstname?: string; lastname?: string; email?: string; jobtitle?: string } }[]
  }
  return (data.results ?? []).map(c => ({
    id: c.id,
    name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' ') || 'Unknown',
    email: c.properties.email,
    title: c.properties.jobtitle,
  }))
}

export async function fetchCompanies(token: string, companyIds: string[]): Promise<{ id: string; name: string }[]> {
  if (companyIds.length === 0) return []
  const res = await fetch(`${HS_API}/crm/v3/objects/companies/batch/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: companyIds.map(id => ({ id })), properties: ['name'] }),
  })
  if (!res.ok) return []
  const data = await res.json() as { results: { id: string; properties: { name?: string } }[] }
  return (data.results ?? []).map(c => ({ id: c.id, name: c.properties.name ?? 'Unknown Company' }))
}

/**
 * Fetch all deal pipeline stages from HubSpot's primary sales pipeline.
 * Returns both a label lookup map and an ordered stage list for building pipelineConfig.
 */
export async function fetchPipelineStages(token: string): Promise<{
  stageLabels: Map<string, string>
  orderedStages: HubspotPipelineStage[]
}> {
  try {
    const data = await hsGet('/crm/v3/pipelines/deals', token) as {
      results: { id: string; label: string; stages: { id: string; label: string; displayOrder: number }[] }[]
    }
    const stageLabels = new Map<string, string>()
    const orderedStages: HubspotPipelineStage[] = []

    // Use the first (primary) pipeline
    const primary = data.results?.[0]
    if (primary) {
      for (const s of primary.stages ?? []) {
        stageLabels.set(s.id, s.label)
        orderedStages.push({ id: s.id, label: s.label, displayOrder: s.displayOrder })
      }
      orderedStages.sort((a, b) => a.displayOrder - b.displayOrder)
    }

    return { stageLabels, orderedStages }
  } catch {
    return { stageLabels: new Map(), orderedStages: [] }
  }
}

/**
 * Fetch all engagements (notes, emails, calls) for a single deal via the Engagements v1 API.
 * This API requires only crm.objects.contacts.read — no extra scopes needed.
 * Handles pagination automatically.
 */
export async function fetchDealEngagements(
  token: string,
  dealId: string,
): Promise<{
  emails: { subject: string | null; body: string | null; direction: string | null; fromEmail: string | null; timestamp: string | null }[]
  notes:  { body: string | null; timestamp: string | null }[]
}> {
  const emails: { subject: string | null; body: string | null; direction: string | null; fromEmail: string | null; timestamp: string | null }[] = []
  const notes:  { body: string | null; timestamp: string | null }[] = []

  let offset: number | undefined
  do {
    const params = new URLSearchParams({ limit: '100' })
    if (offset != null) params.set('offset', String(offset))
    let data: any
    try {
      data = await hsGet(`/engagements/v1/engagements/associated/deal/${dealId}/paged?${params}`, token)
    } catch { break }

    for (const item of data.results ?? []) {
      const type  = item.engagement?.type as string | undefined
      const tsMs  = item.engagement?.timestamp as number | null | undefined
      const ts    = tsMs ? new Date(tsMs).toISOString() : null

      if (type === 'EMAIL') {
        const meta = item.metadata ?? {}
        emails.push({
          subject:   meta.subject ?? null,
          body:      meta.text ?? meta.html ?? null,
          direction: meta.from?.email ? 'OUTGOING_EMAIL' : null,
          fromEmail: meta.from?.email ?? null,
          timestamp: ts,
        })
      } else if (type === 'NOTE') {
        const meta = item.metadata ?? {}
        notes.push({ body: meta.body ?? null, timestamp: ts })
      }
    }

    offset = data.hasMore ? (data.offset as number) : undefined
  } while (offset != null)

  return { emails, notes }
}

/**
 * Batch-fetch associations between deals and a related object type (emails or notes).
 * Returns a Map of dealId → list of related object IDs.
 * @deprecated Use fetchDealEngagements instead — requires crm.objects.emails/notes.read scopes
 *             which are not available on all HubSpot tiers.
 */
export async function fetchDealAssociations(
  token: string,
  dealIds: string[],
  toObjectType: 'emails' | 'notes',
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  if (dealIds.length === 0) return result

  for (const chunk of chunks(dealIds, 100)) {
    try {
      const data = await hsPost(
        `/crm/v4/associations/deals/${toObjectType}/batch/read`,
        token,
        { inputs: chunk.map(id => ({ id })) },
      ) as { results: { from: { id: string }; to: { id: string }[] }[] }

      for (const item of data.results ?? []) {
        result.set(item.from.id, (item.to ?? []).map(t => t.id))
      }
    } catch { /* non-fatal — emails scope may not be enabled */ }
  }
  return result
}

/** Batch-read HubSpot email engagement objects. */
export async function fetchEmails(token: string, emailIds: string[]): Promise<{
  id: string
  subject: string | null
  body: string | null
  direction: string | null
  fromEmail: string | null
  timestamp: string | null
}[]> {
  if (emailIds.length === 0) return []
  const results: any[] = []

  for (const chunk of chunks(emailIds, 100)) {
    try {
      const data = await hsPost('/crm/v3/objects/emails/batch/read', token, {
        inputs: chunk.map(id => ({ id })),
        properties: ['hs_email_subject', 'hs_email_text', 'hs_email_direction', 'hs_email_from_email', 'hs_timestamp'],
      }) as { results: any[] }
      results.push(...(data.results ?? []))
    } catch { /* non-fatal */ }
  }

  return results.map(e => ({
    id: e.id,
    subject:   e.properties?.hs_email_subject   ?? null,
    body:      e.properties?.hs_email_text       ?? null,
    direction: e.properties?.hs_email_direction  ?? null,
    fromEmail: e.properties?.hs_email_from_email ?? null,
    timestamp: e.properties?.hs_timestamp        ?? null,
  }))
}

/** Batch-read HubSpot note engagement objects. */
export async function fetchNotes(token: string, noteIds: string[]): Promise<{
  id: string
  body: string | null
  timestamp: string | null
}[]> {
  if (noteIds.length === 0) return []
  const results: any[] = []

  for (const chunk of chunks(noteIds, 100)) {
    try {
      const data = await hsPost('/crm/v3/objects/notes/batch/read', token, {
        inputs: chunk.map(id => ({ id })),
        properties: ['hs_note_body', 'hs_timestamp'],
      }) as { results: any[] }
      results.push(...(data.results ?? []))
    } catch { /* non-fatal */ }
  }

  return results.map(n => ({
    id:        n.id,
    body:      n.properties?.hs_note_body  ?? null,
    timestamp: n.properties?.hs_timestamp  ?? null,
  }))
}

// ─── Meeting notes builder ────────────────────────────────────────────────────

function isoDate(ts: string | null): string {
  if (!ts) return new Date().toISOString().slice(0, 10)
  try { return new Date(ts).toISOString().slice(0, 10) } catch { return new Date().toISOString().slice(0, 10) }
}

/** Strip HTML tags from a string. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Build a structured meeting-notes string from HubSpot emails and notes.
 * Entries are formatted with [YYYY-MM-DD] date headers so parseMeetingEntries()
 * in text-signals.ts can parse them for NLP scoring.
 *
 * Body text is truncated to 1 500 chars per entry to keep DB rows sane.
 */
export function buildMeetingNotes(
  emails: { subject: string | null; body: string | null; direction: string | null; fromEmail: string | null; timestamp: string | null }[],
  notes:  { body: string | null; timestamp: string | null }[],
): string | null {
  const entries: { sortDate: number; text: string }[] = []

  for (const email of emails) {
    const raw = email.body?.trim()
    if (!raw || raw.length < 10) continue
    const body = stripHtml(raw).slice(0, 1500)
    const direction = email.direction?.toUpperCase() === 'INCOMING_EMAIL' ? 'Inbound email' : 'Email'
    const subject = email.subject ? `: ${email.subject}` : ''
    const from = email.fromEmail ? ` from ${email.fromEmail}` : ''
    const date = email.timestamp ? new Date(email.timestamp) : new Date()
    entries.push({
      sortDate: date.getTime(),
      text: `[${isoDate(email.timestamp)}] ${direction}${from}${subject}\n${body}`,
    })
  }

  for (const note of notes) {
    const raw = note.body?.trim()
    if (!raw || raw.length < 5) continue
    const body = stripHtml(raw).slice(0, 1500)
    const date = note.timestamp ? new Date(note.timestamp) : new Date()
    entries.push({
      sortDate: date.getTime(),
      text: `[${isoDate(note.timestamp)}] Note:\n${body}`,
    })
  }

  if (entries.length === 0) return null

  // Oldest first — matches how reps write notes chronologically
  entries.sort((a, b) => a.sortDate - b.sortDate)
  return entries.map(e => e.text).join('\n\n')
}

// ─── Pipeline config builder ──────────────────────────────────────────────────

/**
 * Build a SellSight pipelineConfig.stages array from HubSpot's ordered stage list.
 * Closed stages are always normalised to closed_won / closed_lost.
 * All other stages keep their native HubSpot ID so deal.stage values match column IDs.
 */
export function buildHubspotPipelineConfig(orderedStages: HubspotPipelineStage[]): {
  id: string; label: string; color: string; order: number; isDefault: boolean; fromHubspot?: boolean
}[] {
  const openStages = orderedStages.filter(s => {
    const k = s.id.toLowerCase().replace(/[_\s]/g, '')
    return k !== 'closedwon' && k !== 'closedlost'
  })

  const totalOpen = openStages.length
  const stages = openStages.map((s, i) => ({
    id: s.id,
    label: s.label,
    color: PIPELINE_COLORS[Math.round(i / Math.max(totalOpen - 1, 1) * (PIPELINE_COLORS.length - 1))] ?? '#8B5CF6',
    order: i + 1,
    isDefault: false,
    fromHubspot: true,
  }))

  stages.push({ id: 'closed_won',  label: 'Closed Won',  color: '#22C55E', order: stages.length + 1, isDefault: true, fromHubspot: false })
  stages.push({ id: 'closed_lost', label: 'Closed Lost', color: '#6B7280', order: stages.length + 2, isDefault: true, fromHubspot: false })

  return stages
}

// ─── Field mapping ────────────────────────────────────────────────────────────

/**
 * Map a HubSpot stage ID to a SellSight stage ID.
 * Only closed stages are normalised — every other stage keeps its native HubSpot ID
 * so the pipeline board can show HubSpot's real column names.
 */
export function mapHubspotStage(hubspotStage: string | undefined): string {
  if (!hubspotStage) return 'prospecting'
  const key = hubspotStage.toLowerCase().replace(/[_\s]/g, '')
  if (key === 'closedwon')  return 'closed_won'
  if (key === 'closedlost') return 'closed_lost'
  return hubspotStage  // preserve native HubSpot stage ID
}

export function mapHubspotDeal(
  raw: HubspotDealRaw,
  contacts: { id: string; name: string; email?: string; title?: string }[],
  companyName: string,
  stageLabels: Map<string, string> = new Map(),
): MappedDeal {
  const p = raw.properties
  const primaryContact = contacts[0]
  const rawStageId = p.dealstage ?? ''
  return {
    hubspotDealId: raw.id,
    dealName:      p.dealname?.trim() || `HubSpot Deal #${raw.id}`,
    prospectCompany: companyName,
    prospectName:  primaryContact?.name ?? null,
    prospectTitle: primaryContact?.title ?? null,
    contacts: contacts.map(c => ({ name: c.name, email: c.email, title: c.title })),
    dealValue:     p.amount ? Math.round(parseFloat(p.amount)) : null,
    stage:         mapHubspotStage(rawStageId),
    hubspotStageLabel: stageLabels.get(rawStageId) ?? null,
    description:   p.description?.trim() || null,
    closeDate:     p.closedate ? new Date(p.closedate) : null,
    updatedAt:     p.hs_lastmodifieddate ? new Date(p.hs_lastmodifieddate) : new Date(),
  }
}
