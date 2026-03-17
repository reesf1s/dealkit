/**
 * HubSpot CRM Integration — Private App token auth
 *
 * Uses HubSpot Private Apps (long-lived token, no OAuth needed).
 * Users create a private app inside their HubSpot account → copy the token → paste into SellSight.
 *
 * How to get a token:
 *   HubSpot CRM → Settings (gear icon) → Integrations → Private Apps → Create private app
 *   Required scopes: crm.objects.deals.read, crm.objects.contacts.read, crm.objects.companies.read
 *   Copy the access token and paste it into SellSight Settings → Integrations.
 *
 * Stage mapping (HubSpot default pipeline → SellSight):
 *   appointmentscheduled  → discovery
 *   qualifiedtobuy        → qualification
 *   presentationscheduled → proposal
 *   decisionmakerboughtin → negotiation
 *   contractsent          → negotiation
 *   closedwon             → closed_won
 *   closedlost            → closed_lost
 *   (anything else)       → prospecting
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

const STAGE_MAP: Record<string, string> = {
  appointmentscheduled:  'discovery',
  qualifiedtobuy:        'qualification',
  presentationscheduled: 'proposal',
  decisionmakerboughtin: 'negotiation',
  contractsent:          'negotiation',
  closedwon:             'closed_won',
  closedlost:            'closed_lost',
}

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

// ─── HubSpot API calls ────────────────────────────────────────────────────────

const DEAL_PROPS = [
  'dealname', 'amount', 'closedate', 'dealstage', 'description', 'hs_lastmodifieddate',
].join(',')

async function hsGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${HS_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`HubSpot GET ${path} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

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

/** Fetch all deal pipeline stages and return a map of stageId → display label. */
export async function fetchPipelineStages(token: string): Promise<Map<string, string>> {
  try {
    const data = await hsGet('/crm/v3/pipelines/deals', token) as {
      results: { stages: { id: string; label: string }[] }[]
    }
    const map = new Map<string, string>()
    for (const pipeline of data.results ?? []) {
      for (const stage of pipeline.stages ?? []) {
        map.set(stage.id, stage.label)
      }
    }
    return map
  } catch {
    return new Map() // non-fatal — fall back to mapped stage names
  }
}

// ─── Field mapping ────────────────────────────────────────────────────────────

export function mapHubspotStage(hubspotStage: string | undefined): string {
  if (!hubspotStage) return 'prospecting'
  return STAGE_MAP[hubspotStage.toLowerCase().replace(/\s+/g, '')] ?? 'prospecting'
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
