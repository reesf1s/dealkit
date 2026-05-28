import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  crmActivities,
  crmAiSummaries,
  crmCalendarEvents,
  crmCompanies,
  crmContacts,
  crmDealParticipants,
  crmDeals,
  crmNotes,
  crmPipelineStages,
  crmPipelines,
  crmSignals,
  crmTasks,
  dealLogs,
  users,
} from '@/lib/db/schema'
import {
  extractDeterministicSignals,
  mapLegacyStage,
  mapLegacyStatus,
  parseDomain,
  riskFromScore,
  scoreDeal,
  splitName,
  titleCaseName,
} from '@/lib/crm/rules'
import { deriveDealIntelligence } from '@/lib/crm/intelligence'
import { generateDealBriefWithAI } from '@/lib/crm/ai'

export const CRM_STAGE_TEMPLATES = [
  { key: 'lead_in', name: 'Lead in', color: '#64748b', probability: 10, isClosed: false },
  { key: 'qualified', name: 'Qualified', color: '#3b82f6', probability: 25, isClosed: false },
  { key: 'discovery', name: 'Discovery', color: '#8b5cf6', probability: 40, isClosed: false },
  { key: 'proposal', name: 'Proposal', color: '#f59e0b', probability: 60, isClosed: false },
  { key: 'contract', name: 'Contract', color: '#ef4444', probability: 80, isClosed: false },
  { key: 'won', name: 'Won', color: '#22c55e', probability: 100, isClosed: true },
  { key: 'lost', name: 'Lost', color: '#6b7280', probability: 0, isClosed: true },
] as const

const CLOSED_STATUSES = new Set(['won', 'lost', 'archived'])

export async function ensureDefaultPipeline(workspaceId: string, businessType: 'saas' | 'agency' | 'consultancy' | 'recruitment' | 'services' | 'other_b2b' = 'other_b2b') {
  const [existing] = await db
    .select()
    .from(crmPipelines)
    .where(and(eq(crmPipelines.workspaceId, workspaceId), eq(crmPipelines.isDefault, true)))
    .limit(1)
  if (existing) {
    const stages = await db
      .select()
      .from(crmPipelineStages)
      .where(eq(crmPipelineStages.pipelineId, existing.id))
      .orderBy(asc(crmPipelineStages.position))
    return { pipeline: existing, stages }
  }

  const [pipeline] = await db.insert(crmPipelines).values({
    workspaceId,
    name: 'Sales pipeline',
    businessType,
    isDefault: true,
  }).returning()

  const stages = await db.insert(crmPipelineStages).values(
    CRM_STAGE_TEMPLATES.map((stage, index) => ({
      workspaceId,
      pipelineId: pipeline.id,
      name: stage.name,
      key: stage.key,
      color: stage.color,
      position: index + 1,
      probability: stage.probability,
      isClosed: Boolean(stage.isClosed),
    }))
  ).returning()

  return { pipeline, stages }
}

async function getOrCreateCompany(workspaceId: string, userId: string, name: string, source = 'manual', domain?: string | null) {
  const cleanName = titleCaseName(name || 'Unknown company')
  const [existing] = await db
    .select()
    .from(crmCompanies)
    .where(and(eq(crmCompanies.workspaceId, workspaceId), eq(crmCompanies.name, cleanName)))
    .limit(1)
  if (existing) return existing

  const [company] = await db.insert(crmCompanies).values({
    workspaceId,
    name: cleanName,
    domain: domain ?? null,
    source,
    ownerId: userId,
    legacyProspectCompany: source === 'legacy_deal_logs' ? cleanName : null,
  }).onConflictDoUpdate({
    target: [crmCompanies.workspaceId, crmCompanies.name],
    set: { updatedAt: new Date() },
  }).returning()
  return company
}

async function getOrCreateContact(input: {
  workspaceId: string
  userId: string
  companyId: string | null
  fullName: string
  email?: string | null
  phone?: string | null
  jobTitle?: string | null
  source?: string
}) {
  const fullName = titleCaseName(input.fullName)
  const email = input.email?.trim().toLowerCase() || null
  if (email) {
    const [existing] = await db
      .select()
      .from(crmContacts)
      .where(and(eq(crmContacts.workspaceId, input.workspaceId), eq(crmContacts.email, email)))
      .limit(1)
    if (existing) return existing
  } else {
    const [existing] = await db
      .select()
      .from(crmContacts)
      .where(and(
        eq(crmContacts.workspaceId, input.workspaceId),
        eq(crmContacts.fullName, fullName),
        input.companyId ? eq(crmContacts.companyId, input.companyId) : isNull(crmContacts.companyId),
      ))
      .limit(1)
    if (existing) return existing
  }

  const { firstName, lastName } = splitName(fullName)
  const [contact] = await db.insert(crmContacts).values({
    workspaceId: input.workspaceId,
    companyId: input.companyId,
    firstName,
    lastName,
    fullName,
    email,
    phone: input.phone ?? null,
    jobTitle: input.jobTitle ?? null,
    source: input.source ?? 'manual',
    ownerId: input.userId,
  }).returning()
  return contact
}

export async function backfillLegacyDealLogs(workspaceId: string, userId: string) {
  const { pipeline, stages } = await ensureDefaultPipeline(workspaceId)
  const stageByKey = new Map(stages.map(stage => [stage.key, stage]))
  const legacyDeals = await db
    .select()
    .from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))
    .orderBy(asc(dealLogs.createdAt))

  let companies = 0
  let contacts = 0
  let deals = 0
  let activities = 0
  let tasks = 0
  let calendarEvents = 0

  for (const legacy of legacyDeals) {
    const [already] = await db
      .select({ id: crmDeals.id })
      .from(crmDeals)
      .where(and(eq(crmDeals.workspaceId, workspaceId), eq(crmDeals.legacyDealLogId, legacy.id)))
      .limit(1)
    if (already) continue

    const contactCandidates = [
      ...(legacy.prospectName ? [{
        name: legacy.prospectName,
        title: legacy.prospectTitle ?? undefined,
        email: undefined,
        phone: undefined,
        primary: true,
      }] : []),
      ...((Array.isArray(legacy.contacts) ? legacy.contacts : []) as Array<{ name?: string; title?: string; role?: string; email?: string; phone?: string }>).map(contact => ({
        name: contact.name,
        title: contact.title ?? contact.role,
        email: contact.email,
        phone: contact.phone,
        primary: false,
      })),
    ].filter(contact => contact.name)

    const domain = contactCandidates.map(contact => parseDomain(contact.email)).find(Boolean) ?? null
    const company = await getOrCreateCompany(workspaceId, userId, legacy.prospectCompany || 'Unknown company', 'legacy_deal_logs', domain)
    companies++

    const mappedStageKey = mapLegacyStage(legacy.stage)
    const stage = stageByKey.get(mappedStageKey) ?? stageByKey.get('lead_in')!
    const status = mapLegacyStatus(legacy.stage)
    const notes = [legacy.meetingNotes, legacy.hubspotNotes, legacy.notes].filter(Boolean).join('\n\n---\n\n')
    const lastActivityAt = legacy.updatedAt ?? legacy.createdAt ?? new Date()
    const staleDays = Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / 86_400_000)

    const [deal] = await db.insert(crmDeals).values({
      workspaceId,
      companyId: company.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: legacy.assignedRepId ?? legacy.userId ?? userId,
      title: legacy.dealName,
      valueAmount: legacy.dealValue ?? null,
      valueCurrency: 'GBP',
      expectedCloseDate: legacy.closeDate ?? null,
      probability: stage.probability,
      status,
      source: legacy.hubspotNotes ? 'legacy_hubspot_import' : 'legacy_deal_logs',
      aiScore: legacy.conversionScore ?? stage.probability,
      aiConfidence: legacy.conversionScore ? 70 : 45,
      aiRiskLevel: riskFromScore(legacy.conversionScore, staleDays),
      aiSummary: legacy.aiSummary ?? null,
      aiNextAction: legacy.nextSteps ?? null,
      lastActivityAt,
      legacyDealLogId: legacy.id,
      createdAt: legacy.createdAt ?? new Date(),
      updatedAt: legacy.updatedAt ?? new Date(),
    }).returning()
    deals++

    for (const candidate of contactCandidates) {
      const contact = await getOrCreateContact({
        workspaceId,
        userId,
        companyId: company.id,
        fullName: candidate.name!,
        email: candidate.email,
        phone: candidate.phone,
        jobTitle: candidate.title,
        source: 'legacy_deal_logs',
      })
      contacts++
      await db.insert(crmDealParticipants).values({
        workspaceId,
        dealId: deal.id,
        contactId: contact.id,
        role: candidate.title ?? null,
        isPrimary: Boolean(candidate.primary),
      }).onConflictDoNothing()
    }

    await db.insert(crmActivities).values({
      workspaceId,
      dealId: deal.id,
      companyId: company.id,
      type: 'import',
      source: 'legacy_deal_logs',
      title: 'Imported legacy deal record',
      body: legacy.description ?? null,
      occurredAt: legacy.createdAt ?? new Date(),
      createdBy: userId,
      externalId: `legacy-import-${legacy.id}`,
      metadata: { legacyDealLogId: legacy.id, legacyStage: legacy.stage },
    }).onConflictDoNothing()
    activities++

    if (notes.trim()) {
      await db.insert(crmActivities).values({
        workspaceId,
        dealId: deal.id,
        companyId: company.id,
        type: 'note',
        source: 'legacy_deal_logs',
        title: 'Legacy deal notes',
        body: notes,
        summary: legacy.aiSummary ?? null,
        occurredAt: legacy.updatedAt ?? legacy.createdAt ?? new Date(),
        createdBy: userId,
        externalId: `legacy-notes-${legacy.id}`,
        metadata: { legacyDealLogId: legacy.id },
      }).onConflictDoNothing()
      activities++
    }

    const legacyTodos = Array.isArray(legacy.todos) ? legacy.todos as Array<{ id?: string; text?: string; done?: boolean; priority?: string; dueDate?: string }> : []
    for (const todo of legacyTodos.filter(todo => todo.text)) {
      await db.insert(crmTasks).values({
        workspaceId,
        dealId: deal.id,
        companyId: company.id,
        assignedTo: legacy.assignedRepId ?? userId,
        title: todo.text!,
        status: todo.done ? 'done' : 'todo',
        priority: todo.priority === 'high' ? 'high' : 'normal',
        dueAt: todo.dueDate ? new Date(todo.dueDate) : null,
        source: 'legacy_deal_logs',
      })
      tasks++
    }

    const scheduledEvents = Array.isArray(legacy.scheduledEvents) ? legacy.scheduledEvents as Array<{ id?: string; description?: string; title?: string; date?: string; time?: string; participants?: string[]; type?: string }> : []
    for (const event of scheduledEvents.filter(event => event.date)) {
      const startsAt = new Date(`${event.date}T${event.time ?? '09:00'}:00`)
      await db.insert(crmCalendarEvents).values({
        workspaceId,
        dealId: deal.id,
        companyId: company.id,
        provider: 'legacy_extracted',
        externalId: event.id ?? `legacy-event-${legacy.id}-${event.date}-${event.description ?? event.title ?? 'event'}`,
        title: event.title ?? event.description ?? 'Meeting',
        description: event.description ?? null,
        startsAt,
        attendees: event.participants ?? [],
        source: 'legacy_deal_logs',
        metadata: { legacyDealLogId: legacy.id, legacyType: event.type },
      }).onConflictDoNothing()
      calendarEvents++
    }

    if (legacy.aiSummary) {
      await db.insert(crmAiSummaries).values({
        workspaceId,
        dealId: deal.id,
        summaryType: 'legacy_deal_brief',
        content: legacy.aiSummary,
        evidence: [{ type: 'legacy_deal_log', id: legacy.id }],
        confidence: legacy.conversionScore ? 70 : 45,
        generatedBy: 'legacy',
      })
    }
  }

  return {
    legacyDeals: legacyDeals.length,
    companies,
    contacts,
    deals,
    activities,
    tasks,
    calendarEvents,
  }
}

const nativeCrmReadyByWorkspace = new Map<string, Promise<void>>()

export async function ensureNativeCrmReady(workspaceId: string, userId: string) {
  const existing = nativeCrmReadyByWorkspace.get(workspaceId)
  if (existing) return existing

  const ready = ensureNativeCrmReadyUncached(workspaceId, userId).catch(error => {
    nativeCrmReadyByWorkspace.delete(workspaceId)
    throw error
  })
  nativeCrmReadyByWorkspace.set(workspaceId, ready)
  return ready
}

async function ensureNativeCrmReadyUncached(workspaceId: string, userId: string) {
  await ensureDefaultPipeline(workspaceId)
  const [{ nativeCount }] = await db
    .select({ nativeCount: sql<number>`count(*)::int` })
    .from(crmDeals)
    .where(eq(crmDeals.workspaceId, workspaceId))

  if (Number(nativeCount) === 0) {
    await backfillLegacyDealLogs(workspaceId, userId)
  }
}

export async function listPipeline(workspaceId: string, userId: string) {
  await ensureNativeCrmReady(workspaceId, userId)
  const { pipeline, stages } = await ensureDefaultPipeline(workspaceId)
  const rows = await db
    .select({
      id: crmDeals.id,
      title: crmDeals.title,
      valueAmount: crmDeals.valueAmount,
      valueCurrency: crmDeals.valueCurrency,
      expectedCloseDate: crmDeals.expectedCloseDate,
      probability: crmDeals.probability,
      status: crmDeals.status,
      aiScore: crmDeals.aiScore,
      aiConfidence: crmDeals.aiConfidence,
      aiRiskLevel: crmDeals.aiRiskLevel,
      aiSummary: crmDeals.aiSummary,
      aiNextAction: crmDeals.aiNextAction,
      lastActivityAt: crmDeals.lastActivityAt,
      nextStepDueAt: crmDeals.nextStepDueAt,
      companyId: crmCompanies.id,
      companyName: crmCompanies.name,
      stageId: crmPipelineStages.id,
      stageName: crmPipelineStages.name,
      stageKey: crmPipelineStages.key,
      stageColor: crmPipelineStages.color,
      ownerId: crmDeals.ownerId,
      ownerEmail: users.email,
    })
    .from(crmDeals)
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmDeals.companyId))
    .leftJoin(crmPipelineStages, eq(crmPipelineStages.id, crmDeals.stageId))
    .leftJoin(users, eq(users.id, crmDeals.ownerId))
    .where(eq(crmDeals.workspaceId, workspaceId))
    .orderBy(desc(crmDeals.updatedAt))

  const dealIds = rows.map(deal => deal.id)
  const [signalRows, taskRows, participantRows] = dealIds.length ? await Promise.all([
    db.select({
      id: crmSignals.id,
      dealId: crmSignals.dealId,
      type: crmSignals.type,
      direction: crmSignals.direction,
      explanation: crmSignals.explanation,
      confidence: crmSignals.confidence,
      createdAt: crmSignals.createdAt,
    })
      .from(crmSignals)
      .where(and(eq(crmSignals.workspaceId, workspaceId), inArray(crmSignals.dealId, dealIds)))
      .orderBy(desc(crmSignals.createdAt))
      .limit(Math.min(360, Math.max(80, dealIds.length * 4))),
    db.select({
      id: crmTasks.id,
      dealId: crmTasks.dealId,
      title: crmTasks.title,
      dueAt: crmTasks.dueAt,
      priority: crmTasks.priority,
      source: crmTasks.source,
      status: crmTasks.status,
    })
      .from(crmTasks)
      .where(and(eq(crmTasks.workspaceId, workspaceId), inArray(crmTasks.dealId, dealIds), eq(crmTasks.status, 'todo')))
      .orderBy(asc(crmTasks.dueAt), desc(crmTasks.updatedAt))
      .limit(Math.min(500, Math.max(100, dealIds.length * 5))),
    db.select({
      dealId: crmDealParticipants.dealId,
      contactId: crmContacts.id,
      fullName: crmContacts.fullName,
      email: crmContacts.email,
      role: crmDealParticipants.role,
      isPrimary: crmDealParticipants.isPrimary,
    })
      .from(crmDealParticipants)
      .innerJoin(crmContacts, eq(crmContacts.id, crmDealParticipants.contactId))
      .where(and(eq(crmDealParticipants.workspaceId, workspaceId), inArray(crmDealParticipants.dealId, dealIds)))
      .orderBy(desc(crmDealParticipants.isPrimary), asc(crmContacts.fullName))
      .limit(Math.min(500, Math.max(100, dealIds.length * 4))),
  ]) : [[], [], []]

  const signalsByDeal = new Map<string, typeof signalRows>()
  for (const signal of signalRows) {
    if (!signal.dealId) continue
    const existing = signalsByDeal.get(signal.dealId) ?? []
    if (existing.length < 5) {
      existing.push(signal)
      signalsByDeal.set(signal.dealId, existing)
    }
  }

  const tasksByDeal = new Map<string, typeof taskRows>()
  for (const task of taskRows) {
    if (!task.dealId) continue
    const existing = tasksByDeal.get(task.dealId) ?? []
    if (existing.length < 6) {
      existing.push(task)
      tasksByDeal.set(task.dealId, existing)
    }
  }

  const peopleByDeal = new Map<string, typeof participantRows>()
  for (const person of participantRows) {
    const existing = peopleByDeal.get(person.dealId) ?? []
    if (existing.length < 4) {
      existing.push(person)
      peopleByDeal.set(person.dealId, existing)
    }
  }

  const now = new Date()
  const deals = rows.map(deal => {
    const signals = signalsByDeal.get(deal.id) ?? []
    const tasks = tasksByDeal.get(deal.id) ?? []
    const riskDrivers = signals
      .filter(signal => signal.direction === 'negative')
      .map(signal => signal.explanation)
      .slice(0, 4)
    const positiveSignals = signals
      .filter(signal => signal.direction === 'positive')
      .map(signal => signal.explanation)
      .slice(0, 3)
    const missingData = [
      !deal.valueAmount ? 'Value is missing' : null,
      !deal.expectedCloseDate ? 'Close date is missing' : null,
      !deal.aiNextAction && !tasks.length ? 'No current next action recorded' : null,
    ].filter(Boolean) as string[]
    const nextTask = tasks.find(task => !task.dueAt || task.dueAt >= now) ?? tasks[0] ?? null
    const nextAction = deal.aiNextAction ?? nextTask?.title ?? null

    return {
      ...deal,
      people: peopleByDeal.get(deal.id) ?? [],
      nextStepDueAt: deal.nextStepDueAt ?? nextTask?.dueAt ?? null,
      aiNextAction: nextAction,
      intelligence: {
        score: deal.aiScore ?? deal.probability ?? 50,
        confidence: deal.aiConfidence ?? 45,
        riskLevel: deal.aiRiskLevel ?? 'unknown',
        nextAction,
        summary: deal.aiSummary ?? null,
        riskDrivers,
        positiveSignals,
        missingData,
      },
    }
  })

  return { pipeline, stages, deals }
}

export async function listToday(workspaceId: string, userId: string) {
  await ensureNativeCrmReady(workspaceId, userId)
  const now = new Date()
  const soon = new Date(now.getTime() + 7 * 86_400_000)
  const staleCutoff = new Date(now.getTime() - 14 * 86_400_000)
  const nowIso = now.toISOString()
  const soonIso = soon.toISOString()

  const { deals } = await listPipeline(workspaceId, userId)
  const openDeals = deals.filter(deal => !CLOSED_STATUSES.has(deal.status))
  const tasks = await db
    .select({
      id: crmTasks.id,
      title: crmTasks.title,
      dueAt: crmTasks.dueAt,
      priority: crmTasks.priority,
      status: crmTasks.status,
      source: crmTasks.source,
      dealId: crmDeals.id,
      dealTitle: crmDeals.title,
      dealStatus: crmDeals.status,
      companyName: crmCompanies.name,
    })
    .from(crmTasks)
    .leftJoin(crmDeals, eq(crmDeals.id, crmTasks.dealId))
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmTasks.companyId))
    .where(and(
      eq(crmTasks.workspaceId, workspaceId),
      eq(crmTasks.status, 'todo'),
      sql`(${crmDeals.status} is null or ${crmDeals.status} not in ('won', 'lost', 'archived'))`,
    ))
    .orderBy(asc(crmTasks.dueAt))
    .limit(80)

  const meetings = await db
    .select({
      id: crmCalendarEvents.id,
      title: crmCalendarEvents.title,
      startsAt: crmCalendarEvents.startsAt,
      dealId: crmCalendarEvents.dealId,
      dealTitle: crmDeals.title,
      companyName: crmCompanies.name,
    })
    .from(crmCalendarEvents)
    .leftJoin(crmDeals, eq(crmDeals.id, crmCalendarEvents.dealId))
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmCalendarEvents.companyId))
    .where(and(
      eq(crmCalendarEvents.workspaceId, workspaceId),
      sql`${crmCalendarEvents.startsAt} >= ${nowIso}`,
      sql`${crmCalendarEvents.startsAt} <= ${soonIso}`,
    ))
    .orderBy(asc(crmCalendarEvents.startsAt))
    .limit(10)

  const isOldTask = (task: { dueAt: Date | null; source?: string | null }) => {
    if (!task.dueAt) return (task.source ?? '') === 'legacy_backfill'
    const ageDays = Math.floor((now.getTime() - task.dueAt.getTime()) / 86_400_000)
    return ageDays > 30
  }
  const currentTasks = tasks.filter(task => !isOldTask(task)).slice(0, 8)
  const oldTaskGroups = tasks
    .filter(isOldTask)
    .reduce<Array<{ dealId: string | null; title: string; companyName: string | null; count: number; oldestDueAt: Date | null }>>((groups, task) => {
      const key = task.dealId ?? `task-${task.id}`
      let group = groups.find(item => (item.dealId ?? item.title) === key)
      if (!group) {
        group = {
          dealId: task.dealId,
          title: task.dealTitle ?? task.title,
          companyName: task.companyName,
          count: 0,
          oldestDueAt: task.dueAt,
        }
        groups.push(group)
      }
      group.count += 1
      if (task.dueAt && (!group.oldestDueAt || task.dueAt < group.oldestDueAt)) group.oldestDueAt = task.dueAt
      return groups
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  const priorities = [
    ...currentTasks
      .filter(task => !task.dueAt || task.dueAt <= soon)
      .slice(0, 5)
      .map(task => ({
        id: `task-${task.id}`,
        title: task.title,
        reason: task.dueAt && task.dueAt < now ? 'Task is overdue' : 'Task is due soon',
        linkedType: 'task',
        linkedId: task.id,
        dealId: task.dealId,
        companyName: task.companyName,
        suggestedAction: 'Complete the task or update the next step.',
        dueAt: task.dueAt,
        confidence: 'high',
      })),
    ...oldTaskGroups.map(group => ({
      id: `old-tasks-${group.dealId ?? group.title}`,
      title: `Review old actions for ${group.companyName ?? group.title}`,
      reason: `${group.count} imported action${group.count === 1 ? '' : 's'} may already be done or out of date.`,
      linkedType: 'deal',
      linkedId: group.dealId ?? '',
      dealId: group.dealId,
      companyName: group.companyName,
      suggestedAction: 'Open the deal and mark stale actions done, snooze them, or replace them with one current next step.',
      dueAt: group.oldestDueAt,
      confidence: 'medium',
    })),
    ...openDeals
      .filter(deal => deal.intelligence?.riskDrivers?.length || deal.aiRiskLevel === 'high')
      .slice(0, 5)
      .map(deal => ({
        id: `risk-${deal.id}`,
        title: `Review ${deal.companyName ?? deal.title}`,
        reason: deal.intelligence?.riskDrivers?.[0] ?? 'Deal is showing elevated risk.',
        linkedType: 'deal',
        linkedId: deal.id,
        dealId: deal.id,
        companyName: deal.companyName,
        suggestedAction: deal.intelligence?.nextAction ?? deal.aiNextAction ?? 'Review the latest evidence and agree a concrete next step.',
        dueAt: null,
        confidence: deal.aiConfidence && deal.aiConfidence >= 70 ? 'high' : 'medium',
      })),
    ...openDeals
      .filter(deal => !deal.aiNextAction && !deal.nextStepDueAt)
      .slice(0, 5)
      .map(deal => ({
        id: `next-${deal.id}`,
        title: `Set a next step for ${deal.companyName ?? deal.title}`,
        reason: 'Open deal has no clear next action.',
        linkedType: 'deal',
        linkedId: deal.id,
        dealId: deal.id,
        companyName: deal.companyName,
        suggestedAction: deal.aiNextAction ?? 'Add a concrete follow-up task.',
        dueAt: null,
        confidence: 'medium',
      })),
    ...openDeals
      .filter(deal => !deal.lastActivityAt || deal.lastActivityAt < staleCutoff)
      .slice(0, 5)
      .map(deal => ({
        id: `stale-${deal.id}`,
        title: `Re-engage ${deal.companyName ?? deal.title}`,
        reason: 'No recent activity in at least 14 days.',
        linkedType: 'deal',
        linkedId: deal.id,
        dealId: deal.id,
        companyName: deal.companyName,
        suggestedAction: deal.aiNextAction ?? 'Send a concise follow-up and confirm whether this is still active.',
        dueAt: null,
        confidence: 'medium',
      })),
  ].slice(0, 10)

  const dealIntelligence = openDeals
    .slice()
    .sort((a, b) => {
      const aRisk = a.aiRiskLevel === 'high' ? 2 : a.aiRiskLevel === 'medium' ? 1 : 0
      const bRisk = b.aiRiskLevel === 'high' ? 2 : b.aiRiskLevel === 'medium' ? 1 : 0
      if (bRisk !== aRisk) return bRisk - aRisk
      const aReasons = a.intelligence?.riskDrivers?.length ?? 0
      const bReasons = b.intelligence?.riskDrivers?.length ?? 0
      if (bReasons !== aReasons) return bReasons - aReasons
      return (b.lastActivityAt?.getTime?.() ?? 0) - (a.lastActivityAt?.getTime?.() ?? 0)
    })
    .slice(0, 12)

  return {
    priorities,
    atRiskDeals: openDeals.filter(deal => deal.aiRiskLevel === 'high' || (deal.aiScore ?? 50) < 45).slice(0, 8),
    staleDeals: openDeals.filter(deal => !deal.lastActivityAt || deal.lastActivityAt < staleCutoff).slice(0, 8),
    upcomingMeetings: meetings,
    overdueTasks: tasks.filter(task => task.dueAt && task.dueAt < now).slice(0, 8),
    openPipelineValue: openDeals.reduce((sum, deal) => sum + (deal.valueAmount ?? 0), 0),
    likelyClosers: openDeals.filter(deal => deal.expectedCloseDate && deal.expectedCloseDate <= soon && (deal.aiScore ?? 0) >= 60).slice(0, 6),
    dealIntelligence,
  }
}

export async function getDealContextNative(dealId: string, workspaceId: string) {
  const [deal] = await db
    .select({
      id: crmDeals.id,
      title: crmDeals.title,
      valueAmount: crmDeals.valueAmount,
      valueCurrency: crmDeals.valueCurrency,
      expectedCloseDate: crmDeals.expectedCloseDate,
      probability: crmDeals.probability,
      status: crmDeals.status,
      aiScore: crmDeals.aiScore,
      aiConfidence: crmDeals.aiConfidence,
      aiRiskLevel: crmDeals.aiRiskLevel,
      aiSummary: crmDeals.aiSummary,
      aiNextAction: crmDeals.aiNextAction,
      lastActivityAt: crmDeals.lastActivityAt,
      companyId: crmCompanies.id,
      companyName: crmCompanies.name,
      companyDomain: crmCompanies.domain,
      companyWebsite: crmCompanies.website,
      stageId: crmPipelineStages.id,
      stageName: crmPipelineStages.name,
      stageKey: crmPipelineStages.key,
      ownerId: crmDeals.ownerId,
    })
    .from(crmDeals)
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmDeals.companyId))
    .leftJoin(crmPipelineStages, eq(crmPipelineStages.id, crmDeals.stageId))
    .where(and(eq(crmDeals.id, dealId), eq(crmDeals.workspaceId, workspaceId)))
    .limit(1)

  if (!deal) return null

  const [participants, activities, openTasks, completedTasks, summaries, signals, meetings] = await Promise.all([
    db.select({
      id: crmContacts.id,
      fullName: crmContacts.fullName,
      email: crmContacts.email,
      jobTitle: crmContacts.jobTitle,
      role: crmDealParticipants.role,
      isPrimary: crmDealParticipants.isPrimary,
    }).from(crmDealParticipants)
      .innerJoin(crmContacts, eq(crmContacts.id, crmDealParticipants.contactId))
      .where(and(eq(crmDealParticipants.workspaceId, workspaceId), eq(crmDealParticipants.dealId, dealId))),
    db.select().from(crmActivities)
      .where(and(eq(crmActivities.workspaceId, workspaceId), eq(crmActivities.dealId, dealId)))
      .orderBy(desc(crmActivities.occurredAt))
      .limit(30),
    db.select().from(crmTasks)
      .where(and(eq(crmTasks.workspaceId, workspaceId), eq(crmTasks.dealId, dealId), eq(crmTasks.status, 'todo')))
      .orderBy(asc(crmTasks.dueAt)),
    db.select().from(crmTasks)
      .where(and(eq(crmTasks.workspaceId, workspaceId), eq(crmTasks.dealId, dealId), eq(crmTasks.status, 'done')))
      .orderBy(desc(crmTasks.updatedAt))
      .limit(10),
    db.select().from(crmAiSummaries)
      .where(and(eq(crmAiSummaries.workspaceId, workspaceId), eq(crmAiSummaries.dealId, dealId)))
      .orderBy(desc(crmAiSummaries.createdAt))
      .limit(5),
    db.select().from(crmSignals)
      .where(and(eq(crmSignals.workspaceId, workspaceId), eq(crmSignals.dealId, dealId)))
      .orderBy(desc(crmSignals.createdAt))
      .limit(12),
    db.select().from(crmCalendarEvents)
      .where(and(eq(crmCalendarEvents.workspaceId, workspaceId), eq(crmCalendarEvents.dealId, dealId)))
      .orderBy(asc(crmCalendarEvents.startsAt))
      .limit(10),
  ])

  const context = {
    deal,
    company: {
      id: deal.companyId,
      name: deal.companyName,
      domain: deal.companyDomain,
      website: deal.companyWebsite,
    },
    contacts: participants,
    latestActivities: activities,
    openTasks,
    completedTasks,
    previousAiSummaries: summaries,
    signals,
    meetings,
    evidenceIds: [
      ...activities.map(activity => ({ type: 'activity', id: activity.id, label: activity.title })),
      ...openTasks.map(task => ({ type: 'task', id: task.id, label: task.title })),
      ...signals.map(signal => ({ type: 'signal', id: signal.id, label: signal.type })),
    ],
  }
  return {
    ...context,
    intelligence: deriveDealIntelligence(context),
  }
}

export async function moveDealStage(input: {
  workspaceId: string
  userId: string
  dealId: string
  stageId: string
}) {
  const [existing] = await db
    .select({
      id: crmDeals.id,
      title: crmDeals.title,
      companyId: crmDeals.companyId,
      previousStageId: crmDeals.stageId,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      lastActivityAt: crmDeals.lastActivityAt,
      nextStepDueAt: crmDeals.nextStepDueAt,
    })
    .from(crmDeals)
    .where(and(eq(crmDeals.id, input.dealId), eq(crmDeals.workspaceId, input.workspaceId)))
    .limit(1)
  if (!existing) return null

  const [stage] = await db
    .select()
    .from(crmPipelineStages)
    .where(and(eq(crmPipelineStages.id, input.stageId), eq(crmPipelineStages.workspaceId, input.workspaceId)))
    .limit(1)
  if (!stage) return null

  const status = stage.key === 'won' ? 'won' : stage.key === 'lost' ? 'lost' : 'open'
  const updatedModel = {
    status,
    probability: stage.probability,
    lastActivityAt: new Date(),
    nextStepDueAt: existing.nextStepDueAt,
    expectedCloseDate: existing.expectedCloseDate,
  }
  const score = scoreDeal(updatedModel)
  const now = new Date()
  const [deal] = await db.update(crmDeals).set({
    stageId: stage.id,
    probability: stage.probability,
    status,
    aiScore: score,
    aiRiskLevel: riskFromScore(score),
    lastActivityAt: now,
    updatedAt: now,
  }).where(and(eq(crmDeals.id, input.dealId), eq(crmDeals.workspaceId, input.workspaceId))).returning()

  await db.insert(crmActivities).values({
    workspaceId: input.workspaceId,
    dealId: input.dealId,
    companyId: existing.companyId,
    type: 'stage_change',
    source: 'crm',
    title: `Moved to ${stage.name}`,
    body: existing.previousStageId ? `Stage changed from ${existing.previousStageId} to ${stage.id}` : `Stage set to ${stage.name}`,
    occurredAt: now,
    createdBy: input.userId,
    metadata: { fromStageId: existing.previousStageId, toStageId: stage.id },
  })

  await refreshDealSignals(input.workspaceId, input.dealId)
  return deal
}

export async function createNativeDeal(input: {
  workspaceId: string
  userId: string
  title: string
  companyName: string
  valueAmount?: number | null
  expectedCloseDate?: Date | null
  source?: string
}) {
  const { pipeline, stages } = await ensureDefaultPipeline(input.workspaceId)
  const firstStage = stages.find(stage => !stage.isClosed) ?? stages[0]
  const source = input.source ?? 'manual'
  const company = await getOrCreateCompany(input.workspaceId, input.userId, input.companyName, source)
  const score = scoreDeal({
    status: 'open',
    probability: firstStage?.probability ?? 10,
    lastActivityAt: new Date(),
    nextStepDueAt: null,
    expectedCloseDate: input.expectedCloseDate ?? null,
  })
  const [deal] = await db.insert(crmDeals).values({
    workspaceId: input.workspaceId,
    companyId: company.id,
    pipelineId: pipeline.id,
    stageId: firstStage?.id ?? null,
    ownerId: input.userId,
    title: input.title,
    valueAmount: input.valueAmount ?? null,
    expectedCloseDate: input.expectedCloseDate ?? null,
    probability: firstStage?.probability ?? 10,
    source,
    aiScore: score,
    aiConfidence: 45,
    aiRiskLevel: riskFromScore(score),
    lastActivityAt: new Date(),
  }).returning()

  await db.insert(crmActivities).values({
    workspaceId: input.workspaceId,
    dealId: deal.id,
    companyId: company.id,
    type: 'import',
    source,
    title: source === 'csv_import' ? 'Deal imported from CSV' : 'Deal created',
    occurredAt: new Date(),
    createdBy: input.userId,
  })

  return deal
}

export async function createNativeCompany(input: {
  workspaceId: string
  userId: string
  name: string
  domain?: string | null
  website?: string | null
  industry?: string | null
  sizeLabel?: string | null
  source?: string
}) {
  const source = input.source ?? 'manual'
  const company = await getOrCreateCompany(
    input.workspaceId,
    input.userId,
    input.name,
    source,
    input.domain ?? parseDomain(input.website) ?? null,
  )
  const [updated] = await db.update(crmCompanies).set({
    website: input.website ?? company.website,
    industry: input.industry ?? company.industry,
    sizeLabel: input.sizeLabel ?? company.sizeLabel,
    updatedAt: new Date(),
  }).where(and(eq(crmCompanies.id, company.id), eq(crmCompanies.workspaceId, input.workspaceId))).returning()

  await db.insert(crmActivities).values({
    workspaceId: input.workspaceId,
    companyId: updated.id,
    type: 'import',
    source,
    title: source === 'csv_import' ? 'Company imported from CSV' : 'Company created',
    occurredAt: new Date(),
    createdBy: input.userId,
  })

  return updated
}

export async function createNativeContact(input: {
  workspaceId: string
  userId: string
  fullName: string
  email?: string | null
  jobTitle?: string | null
  phone?: string | null
  companyName?: string | null
  source?: string
}) {
  const source = input.source ?? 'manual'
  const company = input.companyName?.trim()
    ? await getOrCreateCompany(input.workspaceId, input.userId, input.companyName, source, parseDomain(input.email))
    : null
  const contact = await getOrCreateContact({
    workspaceId: input.workspaceId,
    userId: input.userId,
    companyId: company?.id ?? null,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    jobTitle: input.jobTitle,
    source,
  })

  await db.insert(crmActivities).values({
    workspaceId: input.workspaceId,
    companyId: company?.id ?? null,
    contactId: contact.id,
    type: 'import',
    source,
    title: source === 'csv_import' ? 'Contact imported from CSV' : 'Contact created',
    occurredAt: new Date(),
    createdBy: input.userId,
  })

  return contact
}

export async function createNativeTask(input: {
  workspaceId: string
  userId: string
  title: string
  dueAt?: Date | null
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  dealId?: string | null
  companyId?: string | null
  contactId?: string | null
}) {
  let deal: { id: string; companyId: string | null } | null = null
  if (input.dealId) {
    const [existing] = await db.select({ id: crmDeals.id, companyId: crmDeals.companyId })
      .from(crmDeals)
      .where(and(eq(crmDeals.id, input.dealId), eq(crmDeals.workspaceId, input.workspaceId)))
      .limit(1)
    deal = existing ?? null
  }
  let companyId = deal?.companyId ?? input.companyId ?? null
  let contactId = input.contactId ?? null

  if (!deal && companyId) {
    const [company] = await db.select({ id: crmCompanies.id })
      .from(crmCompanies)
      .where(and(eq(crmCompanies.id, companyId), eq(crmCompanies.workspaceId, input.workspaceId)))
      .limit(1)
    companyId = company?.id ?? null
  }

  if (contactId) {
    const [contact] = await db.select({ id: crmContacts.id, companyId: crmContacts.companyId })
      .from(crmContacts)
      .where(and(eq(crmContacts.id, contactId), eq(crmContacts.workspaceId, input.workspaceId)))
      .limit(1)
    contactId = contact?.id ?? null
    companyId = companyId ?? contact?.companyId ?? null
  }

  const [task] = await db.insert(crmTasks).values({
    workspaceId: input.workspaceId,
    dealId: deal?.id ?? null,
    companyId,
    contactId,
    assignedTo: input.userId,
    title: input.title,
    dueAt: input.dueAt ?? null,
    priority: input.priority ?? 'normal',
    source: 'manual',
  }).returning()

  await db.insert(crmActivities).values({
    workspaceId: input.workspaceId,
    dealId: task.dealId,
    companyId: task.companyId,
    type: 'task',
    source: 'crm',
    title: `Created task: ${task.title}`,
    occurredAt: new Date(),
    createdBy: input.userId,
    metadata: { taskId: task.id },
  })

  if (task.dealId) {
    refreshDealSignals(input.workspaceId, task.dealId).catch(error => {
      console.warn('[crm] background signal refresh failed after task create', error)
    })
  }
  return task
}

export async function updateNativeDeal(input: {
  workspaceId: string
  userId: string
  dealId: string
  title?: string | null
  stageId?: string | null
  status?: 'open' | 'won' | 'lost' | 'archived' | null
  valueAmount?: number | null
  expectedCloseDate?: Date | null
  aiNextAction?: string | null
}) {
  const patch: Partial<typeof crmDeals.$inferInsert> = { updatedAt: new Date() }
  if (typeof input.title === 'string') patch.title = input.title
  if ('stageId' in input) patch.stageId = input.stageId
  if (input.status) patch.status = input.status
  if ('valueAmount' in input) patch.valueAmount = input.valueAmount
  if ('expectedCloseDate' in input) patch.expectedCloseDate = input.expectedCloseDate
  if ('aiNextAction' in input) patch.aiNextAction = input.aiNextAction

  if (input.stageId) {
    const [stage] = await db.select({ probability: crmPipelineStages.probability })
      .from(crmPipelineStages)
      .where(and(eq(crmPipelineStages.id, input.stageId), eq(crmPipelineStages.workspaceId, input.workspaceId)))
      .limit(1)
    if (stage) patch.probability = stage.probability
  }

  const [deal] = await db.update(crmDeals).set(patch)
    .where(and(eq(crmDeals.id, input.dealId), eq(crmDeals.workspaceId, input.workspaceId)))
    .returning()
  if (!deal) return null

  await db.insert(crmActivities).values({
    workspaceId: input.workspaceId,
    dealId: deal.id,
    companyId: deal.companyId,
    type: 'note',
    source: 'manual',
    title: 'Updated deal facts',
    body: 'Deal facts were updated inline.',
    occurredAt: new Date(),
    createdBy: input.userId,
    metadata: { fields: Object.keys(patch).filter(key => key !== 'updatedAt') },
  })
  await refreshDealSignals(input.workspaceId, deal.id)
  return deal
}

export async function addDealUpdate(input: {
  workspaceId: string
  userId: string
  dealId: string
  note: string
  mode: 'note' | 'approved'
  proposedChanges?: {
    blocker?: string | null
    risk?: string | null
    nextAction?: string | null
    task?: string | null
    summary?: string | null
  } | null
}) {
  const [deal] = await db.select({ id: crmDeals.id, companyId: crmDeals.companyId, aiRiskLevel: crmDeals.aiRiskLevel })
    .from(crmDeals)
    .where(and(eq(crmDeals.id, input.dealId), eq(crmDeals.workspaceId, input.workspaceId)))
    .limit(1)
  if (!deal) return null

  const now = new Date()
  const proposed = input.proposedChanges ?? null
  await db.insert(crmNotes).values({
    workspaceId: input.workspaceId,
    dealId: deal.id,
    companyId: deal.companyId,
    body: input.note,
    createdBy: input.userId,
  })
  await db.insert(crmActivities).values({
    workspaceId: input.workspaceId,
    dealId: deal.id,
    companyId: deal.companyId,
    type: 'note',
    source: input.mode === 'approved' ? 'ai_assisted_update' : 'manual',
    title: input.mode === 'approved' ? 'Approved deal update' : 'Deal note added',
    body: input.note,
    summary: proposed?.summary ?? null,
    occurredAt: now,
    createdBy: input.userId,
    metadata: { proposedChanges: proposed, approvalMode: input.mode },
  })

  if (input.mode === 'approved') {
    const update: Partial<typeof crmDeals.$inferInsert> = {
      aiNextAction: proposed?.nextAction ?? null,
      aiSummary: proposed?.summary ?? input.note,
      aiConfidence: proposed?.blocker ? 62 : 70,
      aiRiskLevel: proposed?.blocker ? 'medium' : deal.aiRiskLevel,
      lastActivityAt: now,
      updatedAt: now,
    }
    await db.update(crmDeals).set(update).where(and(eq(crmDeals.id, deal.id), eq(crmDeals.workspaceId, input.workspaceId)))
  } else {
    await db.update(crmDeals).set({ lastActivityAt: now, updatedAt: now }).where(and(eq(crmDeals.id, deal.id), eq(crmDeals.workspaceId, input.workspaceId)))
  }

  await refreshDealSignals(input.workspaceId, deal.id)
  return getDealContextNative(deal.id, input.workspaceId)
}

export async function refreshDealSignals(workspaceId: string, dealId: string) {
  const context = await getDealContextNative(dealId, workspaceId)
  if (!context) return []

  await db.delete(crmSignals).where(and(eq(crmSignals.workspaceId, workspaceId), eq(crmSignals.dealId, dealId)))

  const now = new Date()
  const nowMs = now.getTime()
  const deal = context.deal
  const activityIds = context.latestActivities.map(activity => activity.id).slice(0, 5)
  const derived = deriveDealIntelligence(context)
  const hasCurrentNextAction = !derived.missingData.includes('No current next action recorded')

  const signals: Array<typeof crmSignals.$inferInsert> = extractDeterministicSignals({
    status: deal.status,
    probability: deal.probability,
    lastActivityAt: deal.lastActivityAt,
    nextStepDueAt: hasCurrentNextAction ? (context.openTasks.find(task => task.dueAt && task.dueAt.getTime() >= nowMs)?.dueAt ?? null) : null,
    expectedCloseDate: deal.expectedCloseDate,
    hasOpenTasks: hasCurrentNextAction,
    hasNextAction: hasCurrentNextAction,
    hasUpcomingMeeting: context.meetings.some(meeting => meeting.startsAt.getTime() >= nowMs),
    evidenceActivityIds: activityIds,
    now,
  }).map(signal => ({ ...signal, workspaceId, dealId }))

  if (derived.riskDrivers.some(reason => /procurement|legal|compliance|security/i.test(reason))) {
    signals.push({
      workspaceId,
      dealId,
      type: 'legal_or_procurement_mentioned',
      strength: 75,
      direction: 'negative',
      explanation: derived.riskDrivers.find(reason => /procurement|legal|compliance|security/i.test(reason)) ?? 'Procurement, legal, compliance, or security risk appears in recent context.',
      evidenceActivityIds: derived.evidenceActivityIds,
      confidence: 80,
    })
  }
  if (derived.riskDrivers.some(reason => /pricing|budget/i.test(reason))) {
    signals.push({
      workspaceId,
      dealId,
      type: 'pricing_mentioned',
      strength: 70,
      direction: 'negative',
      explanation: derived.riskDrivers.find(reason => /pricing|budget/i.test(reason)) ?? 'Pricing or budget concern appears in recent context.',
      evidenceActivityIds: derived.evidenceActivityIds,
      confidence: 76,
    })
  }
  if (derived.riskDrivers.some(reason => /blocked|concern|issue|alignment|uncertain|stalled|delay/i.test(reason))) {
    signals.push({
      workspaceId,
      dealId,
      type: 'negative_sentiment',
      strength: 74,
      direction: 'negative',
      explanation: derived.riskDrivers.find(reason => /blocked|concern|issue|alignment|uncertain|stalled|delay/i.test(reason)) ?? 'Recent context contains unresolved concern.',
      evidenceActivityIds: derived.evidenceActivityIds,
      confidence: 74,
    })
  }

  if (signals.length > 0) await db.insert(crmSignals).values(signals)

  let brief = derived
  try {
    brief = await generateDealBriefWithAI(context) ?? derived
  } catch (error) {
    console.warn('[crm] AI deal brief unavailable, using deterministic intelligence', error)
  }

  await db.update(crmDeals).set({
    aiScore: derived.score,
    aiRiskLevel: derived.riskLevel,
    aiConfidence: brief.confidence,
    aiSummary: brief.summary,
    aiNextAction: brief.nextAction,
    updatedAt: new Date(),
  }).where(and(eq(crmDeals.id, dealId), eq(crmDeals.workspaceId, workspaceId)))

  await db.insert(crmAiSummaries).values({
    workspaceId,
    dealId,
    summaryType: 'deal_brief',
    content: brief.summary,
    evidence: derived.evidenceActivityIds,
    confidence: brief.confidence,
    generatedBy: process.env.OPENAI_API_KEY ? 'openai' : 'deterministic',
  })

  return signals
}

export async function validateNativeCrmBackfill(workspaceId: string, userId: string) {
  await ensureNativeCrmReady(workspaceId, userId)
  const [counts] = await db.execute<{
    legacyDeals: number
    nativeDeals: number
    mappedLegacyDeals: number
    unmappedLegacyDeals: number
    nativeDealsMissingCompany: number
    nativeDealsWrongWorkspace: number
    activities: number
    tasks: number
    contacts: number
    companies: number
  }>(sql`
    WITH legacy AS (
      SELECT id FROM deal_logs WHERE workspace_id = ${workspaceId}::uuid
    ),
    native AS (
      SELECT * FROM crm_deals WHERE workspace_id = ${workspaceId}::uuid
    )
    SELECT
      (SELECT COUNT(*)::int FROM legacy) AS "legacyDeals",
      (SELECT COUNT(*)::int FROM native) AS "nativeDeals",
      (SELECT COUNT(*)::int FROM native WHERE legacy_deal_log_id IS NOT NULL) AS "mappedLegacyDeals",
      (SELECT COUNT(*)::int FROM legacy l WHERE NOT EXISTS (
        SELECT 1 FROM crm_deals d WHERE d.workspace_id = ${workspaceId}::uuid AND d.legacy_deal_log_id = l.id
      )) AS "unmappedLegacyDeals",
      (SELECT COUNT(*)::int FROM native WHERE company_id IS NULL) AS "nativeDealsMissingCompany",
      (SELECT COUNT(*)::int FROM crm_deals d
        JOIN deal_logs l ON l.id = d.legacy_deal_log_id
        WHERE d.workspace_id = ${workspaceId}::uuid AND l.workspace_id != d.workspace_id
      ) AS "nativeDealsWrongWorkspace",
      (SELECT COUNT(*)::int FROM crm_activities WHERE workspace_id = ${workspaceId}::uuid) AS activities,
      (SELECT COUNT(*)::int FROM crm_tasks WHERE workspace_id = ${workspaceId}::uuid) AS tasks,
      (SELECT COUNT(*)::int FROM crm_contacts WHERE workspace_id = ${workspaceId}::uuid) AS contacts,
      (SELECT COUNT(*)::int FROM crm_companies WHERE workspace_id = ${workspaceId}::uuid) AS companies
  `)

  const summary = Array.isArray(counts) ? counts[0] : (counts as any)?.rows?.[0]
  const issues = [
    summary?.unmappedLegacyDeals > 0 ? `${summary.unmappedLegacyDeals} legacy deals are not mapped to native deals.` : null,
    summary?.nativeDealsMissingCompany > 0 ? `${summary.nativeDealsMissingCompany} native deals have no company fallback.` : null,
    summary?.nativeDealsWrongWorkspace > 0 ? `${summary.nativeDealsWrongWorkspace} mapped deals point across workspaces.` : null,
  ].filter(Boolean)

  return {
    ...summary,
    readyForCutover: issues.length === 0,
    issues,
  }
}

export async function listCompanies(workspaceId: string, userId: string) {
  await ensureNativeCrmReady(workspaceId, userId)
  return db.execute(sql`
    SELECT
      c.id,
      c.name,
      c.domain,
      c.owner_id AS "ownerId",
      COUNT(DISTINCT d.id)::int AS "openDeals",
      COALESCE(SUM(CASE WHEN d.status = 'open' THEN d.value_amount ELSE 0 END), 0)::int AS "pipelineValue",
      MAX(a.occurred_at) AS "lastActivityAt",
      COUNT(DISTINCT CASE WHEN d.ai_risk_level = 'high' THEN d.id END)::int AS "riskCount"
    FROM crm_companies c
    LEFT JOIN crm_deals d ON d.company_id = c.id AND d.workspace_id = c.workspace_id
    LEFT JOIN crm_activities a ON a.company_id = c.id AND a.workspace_id = c.workspace_id
    WHERE c.workspace_id = ${workspaceId}::uuid
    GROUP BY c.id
    ORDER BY c.name ASC
  `)
}

export async function listContacts(workspaceId: string, userId: string) {
  await ensureNativeCrmReady(workspaceId, userId)
  return db
    .select({
      id: crmContacts.id,
      fullName: crmContacts.fullName,
      email: crmContacts.email,
      jobTitle: crmContacts.jobTitle,
      lastContactedAt: crmContacts.lastContactedAt,
      companyId: crmCompanies.id,
      companyName: crmCompanies.name,
    })
    .from(crmContacts)
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmContacts.companyId))
    .where(eq(crmContacts.workspaceId, workspaceId))
    .orderBy(asc(crmContacts.fullName))
}

export async function listTasks(workspaceId: string, userId: string, status?: 'todo' | 'done' | 'cancelled') {
  await ensureNativeCrmReady(workspaceId, userId)
  const now = new Date()
  const staleCutoff = new Date(now.getTime() - 21 * 86_400_000)
  const conditions = [eq(crmTasks.workspaceId, workspaceId)]
  if (status) conditions.push(eq(crmTasks.status, status))
  const rows = await db
    .select({
      id: crmTasks.id,
      title: crmTasks.title,
      description: crmTasks.description,
      dueAt: crmTasks.dueAt,
      status: crmTasks.status,
      priority: crmTasks.priority,
      source: crmTasks.source,
      dealId: crmDeals.id,
      dealTitle: crmDeals.title,
      companyName: crmCompanies.name,
    })
    .from(crmTasks)
    .leftJoin(crmDeals, eq(crmDeals.id, crmTasks.dealId))
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmTasks.companyId))
    .where(and(...conditions))
    .orderBy(asc(crmTasks.dueAt), desc(crmTasks.createdAt))
    .limit(status === 'done' ? 80 : 140)

  return rows.map(task => ({
    ...task,
    isStale: Boolean(task.status === 'todo' && task.dueAt && task.dueAt < staleCutoff),
    isOverdue: Boolean(task.status === 'todo' && task.dueAt && task.dueAt < now),
  }))
}

export async function completeTask(workspaceId: string, userId: string, taskId: string) {
  return updateTask({ workspaceId, userId, taskId, action: 'complete' })
}

export async function updateTask(input: {
  workspaceId: string
  userId: string
  taskId: string
  action: 'complete' | 'cancel' | 'snooze' | 'edit'
  title?: string | null
  dueAt?: Date | null
  priority?: 'low' | 'normal' | 'high' | 'urgent' | null
}) {
  const patch: Partial<typeof crmTasks.$inferInsert> = { updatedAt: new Date() }
  if (input.action === 'complete') patch.status = 'done'
  if (input.action === 'cancel') patch.status = 'cancelled'
  if (input.action === 'snooze') patch.dueAt = input.dueAt ?? new Date(Date.now() + 86_400_000)
  if (input.action === 'edit') {
    if (typeof input.title === 'string') patch.title = input.title
    if ('dueAt' in input) patch.dueAt = input.dueAt ?? null
    if (input.priority) patch.priority = input.priority
  }

  const [task] = await db.update(crmTasks).set(patch)
    .where(and(eq(crmTasks.id, input.taskId), eq(crmTasks.workspaceId, input.workspaceId)))
    .returning()
  if (!task) return null

  const verb = input.action === 'complete'
    ? 'Completed'
    : input.action === 'cancel'
      ? 'Cancelled'
      : input.action === 'snooze'
        ? 'Snoozed'
        : 'Updated'

  await db.insert(crmActivities).values({
    workspaceId: input.workspaceId,
    dealId: task.dealId,
    companyId: task.companyId,
    contactId: task.contactId,
    type: 'task',
    source: 'crm',
    title: `${verb} task: ${task.title}`,
    occurredAt: new Date(),
    createdBy: input.userId,
    metadata: { taskId: task.id, action: input.action },
  })

  if (task.dealId) {
    refreshDealSignals(input.workspaceId, task.dealId).catch(error => {
      console.warn('[crm] background signal refresh failed after task update', error)
    })
  }

  return task
}

export async function listActivity(workspaceId: string, userId: string) {
  await ensureNativeCrmReady(workspaceId, userId)
  return db
    .select({
      id: crmActivities.id,
      type: crmActivities.type,
      title: crmActivities.title,
      summary: crmActivities.summary,
      body: crmActivities.body,
      occurredAt: crmActivities.occurredAt,
      source: crmActivities.source,
      dealId: crmDeals.id,
      dealTitle: crmDeals.title,
      companyName: crmCompanies.name,
    })
    .from(crmActivities)
    .leftJoin(crmDeals, eq(crmDeals.id, crmActivities.dealId))
    .leftJoin(crmCompanies, eq(crmCompanies.id, crmActivities.companyId))
    .where(eq(crmActivities.workspaceId, workspaceId))
    .orderBy(desc(crmActivities.occurredAt))
    .limit(80)
}
