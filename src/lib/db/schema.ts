import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const planEnum = pgEnum('plan', ['free', 'starter', 'pro'])

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
// users
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),                             // Clerk user ID
  email: text('email').notNull().unique(),
  stripeCustomerId: text('stripe_customer_id'),
  plan: planEnum('plan').notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// company_profiles
// ─────────────────────────────────────────────────────────────────────────────

export const companyProfiles = pgTable('company_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),                                             // one profile per user
  companyName: text('company_name').notNull(),
  website: text('website'),
  industry: text('industry'),
  description: text('description'),
  // Array of Product objects (see src/types/index.ts)
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
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
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
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  customerName: text('customer_name').notNull(),
  customerIndustry: text('customer_industry'),
  customerSize: text('customer_size'),
  challenge: text('challenge').notNull(),
  solution: text('solution').notNull(),
  results: text('results').notNull(),
  // Array of CaseStudyMetric objects: { label, value, unit? }
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
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  dealName: text('deal_name').notNull(),
  prospectCompany: text('prospect_company').notNull(),
  prospectName: text('prospect_name'),
  prospectTitle: text('prospect_title'),
  dealValue: integer('deal_value'),                       // in cents
  stage: dealStageEnum('stage').notNull().default('prospecting'),
  competitors: jsonb('competitors').notNull().default([]), // string[]
  notes: text('notes'),
  meetingNotes: text('meeting_notes'),              // raw pasted meeting notes
  aiSummary: text('ai_summary'),                    // AI-generated deal summary
  conversionScore: integer('conversion_score'),     // 0-100 AI scoring
  conversionInsights: jsonb('conversion_insights').notNull().default([]), // string[]
  todos: jsonb('todos').notNull().default([]),       // {id,text,done,createdAt}[]
  nextSteps: text('next_steps'),
  closeDate: timestamp('close_date', { withTimezone: true }),
  wonDate: timestamp('won_date', { withTimezone: true }),
  lostDate: timestamp('lost_date', { withTimezone: true }),
  lostReason: text('lost_reason'),
  kanbanOrder: integer('kanban_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// product_gaps
// ─────────────────────────────────────────────────────────────────────────────

export const productGaps = pgTable('product_gaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  priority: text('priority').notNull().default('medium'),   // low | medium | high | critical
  frequency: integer('frequency').notNull().default(1),     // how many deals mention it
  status: productGapStatusEnum('status').notNull().default('open'),
  sourceDeals: jsonb('source_deals').notNull().default([]), // string[] deal IDs
  affectedRevenue: integer('affected_revenue'),             // estimated revenue at risk (cents)
  suggestedFix: text('suggested_fix'),                      // AI suggestion
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// collateral
// ─────────────────────────────────────────────────────────────────────────────

export const collateral = pgTable('collateral', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: collateralTypeEnum('type').notNull(),
  title: text('title').notNull(),
  status: collateralStatusEnum('status').notNull().default('generating'),
  // Optional source links
  sourceCompetitorId: uuid('source_competitor_id').references(() => competitors.id, {
    onDelete: 'set null',
  }),
  sourceCaseStudyId: uuid('source_case_study_id').references(() => caseStudies.id, {
    onDelete: 'set null',
  }),
  sourceDealLogId: uuid('source_deal_log_id').references(() => dealLogs.id, {
    onDelete: 'set null',
  }),
  // Structured content JSON (shape depends on type — see CollateralContent in types)
  content: jsonb('content'),
  // Full raw LLM response stored for debugging / regeneration
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
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  companyProfile: one(companyProfiles, {
    fields: [users.id],
    references: [companyProfiles.userId],
  }),
  competitors: many(competitors),
  caseStudies: many(caseStudies),
  dealLogs: many(dealLogs),
  collateral: many(collateral),
  events: many(events),
}))

export const companyProfilesRelations = relations(companyProfiles, ({ one }) => ({
  user: one(users, {
    fields: [companyProfiles.userId],
    references: [users.id],
  }),
}))

export const competitorsRelations = relations(competitors, ({ one, many }) => ({
  user: one(users, {
    fields: [competitors.userId],
    references: [users.id],
  }),
  collateral: many(collateral),
}))

export const caseStudiesRelations = relations(caseStudies, ({ one, many }) => ({
  user: one(users, {
    fields: [caseStudies.userId],
    references: [users.id],
  }),
  collateral: many(collateral),
}))

export const dealLogsRelations = relations(dealLogs, ({ one, many }) => ({
  user: one(users, {
    fields: [dealLogs.userId],
    references: [users.id],
  }),
  collateral: many(collateral),
}))

export const collateralRelations = relations(collateral, ({ one }) => ({
  user: one(users, {
    fields: [collateral.userId],
    references: [users.id],
  }),
  sourceCompetitor: one(competitors, {
    fields: [collateral.sourceCompetitorId],
    references: [competitors.id],
  }),
  sourceCaseStudy: one(caseStudies, {
    fields: [collateral.sourceCaseStudyId],
    references: [caseStudies.id],
  }),
  sourceDealLog: one(dealLogs, {
    fields: [collateral.sourceDealLogId],
    references: [dealLogs.id],
  }),
}))

export const eventsRelations = relations(events, ({ one }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
}))

export const productGapsRelations = relations(productGaps, ({ one }) => ({
  user: one(users, {
    fields: [productGaps.userId],
    references: [users.id],
  }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Inferred row types (useful for type-safe queries)
// ─────────────────────────────────────────────────────────────────────────────

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert

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
