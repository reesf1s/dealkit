import postgres from 'postgres'

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed native CRM data in production.')
}

if (process.env.HALVEX_ALLOW_DEV_SEED !== 'true') {
  throw new Error('Set HALVEX_ALLOW_DEV_SEED=true to run the dev-only CRM seed.')
}

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required.')

const sql = postgres(url, { max: 1, ssl: url.includes('supabase.co') || url.includes('pooler.supabase.com') ? 'require' : false })

const workspaceId = '11111111-1111-4111-8111-111111111111'
const ownerId = 'dev_native_crm_owner'

await sql.begin(async tx => {
  await tx`
    INSERT INTO users (id, email, created_at, updated_at)
    VALUES (${ownerId}, 'founder@halvex.dev', now(), now())
    ON CONFLICT (id) DO NOTHING
  `
  await tx`
    INSERT INTO workspaces (id, name, slug, owner_id, plan, created_at, updated_at)
    VALUES (${workspaceId}, 'Halvex CRM Dev', 'halvex-crm-dev', ${ownerId}, 'pro', now(), now())
    ON CONFLICT (id) DO NOTHING
  `
  await tx`
    INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at)
    VALUES (${workspaceId}, ${ownerId}, 'owner', now())
    ON CONFLICT DO NOTHING
  `
  await tx`
    INSERT INTO crm_pipelines (workspace_id, name, business_type, is_default)
    VALUES (${workspaceId}, 'Sales pipeline', 'saas', true)
    ON CONFLICT (workspace_id, name) DO NOTHING
  `
  const [pipeline] = await tx`
    SELECT id FROM crm_pipelines WHERE workspace_id = ${workspaceId} AND is_default = true LIMIT 1
  `
  const stages = [
    ['lead_in', 'Lead in', '#64748b', 1, 10, false],
    ['qualified', 'Qualified', '#3b82f6', 2, 25, false],
    ['discovery', 'Discovery', '#8b5cf6', 3, 40, false],
    ['proposal', 'Proposal', '#f59e0b', 4, 60, false],
    ['contract', 'Contract', '#ef4444', 5, 80, false],
    ['won', 'Won', '#22c55e', 6, 100, true],
    ['lost', 'Lost', '#6b7280', 7, 0, true],
  ]
  for (const [key, name, color, position, probability, isClosed] of stages) {
    await tx`
      INSERT INTO crm_pipeline_stages (workspace_id, pipeline_id, key, name, color, position, probability, is_closed)
      VALUES (${workspaceId}, ${pipeline.id}, ${key}, ${name}, ${color}, ${position}, ${probability}, ${isClosed})
      ON CONFLICT (pipeline_id, key) DO NOTHING
    `
  }

  const [stage] = await tx`SELECT id FROM crm_pipeline_stages WHERE pipeline_id = ${pipeline.id} AND key = 'proposal' LIMIT 1`
  const [company] = await tx`
    INSERT INTO crm_companies (workspace_id, name, domain, source, owner_id)
    VALUES (${workspaceId}, 'Acme Analytics', 'acme.test', 'dev_seed', ${ownerId})
    ON CONFLICT (workspace_id, name) DO UPDATE SET updated_at = now()
    RETURNING id
  `
  const [deal] = await tx`
    INSERT INTO crm_deals (workspace_id, company_id, pipeline_id, stage_id, owner_id, title, value_amount, expected_close_date, probability, ai_score, ai_confidence, ai_risk_level, ai_summary, ai_next_action, last_activity_at, source)
    VALUES (${workspaceId}, ${company.id}, ${pipeline.id}, ${stage.id}, ${ownerId}, 'Acme Analytics annual CRM rollout', 42000, now() + interval '18 days', 60, 72, 70, 'medium', 'Acme is evaluating Halvex to replace spreadsheet pipeline tracking. The next risk is confirming budget approval before contract review.', 'Confirm budget owner and book contract review.', now() - interval '2 days', 'dev_seed')
    ON CONFLICT DO NOTHING
    RETURNING id
  `
  if (deal?.id) {
    await tx`
      INSERT INTO crm_activities (workspace_id, deal_id, company_id, type, source, title, body, occurred_at, created_by)
      VALUES (${workspaceId}, ${deal.id}, ${company.id}, 'meeting', 'dev_seed', 'Discovery call', 'Founder confirmed spreadsheet CRM is breaking down and wants Monday priorities automated.', now() - interval '2 days', ${ownerId})
    `
  }
})

await sql.end()
console.log('Seeded native CRM dev workspace:', workspaceId)
