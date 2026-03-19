/**
 * Core HubSpot sync logic — usable by both the user-facing route and the cron job.
 *
 * What this does on every sync:
 *  1. Fetches all deals + contacts + companies + pipeline stage labels from HubSpot
 *  2. Fetches engagements (emails, notes, calls) for each deal via Engagements v1 API
 *     — requires only crm.objects.contacts.read, no extra scopes needed
 *  3. Upserts into deal_logs (keyed on hubspot_deal_id)
 *     – meeting_notes is populated on INSERT only; manual notes are never overwritten
 *  4. Rebuilds workspace pipelineConfig from HubSpot's real stage names & order
 *  5. Triggers brain rebuild
 */
import { db } from '@/lib/db'
import { hubspotIntegrations, workspaces } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import {
  getValidToken,
  fetchAllHubspotDeals,
  fetchContacts,
  fetchCompanies,
  fetchPipelineStages,
  fetchDealEngagements,
  buildMeetingNotes,
  buildHubspotPipelineConfig,
  mapHubspotDeal,
  ensureHubspotSchema,
  getHubspotIntegration,
} from '@/lib/hubspot'
import { rebuildWorkspaceBrain } from '@/lib/workspace-brain'

export interface SyncResult {
  workspaceId: string
  dealsImported: number
  emailsFetched: number
  notesFetched: number
  syncedAt: Date
}

export async function syncHubspotDeals(workspaceId: string, userId: string): Promise<SyncResult> {
  await ensureHubspotSchema()

  const integration = await getHubspotIntegration(workspaceId)
  if (!integration) throw new Error('HubSpot not connected')

  const token = await getValidToken(workspaceId)

  // ── 1. Fetch all deals (paginated) ──────────────────────────────────────────
  const rawDeals = await fetchAllHubspotDeals(token)

  const allContactIds = [...new Set(
    rawDeals.flatMap(d => d.associations?.contacts?.results.map(r => r.id) ?? [])
  )]
  const allCompanyIds = [...new Set(
    rawDeals.flatMap(d => d.associations?.companies?.results.map(r => r.id) ?? [])
  )]

  // ── 2. Parallel fetch: contacts, companies, pipeline stages ─────────────────
  const [contacts, companies, { stageLabels, orderedStages }] = await Promise.all([
    fetchContacts(token, allContactIds),
    fetchCompanies(token, allCompanyIds),
    fetchPipelineStages(token),
  ])

  const contactMap = new Map(contacts.map(c => [c.id, c]))
  const companyMap = new Map(companies.map(c => [c.id, c]))

  // ── 3. Fetch engagements for all deals in parallel (Engagements v1 API) ─────
  //  Uses crm.objects.contacts.read — no additional scopes required.
  //  Concurrency-limited to 10 at a time to stay well inside HubSpot's rate limit.
  const CONCURRENCY = 10
  const engagementResults: Map<string, Awaited<ReturnType<typeof fetchDealEngagements>>> = new Map()

  for (let i = 0; i < rawDeals.length; i += CONCURRENCY) {
    const batch = rawDeals.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      batch.map(d => fetchDealEngagements(token, d.id).then(r => ({ dealId: d.id, ...r })))
    )
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        engagementResults.set(result.value.dealId, { emails: result.value.emails, notes: result.value.notes })
      }
    }
  }

  // ── 4. Upsert each deal ──────────────────────────────────────────────────────
  let upserted = 0
  let totalEmails = 0
  let totalNotes = 0
  const now = new Date()

  for (const raw of rawDeals) {
    const dealContactIds = raw.associations?.contacts?.results.map(r => r.id) ?? []
    const dealCompanyIds = raw.associations?.companies?.results.map(r => r.id) ?? []
    const dealContacts   = dealContactIds.map(id => contactMap.get(id)).filter(Boolean) as typeof contacts
    const primaryCompany = dealCompanyIds.map(id => companyMap.get(id)).find(Boolean)
    const companyName    = primaryCompany?.name ?? raw.properties.dealname ?? 'Unknown Company'

    const mapped = mapHubspotDeal(raw, dealContacts, companyName, stageLabels)

    // Build meeting notes from engagements for this deal
    const { emails: dealEmails, notes: dealNotes } = engagementResults.get(raw.id) ?? { emails: [], notes: [] }
    totalEmails += dealEmails.length
    totalNotes  += dealNotes.length
    const meetingNotes = buildMeetingNotes(dealEmails, dealNotes)

    await db.execute(sql`
      INSERT INTO deal_logs (
        id, workspace_id, user_id,
        deal_name, prospect_company, prospect_name, prospect_title,
        contacts, deal_value, stage, hubspot_stage_label, description, close_date,
        meeting_notes, hubspot_deal_id, updated_at, created_at
      ) VALUES (
        gen_random_uuid(), ${workspaceId}, ${userId},
        ${mapped.dealName}, ${mapped.prospectCompany}, ${mapped.prospectName}, ${mapped.prospectTitle},
        ${JSON.stringify(mapped.contacts)}::jsonb,
        ${mapped.dealValue}, ${mapped.stage}, ${mapped.hubspotStageLabel},
        ${mapped.description}, ${mapped.closeDate?.toISOString() ?? null},
        ${meetingNotes}, ${mapped.hubspotDealId}, ${now.toISOString()}, ${now.toISOString()}
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
        updated_at          = EXCLUDED.updated_at,
        -- Only update meeting_notes if HubSpot has content AND the deal has none yet
        -- (preserves notes the rep has manually added in SellSight)
        meeting_notes       = CASE
          WHEN ${meetingNotes} IS NOT NULL AND (deal_logs.meeting_notes IS NULL OR deal_logs.meeting_notes = '')
          THEN ${meetingNotes}
          ELSE deal_logs.meeting_notes
        END
    `)
    upserted++
  }

  // ── 5. Update workspace pipelineConfig from HubSpot's real stage names ───────
  if (orderedStages.length > 0) {
    try {
      const newStages = buildHubspotPipelineConfig(orderedStages)
      const [ws] = await db.select({ pipelineConfig: workspaces.pipelineConfig })
        .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
      const existing = ws?.pipelineConfig as any ?? {}

      const updatedConfig = {
        ...existing,
        stages: newStages,
        hubspotSynced: true,
        updatedAt: now.toISOString(),
      }

      await db.update(workspaces)
        .set({ pipelineConfig: updatedConfig, updatedAt: now })
        .where(eq(workspaces.id, workspaceId))
    } catch (e) {
      console.warn('[hubspot-sync] pipeline config update failed:', (e as Error)?.message)
    }
  }

  // ── 6. Update sync stats ─────────────────────────────────────────────────────
  await db.update(hubspotIntegrations)
    .set({ lastSyncAt: now, dealsImported: upserted, syncError: null, updatedAt: now })
    .where(eq(hubspotIntegrations.workspaceId, workspaceId))

  // ── 7. Rebuild brain in the background ───────────────────────────────────────
  rebuildWorkspaceBrain(workspaceId).catch(() => {})

  return {
    workspaceId,
    dealsImported: upserted,
    emailsFetched: totalEmails,
    notesFetched:  totalNotes,
    syncedAt: now,
  }
}
