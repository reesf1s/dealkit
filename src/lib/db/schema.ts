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
  dealValue: integer('deal_value'),
  stage: dealStageEnum('stage').notNull().default('prospecting'),
  competitors: jsonb('competitors').notNull().default([]),
  notes: text('notes'),
  meetingNotes: text('meeting_notes'),
  aiSummary: text('ai_summary'),
  conversionScore: integer('conversion_score'),
  conversionInsights: jsonb('conversion_insights').notNull().default([]),
  todos: jsonb('todos').notNull().default([]),
  nextSteps: text('next_steps'),
  closeDate: timestamp('close_date', { withTimezone: true }),
  wonDate: timestamp('won_date', { withTimezone: true }),
  lostDate: timestamp('lost_date', { withTimezone: true }),
  lostReason: text('lost_reason'),
  dealType: text('deal_type').notNull().default('one_off'),       // 'one_off' | 'recurring'
  recurringInterval: text('recurring_interval'),                   // 'monthly' | 'quarterly' | 'annual'
  kanbanOrder: integer('kanban_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
  content: jsonb('content'),
  rawResponse: jsonb('raw_response'),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  shareToken: text('share_token').unique(),
  isShared: boolean('is_shared').default(false).notNull(),
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
