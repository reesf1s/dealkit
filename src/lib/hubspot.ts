/**
 * HubSpot CRM Integration
 *
 * Handles OAuth token lifecycle, HubSpot API calls, and deal → DealKit field mapping.
 * Uses the HubSpot REST API v3 directly (no SDK dependency).
 *
 * Stage mapping (HubSpot default pipeline → DealKit):
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
        refresh_token TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        portal_id TEXT NOT NULL,
        last_sync_at TIMESTAMP WITH TIME ZONE,
        deals_imported INTEGER NOT NULL DEFAULT 0,
        sync_error TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `)
    // hubspot_deal_id column on deal_logs — used for upsert/dedup
    await db.execute(sql`
      ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS hubspot_deal_id TEXT UNIQUE
    `)
  } catch { /* already exists */ }
  schemaMigrated = true
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HS_API  = 'https://api.hubapi.com'
const HS_AUTH = 'https://app.hubspot.com/oauth/authorize'
const HS_TOKEN = 'https://api.hubapi.com/oauth/v1/token'

const SCOPES = [
  'crm.objects.deals.read',
  'crm.objects.contacts.read',
  'crm.objects.companies.read',
].join(' ')

// HubSpot default deal stage IDs → DealKit deal stages
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
  refreshToken: string
  expiresAt: Date
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
    hubspot_owner_id?: string
    notes_last_updated?: string
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
  description: string | null
  closeDate: Date | null
  updatedAt: Date
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

export function buildAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.HUBSPOT_CLIENT_ID
  if (!clientId) throw new Error('HUBSPOT_CLIENT_ID env var not set')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  })
  return `${HS_AUTH}?${params}`
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
  portalId: string
}> {
  const clientId     = process.env.HUBSPOT_CLIENT_ID!
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET!
  const res = await fetch(HS_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      code,
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`HubSpot token exchange failed: ${txt}`)
  }
  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
  }
  // Get portal ID from token info
  const infoRes = await fetch(`${HS_API}/oauth/v1/access-tokens/${data.access_token}`)
  const info = infoRes.ok ? (await infoRes.json() as { hub_id?: number }) : {}
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    new Date(Date.now() + (data.expires_in - 60) * 1000), // 1-min buffer
    portalId:     String(info.hub_id ?? 'unknown'),
  }
}

async function refreshTokens(integration: HubspotIntegration): Promise<HubspotIntegration> {
  const clientId     = process.env.HUBSPOT_CLIENT_ID!
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET!
  const res = await fetch(HS_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: integration.refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`HubSpot token refresh failed: ${await res.text()}`)
  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000)
  await db.update(hubspotIntegrations)
    .set({
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(hubspotIntegrations.workspaceId, integration.workspaceId))
  return { ...integration, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function getHubspotIntegration(workspaceId: string): Promise<HubspotIntegration | null> {
  await ensureHubspotSchema()
  const [row] = await db
    .select()
    .from(hubspotIntegrations)
    .where(eq(hubspotIntegrations.workspaceId, workspaceId))
    .limit(1)
  return row ?? null
}

/** Returns a valid (non-expired) access token, refreshing if needed. */
export async function getValidToken(workspaceId: string): Promise<string> {
  let integration = await getHubspotIntegration(workspaceId)
  if (!integration) throw new Error('HubSpot not connected for this workspace')
  if (new Date() >= new Date(integration.expiresAt)) {
    integration = await refreshTokens(integration)
  }
  return integration.accessToken
}

// ─── HubSpot API calls ────────────────────────────────────────────────────────

const DEAL_PROPS = [
  'dealname', 'amount', 'closedate', 'dealstage', 'description',
  'hs_lastmodifieddate', 'notes_last_updated',
].join(',')

async function hsGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${HS_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`HubSpot GET ${path} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

/** Fetch all HubSpot deals with their associated contacts + companies. */
export async function fetchAllHubspotDeals(token: string): Promise<HubspotDealRaw[]> {
  const deals: HubspotDealRaw[] = []
  let after: string | undefined

  do {
    const params = new URLSearchParams({
      limit: '100',
      properties: DEAL_PROPS,
      associations: 'contacts,companies',
    })
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

/** Fetch contact properties for a list of contact IDs. */
export async function fetchContacts(token: string, contactIds: string[]): Promise<{
  id: string
  name: string
  email?: string
  title?: string
}[]> {
  if (contactIds.length === 0) return []
  // Batch read contacts
  const res = await fetch(`${HS_API}/crm/v3/objects/contacts/batch/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: contactIds.map(id => ({ id })),
      properties: ['firstname', 'lastname', 'email', 'jobtitle'],
    }),
  })
  if (!res.ok) return []
  const data = await res.json() as {
    results: { id: string; properties: { firstname?: string; lastname?: string; email?: string; jobtitle?: string } }[]
  }
  return (data.results ?? []).map(c => ({
    id: c.id,
    name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' ') || 'Unknown Contact',
    email: c.properties.email,
    title: c.properties.jobtitle,
  }))
}

/** Fetch company name for a list of company IDs. */
export async function fetchCompanies(token: string, companyIds: string[]): Promise<{ id: string; name: string }[]> {
  if (companyIds.length === 0) return []
  const res = await fetch(`${HS_API}/crm/v3/objects/companies/batch/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: companyIds.map(id => ({ id })),
      properties: ['name'],
    }),
  })
  if (!res.ok) return []
  const data = await res.json() as { results: { id: string; properties: { name?: string } }[] }
  return (data.results ?? []).map(c => ({ id: c.id, name: c.properties.name ?? 'Unknown Company' }))
}

// ─── Field mapping ────────────────────────────────────────────────────────────

export function mapHubspotStage(hubspotStage: string | undefined): string {
  if (!hubspotStage) return 'prospecting'
  const normalized = hubspotStage.toLowerCase().replace(/\s+/g, '')
  return STAGE_MAP[normalized] ?? 'prospecting'
}

export function mapHubspotDeal(
  raw: HubspotDealRaw,
  contacts: { id: string; name: string; email?: string; title?: string }[],
  companyName: string,
): MappedDeal {
  const p = raw.properties
  const primaryContact = contacts[0]
  const dealValue = p.amount ? Math.round(parseFloat(p.amount)) : null
  const closeDate = p.closedate ? new Date(p.closedate) : null
  const lastMod   = p.hs_lastmodifieddate ? new Date(p.hs_lastmodifieddate) : new Date()

  return {
    hubspotDealId: raw.id,
    dealName:      p.dealname?.trim() || `HubSpot Deal #${raw.id}`,
    prospectCompany: companyName,
    prospectName:  primaryContact?.name ?? null,
    prospectTitle: primaryContact?.title ?? null,
    contacts: contacts.map(c => ({ name: c.name, email: c.email, title: c.title })),
    dealValue:     dealValue,
    stage:         mapHubspotStage(p.dealstage),
    description:   p.description?.trim() || null,
    closeDate,
    updatedAt:     lastMod,
  }
}
