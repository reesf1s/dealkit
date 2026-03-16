/**
 * POST /api/integrations/hubspot/sync
 * Imports (or updates) deals from HubSpot into DealKit deal_logs.
 *
 * Logic:
 * 1. Fetch all deals from HubSpot with associated contacts + companies
 * 2. For each deal, batch-fetch contact/company details
 * 3. Upsert into deal_logs using hubspot_deal_id as the unique key
 * 4. Update sync stats on the integration record
 * 5. Trigger brain rebuild so ML + forecasts update immediately
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hubspotIntegrations } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import {
  getValidToken, fetchAllHubspotDeals, fetchContacts, fetchCompanies,
  mapHubspotDeal, ensureHubspotSchema, getHubspotIntegration,
} from '@/lib/hubspot'
import { rebuildWorkspaceBrain } from '@/lib/workspace-brain'

export async function POST(_req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkRateLimit(userId, 'hubspot-sync', 5) // max 5 syncs / 15 min
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    const { workspaceId } = await getWorkspaceContext(userId)
    await ensureHubspotSchema()

    const integration = await getHubspotIntegration(workspaceId)
    if (!integration) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 })
    }

    // Get valid token (refreshes automatically if expired)
    const token = await getValidToken(workspaceId)

    // 1. Fetch all deals from HubSpot
    const rawDeals = await fetchAllHubspotDeals(token)

    // 2. Collect all unique contact + company IDs across all deals
    const allContactIds = [...new Set(
      rawDeals.flatMap(d => d.associations?.contacts?.results.map(r => r.id) ?? [])
    )]
    const allCompanyIds = [...new Set(
      rawDeals.flatMap(d => d.associations?.companies?.results.map(r => r.id) ?? [])
    )]

    // 3. Batch fetch contact + company details
    const [contacts, companies] = await Promise.all([
      fetchContacts(token, allContactIds),
      fetchCompanies(token, allCompanyIds),
    ])
    const contactMap  = new Map(contacts.map(c => [c.id, c]))
    const companyMap  = new Map(companies.map(c => [c.id, c]))

    // 4. Upsert each deal into deal_logs
    let upserted = 0
    const now = new Date()

    for (const raw of rawDeals) {
      const dealContactIds  = raw.associations?.contacts?.results.map(r => r.id)  ?? []
      const dealCompanyIds  = raw.associations?.companies?.results.map(r => r.id) ?? []
      const dealContacts    = dealContactIds.map(id => contactMap.get(id)).filter(Boolean) as typeof contacts
      const primaryCompany  = dealCompanyIds.map(id => companyMap.get(id)).find(Boolean)
      const companyName     = primaryCompany?.name ?? raw.properties.dealname ?? 'Unknown Company'

      const mapped = mapHubspotDeal(raw, dealContacts, companyName)

      // Upsert using raw SQL — Drizzle doesn't support ON CONFLICT DO UPDATE on a non-schema column
      await db.execute(sql`
        INSERT INTO deal_logs (
          id, workspace_id, user_id,
          deal_name, prospect_company, prospect_name, prospect_title,
          contacts, deal_value, stage, description, close_date,
          hubspot_deal_id, updated_at, created_at
        ) VALUES (
          gen_random_uuid(), ${workspaceId}, ${userId},
          ${mapped.dealName}, ${mapped.prospectCompany}, ${mapped.prospectName}, ${mapped.prospectTitle},
          ${JSON.stringify(mapped.contacts)}::jsonb,
          ${mapped.dealValue}, ${mapped.stage},
          ${mapped.description}, ${mapped.closeDate?.toISOString() ?? null},
          ${mapped.hubspotDealId}, ${now.toISOString()}, ${now.toISOString()}
        )
        ON CONFLICT (hubspot_deal_id) DO UPDATE SET
          deal_name        = EXCLUDED.deal_name,
          prospect_company = EXCLUDED.prospect_company,
          prospect_name    = EXCLUDED.prospect_name,
          prospect_title   = EXCLUDED.prospect_title,
          contacts         = EXCLUDED.contacts,
          deal_value       = EXCLUDED.deal_value,
          stage            = EXCLUDED.stage,
          description      = EXCLUDED.description,
          close_date       = EXCLUDED.close_date,
          updated_at       = EXCLUDED.updated_at
      `)
      upserted++
    }

    // 5. Update sync stats
    await db.update(hubspotIntegrations)
      .set({
        lastSyncAt:    now,
        dealsImported: upserted,
        syncError:     null,
        updatedAt:     now,
      })
      .where(eq(hubspotIntegrations.workspaceId, workspaceId))

    // 6. Rebuild brain in background so ML + forecasts reflect new deals
    after(async () => {
      try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ }
    })

    return NextResponse.json({
      data: { dealsImported: upserted, syncedAt: now.toISOString() },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[hubspot/sync]', msg)

    // Store the error on the integration record so the UI can surface it
    try {
      const { userId } = await auth()
      if (userId) {
        const { workspaceId } = await getWorkspaceContext(userId)
        await db.update(hubspotIntegrations)
          .set({ syncError: msg.slice(0, 500), updatedAt: new Date() })
          .where(eq(hubspotIntegrations.workspaceId, workspaceId))
      }
    } catch { /* best effort */ }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
