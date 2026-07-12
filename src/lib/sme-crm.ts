import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  crmActivities,
  crmAiActions,
  crmChannels,
  crmLeads,
  crmMessages,
  crmTasks,
  type CrmActivityRow,
  type CrmChannelRow,
  type CrmLeadRow,
  type CrmMessageRow,
  type CrmTaskRow,
  type NewCrmActivityRow,
  type NewCrmLeadRow,
  type NewCrmMessageRow,
  type NewCrmTaskRow,
} from '@/lib/db/schema'
import {
  buildRecoveryIntelligence,
  classifyRecoveryIntent,
  type RecoveryActivity,
  type RecoveryRecord,
  type RecoveryTask,
} from '@/lib/recovery-intelligence'

export type ChannelId = 'mail' | 'linkedin' | 'webchat' | 'meetings'

export type CrmLeadDto = RecoveryRecord & {
  id: string
  owner: string
  score: number
  stage: string
  channel: ChannelId
  risk: 'hot' | 'warm' | 'new'
  notes: string
}

export type CrmMessageDto = {
  id: string
  leadId: string
  channel: ChannelId
  from: 'rep' | 'customer' | 'ai'
  text: string
  time: string
  sentAt: string
}

export type CrmChannelDto = {
  id: ChannelId
  name: string
  connected: boolean
  status: string
}

export type CrmWorkspacePayload = {
  demo?: boolean
  leads: CrmLeadDto[]
  channels: CrmChannelDto[]
  messages: Record<ChannelId, CrmMessageDto[]>
  tasks: RecoveryTask[]
  activities: RecoveryActivity[]
  intelligence: ReturnType<typeof buildRecoveryIntelligence>
}

export type LeadMutationInput = {
  title?: string
  owner?: string
  companyName?: string
  primaryPersonName?: string
  status?: string
  stage?: string
  description?: string
  nextStep?: string
  valueAmount?: number
  probability?: number
  expectedCloseDate?: string
  channel?: ChannelId
  risk?: CrmLeadDto['risk']
}

export type TaskMutationInput = {
  leadId?: string
  title?: string
  description?: string
  priority?: string
  dueAt?: string
  companyName?: string
  personName?: string
}

export type ActivityMutationInput = {
  leadId?: string
  title?: string
  body?: string
  type?: string
  companyName?: string
  personName?: string
}

const channelIds = ['mail', 'linkedin', 'webchat', 'meetings'] as const

const seedChannels = [
  { provider: 'mail', name: 'Gmail', connected: true, status: 'connected' },
  { provider: 'linkedin', name: 'LinkedIn', connected: false, status: 'oauth_pending' },
  { provider: 'webchat', name: 'Web Chat', connected: true, status: 'connected' },
  { provider: 'meetings', name: 'Calls & Meetings', connected: true, status: 'connected' },
] satisfies Array<{ provider: ChannelId; name: string; connected: boolean; status: string }>

function normalizeChannel(value: unknown): ChannelId {
  const channel = String(value ?? 'mail')
  if (channelIds.includes(channel as ChannelId)) return channel as ChannelId
  return 'mail'
}

function date(daysFromNow: number) {
  const value = new Date()
  value.setUTCDate(value.getUTCDate() + daysFromNow)
  value.setUTCHours(10, 0, 0, 0)
  return value
}

function leadSeed(workspaceId: string, ownerId: string): NewCrmLeadRow[] {
  return [
    {
      workspaceId,
      ownerId,
      title: 'Harborline Studio',
      ownerName: 'Maya Chen',
      score: 92,
      status: 'qualified',
      stage: 'Discovery',
      stageName: 'Discovery',
      description: 'Requested custom plan for 40-seat rollout. CTO asked for implementation timeline and deployment notes.',
      nextStep: 'Confirm scope and send a focused discovery package.',
      companyName: 'Harborline Studio',
      primaryPersonName: 'Maya Chen',
      valueAmount: 28000,
      probability: 76,
      expectedCloseDate: date(10),
      latestActivityAt: date(-1),
      openTaskCount: 3,
      channel: 'mail',
      risk: 'hot',
      notes: '# Harborline Studio\n- Owner: Maya Chen\n- Need implementation timeline\n- CTO wants deployment detail\n\n## Next\nSend concise discovery pack and pricing path.',
    },
    {
      workspaceId,
      ownerId,
      title: 'Northway Retail',
      ownerName: 'Jules Moreno',
      score: 84,
      status: 'discovery',
      stage: 'Proposal',
      stageName: 'Proposal',
      description: 'LinkedIn Sales Navigator lead. Wants pricing proof, implementation references, and rollout confidence.',
      nextStep: 'Send social-proof pack and ask for kickoff availability.',
      companyName: 'Northway Retail',
      primaryPersonName: 'Jules Moreno',
      valueAmount: 13200,
      probability: 54,
      expectedCloseDate: date(7),
      latestActivityAt: date(-2),
      openTaskCount: 1,
      channel: 'linkedin',
      risk: 'warm',
      notes: '# Northway Retail\n- Came from LinkedIn Sales Navigator\n- Needs implementation references\n- Ask about kickoff window',
    },
    {
      workspaceId,
      ownerId,
      title: 'Crescent Systems',
      ownerName: 'Ari Patel',
      score: 61,
      status: 'open',
      stage: 'Follow-up',
      stageName: 'Follow-up',
      description: 'Lead came from a shared spreadsheet import. Email went cold after two unanswered outreach attempts.',
      nextStep: 'Re-engage with one concrete outcome and timeline.',
      companyName: 'Crescent Systems',
      primaryPersonName: 'Ari Patel',
      valueAmount: 7200,
      probability: 34,
      latestActivityAt: date(-8),
      openTaskCount: 0,
      channel: 'webchat',
      risk: 'new',
      notes: '# Crescent Systems\n- Imported lead\n- No reply after two attempts\n- Try one specific outcome',
    },
    {
      workspaceId,
      ownerId,
      title: 'Orbit Logistics',
      ownerName: 'Sofie Grant',
      score: 70,
      status: 'qualification',
      stage: 'Negotiation',
      stageName: 'Negotiation',
      description: 'LinkedIn message from CFO. Budget available and implementation window is two weeks.',
      nextStep: 'Draft revised commercial terms and secure legal review time.',
      companyName: 'Orbit Logistics',
      primaryPersonName: 'Sofie Grant',
      valueAmount: 41000,
      probability: 64,
      expectedCloseDate: date(15),
      latestActivityAt: date(-3),
      openTaskCount: 2,
      channel: 'linkedin',
      risk: 'warm',
      notes: '# Orbit Logistics\n- CFO-led LinkedIn conversation\n- Budget exists\n- Needs revised commercial terms',
    },
  ]
}

function seededMessages(workspaceId: string, leads: CrmLeadRow[]): NewCrmMessageRow[] {
  const byTitle = new Map(leads.map(lead => [lead.title, lead]))
  return [
    { workspaceId, leadId: byTitle.get('Harborline Studio')!.id, channel: 'mail', fromRole: 'customer', body: 'Can we talk before Friday? We need numbers by end of week.', sentAt: date(-1) },
    { workspaceId, leadId: byTitle.get('Harborline Studio')!.id, channel: 'mail', fromRole: 'rep', body: 'Absolutely. I can share a 2-step rollout and pricing breakdown today.', sentAt: date(-1) },
    { workspaceId, leadId: byTitle.get('Northway Retail')!.id, channel: 'linkedin', fromRole: 'customer', body: 'I liked your one-pager. What kind of onboarding support is included?', sentAt: date(-2) },
    { workspaceId, leadId: byTitle.get('Northway Retail')!.id, channel: 'linkedin', fromRole: 'rep', body: 'I can cover implementation planning and first-week training in every plan.', sentAt: date(-2) },
    { workspaceId, leadId: byTitle.get('Orbit Logistics')!.id, channel: 'linkedin', fromRole: 'customer', body: 'Need budget-aligned option for 45 seats. Can we discuss Monday?', sentAt: date(-3) },
    { workspaceId, leadId: byTitle.get('Crescent Systems')!.id, channel: 'webchat', fromRole: 'customer', body: 'Hi there, are you available for a quick demo?', sentAt: date(-8) },
    { workspaceId, leadId: byTitle.get('Crescent Systems')!.id, channel: 'webchat', fromRole: 'rep', body: 'Yes, I can book a 20-min discovery window for tomorrow.', sentAt: date(-8) },
  ]
}

function seededTasks(workspaceId: string, leads: CrmLeadRow[]): NewCrmTaskRow[] {
  const byTitle = new Map(leads.map(lead => [lead.title, lead]))
  return [
    { workspaceId, leadId: byTitle.get('Harborline Studio')!.id, title: 'Prepare implementation timeline', description: 'Build a three-step onboarding checklist for Harborline Studio.', priority: 'high', dueAt: date(3), companyName: 'Harborline Studio', personName: 'Maya Chen' },
    { workspaceId, leadId: byTitle.get('Northway Retail')!.id, title: 'Pull case study pack', description: 'Collect references for SME implementation with 30+ users.', priority: 'medium', dueAt: date(5), companyName: 'Northway Retail', personName: 'Jules Moreno' },
    { workspaceId, leadId: byTitle.get('Orbit Logistics')!.id, title: 'Send revised commercial model', description: 'Draft a 12-week plan with rollout costs and success checkpoints.', priority: 'high', dueAt: date(6), companyName: 'Orbit Logistics', personName: 'Sofie Grant' },
  ]
}

function seededActivities(workspaceId: string, leads: CrmLeadRow[]): NewCrmActivityRow[] {
  const byTitle = new Map(leads.map(lead => [lead.title, lead]))
  return [
    { workspaceId, leadId: byTitle.get('Harborline Studio')!.id, title: 'Email opened', body: 'Recipient viewed outreach after three reminders.', type: 'engagement', occurredAt: date(-1), companyName: 'Harborline Studio', personName: 'Maya Chen' },
    { workspaceId, leadId: byTitle.get('Northway Retail')!.id, title: 'LinkedIn reply', body: 'Customer asked for deployment timeline and support availability.', type: 'reply', occurredAt: date(-2), companyName: 'Northway Retail', personName: 'Jules Moreno' },
    { workspaceId, leadId: byTitle.get('Crescent Systems')!.id, title: 'Webchat bounce', body: 'No reply after first message, lead still warm based on visit frequency.', type: 'follow_up', occurredAt: date(-5), companyName: 'Crescent Systems', personName: 'Ari Patel' },
  ]
}

export async function ensureCrmSeeded(workspaceId: string, ownerId: string) {
  const [existingLead] = await db.select({ id: crmLeads.id }).from(crmLeads).where(eq(crmLeads.workspaceId, workspaceId)).limit(1)
  if (existingLead) return

  await db.insert(crmChannels).values(seedChannels.map(channel => ({ workspaceId, ...channel }))).onConflictDoNothing()
  const insertedLeads = await db.insert(crmLeads).values(leadSeed(workspaceId, ownerId)).returning()
  await db.insert(crmMessages).values(seededMessages(workspaceId, insertedLeads))
  await db.insert(crmTasks).values(seededTasks(workspaceId, insertedLeads))
  await db.insert(crmActivities).values(seededActivities(workspaceId, insertedLeads))
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return undefined
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function leadToDto(lead: CrmLeadRow): CrmLeadDto {
  return {
    id: lead.id,
    title: lead.title,
    owner: lead.ownerName,
    score: lead.score,
    status: lead.status,
    stage: lead.stage,
    stageName: lead.stageName,
    description: lead.description,
    nextStep: lead.nextStep,
    companyName: lead.companyName,
    primaryPersonName: lead.primaryPersonName,
    valueAmount: lead.valueAmount,
    probability: lead.probability,
    expectedCloseDate: toIso(lead.expectedCloseDate),
    latestActivityAt: toIso(lead.latestActivityAt),
    openTaskCount: lead.openTaskCount,
    channel: normalizeChannel(lead.channel),
    risk: lead.risk as CrmLeadDto['risk'],
    notes: lead.notes,
  }
}

function messageToDto(message: CrmMessageRow): CrmMessageDto {
  return {
    id: message.id,
    leadId: message.leadId,
    channel: normalizeChannel(message.channel),
    from: message.fromRole as CrmMessageDto['from'],
    text: message.body,
    time: message.sentAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    sentAt: message.sentAt.toISOString(),
  }
}

function taskToRecovery(task: CrmTaskRow): RecoveryTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueAt: toIso(task.dueAt),
    companyName: task.companyName,
    personName: task.personName,
  }
}

function activityToRecovery(activity: CrmActivityRow): RecoveryActivity {
  return {
    id: activity.id,
    title: activity.title,
    body: activity.body,
    type: activity.type,
    occurredAt: toIso(activity.occurredAt),
    companyName: activity.companyName,
    personName: activity.personName,
    dealTitle: activity.companyName,
  }
}

function channelToDto(channel: CrmChannelRow): CrmChannelDto {
  return {
    id: normalizeChannel(channel.provider),
    name: channel.name,
    connected: channel.connected,
    status: channel.status,
  }
}

export async function getCrmWorkspacePayload(workspaceId: string): Promise<CrmWorkspacePayload> {
  const [leads, channels, messages, tasks, activities] = await Promise.all([
    db.select().from(crmLeads).where(eq(crmLeads.workspaceId, workspaceId)).orderBy(desc(crmLeads.score), desc(crmLeads.updatedAt)),
    db.select().from(crmChannels).where(eq(crmChannels.workspaceId, workspaceId)).orderBy(asc(crmChannels.name)),
    db.select().from(crmMessages).where(eq(crmMessages.workspaceId, workspaceId)).orderBy(asc(crmMessages.sentAt)),
    db.select().from(crmTasks).where(eq(crmTasks.workspaceId, workspaceId)).orderBy(asc(crmTasks.dueAt)),
    db.select().from(crmActivities).where(eq(crmActivities.workspaceId, workspaceId)).orderBy(desc(crmActivities.occurredAt)),
  ])

  const leadDtos = leads.map(leadToDto)
  const taskDtos = tasks.map(taskToRecovery)
  const activityDtos = activities.map(activityToRecovery)
  const groupedMessages: Record<ChannelId, CrmMessageDto[]> = {
    mail: [],
    linkedin: [],
    webchat: [],
    meetings: [],
  }
  for (const message of messages) {
    const channel = normalizeChannel(message.channel)
    groupedMessages[channel].push(messageToDto(message))
  }

  return {
    leads: leadDtos,
    channels: channels.map(channelToDto),
    messages: groupedMessages,
    tasks: taskDtos,
    activities: activityDtos,
    intelligence: buildRecoveryIntelligence({ records: leadDtos, tasks: taskDtos, activities: activityDtos }),
  }
}

export async function updateLeadNotes(input: { workspaceId: string; leadId: string; notes: string }) {
  const [lead] = await db
    .update(crmLeads)
    .set({ notes: input.notes, updatedAt: new Date() })
    .where(and(eq(crmLeads.id, input.leadId), eq(crmLeads.workspaceId, input.workspaceId)))
    .returning()

  if (!lead) return null
  return leadToDto(lead)
}

function scoreFromProbability(probability: number, risk: CrmLeadDto['risk']) {
  const riskLift = risk === 'hot' ? 12 : risk === 'warm' ? 4 : 0
  return Math.max(1, Math.min(99, Math.round(probability * 0.8 + riskLift)))
}

function cleanLeadInput(input: LeadMutationInput) {
  const probability = Number.isFinite(input.probability) ? Math.max(0, Math.min(100, Math.round(input.probability!))) : undefined
  const valueAmount = Number.isFinite(input.valueAmount) ? Math.max(0, Math.round(input.valueAmount!)) : undefined
  const expectedCloseDate = input.expectedCloseDate ? new Date(input.expectedCloseDate) : undefined
  return {
    title: input.title?.trim(),
    ownerName: input.owner?.trim(),
    companyName: input.companyName?.trim(),
    primaryPersonName: input.primaryPersonName?.trim(),
    status: input.status === 'open' || input.status === 'qualified' || input.status === 'discovery' || input.status === 'qualification' || input.status === 'won' || input.status === 'lost' ? input.status : undefined,
    stage: input.stage?.trim(),
    stageName: input.stage?.trim(),
    description: input.description?.trim(),
    nextStep: input.nextStep?.trim(),
    valueAmount,
    probability,
    expectedCloseDate: expectedCloseDate && !Number.isNaN(expectedCloseDate.getTime()) ? expectedCloseDate : undefined,
    channel: input.channel,
    risk: input.risk,
  }
}

function cleanTaskInput(input: TaskMutationInput) {
  const dueAt = input.dueAt ? new Date(input.dueAt) : undefined
  return {
    leadId: input.leadId?.trim(),
    title: input.title?.trim(),
    description: input.description?.trim(),
    priority: input.priority === 'high' || input.priority === 'medium' || input.priority === 'low' ? input.priority : 'medium',
    dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : undefined,
    companyName: input.companyName?.trim(),
    personName: input.personName?.trim(),
  }
}

function cleanActivityInput(input: ActivityMutationInput) {
  return {
    leadId: input.leadId?.trim(),
    title: input.title?.trim(),
    body: input.body?.trim(),
    type: input.type === 'call' || input.type === 'meeting' || input.type === 'email' || input.type === 'note' || input.type === 'intent' || input.type === 'risk' ? input.type : 'meeting',
    companyName: input.companyName?.trim(),
    personName: input.personName?.trim(),
  }
}

function demoId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export function createDemoCrmLead(data: LeadMutationInput): CrmLeadDto {
  const cleaned = cleanLeadInput(data)
  const risk = cleaned.risk ?? 'new'
  const probability = cleaned.probability ?? 25
  const title = cleaned.title || cleaned.companyName || 'New lead'
  const companyName = cleaned.companyName || title
  const personName = cleaned.primaryPersonName || 'New contact'
  const nextStep = cleaned.nextStep || 'Qualify the opportunity and confirm the next step.'

  return {
    id: demoId('demo-lead'),
    title,
    owner: cleaned.ownerName || 'Sales owner',
    score: scoreFromProbability(probability, risk),
    status: cleaned.status || 'open',
    stage: cleaned.stage || 'New',
    stageName: cleaned.stageName || cleaned.stage || 'New',
    description: cleaned.description || 'New opportunity created from the CRM canvas.',
    nextStep,
    companyName,
    primaryPersonName: personName,
    valueAmount: cleaned.valueAmount ?? 0,
    probability,
    expectedCloseDate: (cleaned.expectedCloseDate ?? date(14)).toISOString(),
    latestActivityAt: new Date().toISOString(),
    openTaskCount: 0,
    channel: cleaned.channel ?? 'mail',
    risk,
    notes: `# ${title}\n- Contact: ${personName}\n- Company: ${companyName}\n- Next step: ${nextStep}`,
  }
}

export function createDemoCrmMessage(input: {
  leadId: string
  channel: ChannelId
  from?: CrmMessageDto['from']
  text: string
}): CrmMessageDto {
  const sentAt = new Date()

  return {
    id: demoId('demo-msg'),
    leadId: input.leadId,
    channel: input.channel,
    from: input.from ?? 'rep',
    text: input.text,
    time: sentAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    sentAt: sentAt.toISOString(),
  }
}

function createDemoCrmTask(input: TaskMutationInput): RecoveryTask {
  const cleaned = cleanTaskInput(input)
  const dueAt = cleaned.dueAt ?? date(3)

  return {
    id: demoId('demo-task'),
    title: cleaned.title || 'Follow up with buyer',
    description: cleaned.description || 'Complete the next sales action and update the deal record.',
    priority: cleaned.priority,
    dueAt: dueAt.toISOString(),
    companyName: cleaned.companyName || 'New account',
    personName: cleaned.personName || 'Buyer',
  }
}

function createDemoCrmActivity(input: ActivityMutationInput): RecoveryActivity {
  const cleaned = cleanActivityInput(input)

  return {
    id: demoId('demo-activity'),
    title: cleaned.title || 'Customer meeting logged',
    body: cleaned.body || 'Captured a customer interaction and linked it back to the active deal.',
    type: cleaned.type,
    occurredAt: new Date().toISOString(),
    companyName: cleaned.companyName || 'New account',
    personName: cleaned.personName || 'Buyer',
    dealTitle: cleaned.companyName || 'New account',
  }
}

export function updateDemoCrmLeadNotes(input: { leadId: string; notes: string }) {
  const lead = getDemoCrmWorkspacePayload().leads.find(candidate => candidate.id === input.leadId)
  if (!lead) return null

  return {
    ...lead,
    notes: input.notes,
    latestActivityAt: new Date().toISOString(),
  }
}

export function setDemoChannelConnection(provider: ChannelId, connected: boolean): CrmChannelDto {
  const existing = seedChannels.find(channel => channel.provider === provider)

  return {
    id: provider,
    name: existing?.name ?? provider,
    connected,
    status: connected ? 'connected' : 'oauth_pending',
  }
}

export async function createCrmLead(input: { workspaceId: string; ownerId: string; data: LeadMutationInput }) {
  const data = cleanLeadInput(input.data)
  const risk = data.risk ?? 'new'
  const probability = data.probability ?? 25
  const title = data.title || data.companyName || 'New lead'
  const companyName = data.companyName || title
  const personName = data.primaryPersonName || 'New contact'
  const nextStep = data.nextStep || 'Qualify the opportunity and confirm the next step.'

  const [lead] = await db.insert(crmLeads).values({
    workspaceId: input.workspaceId,
    ownerId: input.ownerId,
    title,
    ownerName: data.ownerName || 'Sales owner',
    score: scoreFromProbability(probability, risk),
    status: data.status || 'open',
    stage: data.stage || 'New',
    stageName: data.stageName || data.stage || 'New',
    description: data.description || 'New opportunity created from the CRM canvas.',
    nextStep,
    companyName,
    primaryPersonName: personName,
    valueAmount: data.valueAmount ?? 0,
    probability,
    expectedCloseDate: data.expectedCloseDate ?? date(14),
    latestActivityAt: new Date(),
    openTaskCount: 0,
    channel: data.channel ?? 'mail',
    risk,
    notes: `# ${title}\n- Contact: ${personName}\n- Company: ${companyName}\n- Next step: ${nextStep}`,
  }).returning()

  return leadToDto(lead)
}

export async function updateCrmLead(input: { workspaceId: string; leadId: string; data: LeadMutationInput }) {
  const data = cleanLeadInput(input.data)
  const [existing] = await db
    .select()
    .from(crmLeads)
    .where(and(eq(crmLeads.id, input.leadId), eq(crmLeads.workspaceId, input.workspaceId)))
    .limit(1)

  if (!existing) return null

  const risk = data.risk ?? existing.risk as CrmLeadDto['risk']
  const probability = data.probability ?? existing.probability
  const [lead] = await db
    .update(crmLeads)
    .set({
      title: data.title || existing.title,
      ownerName: data.ownerName || existing.ownerName,
      companyName: data.companyName || existing.companyName,
      primaryPersonName: data.primaryPersonName || existing.primaryPersonName,
      status: data.status || existing.status,
      stage: data.stage || existing.stage,
      stageName: data.stageName || existing.stageName,
      description: data.description ?? existing.description,
      nextStep: data.nextStep ?? existing.nextStep,
      valueAmount: data.valueAmount ?? existing.valueAmount,
      probability,
      expectedCloseDate: data.expectedCloseDate ?? existing.expectedCloseDate,
      channel: data.channel ?? existing.channel,
      risk,
      score: scoreFromProbability(probability, risk),
      updatedAt: new Date(),
    })
    .where(and(eq(crmLeads.id, input.leadId), eq(crmLeads.workspaceId, input.workspaceId)))
    .returning()

  return lead ? leadToDto(lead) : null
}

export async function deleteCrmLead(input: { workspaceId: string; leadId: string }) {
  const [lead] = await db
    .delete(crmLeads)
    .where(and(eq(crmLeads.id, input.leadId), eq(crmLeads.workspaceId, input.workspaceId)))
    .returning()

  return lead ? leadToDto(lead) : null
}

export async function createCrmTask(input: { workspaceId: string; data: TaskMutationInput }) {
  const data = cleanTaskInput(input.data)
  let lead: CrmLeadRow | undefined

  if (data.leadId) {
    const [candidate] = await db
      .select()
      .from(crmLeads)
      .where(and(eq(crmLeads.id, data.leadId), eq(crmLeads.workspaceId, input.workspaceId)))
      .limit(1)
    lead = candidate
  }

  const [task] = await db.insert(crmTasks).values({
    workspaceId: input.workspaceId,
    leadId: lead?.id,
    title: data.title || 'Follow up with buyer',
    description: data.description || 'Complete the next sales action and update the deal record.',
    priority: data.priority,
    dueAt: data.dueAt ?? date(3),
    companyName: data.companyName || lead?.companyName || null,
    personName: data.personName || lead?.primaryPersonName || null,
  }).returning()

  if (lead) {
    await db
      .update(crmLeads)
      .set({ openTaskCount: lead.openTaskCount + 1, updatedAt: new Date() })
      .where(and(eq(crmLeads.id, lead.id), eq(crmLeads.workspaceId, input.workspaceId)))
  }

  return taskToRecovery(task)
}

export async function completeCrmTask(input: { workspaceId: string; taskId: string }) {
  const [task] = await db
    .select()
    .from(crmTasks)
    .where(and(eq(crmTasks.id, input.taskId), eq(crmTasks.workspaceId, input.workspaceId)))
    .limit(1)

  if (!task) return null

  await db
    .delete(crmTasks)
    .where(and(eq(crmTasks.id, input.taskId), eq(crmTasks.workspaceId, input.workspaceId)))

  if (task.leadId) {
    const [lead] = await db
      .select()
      .from(crmLeads)
      .where(and(eq(crmLeads.id, task.leadId), eq(crmLeads.workspaceId, input.workspaceId)))
      .limit(1)

    if (lead) {
      await db
        .update(crmLeads)
        .set({ openTaskCount: Math.max(0, lead.openTaskCount - 1), updatedAt: new Date() })
        .where(and(eq(crmLeads.id, lead.id), eq(crmLeads.workspaceId, input.workspaceId)))
    }
  }

  return taskToRecovery(task)
}

export async function createCrmActivity(input: { workspaceId: string; data: ActivityMutationInput }) {
  const data = cleanActivityInput(input.data)
  let lead: CrmLeadRow | undefined

  if (data.leadId) {
    const [candidate] = await db
      .select()
      .from(crmLeads)
      .where(and(eq(crmLeads.id, data.leadId), eq(crmLeads.workspaceId, input.workspaceId)))
      .limit(1)
    lead = candidate
  }

  const [activity] = await db.insert(crmActivities).values({
    workspaceId: input.workspaceId,
    leadId: lead?.id,
    title: data.title || 'Customer meeting logged',
    body: data.body || 'Captured a customer interaction and linked it back to the active deal.',
    type: data.type,
    occurredAt: new Date(),
    companyName: data.companyName || lead?.companyName || null,
    personName: data.personName || lead?.primaryPersonName || null,
  }).returning()

  if (lead) {
    await db
      .update(crmLeads)
      .set({ latestActivityAt: new Date(), updatedAt: new Date() })
      .where(and(eq(crmLeads.id, lead.id), eq(crmLeads.workspaceId, input.workspaceId)))
  }

  return activityToRecovery(activity)
}

export async function deleteCrmActivity(input: { workspaceId: string; activityId: string }) {
  const [activity] = await db
    .delete(crmActivities)
    .where(and(eq(crmActivities.id, input.activityId), eq(crmActivities.workspaceId, input.workspaceId)))
    .returning()

  return activity ? activityToRecovery(activity) : null
}

export async function createCrmMessage(input: { workspaceId: string; leadId: string; channel: ChannelId; from: CrmMessageDto['from']; text: string }) {
  const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, input.leadId)).limit(1)
  if (!lead || lead.workspaceId !== input.workspaceId) return null

  const [message] = await db.insert(crmMessages).values({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    channel: input.channel,
    fromRole: input.from,
    body: input.text,
    sentAt: new Date(),
  }).returning()

  await db.update(crmLeads).set({ latestActivityAt: new Date(), updatedAt: new Date(), channel: input.channel }).where(eq(crmLeads.id, input.leadId))
  return messageToDto(message)
}

export async function getLeadForWorkspace(workspaceId: string, leadId: string) {
  const [lead] = await db
    .select()
    .from(crmLeads)
    .where(and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)))
    .limit(1)

  return lead ? leadToDto(lead) : null
}

export async function setChannelConnection(input: { workspaceId: string; provider: ChannelId; connected: boolean }) {
  const [channel] = await db
    .insert(crmChannels)
    .values({
      workspaceId: input.workspaceId,
      provider: input.provider,
      name: seedChannels.find(channel => channel.provider === input.provider)?.name ?? input.provider,
      connected: input.connected,
      status: input.connected ? 'connected' : 'oauth_pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [crmChannels.workspaceId, crmChannels.provider],
      set: {
        connected: input.connected,
        status: input.connected ? 'connected' : 'oauth_pending',
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!channel) return null
  return channelToDto(channel)
}

export function buildFallbackDraft(lead: CrmLeadDto, intent = classifyRecoveryIntent(lead)) {
  const action =
    intent === 'reduce_no_show'
      ? 'confirm the decision window and remove any implementation risk'
      : intent === 'upsell'
        ? 'anchor the stronger rollout package around the business outcome'
        : intent === 'rebook'
        ? 'lock the next conversation into the diary'
        : 'move this to one clear next milestone'
  const nextStep = (lead.nextStep || 'scope, timeline, and next actions').trim().replace(/[.!?]+$/, '')

  return `Hi ${lead.primaryPersonName}, quick follow-up on ${lead.companyName}.\n\nBased on what you shared, I think the cleanest next step is to ${action}. I can send a focused plan covering ${nextStep}.\n\nWould a 20-minute walkthrough this week work?`
}

export async function recordAiDraft(input: { workspaceId: string; leadId: string; prompt: string; result: string; model: string }) {
  await db.insert(crmAiActions).values({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    actionType: 'draft_reply',
    prompt: input.prompt,
    result: input.result,
    model: input.model,
  })
}

type DemoGlobal = typeof globalThis & {
  __halvexDemoWorkspace?: CrmWorkspacePayload
}

const demoGlobal = globalThis as DemoGlobal

function refreshDemoWorkspace(workspace: CrmWorkspacePayload) {
  workspace.demo = true
  workspace.intelligence = buildRecoveryIntelligence({ records: workspace.leads, tasks: workspace.tasks, activities: workspace.activities })
  return workspace
}

export function getDemoCrmWorkspaceState(): CrmWorkspacePayload {
  if (!demoGlobal.__halvexDemoWorkspace) {
    demoGlobal.__halvexDemoWorkspace = getDemoCrmWorkspacePayload()
  }

  return refreshDemoWorkspace(demoGlobal.__halvexDemoWorkspace)
}

export function getDemoCrmLead(leadId: string) {
  return getDemoCrmWorkspaceState().leads.find(lead => lead.id === leadId) ?? null
}

export function addDemoCrmLead(data: LeadMutationInput) {
  const workspace = getDemoCrmWorkspaceState()
  const lead = createDemoCrmLead(data)
  workspace.leads = [lead, ...workspace.leads]
  workspace.messages = {
    ...workspace.messages,
    [lead.channel]: workspace.messages[lead.channel] ?? [],
  }
  refreshDemoWorkspace(workspace)
  return lead
}

export function addDemoCrmMessage(input: { leadId: string; channel: ChannelId; from?: CrmMessageDto['from']; text: string }) {
  const workspace = getDemoCrmWorkspaceState()
  const lead = workspace.leads.find(candidate => candidate.id === input.leadId)
  const message = createDemoCrmMessage(input)

  if (!lead) return message

  workspace.messages = {
    ...workspace.messages,
    [message.channel]: [...(workspace.messages[message.channel] ?? []), message],
  }
  workspace.leads = workspace.leads.map(candidate => candidate.id === input.leadId ? { ...candidate, latestActivityAt: message.sentAt, channel: message.channel } : candidate)
  refreshDemoWorkspace(workspace)
  return message
}

export function updateDemoCrmLead(input: { leadId: string; data: LeadMutationInput }) {
  const workspace = getDemoCrmWorkspaceState()
  const existing = workspace.leads.find(candidate => candidate.id === input.leadId)
  if (!existing) return null

  const cleaned = cleanLeadInput(input.data)
  const risk = cleaned.risk ?? existing.risk
  const probability = cleaned.probability ?? Number(existing.probability ?? 0)
  const updated: CrmLeadDto = {
    ...existing,
    title: cleaned.title || existing.title,
    owner: cleaned.ownerName || existing.owner,
    companyName: cleaned.companyName || existing.companyName,
    primaryPersonName: cleaned.primaryPersonName || existing.primaryPersonName,
    status: cleaned.status || existing.status,
    stage: cleaned.stage || existing.stage,
    stageName: cleaned.stageName || existing.stageName,
    description: cleaned.description ?? existing.description,
    nextStep: cleaned.nextStep ?? existing.nextStep,
    valueAmount: cleaned.valueAmount ?? existing.valueAmount,
    probability,
    expectedCloseDate: cleaned.expectedCloseDate ? cleaned.expectedCloseDate.toISOString() : existing.expectedCloseDate,
    channel: cleaned.channel ?? existing.channel,
    risk,
    score: scoreFromProbability(probability, risk),
    latestActivityAt: new Date().toISOString(),
  }

  workspace.leads = workspace.leads.map(candidate => candidate.id === input.leadId ? updated : candidate)
  refreshDemoWorkspace(workspace)
  return updated
}

export function deleteDemoCrmLead(leadId: string) {
  const workspace = getDemoCrmWorkspaceState()
  const lead = workspace.leads.find(candidate => candidate.id === leadId)
  if (!lead) return null

  workspace.leads = workspace.leads.filter(candidate => candidate.id !== leadId)
  workspace.messages = Object.fromEntries(
    Object.entries(workspace.messages).map(([channel, messages]) => [
      channel,
      messages.filter(message => message.leadId !== leadId),
    ]),
  ) as Record<ChannelId, CrmMessageDto[]>
  workspace.tasks = workspace.tasks.filter(task => task.companyName !== lead.companyName && task.personName !== lead.primaryPersonName)
  workspace.activities = workspace.activities.filter(activity => activity.companyName !== lead.companyName && activity.personName !== lead.primaryPersonName)
  refreshDemoWorkspace(workspace)
  return lead
}

export function addDemoCrmTask(input: TaskMutationInput) {
  const workspace = getDemoCrmWorkspaceState()
  const lead = input.leadId ? workspace.leads.find(candidate => candidate.id === input.leadId) : undefined
  const task = createDemoCrmTask({
    ...input,
    companyName: input.companyName || lead?.companyName || undefined,
    personName: input.personName || lead?.primaryPersonName || undefined,
  })

  workspace.tasks = [task, ...workspace.tasks]
  if (lead) {
    workspace.leads = workspace.leads.map(candidate => (
      candidate.id === lead.id ? { ...candidate, openTaskCount: Number(candidate.openTaskCount ?? 0) + 1 } : candidate
    ))
  }
  refreshDemoWorkspace(workspace)
  return task
}

export function completeDemoCrmTask(taskId: string) {
  const workspace = getDemoCrmWorkspaceState()
  const task = workspace.tasks.find(candidate => candidate.id === taskId)
  if (!task) return null

  workspace.tasks = workspace.tasks.filter(candidate => candidate.id !== taskId)
  if (task.companyName) {
    workspace.leads = workspace.leads.map(candidate => (
      candidate.companyName === task.companyName
        ? { ...candidate, openTaskCount: Math.max(0, Number(candidate.openTaskCount ?? 0) - 1) }
        : candidate
    ))
  }
  refreshDemoWorkspace(workspace)
  return task
}

export function addDemoCrmActivity(input: ActivityMutationInput) {
  const workspace = getDemoCrmWorkspaceState()
  const lead = input.leadId ? workspace.leads.find(candidate => candidate.id === input.leadId) : undefined
  const activity = createDemoCrmActivity({
    ...input,
    companyName: input.companyName || lead?.companyName || undefined,
    personName: input.personName || lead?.primaryPersonName || undefined,
  })

  workspace.activities = [activity, ...workspace.activities]
  if (lead) {
    workspace.leads = workspace.leads.map(candidate => (
      candidate.id === lead.id ? { ...candidate, latestActivityAt: activity.occurredAt } : candidate
    ))
  }
  refreshDemoWorkspace(workspace)
  return activity
}

export function deleteDemoCrmActivity(activityId: string) {
  const workspace = getDemoCrmWorkspaceState()
  const activity = workspace.activities.find(candidate => candidate.id === activityId)
  if (!activity) return null

  workspace.activities = workspace.activities.filter(candidate => candidate.id !== activityId)
  refreshDemoWorkspace(workspace)
  return activity
}

export function saveDemoCrmLeadNotes(input: { leadId: string; notes: string }) {
  const workspace = getDemoCrmWorkspaceState()
  const lead = workspace.leads.find(candidate => candidate.id === input.leadId)
  if (!lead) {
    return {
      id: input.leadId,
      notes: input.notes,
      latestActivityAt: new Date().toISOString(),
    }
  }

  const updated = {
    ...lead,
    notes: input.notes,
    latestActivityAt: new Date().toISOString(),
  }
  workspace.leads = workspace.leads.map(candidate => candidate.id === input.leadId ? updated : candidate)
  refreshDemoWorkspace(workspace)
  return updated
}

export function updateDemoChannelConnection(provider: ChannelId, connected: boolean) {
  const workspace = getDemoCrmWorkspaceState()
  const channel = setDemoChannelConnection(provider, connected)
  const exists = workspace.channels.some(candidate => candidate.id === provider)
  workspace.channels = exists
    ? workspace.channels.map(candidate => candidate.id === provider ? channel : candidate)
    : [...workspace.channels, channel]
  refreshDemoWorkspace(workspace)
  return channel
}

function demoMessage(input: { id: string; leadId: string; channel: ChannelId; from: CrmMessageDto['from']; text: string; daysAgo: number }): CrmMessageDto {
  const sentAt = date(-input.daysAgo)
  return {
    id: input.id,
    leadId: input.leadId,
    channel: input.channel,
    from: input.from,
    text: input.text,
    time: sentAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    sentAt: sentAt.toISOString(),
  }
}

export function getDemoCrmWorkspacePayload(): CrmWorkspacePayload {
  const leads: CrmLeadDto[] = [
    {
      id: 'demo-solstice',
      title: 'Solstice Dental Group',
      owner: 'Nina Frost',
      score: 94,
      status: 'qualified',
      stage: 'Evaluation',
      stageName: 'Evaluation',
      description: 'Owner is comparing Halvex against Gong for call intelligence. Budget is available this month, but legal needs security notes before Friday.',
      nextStep: 'Book decision call with owner and send security notes plus Gong comparison.',
      companyName: 'Solstice Dental Group',
      primaryPersonName: 'Nina Frost',
      valueAmount: 36000,
      probability: 72,
      expectedCloseDate: date(8).toISOString(),
      latestActivityAt: date(-1).toISOString(),
      openTaskCount: 3,
      channel: 'meetings',
      risk: 'hot',
      notes: '# Solstice Dental Group\n- Comparing Halvex against Gong\n- Budget available this month\n- Legal wants security notes\n\n## Next\nBook the owner decision call and send the Gong comparison.',
    },
    {
      id: 'demo-harborline',
      title: 'Harborline Studio',
      owner: 'Maya Chen',
      score: 92,
      status: 'qualified',
      stage: 'Discovery',
      stageName: 'Discovery',
      description: 'Requested custom plan for 40-seat rollout. CTO asked for implementation timeline and deployment notes.',
      nextStep: 'Confirm scope and send a focused discovery package.',
      companyName: 'Harborline Studio',
      primaryPersonName: 'Maya Chen',
      valueAmount: 28000,
      probability: 76,
      expectedCloseDate: date(10).toISOString(),
      latestActivityAt: date(-1).toISOString(),
      openTaskCount: 3,
      channel: 'mail',
      risk: 'hot',
      notes: '# Harborline Studio\n- Owner: Maya Chen\n- Need implementation timeline\n- CTO wants deployment detail\n\n## Next\nSend concise discovery pack and pricing path.',
    },
    {
      id: 'demo-northway',
      title: 'Northway Retail',
      owner: 'Jules Moreno',
      score: 84,
      status: 'discovery',
      stage: 'Proposal',
      stageName: 'Proposal',
      description: 'LinkedIn Sales Navigator lead. Wants pricing proof, implementation references, and rollout confidence.',
      nextStep: 'Send social-proof pack and ask for kickoff availability.',
      companyName: 'Northway Retail',
      primaryPersonName: 'Jules Moreno',
      valueAmount: 13200,
      probability: 54,
      expectedCloseDate: date(7).toISOString(),
      latestActivityAt: date(-2).toISOString(),
      openTaskCount: 1,
      channel: 'linkedin',
      risk: 'warm',
      notes: '# Northway Retail\n- Came from LinkedIn Sales Navigator\n- Needs implementation references\n- Ask about kickoff window',
    },
    {
      id: 'demo-crescent',
      title: 'Crescent Systems',
      owner: 'Ari Patel',
      score: 61,
      status: 'open',
      stage: 'Follow-up',
      stageName: 'Follow-up',
      description: 'Lead came from a shared spreadsheet import. Email went cold after two unanswered outreach attempts.',
      nextStep: 'Re-engage with one concrete outcome and timeline.',
      companyName: 'Crescent Systems',
      primaryPersonName: 'Ari Patel',
      valueAmount: 7200,
      probability: 34,
      latestActivityAt: date(-8).toISOString(),
      openTaskCount: 0,
      channel: 'webchat',
      risk: 'new',
      notes: '# Crescent Systems\n- Imported lead\n- No reply after two attempts\n- Try one specific outcome',
    },
    {
      id: 'demo-orbit',
      title: 'Orbit Logistics',
      owner: 'Sofie Grant',
      score: 70,
      status: 'qualification',
      stage: 'Negotiation',
      stageName: 'Negotiation',
      description: 'LinkedIn message from CFO. Budget available and implementation window is two weeks.',
      nextStep: 'Draft revised commercial terms and secure legal review time.',
      companyName: 'Orbit Logistics',
      primaryPersonName: 'Sofie Grant',
      valueAmount: 41000,
      probability: 64,
      expectedCloseDate: date(15).toISOString(),
      latestActivityAt: date(-3).toISOString(),
      openTaskCount: 2,
      channel: 'linkedin',
      risk: 'warm',
      notes: '# Orbit Logistics\n- CFO-led LinkedIn conversation\n- Budget exists\n- Needs revised commercial terms',
    },
  ]

  const messages: Record<ChannelId, CrmMessageDto[]> = {
    mail: [
      demoMessage({ id: 'demo-msg-1', leadId: 'demo-harborline', channel: 'mail', from: 'customer', text: 'Can we talk before Friday? We need numbers by end of week.', daysAgo: 1 }),
      demoMessage({ id: 'demo-msg-2', leadId: 'demo-harborline', channel: 'mail', from: 'rep', text: 'Absolutely. I can share a 2-step rollout and pricing breakdown today.', daysAgo: 1 }),
    ],
    meetings: [
      demoMessage({ id: 'demo-msg-solstice-1', leadId: 'demo-solstice', channel: 'meetings', from: 'customer', text: 'Gong feels too heavy for a small team. Can Halvex cover call notes, transcripts, and follow-ups without another admin layer?', daysAgo: 1 }),
      demoMessage({ id: 'demo-msg-solstice-2', leadId: 'demo-solstice', channel: 'meetings', from: 'rep', text: 'Yes. Halvex keeps transcript capture, next action, and forecast signal in one workspace so reps do not switch tools.', daysAgo: 1 }),
      demoMessage({ id: 'demo-msg-solstice-3', leadId: 'demo-solstice', channel: 'meetings', from: 'customer', text: 'Good. We have budget this month, but legal needs security notes and the owner wants a Friday decision call.', daysAgo: 1 }),
    ],
    linkedin: [
      demoMessage({ id: 'demo-msg-3', leadId: 'demo-northway', channel: 'linkedin', from: 'customer', text: 'I liked your one-pager. What kind of onboarding support is included?', daysAgo: 2 }),
      demoMessage({ id: 'demo-msg-4', leadId: 'demo-northway', channel: 'linkedin', from: 'rep', text: 'I can cover implementation planning and first-week training in every plan.', daysAgo: 2 }),
      demoMessage({ id: 'demo-msg-5', leadId: 'demo-orbit', channel: 'linkedin', from: 'customer', text: 'Need budget-aligned option for 45 seats. Can we discuss Monday?', daysAgo: 3 }),
    ],
    webchat: [
      demoMessage({ id: 'demo-msg-6', leadId: 'demo-crescent', channel: 'webchat', from: 'customer', text: 'Hi there, are you available for a quick demo?', daysAgo: 8 }),
      demoMessage({ id: 'demo-msg-7', leadId: 'demo-crescent', channel: 'webchat', from: 'rep', text: 'Yes, I can book a 20-min discovery window for tomorrow.', daysAgo: 8 }),
    ],
  }

  const tasks: RecoveryTask[] = [
    { id: 'demo-task-solstice-1', title: 'Send security notes and Gong comparison', description: 'Package security posture, call intelligence workflow, and admin-light deployment plan.', priority: 'high', dueAt: date(1).toISOString(), companyName: 'Solstice Dental Group', personName: 'Nina Frost' },
    { id: 'demo-task-solstice-2', title: 'Book owner decision call', description: 'Confirm Friday slot with owner and legal stakeholder.', priority: 'high', dueAt: date(2).toISOString(), companyName: 'Solstice Dental Group', personName: 'Nina Frost' },
    { id: 'demo-task-1', title: 'Prepare implementation timeline', description: 'Build a three-step onboarding checklist for Harborline Studio.', priority: 'high', dueAt: date(3).toISOString(), companyName: 'Harborline Studio', personName: 'Maya Chen' },
    { id: 'demo-task-2', title: 'Pull case study pack', description: 'Collect references for SME implementation with 30+ users.', priority: 'medium', dueAt: date(5).toISOString(), companyName: 'Northway Retail', personName: 'Jules Moreno' },
    { id: 'demo-task-3', title: 'Send revised commercial model', description: 'Draft a 12-week plan with rollout costs and success checkpoints.', priority: 'high', dueAt: date(6).toISOString(), companyName: 'Orbit Logistics', personName: 'Sofie Grant' },
  ]

  const activities: RecoveryActivity[] = [
    { id: 'demo-activity-solstice-1', title: 'Competitor mentioned', body: 'Buyer compared Halvex with Gong and objected to workflow weight for a small sales team.', type: 'call_signal', occurredAt: date(-1).toISOString(), companyName: 'Solstice Dental Group', personName: 'Nina Frost', dealTitle: 'Solstice Dental Group' },
    { id: 'demo-activity-solstice-2', title: 'Decision window captured', body: 'Owner wants a Friday decision call after legal reviews security notes.', type: 'intent', occurredAt: date(-1).toISOString(), companyName: 'Solstice Dental Group', personName: 'Nina Frost', dealTitle: 'Solstice Dental Group' },
    { id: 'demo-activity-1', title: 'Email opened', body: 'Recipient viewed outreach after three reminders.', type: 'engagement', occurredAt: date(-1).toISOString(), companyName: 'Harborline Studio', personName: 'Maya Chen', dealTitle: 'Harborline Studio' },
    { id: 'demo-activity-2', title: 'LinkedIn reply', body: 'Customer asked for deployment timeline and support availability.', type: 'reply', occurredAt: date(-2).toISOString(), companyName: 'Northway Retail', personName: 'Jules Moreno', dealTitle: 'Northway Retail' },
    { id: 'demo-activity-3', title: 'Webchat bounce', body: 'No reply after first message, lead still warm based on visit frequency.', type: 'follow_up', occurredAt: date(-5).toISOString(), companyName: 'Crescent Systems', personName: 'Ari Patel', dealTitle: 'Crescent Systems' },
  ]

  return {
    demo: true,
    leads,
    channels: seedChannels.map(channel => ({ id: channel.provider, name: channel.name, connected: channel.connected, status: channel.status })),
    messages,
    tasks,
    activities,
    intelligence: buildRecoveryIntelligence({ records: leads, tasks, activities }),
  }
}

export function getSeedCrmWorkspacePayload(): CrmWorkspacePayload {
  return { ...getDemoCrmWorkspacePayload(), demo: undefined }
}
