import { relations } from 'drizzle-orm'
import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

export const planEnum = pgEnum('plan', ['free', 'starter', 'pro'])
export const workspaceRoleEnum = pgEnum('workspace_role', ['owner', 'admin', 'member'])

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  plan: planEnum('plan').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workspaceMemberships = pgTable('workspace_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: workspaceRoleEnum('role').notNull().default('member'),
  appRole: text('app_role').notNull().default('sales'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [unique().on(table.workspaceId, table.userId)])

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crmLeads = pgTable('crm_leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  ownerName: text('owner_name').notNull(),
  score: integer('score').notNull().default(50),
  status: text('status').notNull().default('open'),
  stage: text('stage').notNull().default('New'),
  stageName: text('stage_name').notNull().default('New'),
  description: text('description').notNull().default(''),
  nextStep: text('next_step').notNull().default(''),
  companyName: text('company_name').notNull(),
  primaryPersonName: text('primary_person_name').notNull(),
  valueAmount: integer('value_amount').notNull().default(0),
  probability: integer('probability').notNull().default(0),
  expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
  latestActivityAt: timestamp('latest_activity_at', { withTimezone: true }),
  openTaskCount: integer('open_task_count').notNull().default(0),
  channel: text('channel').notNull().default('mail'),
  risk: text('risk').notNull().default('new'),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crmChannels = pgTable('crm_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  name: text('name').notNull(),
  connected: boolean('connected').notNull().default(false),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [unique().on(table.workspaceId, table.provider)])

export const crmMessages = pgTable('crm_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => crmLeads.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull(),
  fromRole: text('from_role').notNull(),
  body: text('body').notNull(),
  externalId: text('external_id'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crmTasks = pgTable('crm_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => crmLeads.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority').notNull().default('medium'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  companyName: text('company_name'),
  personName: text('person_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crmActivities = pgTable('crm_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => crmLeads.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  type: text('type').notNull().default('note'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  companyName: text('company_name'),
  personName: text('person_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crmAiActions = pgTable('crm_ai_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => crmLeads.id, { onDelete: 'cascade' }),
  actionType: text('action_type').notNull(),
  prompt: text('prompt').notNull().default(''),
  result: text('result').notNull(),
  model: text('model').notNull().default('fallback'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const usersRelations = relations(users, ({ many }) => ({
  workspaceMemberships: many(workspaceMemberships),
  ownedWorkspaces: many(workspaces),
  events: many(events),
}))

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  memberships: many(workspaceMemberships),
  events: many(events),
  leads: many(crmLeads),
  channels: many(crmChannels),
  messages: many(crmMessages),
  tasks: many(crmTasks),
  activities: many(crmActivities),
  aiActions: many(crmAiActions),
}))

export const workspaceMembershipsRelations = relations(workspaceMemberships, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMemberships.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMemberships.userId], references: [users.id] }),
}))

export const eventsRelations = relations(events, ({ one }) => ({
  workspace: one(workspaces, { fields: [events.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [events.userId], references: [users.id] }),
}))

export const crmLeadsRelations = relations(crmLeads, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [crmLeads.workspaceId], references: [workspaces.id] }),
  owner: one(users, { fields: [crmLeads.ownerId], references: [users.id] }),
  messages: many(crmMessages),
  tasks: many(crmTasks),
  activities: many(crmActivities),
  aiActions: many(crmAiActions),
}))

export const crmChannelsRelations = relations(crmChannels, ({ one }) => ({
  workspace: one(workspaces, { fields: [crmChannels.workspaceId], references: [workspaces.id] }),
}))

export const crmMessagesRelations = relations(crmMessages, ({ one }) => ({
  workspace: one(workspaces, { fields: [crmMessages.workspaceId], references: [workspaces.id] }),
  lead: one(crmLeads, { fields: [crmMessages.leadId], references: [crmLeads.id] }),
}))

export const crmTasksRelations = relations(crmTasks, ({ one }) => ({
  workspace: one(workspaces, { fields: [crmTasks.workspaceId], references: [workspaces.id] }),
  lead: one(crmLeads, { fields: [crmTasks.leadId], references: [crmLeads.id] }),
}))

export const crmActivitiesRelations = relations(crmActivities, ({ one }) => ({
  workspace: one(workspaces, { fields: [crmActivities.workspaceId], references: [workspaces.id] }),
  lead: one(crmLeads, { fields: [crmActivities.leadId], references: [crmLeads.id] }),
}))

export const crmAiActionsRelations = relations(crmAiActions, ({ one }) => ({
  workspace: one(workspaces, { fields: [crmAiActions.workspaceId], references: [workspaces.id] }),
  lead: one(crmLeads, { fields: [crmAiActions.leadId], references: [crmLeads.id] }),
}))

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert
export type WorkspaceRow = typeof workspaces.$inferSelect
export type NewWorkspaceRow = typeof workspaces.$inferInsert
export type WorkspaceMembershipRow = typeof workspaceMemberships.$inferSelect
export type NewWorkspaceMembershipRow = typeof workspaceMemberships.$inferInsert
export type EventRow = typeof events.$inferSelect
export type NewEventRow = typeof events.$inferInsert
export type CrmLeadRow = typeof crmLeads.$inferSelect
export type NewCrmLeadRow = typeof crmLeads.$inferInsert
export type CrmChannelRow = typeof crmChannels.$inferSelect
export type NewCrmChannelRow = typeof crmChannels.$inferInsert
export type CrmMessageRow = typeof crmMessages.$inferSelect
export type NewCrmMessageRow = typeof crmMessages.$inferInsert
export type CrmTaskRow = typeof crmTasks.$inferSelect
export type NewCrmTaskRow = typeof crmTasks.$inferInsert
export type CrmActivityRow = typeof crmActivities.$inferSelect
export type NewCrmActivityRow = typeof crmActivities.$inferInsert
export type CrmAiActionRow = typeof crmAiActions.$inferSelect
export type NewCrmAiActionRow = typeof crmAiActions.$inferInsert
