import 'server-only'

import {
  addDealUpdate,
  createNativeCompany,
  createNativeContact,
  createNativeDeal,
  createNativeTask,
  listCompanies,
  listContacts,
  listPipeline,
  listTasks,
  moveDealStage,
  updateNativeDeal,
  updateTask,
} from '@/lib/crm/core'
import { compactAssistantText, findMentionedDeal, normalizeAssistantText } from '@/lib/crm/assistant-context'
import { planAssistantToolsWithAI, type AssistantToolPlan } from '@/lib/crm/ai'
import type { Plan } from '@/types'

export type AssistantActionType =
  | 'create_deal'
  | 'update_deal'
  | 'move_deal_stage'
  | 'add_deal_note'
  | 'create_task'
  | 'edit_task'
  | 'complete_task'
  | 'snooze_task'
  | 'cancel_task'
  | 'create_company'
  | 'create_contact'
  | 'draft_follow_up'
  | 'open_record'

export type AssistantProposedAction = {
  id: string
  type: AssistantActionType
  label: string
  description: string
  record?: { type: 'deal' | 'task' | 'company' | 'contact'; id?: string; label: string; href?: string }
  params: Record<string, unknown>
  before?: Array<{ label: string; value: string }>
  after?: Array<{ label: string; value: string }>
  requiresConfirmation: boolean
}

type PlanningInput = {
  message: string
  workspaceId: string
  userId: string
  dealId?: string | null
  plan?: Plan | null
  pipeline: Awaited<ReturnType<typeof listPipeline>>
}

const mutationTypes = new Set<AssistantActionType>([
  'create_deal',
  'update_deal',
  'move_deal_stage',
  'add_deal_note',
  'create_task',
  'edit_task',
  'complete_task',
  'snooze_task',
  'cancel_task',
  'create_company',
  'create_contact',
])

export async function planAssistantActions(input: PlanningInput) {
  const message = input.message.trim()
  const lower = message.toLowerCase()
  const actions: AssistantProposedAction[] = []
  const links: Array<{ label: string; href: string }> = []
  const clarification = ''

  const scopedDeal = input.dealId
    ? input.pipeline.deals.find(deal => deal.id === input.dealId) ?? null
    : null
  const mentionedDeals = findMentionedDeals(message, input.pipeline.deals)
  const matchedDeal = scopedDeal ?? (mentionedDeals.length === 1 ? mentionedDeals[0] : findMentionedDeal(message, input.pipeline.deals))

  if (!scopedDeal && mentionedDeals.length > 1 && /\b(task|move|stage|note|update|deal|follow.?up|email)\b/i.test(message)) {
    return {
      actions,
      links: mentionedDeals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })),
      clarification: `I found multiple matching records: ${mentionedDeals.slice(0, 3).map(deal => deal.companyName ?? deal.title).join(', ')}. Which one should I use?`,
    }
  }

  const aiPlan = await planWithValidatedAiTools(input, matchedDeal)
  if (aiPlan.actions.length || aiPlan.links.length || aiPlan.clarification) return aiPlan

  if (/\b(create|add|new)\b/.test(lower) && /\b(task|todo|to do)\b/.test(lower)) {
    if (!matchedDeal && /\b(for|on|about)\b/.test(lower)) {
      return clarifyDeal(input.pipeline.deals, message, 'Which deal should this task be linked to?')
    }
    const title = extractTaskTitle(message, matchedDeal)
    if (!title) return { actions, links, clarification: 'What should the task say?' }
    const dueAt = parseDueDate(message)
    actions.push(action('create_task', `Create task`, `Create "${title}"${matchedDeal ? ` for ${matchedDeal.companyName ?? matchedDeal.title}` : ''}.`, {
      title,
      dueAt: dueAt?.toISOString() ?? null,
      dealId: matchedDeal?.id ?? null,
      priority: lower.includes('urgent') ? 'urgent' : lower.includes('high priority') ? 'high' : 'normal',
    }, {
      record: matchedDeal ? { type: 'deal', id: matchedDeal.id, label: matchedDeal.companyName ?? matchedDeal.title, href: `/deals/${matchedDeal.id}` } : undefined,
      after: [
        { label: 'Task', value: title },
        { label: 'Due', value: dueAt ? formatDate(dueAt) : 'No due date' },
      ],
    }))
  }

  if (/\b(move|set|change)\b/.test(lower) && /\b(stage|proposal|qualified|discovery|negotiation|won|lost|prospect)\b/.test(lower)) {
    if (!matchedDeal) return clarifyDeal(input.pipeline.deals, message, 'Which deal should I move?')
    const stage = findStage(message, input.pipeline.stages)
    if (!stage) {
      return {
        actions,
        links: input.pipeline.stages.map(stage => ({ label: stage.name, href: '/deals?view=pipeline' })),
        clarification: 'Which pipeline stage should I move it to?',
      }
    }
    actions.push(action('move_deal_stage', `Move to ${stage.name}`, `Move ${matchedDeal.companyName ?? matchedDeal.title} to ${stage.name}.`, {
      dealId: matchedDeal.id,
      stageId: stage.id,
    }, {
      record: { type: 'deal', id: matchedDeal.id, label: matchedDeal.companyName ?? matchedDeal.title, href: `/deals/${matchedDeal.id}` },
      before: [{ label: 'Stage', value: matchedDeal.stageName ?? 'No stage' }],
      after: [{ label: 'Stage', value: stage.name }],
    }))
  }

  if (/\b(add|save|log|write)\b/.test(lower) && /\b(note|update)\b/.test(lower)) {
    if (!matchedDeal) return clarifyDeal(input.pipeline.deals, message, 'Which deal should this note be added to?')
    const note = extractNote(message, matchedDeal)
    if (!note) return { actions, links, clarification: 'What note should I add?' }
    actions.push(action('add_deal_note', 'Add note', `Add this note to ${matchedDeal.companyName ?? matchedDeal.title}.`, {
      dealId: matchedDeal.id,
      note,
    }, {
      record: { type: 'deal', id: matchedDeal.id, label: matchedDeal.companyName ?? matchedDeal.title, href: `/deals/${matchedDeal.id}` },
      after: [{ label: 'Note', value: compactAssistantText(note, 160) }],
    }))
  }

  const dealPatch = extractDealPatch(message, input.pipeline.stages)
  if (dealPatch && /\b(update|set|change)\b/.test(lower)) {
    if (!matchedDeal) return clarifyDeal(input.pipeline.deals, message, 'Which deal should I update?')
    actions.push(action('update_deal', 'Update deal', `Update ${matchedDeal.companyName ?? matchedDeal.title}.`, {
      dealId: matchedDeal.id,
      ...dealPatch.patch,
    }, {
      record: { type: 'deal', id: matchedDeal.id, label: matchedDeal.companyName ?? matchedDeal.title, href: `/deals/${matchedDeal.id}` },
      before: dealPatch.before(matchedDeal),
      after: dealPatch.after,
    }))
  }

  if (/\b(create|add|new)\b/.test(lower) && /\b(company|account)\b/.test(lower)) {
    const name = extractNamedValue(message, /\b(?:company|account)\s+(?:called|named)?\s*([^,.;]+)/i)
    if (!name) return { actions, links, clarification: 'What is the company name?' }
    actions.push(action('create_company', 'Create company', `Create company ${name}.`, { name }, {
      after: [{ label: 'Company', value: name }],
    }))
  }

  if (/\b(create|add|new)\b/.test(lower) && /\b(person|contact)\b/.test(lower)) {
    const fullName = extractNamedValue(message, /\b(?:person|contact)\s+(?:called|named)?\s*([^,.;]+)/i)
    if (!fullName) return { actions, links, clarification: 'What is the contact name?' }
    const email = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null
    actions.push(action('create_contact', 'Create contact', `Create contact ${fullName}.`, {
      fullName,
      email,
      companyName: matchedDeal?.companyName ?? null,
    }, {
      record: matchedDeal ? { type: 'deal', id: matchedDeal.id, label: matchedDeal.companyName ?? matchedDeal.title, href: `/deals/${matchedDeal.id}` } : undefined,
      after: [
        { label: 'Contact', value: fullName },
        { label: 'Email', value: email ?? 'Missing' },
      ],
    }))
  }

  if (/\b(create|add|new)\b/.test(lower) && /\b(deal|opportunity)\b/.test(lower)) {
    const companyName = extractNamedValue(message, /\b(?:for|with|at)\s+([^,.;]+)/i)
    const title = extractNamedValue(message, /\b(?:deal|opportunity)\s+(?:called|named)?\s*([^,.;]+)/i) ?? (companyName ? `${companyName} opportunity` : '')
    if (!companyName || !title) return { actions, links, clarification: 'I need a deal title and company before creating it.' }
    const valueAmount = extractMoney(message)
    const expectedCloseDate = parseDueDate(message)
    actions.push(action('create_deal', 'Create deal', `Create ${title} for ${companyName}.`, {
      title,
      companyName,
      valueAmount,
      expectedCloseDate: expectedCloseDate?.toISOString() ?? null,
    }, {
      after: [
        { label: 'Deal', value: title },
        { label: 'Company', value: companyName },
        { label: 'Value', value: valueAmount == null ? 'Missing' : String(valueAmount) },
      ],
    }))
  }

  if (/\b(complete|done|finish|cancel|snooze|edit)\b/.test(lower) && /\b(task|todo|to do)\b/.test(lower)) {
    const tasks = await listTasks(input.workspaceId, input.userId, 'todo')
    const task = findMentionedTask(message, tasks, matchedDeal?.id)
    if (!task) return { actions, links, clarification: 'Which task should I change?' }
    const taskAction = /\b(cancel)\b/.test(lower) ? 'cancel_task' : /\b(snooze)\b/.test(lower) ? 'snooze_task' : /\b(edit)\b/.test(lower) ? 'edit_task' : 'complete_task'
    const dueAt = taskAction === 'snooze_task' ? (parseDueDate(message) ?? new Date(Date.now() + 86_400_000)) : null
    actions.push(action(taskAction as AssistantActionType, taskAction === 'complete_task' ? 'Complete task' : taskAction === 'cancel_task' ? 'Cancel task' : taskAction === 'snooze_task' ? 'Snooze task' : 'Edit task', `${taskActionLabel(taskAction)} "${task.title}".`, {
      taskId: task.id,
      dueAt: dueAt?.toISOString() ?? null,
    }, {
      record: { type: 'task', id: task.id, label: task.title, href: task.dealId ? `/deals/${task.dealId}` : '/tasks' },
      before: [{ label: 'Status', value: task.status }],
      after: [{ label: taskAction === 'snooze_task' ? 'Due' : 'Status', value: taskAction === 'snooze_task' ? formatDate(dueAt!) : taskAction === 'cancel_task' ? 'cancelled' : 'done' }],
    }))
  }

  if (/\b(search|find|open|show)\b/.test(lower)) {
    const records = findRecords(message, input.pipeline.deals, await listCompanies(input.workspaceId, input.userId), await listContacts(input.workspaceId, input.userId))
    links.push(...records.slice(0, 6))
  }

  return {
    actions,
    links,
    clarification,
  }
}

async function planWithValidatedAiTools(input: PlanningInput, matchedDeal: any | null) {
  const [tasks, companies, contacts] = await Promise.all([
    listTasks(input.workspaceId, input.userId),
    listCompanies(input.workspaceId, input.userId),
    listContacts(input.workspaceId, input.userId),
  ])
  const plan = await planAssistantToolsWithAI({
    message: input.message,
    plan: input.plan,
    crm: {
      currentDealId: input.dealId ?? null,
      stages: input.pipeline.stages.map(stage => ({ id: stage.id, name: stage.name, key: stage.key })),
      deals: input.pipeline.deals.slice(0, 80).map(deal => ({
        id: deal.id,
        title: deal.title,
        companyName: deal.companyName,
        stageName: deal.stageName,
        status: deal.status,
        valueAmount: deal.valueAmount,
        expectedCloseDate: deal.expectedCloseDate,
        aiNextAction: deal.aiNextAction,
      })),
      tasks: tasks.slice(0, 120).map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueAt: task.dueAt,
        dealId: task.dealId,
        dealTitle: task.dealTitle,
        companyName: task.companyName,
      })),
      companies: (companies as any[]).slice(0, 80).map(company => ({ id: company.id, name: company.name, domain: company.domain })),
      contacts: (contacts as any[]).slice(0, 80).map(contact => ({ id: contact.id, fullName: contact.fullName, email: contact.email, companyName: contact.companyName })),
    },
  })
  if (!plan) return { actions: [], links: [], clarification: '' }
  return materializeToolPlan(plan, {
    message: input.message,
    currentDealId: input.dealId ?? null,
    matchedDeal,
    deals: input.pipeline.deals,
    stages: input.pipeline.stages,
    tasks,
    companies: companies as any[],
    contacts: contacts as any[],
  })
}

function materializeToolPlan(plan: AssistantToolPlan, ctx: {
  message: string
  currentDealId?: string | null
  matchedDeal: any | null
  deals: any[]
  stages: any[]
  tasks: any[]
  companies: any[]
  contacts: any[]
}) {
  if (plan.clarification?.trim()) {
    return { actions: [], links: linksForClarification(plan.clarification, ctx), clarification: plan.clarification.trim() }
  }

  const proposed: AssistantProposedAction[] = []
  const links: Array<{ label: string; href: string }> = []
  for (const raw of plan.actions ?? []) {
    const fields = raw.fields ?? {}
    const target = raw.target ?? (ctx.currentDealId ? ctx.deals.find(deal => deal.id === ctx.currentDealId)?.title : null)

    if (raw.type === 'open_record') {
      const record = findAnyRecord(String(target ?? ctx.message), ctx)
      if (record) links.push(record)
      continue
    }

    if (raw.type === 'draft_follow_up') continue

    if (raw.type === 'create_task') {
      const deal = resolveDeal(target, ctx) ?? ctx.matchedDeal
      const title = requiredPlanText(raw.title ?? fields.title, 'What should the task say?')
      if ('clarification' in title) return { actions: [], links, clarification: title.clarification }
      const dueAt = parsePlanDate(raw.dueAt ?? fields.dueAt)
      proposed.push(action('create_task', 'Create task', `Create "${title.value}"${deal ? ` for ${deal.companyName ?? deal.title}` : ''}.`, {
        title: title.value,
        dueAt: dueAt?.toISOString() ?? null,
        dealId: deal?.id ?? null,
        priority: normalizePriority(raw.priority ?? fields.priority),
      }, {
        record: deal ? { type: 'deal', id: deal.id, label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` } : undefined,
        after: [
          { label: 'Task', value: title.value },
          { label: 'Due', value: dueAt ? formatDate(dueAt) : 'No due date' },
        ],
      }))
      continue
    }

    if (raw.type === 'move_deal_stage') {
      const deal = resolveDeal(target, ctx) ?? ctx.matchedDeal
      if (!deal) return { actions: [], links, clarification: 'Which deal should I move?' }
      const stage = resolveStage(raw.stage ?? fields.stage ?? fields.stageName, ctx.stages)
      if (!stage) return { actions: [], links: ctx.stages.map(stage => ({ label: stage.name, href: '/deals?view=pipeline' })), clarification: 'Which pipeline stage should I move it to?' }
      proposed.push(action('move_deal_stage', `Move to ${stage.name}`, `Move ${deal.companyName ?? deal.title} to ${stage.name}.`, {
        dealId: deal.id,
        stageId: stage.id,
      }, {
        record: { type: 'deal', id: deal.id, label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` },
        before: [{ label: 'Stage', value: deal.stageName ?? 'No stage' }],
        after: [{ label: 'Stage', value: stage.name }],
      }))
      continue
    }

    if (raw.type === 'update_deal') {
      const deal = resolveDeal(target, ctx) ?? ctx.matchedDeal
      if (!deal) return { actions: [], links, clarification: 'Which deal should I update?' }
      const patch = patchFromAiFields(fields, raw, ctx.stages)
      if (!Object.keys(patch.params).length) return { actions: [], links, clarification: 'Which deal fields should I update?' }
      proposed.push(action('update_deal', 'Update deal', `Update ${deal.companyName ?? deal.title}.`, {
        dealId: deal.id,
        ...patch.params,
      }, {
        record: { type: 'deal', id: deal.id, label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` },
        before: patch.before(deal),
        after: patch.after,
      }))
      continue
    }

    if (raw.type === 'add_deal_note') {
      const deal = resolveDeal(target, ctx) ?? ctx.matchedDeal
      if (!deal) return { actions: [], links, clarification: 'Which deal should this note be added to?' }
      const note = requiredPlanText(raw.note ?? fields.note ?? fields.body, 'What note should I add?')
      if ('clarification' in note) return { actions: [], links, clarification: note.clarification }
      proposed.push(action('add_deal_note', 'Add note', `Add this note to ${deal.companyName ?? deal.title}.`, {
        dealId: deal.id,
        note: note.value,
      }, {
        record: { type: 'deal', id: deal.id, label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` },
        after: [{ label: 'Note', value: compactAssistantText(note.value, 160) }],
      }))
      continue
    }

    if (raw.type === 'complete_task' || raw.type === 'cancel_task' || raw.type === 'snooze_task' || raw.type === 'edit_task') {
      const task = resolveTask(target ?? raw.title ?? fields.title, ctx)
      if (!task) return { actions: [], links, clarification: 'Which task should I change?' }
      const dueAt = raw.type === 'snooze_task' ? (parsePlanDate(raw.dueAt ?? fields.dueAt) ?? new Date(Date.now() + 86_400_000)) : parsePlanDate(fields.dueAt)
      const params: Record<string, unknown> = { taskId: task.id, dueAt: dueAt?.toISOString() ?? null }
      if (raw.type === 'edit_task') {
        if (typeof fields.title === 'string') params.title = fields.title
        params.priority = normalizePriority(fields.priority)
      }
      proposed.push(action(raw.type, raw.type === 'complete_task' ? 'Complete task' : raw.type === 'cancel_task' ? 'Cancel task' : raw.type === 'snooze_task' ? 'Snooze task' : 'Edit task', `${taskActionLabel(raw.type)} "${task.title}".`, params, {
        record: { type: 'task', id: task.id, label: task.title, href: task.dealId ? `/deals/${task.dealId}` : '/tasks' },
        before: [{ label: 'Status', value: task.status }],
        after: [{ label: raw.type === 'snooze_task' ? 'Due' : 'Status', value: raw.type === 'snooze_task' && dueAt ? formatDate(dueAt) : raw.type === 'cancel_task' ? 'cancelled' : raw.type === 'complete_task' ? 'done' : 'updated' }],
      }))
      continue
    }

    if (raw.type === 'create_deal') {
      const title = requiredPlanText(raw.title ?? fields.title, 'What is the deal title?')
      if ('clarification' in title) return { actions: [], links, clarification: title.clarification }
      const companyName = requiredPlanText(fields.companyName ?? fields.company ?? target, 'Which company is this deal for?')
      if ('clarification' in companyName) return { actions: [], links, clarification: companyName.clarification }
      const expectedCloseDate = parsePlanDate(fields.expectedCloseDate ?? fields.closeDate)
      proposed.push(action('create_deal', 'Create deal', `Create ${title.value} for ${companyName.value}.`, {
        title: title.value,
        companyName: companyName.value,
        valueAmount: nullableNumber(fields.valueAmount ?? fields.value),
        expectedCloseDate: expectedCloseDate?.toISOString() ?? null,
      }, {
        after: [
          { label: 'Deal', value: title.value },
          { label: 'Company', value: companyName.value },
        ],
      }))
      continue
    }

    if (raw.type === 'create_company') {
      const name = requiredPlanText(fields.name ?? target ?? raw.title, 'What is the company name?')
      if ('clarification' in name) return { actions: [], links, clarification: name.clarification }
      proposed.push(action('create_company', 'Create company', `Create company ${name.value}.`, {
        name: name.value,
        domain: fields.domain ?? null,
        website: fields.website ?? null,
        industry: fields.industry ?? null,
        sizeLabel: fields.sizeLabel ?? null,
      }, {
        after: [{ label: 'Company', value: name.value }],
      }))
      continue
    }

    if (raw.type === 'create_contact') {
      const fullName = requiredPlanText(fields.fullName ?? fields.name ?? target ?? raw.title, 'What is the contact name?')
      if ('clarification' in fullName) return { actions: [], links, clarification: fullName.clarification }
      proposed.push(action('create_contact', 'Create contact', `Create contact ${fullName.value}.`, {
        fullName: fullName.value,
        email: fields.email ?? null,
        jobTitle: fields.jobTitle ?? null,
        phone: fields.phone ?? null,
        companyName: fields.companyName ?? fields.company ?? null,
      }, {
        after: [
          { label: 'Contact', value: fullName.value },
          { label: 'Email', value: typeof fields.email === 'string' ? fields.email : 'Missing' },
        ],
      }))
    }
  }

  return { actions: proposed, links: dedupeLinks(links), clarification: '' }
}

export async function executeAssistantAction(input: {
  action: AssistantProposedAction
  workspaceId: string
  userId: string
}) {
  if (!mutationTypes.has(input.action.type)) {
    return { message: 'This action does not change CRM data.', data: null }
  }

  const params = input.action.params ?? {}
  switch (input.action.type) {
    case 'create_deal': {
      const data = await createNativeDeal({
        workspaceId: input.workspaceId,
        userId: input.userId,
        title: requiredString(params.title, 'title'),
        companyName: requiredString(params.companyName, 'companyName'),
        valueAmount: nullableNumber(params.valueAmount),
        expectedCloseDate: nullableDate(params.expectedCloseDate),
      })
      return { message: `Created deal "${data.title}".`, data, href: `/deals/${data.id}` }
    }
    case 'update_deal': {
      const dealId = requiredString(params.dealId, 'dealId')
      const data = await updateNativeDeal({
        workspaceId: input.workspaceId,
        userId: input.userId,
        dealId,
        title: optionalString(params.title),
        stageId: optionalString(params.stageId),
        status: ['open', 'won', 'lost', 'archived'].includes(String(params.status)) ? String(params.status) as any : undefined,
        valueAmount: 'valueAmount' in params ? nullableNumber(params.valueAmount) : undefined,
        expectedCloseDate: 'expectedCloseDate' in params ? nullableDate(params.expectedCloseDate) : undefined,
        aiNextAction: optionalString(params.aiNextAction),
      })
      if (!data) throw new Error('Deal not found')
      return { message: `Updated deal "${data.title}".`, data, href: `/deals/${data.id}` }
    }
    case 'move_deal_stage': {
      const data = await moveDealStage({
        workspaceId: input.workspaceId,
        userId: input.userId,
        dealId: requiredString(params.dealId, 'dealId'),
        stageId: requiredString(params.stageId, 'stageId'),
      })
      if (!data) throw new Error('Deal or stage not found')
      return { message: `Moved "${data.title}".`, data, href: `/deals/${data.id}` }
    }
    case 'add_deal_note': {
      const data = await addDealUpdate({
        workspaceId: input.workspaceId,
        userId: input.userId,
        dealId: requiredString(params.dealId, 'dealId'),
        note: requiredString(params.note, 'note'),
        mode: 'note',
      })
      if (!data) throw new Error('Deal not found')
      return { message: 'Added the note.', data, href: `/deals/${data.deal.id}` }
    }
    case 'create_task': {
      const data = await createNativeTask({
        workspaceId: input.workspaceId,
        userId: input.userId,
        title: requiredString(params.title, 'title'),
        dueAt: nullableDate(params.dueAt),
        priority: ['low', 'normal', 'high', 'urgent'].includes(String(params.priority)) ? String(params.priority) as any : 'normal',
        dealId: optionalString(params.dealId) ?? null,
      })
      return { message: `Created task "${data.title}".`, data, href: data.dealId ? `/deals/${data.dealId}` : '/tasks' }
    }
    case 'complete_task':
    case 'cancel_task':
    case 'snooze_task':
    case 'edit_task': {
      const action = input.action.type === 'complete_task' ? 'complete' : input.action.type === 'cancel_task' ? 'cancel' : input.action.type === 'snooze_task' ? 'snooze' : 'edit'
      const data = await updateTask({
        workspaceId: input.workspaceId,
        userId: input.userId,
        taskId: requiredString(params.taskId, 'taskId'),
        action,
        title: optionalString(params.title),
        dueAt: nullableDate(params.dueAt),
        priority: ['low', 'normal', 'high', 'urgent'].includes(String(params.priority)) ? String(params.priority) as any : null,
      })
      if (!data) throw new Error('Task not found')
      return { message: `${taskActionLabel(input.action.type)} "${data.title}".`, data, href: data.dealId ? `/deals/${data.dealId}` : '/tasks' }
    }
    case 'create_company': {
      const data = await createNativeCompany({
        workspaceId: input.workspaceId,
        userId: input.userId,
        name: requiredString(params.name, 'name'),
        domain: optionalString(params.domain) ?? null,
        website: optionalString(params.website) ?? null,
        industry: optionalString(params.industry) ?? null,
        sizeLabel: optionalString(params.sizeLabel) ?? null,
      })
      return { message: `Created company "${data.name}".`, data, href: `/companies/${data.id}` }
    }
    case 'create_contact': {
      const data = await createNativeContact({
        workspaceId: input.workspaceId,
        userId: input.userId,
        fullName: requiredString(params.fullName, 'fullName'),
        email: optionalString(params.email) ?? null,
        jobTitle: optionalString(params.jobTitle) ?? null,
        phone: optionalString(params.phone) ?? null,
        companyName: optionalString(params.companyName) ?? null,
      })
      return { message: `Created contact "${data.fullName}".`, data, href: `/people/${data.id}` }
    }
  }
}

function action(type: AssistantActionType, label: string, description: string, params: Record<string, unknown>, extra: Partial<AssistantProposedAction> = {}): AssistantProposedAction {
  return {
    id: `${type}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    label,
    description,
    params,
    requiresConfirmation: mutationTypes.has(type),
    ...extra,
  }
}

function findMentionedDeals(message: string, deals: any[]) {
  const normalized = normalizeAssistantText(message)
  return deals.filter(deal => {
    const names = [deal.title, deal.companyName].map(normalizeAssistantText).filter(Boolean)
    return names.some(name => name.length > 2 && normalized.includes(name))
  })
}

function clarifyDeal(deals: any[], message: string, fallback: string) {
  const matches = findMentionedDeals(message, deals)
  return {
    actions: [],
    links: matches.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })),
    clarification: matches.length > 1 ? `I found multiple matching deals: ${matches.map(deal => deal.companyName ?? deal.title).join(', ')}. Which one should I use?` : fallback,
  }
}

function findStage(message: string, stages: any[]) {
  const normalized = normalizeAssistantText(message)
  return stages.find(stage => {
    const name = normalizeAssistantText(stage.name)
    const key = normalizeAssistantText(stage.key)
    return (name && normalized.includes(name)) || (key && normalized.includes(key))
  }) ?? null
}

function extractTaskTitle(message: string, deal?: any | null) {
  let text = message
    .replace(/\b(create|add|new)\b/ig, '')
    .replace(/\b(task|todo|to do)\b/ig, '')
    .replace(/\bfor\s+[^,.;]+/i, '')
    .replace(/\b(on|by|due)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig, '')
    .replace(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig, '')
    .trim()
  if (deal?.companyName) text = text.replace(new RegExp(escapeRegExp(deal.companyName), 'ig'), '').trim()
  if (deal?.title) text = text.replace(new RegExp(escapeRegExp(deal.title), 'ig'), '').trim()
  return cleanSentence(text || 'Follow up')
}

function extractNote(message: string, deal?: any | null) {
  const colon = message.split(/:\s*/).slice(1).join(': ').trim()
  if (colon) return colon
  let text = message.replace(/\b(add|save|log|write)\b/ig, '').replace(/\b(note|update)\b/ig, '').replace(/\b(to|for|on|about)\s+[^,.;]+/i, '').trim()
  if (deal?.companyName) text = text.replace(new RegExp(escapeRegExp(deal.companyName), 'ig'), '').trim()
  if (deal?.title) text = text.replace(new RegExp(escapeRegExp(deal.title), 'ig'), '').trim()
  return cleanSentence(text)
}

function extractDealPatch(message: string, stages: any[]) {
  const valueAmount = extractMoney(message)
  const expectedCloseDate = /\b(close|date)\b/i.test(message) ? parseDueDate(message) : null
  const stage = findStage(message, stages)
  const next = message.match(/\bnext action\s+(?:to|is|as)?\s*([^.;]+)/i)?.[1]
  const patch: Record<string, unknown> = {}
  const after: Array<{ label: string; value: string }> = []
  if (valueAmount != null) {
    patch.valueAmount = valueAmount
    after.push({ label: 'Value', value: String(valueAmount) })
  }
  if (expectedCloseDate) {
    patch.expectedCloseDate = expectedCloseDate.toISOString()
    after.push({ label: 'Close date', value: formatDate(expectedCloseDate) })
  }
  if (stage) {
    patch.stageId = stage.id
    after.push({ label: 'Stage', value: stage.name })
  }
  if (next) {
    patch.aiNextAction = cleanSentence(next)
    after.push({ label: 'Next action', value: cleanSentence(next) })
  }
  if (!Object.keys(patch).length) return null
  return {
    patch,
    after,
    before: (deal: any) => after.map(item => ({
      label: item.label,
      value: item.label === 'Value' ? String(deal.valueAmount ?? 'Missing')
        : item.label === 'Close date' ? (deal.expectedCloseDate ? formatDate(new Date(deal.expectedCloseDate)) : 'Missing')
          : item.label === 'Stage' ? (deal.stageName ?? 'Missing')
            : deal.aiNextAction ?? 'Missing',
    })),
  }
}

function parseDueDate(message: string, now = new Date()) {
  const lower = message.toLowerCase()
  if (/\btoday\b/.test(lower)) return endOfDay(now)
  if (/\btomorrow\b/.test(lower)) return endOfDay(addDays(now, 1))
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const weekdayIndex = weekdays.findIndex(day => new RegExp(`\\b${day}\\b`).test(lower))
  if (weekdayIndex >= 0) {
    const days = (weekdayIndex - now.getDay() + 7) % 7 || 7
    return endOfDay(addDays(now, days))
  }
  const iso = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]
  if (iso) {
    const date = new Date(`${iso}T17:00:00`)
    if (!Number.isNaN(date.getTime())) return date
  }
  return null
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(17, 0, 0, 0)
  return next
}

function extractMoney(message: string) {
  const match = message.match(/(?:£|\$|value\s+|worth\s+)(\d[\d,]*)/i)
  return match ? Number(match[1].replace(/,/g, '')) : null
}

function extractNamedValue(message: string, pattern: RegExp) {
  const value = message.match(pattern)?.[1]
  return value ? cleanSentence(value) : null
}

function findMentionedTask(message: string, tasks: any[], dealId?: string | null) {
  const normalized = normalizeAssistantText(message)
  const scoped = dealId ? tasks.filter(task => task.dealId === dealId) : tasks
  return scoped.find(task => normalizeAssistantText(task.title).split(' ').some((word: string) => word.length > 3 && normalized.includes(word))) ?? (scoped.length === 1 ? scoped[0] : null)
}

function findRecords(message: string, deals: any[], companies: any[], contacts: any[]) {
  const normalized = normalizeAssistantText(message)
  const matches: Array<{ label: string; href: string }> = []
  for (const deal of deals) {
    if ([deal.title, deal.companyName].map(normalizeAssistantText).some(name => name && normalized.includes(name))) {
      matches.push({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })
    }
  }
  for (const company of companies as any[]) {
    if (normalizeAssistantText(company.name) && normalized.includes(normalizeAssistantText(company.name))) {
      matches.push({ label: company.name, href: `/companies/${company.id}` })
    }
  }
  for (const contact of contacts as any[]) {
    if (normalizeAssistantText(contact.fullName) && normalized.includes(normalizeAssistantText(contact.fullName))) {
      matches.push({ label: contact.fullName, href: `/people/${contact.id}` })
    }
  }
  return matches
}

function linksForClarification(clarification: string, ctx: { deals: any[]; companies: any[]; contacts: any[]; tasks: any[] }) {
  const normalized = normalizeAssistantText(clarification)
  return dedupeLinks([
    ...ctx.deals
      .filter(deal => [deal.title, deal.companyName].map(normalizeAssistantText).some(name => name && normalized.includes(name)))
      .slice(0, 5)
      .map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })),
    ...ctx.tasks
      .filter(task => normalizeAssistantText(task.title) && normalized.includes(normalizeAssistantText(task.title)))
      .slice(0, 5)
      .map(task => ({ label: task.title, href: task.dealId ? `/deals/${task.dealId}` : '/tasks' })),
  ])
}

function findAnyRecord(value: string, ctx: { deals: any[]; companies: any[]; contacts: any[]; tasks: any[] }) {
  const normalized = normalizeAssistantText(value)
  const deal = ctx.deals.find(deal => [deal.title, deal.companyName].map(normalizeAssistantText).some(name => name && normalized.includes(name)))
  if (deal) return { label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` }
  const company = ctx.companies.find(company => normalizeAssistantText(company.name) && normalized.includes(normalizeAssistantText(company.name)))
  if (company) return { label: company.name, href: `/companies/${company.id}` }
  const contact = ctx.contacts.find(contact => normalizeAssistantText(contact.fullName) && normalized.includes(normalizeAssistantText(contact.fullName)))
  if (contact) return { label: contact.fullName, href: `/people/${contact.id}` }
  const task = ctx.tasks.find(task => normalizeAssistantText(task.title) && normalized.includes(normalizeAssistantText(task.title)))
  if (task) return { label: task.title, href: task.dealId ? `/deals/${task.dealId}` : '/tasks' }
  return null
}

function resolveDeal(value: unknown, ctx: { currentDealId?: string | null; deals: any[] }) {
  if (ctx.currentDealId) return ctx.deals.find(deal => deal.id === ctx.currentDealId) ?? null
  const text = normalizeAssistantText(String(value ?? ''))
  if (!text) return null
  const matches = ctx.deals.filter(deal => [deal.id, deal.title, deal.companyName].map(normalizeAssistantText).some(name => name && (text === name || text.includes(name) || name.includes(text))))
  return matches.length === 1 ? matches[0] : null
}

function resolveTask(value: unknown, ctx: { tasks: any[]; currentDealId?: string | null }) {
  const text = normalizeAssistantText(String(value ?? ''))
  const scoped = ctx.currentDealId ? ctx.tasks.filter(task => task.dealId === ctx.currentDealId) : ctx.tasks
  if (!text) return scoped.length === 1 ? scoped[0] : null
  const matches = scoped.filter(task => [task.id, task.title].map(normalizeAssistantText).some(name => name && (text === name || text.includes(name) || name.includes(text))))
  return matches.length === 1 ? matches[0] : null
}

function resolveStage(value: unknown, stages: any[]) {
  const text = normalizeAssistantText(String(value ?? ''))
  if (!text) return null
  const matches = stages.filter(stage => [stage.id, stage.name, stage.key].map(normalizeAssistantText).some(name => name && (text === name || text.includes(name) || name.includes(text))))
  return matches.length === 1 ? matches[0] : null
}

function patchFromAiFields(fields: Record<string, unknown>, raw: NonNullable<AssistantToolPlan['actions']>[number], stages: any[]) {
  const params: Record<string, unknown> = {}
  const after: Array<{ label: string; value: string }> = []
  const title = optionalString(fields.title ?? raw.title)
  const status = optionalString(fields.status)
  const nextAction = optionalString(fields.aiNextAction ?? fields.nextAction)
  const valueAmount = nullableNumber(fields.valueAmount ?? fields.value)
  const expectedCloseDate = parsePlanDate(fields.expectedCloseDate ?? fields.closeDate)
  const stage = resolveStage(fields.stage ?? fields.stageName ?? raw.stage, stages)

  if (title) {
    params.title = title
    after.push({ label: 'Title', value: title })
  }
  if (status && ['open', 'won', 'lost', 'archived'].includes(status)) {
    params.status = status
    after.push({ label: 'Status', value: status })
  }
  if (valueAmount != null) {
    params.valueAmount = valueAmount
    after.push({ label: 'Value', value: String(valueAmount) })
  }
  if (expectedCloseDate) {
    params.expectedCloseDate = expectedCloseDate.toISOString()
    after.push({ label: 'Close date', value: formatDate(expectedCloseDate) })
  }
  if (stage) {
    params.stageId = stage.id
    after.push({ label: 'Stage', value: stage.name })
  }
  if (nextAction) {
    params.aiNextAction = nextAction
    after.push({ label: 'Next action', value: nextAction })
  }

  return {
    params,
    after,
    before: (deal: any) => after.map(item => ({
      label: item.label,
      value: item.label === 'Title' ? deal.title
        : item.label === 'Status' ? deal.status
          : item.label === 'Value' ? String(deal.valueAmount ?? 'Missing')
            : item.label === 'Close date' ? (deal.expectedCloseDate ? formatDate(new Date(deal.expectedCloseDate)) : 'Missing')
              : item.label === 'Stage' ? (deal.stageName ?? 'Missing')
                : deal.aiNextAction ?? 'Missing',
    })),
  }
}

function requiredPlanText(value: unknown, clarification: string): { value: string } | { clarification: string } {
  const text = optionalString(value)
  return text ? { value: text } : { clarification }
}

function parsePlanDate(value: unknown) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const text = String(value)
  const parsed = parseDueDate(text)
  if (parsed) return parsed
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizePriority(value: unknown): 'low' | 'normal' | 'high' | 'urgent' {
  return value === 'low' || value === 'high' || value === 'urgent' ? value : 'normal'
}

function dedupeLinks(links: Array<{ label: string; href: string }>) {
  const seen = new Set<string>()
  return links.filter(link => {
    if (seen.has(link.href)) return false
    seen.add(link.href)
    return true
  })
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
  return value.trim()
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function nullableDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function cleanSentence(value: string) {
  return value.replace(/\s+/g, ' ').replace(/^[-:,\s]+|[-:,\s]+$/g, '').trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function taskActionLabel(action: string) {
  if (action === 'cancel_task') return 'Cancel'
  if (action === 'snooze_task') return 'Snooze'
  if (action === 'edit_task') return 'Edit'
  return 'Complete'
}
