import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  uuid,
  unique,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const planEnum = pgEnum('plan', ['free', 'starter', 'pro'])

export const workspaceRoleEnum = pgEnum('workspace_role', ['owner', 'admin', 'member'])

export const collateralTypeEnum = pgEnum('collateral_type', [
  'battlecard',
  'case_study_doc',
  'one_pager',
  'objection_handler',
  'talk_track',
  'email_sequence',
  'custom',
])

export const collateralStatusEnum = pgEnum('collateral_status', [
  'generating',
  'ready',
  'stale',
  'archived',
])

export const dealStageEnum = pgEnum('deal_stage', [
  'prospecting',
  'qualification',
  'discovery',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
])

export const productGapStatusEnum = pgEnum('product_gap_status', [
  'open',
  'in_review',
  'on_roadmap',
  'wont_fix',
  'shipped',
])

// ─────────────────────────────────────────────────────────────────────────────
// users  (authentication identity only — billing lives on workspace)
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),                             // Clerk user ID
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// workspaces  (team unit — owns plan, billing, and all data)
// ─────────────────────────────────────────────────────────────────────────────

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),                   // join code e.g. "spark-42"
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  plan: planEnum('plan').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  aiOverview: jsonb('ai_overview'),                        // cached daily AI overview
  aiOverviewGeneratedAt: timestamp('ai_overview_generated_at', { withTimezone: true }),
  workspaceBrain: jsonb('workspace_brain'),                // compressed org knowledge — updated after every deal analysis
  pipelineConfig: jsonb('pipeline_config'),                    // PipelineConfig JSON — custom stages, labels, industry preset
  embeddingCache: jsonb('embedding_cache'),                    // Semantic embedding vectors for deals, competitors, collateral
  inboundEmailToken: text('inbound_email_token'),              // 8-char hex token for email forwarding ingest
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// workspace_memberships  (user ↔ workspace many-to-many with role)
// ─────────────────────────────────────────────────────────────────────────────

export const workspaceMemberships = pgTable('workspace_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: workspaceRoleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.workspaceId, t.userId)])

// ─────────────────────────────────────────────────────────────────────────────
// company_profiles  (one per workspace)
// ─────────────────────────────────────────────────────────────────────────────

export const companyProfiles = pgTable('company_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .unique(),                                             // one profile per workspace
  userId: text('user_id')                                  // who last updated it
    .references(() => users.id, { onDelete: 'set null' }),
  companyName: text('company_name').notNull(),
  website: text('website'),
  industry: text('industry'),
  description: text('description'),
  products: jsonb('products').notNull().default([]),
  valuePropositions: jsonb('value_propositions').notNull().default([]),
  differentiators: jsonb('differentiators').notNull().default([]),
  commonObjections: jsonb('common_objections').notNull().default([]),
  knownCapabilities: jsonb('known_capabilities').notNull().default([]),
  targetMarket: text('target_market'),
  competitiveAdvantage: text('competitive_advantage'),
  founded: integer('founded'),
  employeeCount: text('employee_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// competitors
// ─────────────────────────────────────────────────────────────────────────────

export const competitors = pgTable('competitors', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')                                  // who created it
    .references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  website: text('website'),
  description: text('description'),
  strengths: jsonb('strengths').notNull().default([]),
  weaknesses: jsonb('weaknesses').notNull().default([]),
  pricing: text('pricing'),
  targetMarket: text('target_market'),
  keyFeatures: jsonb('key_features').notNull().default([]),
  differentiators: jsonb('differentiators').notNull().default([]),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// case_studies
// ─────────────────────────────────────────────────────────────────────────────

export const caseStudies = pgTable('case_studies', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  customerIndustry: text('customer_industry'),
  customerSize: text('customer_size'),
  challenge: text('challenge').notNull(),
  solution: text('solution').notNull(),
  results: text('results').notNull(),
  metrics: jsonb('metrics').notNull().default([]),
  generatedNarrative: text('generated_narrative'),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// deal_logs
// ─────────────────────────────────────────────────────────────────────────────

export const dealLogs = pgTable('deal_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  dealName: text('deal_name').notNull(),
  prospectCompany: text('prospect_company').notNull(),
  prospectName: text('prospect_name'),
  prospectTitle: text('prospect_title'),
  contacts: jsonb('contacts').notNull().default([]),   // DealContact[]
  description: text('description'),
  dealValue: integer('deal_value'),
  stage: dealStageEnum('stage').notNull().default('prospecting'),
  competitors: jsonb('competitors').notNull().default([]),
  notes: text('notes'),
  meetingNotes: text('meeting_notes'),
  hubspotNotes: text('hubspot_notes'),    // always overwritten on HubSpot sync; meetingNotes is manual-only
  aiSummary: text('ai_summary'),
  conversionScore: integer('conversion_score'),
  conversionScorePinned: boolean('conversion_score_pinned').notNull().default(false), // true = user explicitly set, AI must not overwrite
  conversionInsights: jsonb('conversion_insights').notNull().default([]),
  dealRisks: jsonb('deal_risks').notNull().default([]),
  todos: jsonb('todos').notNull().default([]),
  successCriteria: text('success_criteria'),
  successCriteriaTodos: jsonb('success_criteria_todos').notNull().default([]),
  successCriteriaShareToken: text('success_criteria_share_token').unique(),
  successCriteriaIsShared: boolean('success_criteria_is_shared').default(false).notNull(),
  nextSteps: text('next_steps'),
  closeDate: timestamp('close_date', { withTimezone: true }),
  wonDate: timestamp('won_date', { withTimezone: true }),
  lostDate: timestamp('lost_date', { withTimezone: true }),
  lostReason: text('lost_reason'),
  winReason: text('win_reason'),
  competitorLostTo: text('competitor_lost_to'),
  dealType: text('deal_type').notNull().default('one_off'),       // 'one_off' | 'recurring'
  recurringInterval: text('recurring_interval'),                   // 'monthly' | 'quarterly' | 'annual'
  kanbanOrder: integer('kanban_order').notNull().default(0),
  projectPlan: jsonb('project_plan'),                          // ProjectPlan JSON
  intentSignals: jsonb('intent_signals'),                      // LLM-extracted intent: champion/budget/timeline/nextMeeting
  links: jsonb('links').notNull().default([]),                  // DealLink[] — external URLs (SharePoint, Google Docs, Salesforce, etc.)
  // Migration: ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb;
  contractStartDate: timestamp('contract_start_date', { withTimezone: true }),
  contractEndDate: timestamp('contract_end_date', { withTimezone: true }),
  // Migration: ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS contract_start_date timestamptz, ADD COLUMN IF NOT EXISTS contract_end_date timestamptz;
  parentDealId: uuid('parent_deal_id'),                        // links expansion/upsell deals to their original won deal
  expansionType: text('expansion_type'),                       // 'upsell' | 'cross_sell' | 'renewal' | 'expansion' | null
  // Migration: ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS parent_deal_id uuid, ADD COLUMN IF NOT EXISTS expansion_type text;
  outcome: text('outcome'),                                    // 'won' | 'lost' | null — set when deal is closed; synced with stage field
  // Migration: ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS outcome text;
  engagementType: text('engagement_type'),                     // 'POC' | 'Pilot' | 'Live' | 'Expansion' | 'Renewal' | 'Upsell' | custom
  // Migration: ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS engagement_type text;
  scheduledEvents: jsonb('scheduled_events').notNull().default([]), // ScheduledEvent[] — extracted from meeting notes
  // Migration: ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS scheduled_events jsonb NOT NULL DEFAULT '[]'::jsonb;
  noteSource: text('note_source').default('manual'),               // 'manual' | 'email' | 'hubspot' — where the last note came from
  // Migration: ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS note_source text DEFAULT 'manual';
  noteEmbedding: text('note_embedding'),   // stored as text, cast to vector in SQL
  dealEmbedding: text('deal_embedding'),   // stored as text, cast to vector in SQL
  // Migration v25: actual column type is vector(1536) — Drizzle uses text since it lacks native vector support
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// unmatched_emails  (inbound emails that couldn't be auto-matched to a deal)
// ─────────────────────────────────────────────────────────────────────────────

export const unmatchedEmails = pgTable('unmatched_emails', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  workspaceId: text('workspace_id').notNull(),
  fromEmail: text('from_email').notNull(),
  fromName: text('from_name'),
  subject: text('subject'),
  body: text('body'),
  suggestedDealIds: jsonb('suggested_deal_ids').default([]),
  status: text('status').notNull().default('pending'),   // pending | assigned | dismissed
  assignedDealId: text('assigned_deal_id'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// signal_outcomes  (pattern memory — structured snapshots when deals close)
// ─────────────────────────────────────────────────────────────────────────────

export const signalOutcomes = pgTable('signal_outcomes', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  workspaceId: text('workspace_id').notNull(),
  dealId: text('deal_id').notNull(),
  outcome: text('outcome').notNull(), // 'won' | 'lost'
  closeDate: timestamp('close_date', { withTimezone: true }),

  // Structured signals at close time
  championIdentified: boolean('champion_identified'),
  budgetConfirmed: boolean('budget_confirmed'),
  competitorPresent: boolean('competitor_present'),
  competitorName: text('competitor_name'),
  objectionThemes: jsonb('objection_themes').default([]),
  sentimentTrajectory: text('sentiment_trajectory'), // 'improving' | 'declining' | 'stable'
  daysToClose: integer('days_to_close'),
  totalMeetings: integer('total_meetings'),
  stakeholderCount: integer('stakeholder_count'),
  dealValue: integer('deal_value'),
  stage: text('stage'),

  // Outcome context
  winReason: text('win_reason'),
  lossReason: text('loss_reason'),

  // Embedding (will be populated by Agent 2 later)
  dealEmbedding: text('deal_embedding'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// product_gaps
// ─────────────────────────────────────────────────────────────────────────────

export const productGaps = pgTable('product_gaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  priority: text('priority').notNull().default('medium'),
  frequency: integer('frequency').notNull().default(1),
  status: productGapStatusEnum('status').notNull().default('open'),
  sourceDeals: jsonb('source_deals').notNull().default([]),
  affectedRevenue: integer('affected_revenue'),
  suggestedFix: text('suggested_fix'),
  roadmap: text('roadmap'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// collateral
// ─────────────────────────────────────────────────────────────────────────────

export const collateral = pgTable('collateral', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  type: collateralTypeEnum('type').notNull(),
  title: text('title').notNull(),
  status: collateralStatusEnum('status').notNull().default('generating'),
  sourceCompetitorId: uuid('source_competitor_id').references(() => competitors.id, {
    onDelete: 'set null',
  }),
  sourceCaseStudyId: uuid('source_case_study_id').references(() => caseStudies.id, {
    onDelete: 'set null',
  }),
  sourceDealLogId: uuid('source_deal_log_id').references(() => dealLogs.id, {
    onDelete: 'set null',
  }),
  customTypeName: text('custom_type_name'),
  generationSource: text('generation_source'),
  content: jsonb('content'),
  rawResponse: jsonb('raw_response'),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  shareToken: text('share_token').unique(),
  isShared: boolean('is_shared').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// hubspot_integrations  (OAuth credentials + sync state, one per workspace)
// ─────────────────────────────────────────────────────────────────────────────

export const hubspotIntegrations = pgTable('hubspot_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .unique(),                                               // one integration per workspace
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  portalId: text('portal_id').notNull(),                    // HubSpot account identifier
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  dealsImported: integer('deals_imported').notNull().default(0),
  syncError: text('sync_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// events (activity feed)
// ─────────────────────────────────────────────────────────────────────────────

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  workspaceMemberships: many(workspaceMemberships),
  ownedWorkspaces: many(workspaces),
}))

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  memberships: many(workspaceMemberships),
  companyProfile: one(companyProfiles, { fields: [workspaces.id], references: [companyProfiles.workspaceId] }),
  competitors: many(competitors),
  caseStudies: many(caseStudies),
  dealLogs: many(dealLogs),
  collateral: many(collateral),
  events: many(events),
  productGaps: many(productGaps),
}))

export const workspaceMembershipsRelations = relations(workspaceMemberships, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMemberships.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMemberships.userId], references: [users.id] }),
}))

export const companyProfilesRelations = relations(companyProfiles, ({ one }) => ({
  workspace: one(workspaces, { fields: [companyProfiles.workspaceId], references: [workspaces.id] }),
}))

export const competitorsRelations = relations(competitors, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [competitors.workspaceId], references: [workspaces.id] }),
  collateral: many(collateral),
}))

export const caseStudiesRelations = relations(caseStudies, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [caseStudies.workspaceId], references: [workspaces.id] }),
  collateral: many(collateral),
}))

export const dealLogsRelations = relations(dealLogs, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [dealLogs.workspaceId], references: [workspaces.id] }),
  collateral: many(collateral),
}))

export const collateralRelations = relations(collateral, ({ one }) => ({
  workspace: one(workspaces, { fields: [collateral.workspaceId], references: [workspaces.id] }),
  sourceCompetitor: one(competitors, { fields: [collateral.sourceCompetitorId], references: [competitors.id] }),
  sourceCaseStudy: one(caseStudies, { fields: [collateral.sourceCaseStudyId], references: [caseStudies.id] }),
  sourceDealLog: one(dealLogs, { fields: [collateral.sourceDealLogId], references: [dealLogs.id] }),
}))

export const eventsRelations = relations(events, ({ one }) => ({
  workspace: one(workspaces, { fields: [events.workspaceId], references: [workspaces.id] }),
}))

export const productGapsRelations = relations(productGaps, ({ one }) => ({
  workspace: one(workspaces, { fields: [productGaps.workspaceId], references: [workspaces.id] }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Global transfer-learning tables  (privacy-preserving, cross-workspace pool)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-workspace consent record for contributing to the global pool.
 * Default: NOT consented (opt-in required).
 * Stores consent version so policy updates can require re-consent.
 */
export const workspaceGlobalConsent = pgTable('workspace_global_consent', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  workspaceId:        uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .unique(),
  consented:          boolean('consented').notNull().default(false),
  consentedAt:        timestamp('consented_at', { withTimezone: true }),
  consentedByUserId:  text('consented_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  consentVersion:     integer('consent_version').notNull().default(1),
  revokedAt:          timestamp('revoked_at', { withTimezone: true }),
  erasedAt:           timestamp('erased_at', { withTimezone: true }),   // set on GDPR erasure completion
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Anonymised deal outcome vectors.
 * NEVER contains PII — workspace is identified only by one-way HMAC hash.
 * Contains only 10 normalised ML feature floats + outcome (0/1) + coarse metadata.
 */
export const globalDealOutcomes = pgTable('global_deal_outcomes', {
  id:                    text('id').primaryKey(),           // sha256 fingerprint — deduplication key
  poolContributorId:     text('pool_contributor_id').notNull(),  // HMAC(workspaceId, SALT) — NOT a FK
  features:              jsonb('features').notNull(),        // number[10] matching ML_FEATURE_NAMES
  outcome:               integer('outcome').notNull(),       // 0=lost, 1=won
  dealValueBucket:       text('deal_value_bucket').notNull().default('m'),  // xs/s/m/l/xl
  stageDurationBucket:   integer('stage_duration_bucket').notNull().default(0), // days rounded to 5
  riskThemes:            jsonb('risk_themes').notNull().default([]),   // boolean[7]
  collateralUsed:        jsonb('collateral_used').notNull().default([]), // string[] type enum only
  brainVersion:          integer('brain_version').notNull().default(8),
  isErased:              boolean('is_erased').notNull().default(false),
  contributedAt:         timestamp('contributed_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Trained universal prior model.
 * Only one row is active at a time. Versions increment monotonically.
 */
export const globalMlModel = pgTable('global_ml_model', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  version:             integer('version').notNull().unique(),
  isActive:            boolean('is_active').notNull().default(false),
  weights:             jsonb('weights').notNull(),           // number[10]
  bias:                jsonb('bias').notNull(),              // stored as jsonb for portability
  featureNames:        jsonb('feature_names').notNull(),
  trainingSize:        integer('training_size').notNull(),
  looAccuracy:         jsonb('loo_accuracy').notNull(),
  featureImportance:   jsonb('feature_importance').notNull(),
  globalWinRate:       jsonb('global_win_rate').notNull(),   // 0-1
  stageVelocityP25:    jsonb('stage_velocity_p25'),
  stageVelocityP50:    jsonb('stage_velocity_p50'),
  stageVelocityP75:    jsonb('stage_velocity_p75'),
  riskThemeWinRates:   jsonb('risk_theme_win_rates'),        // number[7]
  collateralLift:      jsonb('collateral_lift'),             // {type,withRate,withoutRate}[]
  archetypeCentroids:  jsonb('archetype_centroids'),         // number[][]
  archetypeWinRates:   jsonb('archetype_win_rates'),         // number[]
  minBrainVersion:     integer('min_brain_version').notNull().default(8),
  trainedAt:           timestamp('trained_at', { withTimezone: true }).notNull().defaultNow(),
  trainingDurationMs:  integer('training_duration_ms'),
})

/**
 * Immutable audit log for all global pool events.
 * Required for GDPR compliance and SOC2 audit trail.
 */
export const globalContributionAudit = pgTable('global_contribution_audit', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  poolContributorId:   text('pool_contributor_id').notNull(),
  eventType:           text('event_type').notNull(),   // 'contributed'|'retracted'|'erased'|'consent_granted'|'consent_revoked'
  dealCount:           integer('deal_count'),
  brainVersion:        integer('brain_version'),
  metadata:            jsonb('metadata').notNull().default({}),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * 24-hour cache for cross-workspace benchmark aggregates.
 * Prevents hot aggregate queries on global_deal_outcomes at scale.
 */
export const globalBenchmarkCache = pgTable('global_benchmark_cache', {
  id:              uuid('id').primaryKey().defaultRandom(),
  cacheKey:        text('cache_key').notNull().unique(),
  data:            jsonb('data').notNull(),
  computedFromN:   integer('computed_from_n').notNull(),
  expiresAt:       timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// MCP Phase 1 — Linear bidirectional intelligence link
// ─────────────────────────────────────────────────────────────────────────────

/**
 * linear_integrations  (one per workspace — stores encrypted API key + team context)
 * Follows the same pattern as hubspot_integrations.
 */
export const linearIntegrations = pgTable('linear_integrations', {
  id:            uuid('id').primaryKey().defaultRandom(),
  workspaceId:   uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .unique(),                                               // one integration per workspace
  apiKeyEnc:     text('api_key_enc').notNull(),              // AES-256-GCM encrypted Linear API key
  teamId:        text('team_id').notNull(),                  // Linear team ID resolved on connect
  teamName:      text('team_name'),                          // Display name e.g. "Engineering"
  workspaceName: text('workspace_name'),                     // Linear workspace name e.g. "Acme"
  webhookSecret: text('webhook_secret'),                     // HMAC secret for Linear webhooks
  lastSyncAt:    timestamp('last_sync_at', { withTimezone: true }),
  syncError:     text('sync_error'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * linear_issues_cache  (denormalised Linear issues with TF-IDF embeddings)
 * Populated by the linear sync job. Embeddings live in workspace.embedding_cache (linearIssues).
 */
export const linearIssuesCache = pgTable('linear_issues_cache', {
  id:             uuid('id').primaryKey().defaultRandom(),
  workspaceId:    uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  linearIssueId:  text('linear_issue_id').notNull(),         // e.g. "ENG-36"
  linearIssueUrl: text('linear_issue_url'),
  title:          text('title').notNull(),
  description:    text('description'),
  status:         text('status'),                            // e.g. "Todo", "In Progress"
  cycleId:        text('cycle_id'),
  assigneeId:     text('assignee_id'),
  assigneeName:   text('assignee_name'),
  priority:       integer('priority').notNull().default(0), // 0=no priority,1=urgent,2=high,3=medium,4=low
  embedding:      jsonb('embedding').$type<number[]>(),     // TF-IDF vector — populated by embedLinearIssues()
  cachedAt:       timestamp('cached_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.workspaceId, t.linearIssueId),
])

/**
 * deal_linear_links  (the link between a Halvex deal and a Linear issue)
 */
export const dealLinearLinks = pgTable('deal_linear_links', {
  id:              uuid('id').primaryKey().defaultRandom(),
  workspaceId:     uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  dealId:          uuid('deal_id')
    .notNull()
    .references(() => dealLogs.id, { onDelete: 'cascade' }),
  linearIssueId:   text('linear_issue_id').notNull(),        // e.g. "ENG-36"
  linearIssueUrl:  text('linear_issue_url'),
  linearTitle:     text('linear_title'),
  relevanceScore:  integer('relevance_score').notNull().default(0), // 0-100 (scaled from 0.0-1.0)
  linkType:        text('link_type').notNull().default('feature_gap'), // 'feature_gap'|'competitor_signal'|'manual'
  status:          text('status').notNull().default('suggested'),     // 'suggested'|'confirmed'|'dismissed'|'in_cycle'|'deployed'
  scopedAt:        timestamp('scoped_at', { withTimezone: true }),
  deployedAt:      timestamp('deployed_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.dealId, t.linearIssueId),
])

/**
 * mcp_action_log  (audit trail for all MCP actions — scope, email, slack, link events)
 */
export const mcpActionLog = pgTable('mcp_action_log', {
  id:             uuid('id').primaryKey().defaultRandom(),
  workspaceId:    uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  actionType:     text('action_type').notNull(),             // 'scope_issue'|'draft_email'|'slack_notify'|'link_created'|'link_confirmed'|'link_dismissed'
  dealId:         uuid('deal_id').references(() => dealLogs.id, { onDelete: 'set null' }),
  linearIssueId:  text('linear_issue_id'),
  triggeredBy:    text('triggered_by'),                      // 'slack'|'claude'|'cron'|'webhook'|'user'
  payload:        jsonb('payload'),
  result:         jsonb('result'),
  status:         text('status').notNull().default('pending'), // 'pending'|'complete'|'error'|'awaiting_confirmation'
  slackMessageTs: text('slack_message_ts'),                  // Slack message ts — for editing the notification in-place
  slackChannelId: text('slack_channel_id'),                  // Slack channel ID for the notification message
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// MCP Phase 2 — Slack Gateway tables
// ─────────────────────────────────────────────────────────────────────────────

/**
 * slack_connections  (one per workspace — stores encrypted bot token)
 * Created by OAuth install flow. Bot token is AES-256-GCM encrypted via encrypt.ts.
 */
export const slackConnections = pgTable('slack_connections', {
  id:            uuid('id').primaryKey().defaultRandom(),
  workspaceId:   uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .unique(),                                               // one connection per workspace
  slackTeamId:   text('slack_team_id').notNull().unique(),  // e.g. "T01234567"
  slackTeamName: text('slack_team_name'),                   // e.g. "Acme Sales"
  botTokenEnc:   text('bot_token_enc').notNull(),           // AES-256-GCM encrypted bot token
  installedBy:   text('installed_by'),                      // Clerk user ID who installed
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * slack_user_mappings  (Clerk user ↔ Slack user, with per-user notification prefs)
 */
export const slackUserMappings = pgTable('slack_user_mappings', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  workspaceId:          uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  clerkUserId:          text('clerk_user_id').notNull(),    // Clerk user ID
  slackUserId:          text('slack_user_id').notNull(),    // Slack user ID e.g. "U01234567"
  notifyHealthDrops:    boolean('notify_health_drops').notNull().default(true),
  notifyIssueLinks:     boolean('notify_issue_links').notNull().default(true),
  notifyStaleDeals:     boolean('notify_stale_deals').notNull().default(true),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.workspaceId, t.clerkUserId)])

// Relations
export const linearIntegrationsRelations = relations(linearIntegrations, ({ one }) => ({
  workspace: one(workspaces, { fields: [linearIntegrations.workspaceId], references: [workspaces.id] }),
}))

export const linearIssuesCacheRelations = relations(linearIssuesCache, ({ one }) => ({
  workspace: one(workspaces, { fields: [linearIssuesCache.workspaceId], references: [workspaces.id] }),
}))

export const dealLinearLinksRelations = relations(dealLinearLinks, ({ one }) => ({
  workspace: one(workspaces, { fields: [dealLinearLinks.workspaceId], references: [workspaces.id] }),
  deal: one(dealLogs, { fields: [dealLinearLinks.dealId], references: [dealLogs.id] }),
}))

export const mcpActionLogRelations = relations(mcpActionLog, ({ one }) => ({
  workspace: one(workspaces, { fields: [mcpActionLog.workspaceId], references: [workspaces.id] }),
  deal: one(dealLogs, { fields: [mcpActionLog.dealId], references: [dealLogs.id] }),
}))

export const slackConnectionsRelations = relations(slackConnections, ({ one }) => ({
  workspace: one(workspaces, { fields: [slackConnections.workspaceId], references: [workspaces.id] }),
}))

export const slackUserMappingsRelations = relations(slackUserMappings, ({ one }) => ({
  workspace: one(workspaces, { fields: [slackUserMappings.workspaceId], references: [workspaces.id] }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Inferred row types
// ─────────────────────────────────────────────────────────────────────────────

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert

export type WorkspaceRow = typeof workspaces.$inferSelect
export type NewWorkspaceRow = typeof workspaces.$inferInsert

export type WorkspaceMembershipRow = typeof workspaceMemberships.$inferSelect
export type NewWorkspaceMembershipRow = typeof workspaceMemberships.$inferInsert

export type CompanyProfileRow = typeof companyProfiles.$inferSelect
export type NewCompanyProfileRow = typeof companyProfiles.$inferInsert

export type CompetitorRow = typeof competitors.$inferSelect
export type NewCompetitorRow = typeof competitors.$inferInsert

export type CaseStudyRow = typeof caseStudies.$inferSelect
export type NewCaseStudyRow = typeof caseStudies.$inferInsert

export type DealLogRow = typeof dealLogs.$inferSelect
export type NewDealLogRow = typeof dealLogs.$inferInsert

export type CollateralRow = typeof collateral.$inferSelect
export type NewCollateralRow = typeof collateral.$inferInsert

export type EventRow = typeof events.$inferSelect
export type NewEventRow = typeof events.$inferInsert

export type ProductGapRow = typeof productGaps.$inferSelect
export type NewProductGapRow = typeof productGaps.$inferInsert

export type UnmatchedEmailRow = typeof unmatchedEmails.$inferSelect
export type NewUnmatchedEmailRow = typeof unmatchedEmails.$inferInsert

export type WorkspaceGlobalConsentRow = typeof workspaceGlobalConsent.$inferSelect
export type NewWorkspaceGlobalConsentRow = typeof workspaceGlobalConsent.$inferInsert

export type GlobalDealOutcomeRow = typeof globalDealOutcomes.$inferSelect
export type NewGlobalDealOutcomeRow = typeof globalDealOutcomes.$inferInsert

export type GlobalMlModelRow = typeof globalMlModel.$inferSelect
export type NewGlobalMlModelRow = typeof globalMlModel.$inferInsert

export type LinearIntegrationRow = typeof linearIntegrations.$inferSelect
export type NewLinearIntegrationRow = typeof linearIntegrations.$inferInsert

export type LinearIssueCacheRow = typeof linearIssuesCache.$inferSelect
export type NewLinearIssueCacheRow = typeof linearIssuesCache.$inferInsert

export type DealLinearLinkRow = typeof dealLinearLinks.$inferSelect
export type NewDealLinearLinkRow = typeof dealLinearLinks.$inferInsert

export type McpActionLogRow = typeof mcpActionLog.$inferSelect
export type NewMcpActionLogRow = typeof mcpActionLog.$inferInsert

export type GlobalContributionAuditRow = typeof globalContributionAudit.$inferSelect
export type GlobalBenchmarkCacheRow = typeof globalBenchmarkCache.$inferSelect

export type SignalOutcomeRow = typeof signalOutcomes.$inferSelect
export type NewSignalOutcomeRow = typeof signalOutcomes.$inferInsert

export type SlackConnectionRow = typeof slackConnections.$inferSelect
export type NewSlackConnectionRow = typeof slackConnections.$inferInsert

export type SlackUserMappingRow = typeof slackUserMappings.$inferSelect
export type NewSlackUserMappingRow = typeof slackUserMappings.$inferInsert
