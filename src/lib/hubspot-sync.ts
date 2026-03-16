/**
 * Core HubSpot sync logic — usable by both the user-facing route and the cron job.
 * Fetches all deals + contacts + companies + pipeline stage labels from HubSpot,
 * upserts into deal_logs (keyed on hubspot_deal_id), and triggers brain rebuild.
 */
import { db } from '@/lib/db'
import { hubspotIntegrations } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import {
  getValidToken,
  fetchAllHubspotDeals,
  fetchContacts,
  fetchCompanies,
  fetchPipelineStages,
  mapHubspotDeal,
  ensureHubspotSchema,
  getHubspotIntegration,
} from '@/lib/hubspot'
import { rebuildWorkspaceBrain } from '@/lib/workspace-brain'

export interface SyncResult {
  workspaceId: string
  dealsImported: number
  syncedAt: Date
}

export async function syncHubspotDeals(workspaceId: string, userId: string): Promise<SyncResult> {
  await ensureHubspotSchema()

  const integration = await getHubspotIntegration(workspaceId)
  if (!integration) throw new Error('HubSpot not connected')

  const token = await getValidToken(workspaceId)

  // Fetch deals, contacts, companies, and pipeline stage labels in parallel
  const rawDeals = await fetchAllHubspotDeals(token)

  const allContactIds = [...new Set(
    rawDeals.flatMap(d => d.associations?.contacts?.results.map(r => r.id) ?? [])
  )]
  const allCompanyIds = [...new Set(
    rawDeals.flatMap(d => d.associations?.companies?.results.map(r => r.id) ?? [])
  )]

  const [contacts, companies, stageLabels] = await Promise.all([
    fetchContacts(token, allContactIds),
    fetchCompanies(token, allCompanyIds),
    fetchPipelineStages(token),
  ])
  const contactMap = new Map(contacts.map(c => [c.id, c]))
  const companyMap = new Map(companies.map(c => [c.id, c]))

  let upserted = 0
  const now = new Date()

  for (const raw of rawDeals) {
    const dealContactIds = raw.associations?.contacts?.results.map(r => r.id) ?? []
    const dealCompanyIds = raw.associations?.companies?.results.map(r => r.id) ?? []
    const dealContacts   = dealContactIds.map(id => contactMap.get(id)).filter(Boolean) as typeof contacts
    const primaryCompany = dealCompanyIds.map(id => companyMap.get(id)).find(Boolean)
    const companyName    = primaryCompany?.name ?? raw.properties.dealname ?? 'Unknown Company'

    const mapped = mapHubspotDeal(raw, dealContacts, companyName, stageLabels)

    await db.execute(sql`
      INSERT INTO deal_logs (
        id, workspace_id, user_id,
        deal_name, prospect_company, prospect_name, prospect_title,
        contacts, deal_value, stage, hubspot_stage_label, description, close_date,
        hubspot_deal_id, updated_at, created_at
      ) VALUES (
        gen_random_uuid(), ${workspaceId}, ${userId},
        ${mapped.dealName}, ${mapped.prospectCompany}, ${mapped.prospectName}, ${mapped.prospectTitle},
        ${JSON.stringify(mapped.contacts)}::jsonb,
        ${mapped.dealValue}, ${mapped.stage}, ${mapped.hubspotStageLabel},
        ${mapped.description}, ${mapped.closeDate?.toISOString() ?? null},
        ${mapped.hubspotDealId}, ${now.toISOString()}, ${now.toISOString()}
      )
      ON CONFLICT (hubspot_deal_id) DO UPDATE SET
        deal_name           = EXCLUDED.deal_name,
        prospect_company    = EXCLUDED.prospect_company,
        prospect_name       = EXCLUDED.prospect_name,
        prospect_title      = EXCLUDED.prospect_title,
        contacts            = EXCLUDED.contacts,
        deal_value          = EXCLUDED.deal_value,
        stage               = EXCLUDED.stage,
        hubspot_stage_label = EXCLUDED.hubspot_stage_label,
        description         = EXCLUDED.description,
        close_date          = EXCLUDED.close_date,
        updated_at          = EXCLUDED.updated_at
    `)
    upserted++
  }

  // Update sync stats
  await db.update(hubspotIntegrations)
    .set({ lastSyncAt: now, dealsImported: upserted, syncError: null, updatedAt: now })
    .where(eq(hubspotIntegrations.workspaceId, workspaceId))

  // Rebuild brain in the background
  rebuildWorkspaceBrain(workspaceId).catch(() => {})

  return { workspaceId, dealsImported: upserted, syncedAt: now }
}
