import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { getDealContextNative, listActivity, listPipeline, listToday } from '@/lib/crm/core'
import { answerAssistantWithAI } from '@/lib/crm/ai'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId, plan } = await getWorkspaceContext(userId)
    const { message, dealId } = await req.json()
    const rawMessage = String(message ?? '')
    const lower = rawMessage.toLowerCase()

    const pipeline = await listPipeline(workspaceId, userId)
    const matchedDeal = typeof dealId === 'string' && dealId ? null : findMentionedDeal(rawMessage, pipeline.deals)
    const resolvedDealId = typeof dealId === 'string' && dealId ? dealId : matchedDeal?.id
    const dealContext = resolvedDealId ? await getDealContextNative(resolvedDealId, workspaceId) : null
    const dealScoped = Boolean(dealContext)

    const today = dealScoped ? null : await listToday(workspaceId, userId)
    const activity = dealScoped ? [] : await listActivity(workspaceId, userId)

    const openDeals = pipeline.deals.filter(deal => deal.status === 'open')
    const intelligenceDeals = openDeals.map(deal => ({
      ...deal,
      riskDrivers: deal.intelligence?.riskDrivers ?? [],
      missingData: deal.intelligence?.missingData ?? [],
      positiveSignals: deal.intelligence?.positiveSignals ?? [],
    }))
    const noNextStepDeals = openDeals.filter(deal => !deal.aiNextAction && !deal.nextStepDueAt)
    const missingDataDeals = openDeals.filter(deal => !deal.valueAmount || !deal.expectedCloseDate)
    const slippingDeals = intelligenceDeals
      .filter(deal => [
        deal.aiRiskLevel === 'high',
        (deal.riskDrivers ?? []).some((reason: string) => /activity|close date|passed|stuck|blocked|waiting|concern|data|alignment|next step/i.test(reason)),
        !deal.aiNextAction && !deal.nextStepDueAt,
      ].some(Boolean))
      .sort((a, b) => (b.aiRiskLevel === 'high' ? 1 : 0) - (a.aiRiskLevel === 'high' ? 1 : 0) || (a.aiScore ?? 100) - (b.aiScore ?? 100))
    const atRiskDeals = intelligenceDeals
      .filter(deal => deal.aiRiskLevel === 'high' || (deal.riskDrivers ?? []).length)
      .sort((a, b) => (a.aiScore ?? 100) - (b.aiScore ?? 100))

    let fallbackAnswer = ''
    const links: Array<{ label: string; href: string }> = []

    if (dealContext) {
      fallbackAnswer = answerDealScoped(lower, dealContext)
      links.push({ label: dealContext.company?.name ?? dealContext.deal.title, href: `/deals/${dealContext.deal.id}` })
    } else if (lower.includes('draft') && (lower.includes('follow') || lower.includes('email'))) {
      fallbackAnswer = 'Which deal should I draft this for? I do not want to mix workspace context into a customer email.'
    } else if (looksDealSpecific(lower)) {
      fallbackAnswer = 'I could not confidently match that to one deal. Open the deal first or include the exact deal/company name so I do not pull context from the wrong account.'
    } else if (lower.includes('no next') || lower.includes('next step')) {
      fallbackAnswer = noNextStepDeals.length
        ? [
            `What happened: ${noNextStepDeals.length} open deal${noNextStepDeals.length === 1 ? '' : 's'} have no recorded next step.`,
            'What it means: confidence should stay limited until each deal has a named action and owner.',
            `Next: start with ${noNextStepDeals[0].companyName ?? noNextStepDeals[0].title} and add a concrete follow-up.`,
          ].join('\n')
        : 'No open deals are missing a next step right now.'
      links.push(...noNextStepDeals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('slipping') || lower.includes('stale') || lower.includes('stuck')) {
      const deals = slippingDeals.length ? slippingDeals : (today?.staleDeals ?? [])
      fallbackAnswer = deals.length
        ? [
            `What happened: ${deals.length} deal${deals.length === 1 ? '' : 's'} look like they may be slipping.`,
            `What it means: ${explainDeal(deals[0])}`,
            `Next: open ${deals[0].companyName ?? deals[0].title} and resolve the highest-confidence blocker or add a dated next action.`,
          ].join('\n')
        : 'No slipping deals are currently flagged from the available CRM evidence.'
      links.push(...deals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('at risk') || lower.includes('risk')) {
      const deals = atRiskDeals.length ? atRiskDeals : (today?.atRiskDeals ?? [])
      fallbackAnswer = deals.length
        ? [
            `What happened: ${deals.length} deal${deals.length === 1 ? '' : 's'} are showing elevated risk.`,
            `What it means: ${explainDeal(deals[0])}`,
            `Next: start with ${deals[0].companyName ?? deals[0].title}. Score ${deals[0].aiScore ?? 'unknown'}, confidence ${deals[0].aiConfidence ?? 'unknown'}%, risk ${deals[0].aiRiskLevel}.`,
          ].join('\n')
        : 'No high-risk deals are showing right now.'
      links.push(...deals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('missing') || lower.includes('data')) {
      fallbackAnswer = missingDataDeals.length
        ? [
            `What happened: ${missingDataDeals.length} open deal${missingDataDeals.length === 1 ? '' : 's'} are missing value or close-date data.`,
            'What it means: score may still show momentum, but confidence should remain lower until the facts are complete.',
            `Next: update ${missingDataDeals[0].companyName ?? missingDataDeals[0].title} first.`,
          ].join('\n')
        : 'No open deals are missing value or close date.'
      links.push(...missingDataDeals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('close') || lower.includes('month') || lower.includes('likely')) {
      fallbackAnswer = today?.likelyClosers?.length
        ? [
            `What happened: ${today.likelyClosers.length} deal${today.likelyClosers.length === 1 ? '' : 's'} look closest to closing soon.`,
            'What it means: these have better timing or momentum, but still need evidence checked before forecasting.',
            `Next: review ${today.likelyClosers[0].companyName ?? today.likelyClosers[0].title} and confirm the buyer-side next step.`,
          ].join('\n')
        : 'No likely closers are flagged in the next 7 days yet.'
      links.push(...(today?.likelyClosers ?? []).slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('meeting') || lower.includes('prep')) {
      fallbackAnswer = today?.upcomingMeetings?.length
        ? [
            `What happened: your next matched meeting is ${today.upcomingMeetings[0].title}.`,
            'What it means: prep should start from the linked company, deal, last touch, and open tasks.',
            'Next: open the meeting or linked deal and add notes after the call so Halvex can propose updates.',
          ].join('\n')
        : 'No upcoming matched meetings are visible yet. Connect Google Calendar or add meetings to build prep context.'
      links.push(...(today?.upcomingMeetings ?? []).slice(0, 5).map(meeting => ({ label: meeting.title, href: meeting.dealId ? `/deals/${meeting.dealId}` : '/calendar' })))
    } else {
      const priorities = today?.priorities ?? []
      const stalePriorities = priorities.filter((priority: any) => isStaleDate(priority.dueAt, 21))
      const freshPriorities = priorities.filter((priority: any) => !isStaleDate(priority.dueAt, 21))
      fallbackAnswer = priorities.length
        ? [
            stalePriorities.length
              ? `What happened: Halvex found ${freshPriorities.length} current priorit${freshPriorities.length === 1 ? 'y' : 'ies'} and ${stalePriorities.length} older open action${stalePriorities.length === 1 ? '' : 's'} that may be done or out of date.`
              : `What happened: Halvex found ${freshPriorities.length} item${freshPriorities.length === 1 ? '' : 's'} that need attention today.`,
            stalePriorities.length
              ? 'What it means: old imported actions should be reviewed before they drive today. Mark them done, snooze them, or update the deal if they are still real.'
              : 'What it means: these are the actions most likely to improve pipeline truth or move active deals.',
            freshPriorities.length
              ? `Next: ${freshPriorities.slice(0, 3).map((priority: any) => priority.title).join('; ')}.`
              : `Next: review whether "${stalePriorities[0]?.title}" is already done or no longer relevant.`,
          ].join('\n')
        : 'There are no urgent priorities yet. Add deals, tasks, or sync Google Calendar to give Halvex more context.'
      links.push(...priorities.filter((priority: any) => priority.dealId).slice(0, 5).map((priority: any) => ({ label: priority.title, href: `/deals/${priority.dealId}` })))
    }

    const scopedDeals = dealScoped ? intelligenceDeals.filter(deal => deal.id === dealContext?.deal.id) : intelligenceDeals.slice(0, 30)
    const answer = await answerAssistantWithAI({
      message: rawMessage,
      plan,
      today: dealScoped ? { scope: 'deal_only', note: 'Do not use workspace priorities for this answer.' } : today,
      pipeline: {
        stages: dealScoped ? [] : pipeline.stages,
        deals: scopedDeals.map(deal => ({
          id: deal.id,
          title: deal.title,
          companyName: deal.companyName,
          status: deal.status,
          stageName: deal.stageName,
          valueAmount: deal.valueAmount,
          expectedCloseDate: deal.expectedCloseDate,
          aiScore: deal.aiScore,
          aiConfidence: deal.aiConfidence,
          aiRiskLevel: deal.aiRiskLevel,
          aiNextAction: deal.aiNextAction,
          riskDrivers: deal.riskDrivers,
          missingData: deal.missingData,
          positiveSignals: deal.positiveSignals,
        })),
      },
      activity: dealScoped ? (dealContext?.latestActivities ?? []).slice(0, 8) : activity.slice(0, 12),
      dealContext: dealContext ? {
        deal: dealContext.deal,
        company: dealContext.company,
        contacts: dealContext.contacts,
        openTasks: dealContext.openTasks,
        latestActivities: dealContext.latestActivities.slice(0, 8),
        intelligence: dealContext.intelligence,
      } : null,
      fallbackAnswer,
    })

    return NextResponse.json({ data: { answer, links } })
  } catch (err) {
    return dbErrResponse(err)
  }
}

function answerDealScoped(lower: string, dealContext: any) {
  const name = dealContext.company?.name ?? dealContext.deal.title
  const staleTasks = (dealContext.openTasks ?? []).filter((task: any) => isStaleDate(task.dueAt, 21))
  const latestEvidence = dealContext.intelligence?.latestEvidence
  const staleEvidence = latestEvidence?.occurredAt ? isStaleDate(latestEvidence.occurredAt, 30) : false

  if (lower.includes('draft')) {
    return [
      staleTasks.length || staleEvidence
        ? `Before drafting: some ${name} context looks old. I would check whether the older open actions are done or no longer relevant.`
        : `Draft based only on ${name} context:`,
      '',
      `Subject: Next steps on ${name}`,
      '',
      'Hi,',
      '',
      latestEvidence?.text
        ? `Thanks again for the recent context. My understanding is: ${compact(latestEvidence.text, 240)}`
        : 'Thanks again for the recent conversation.',
      '',
      dealContext.intelligence?.nextAction ?? 'Could you confirm the best next step and timing from your side?',
      '',
      'Best,',
    ].join('\n')
  }

  return [
    `What happened: ${dealContext.intelligence?.summary ?? dealContext.deal.aiSummary ?? `${name} has limited evidence.`}`,
    `What it means: ${(dealContext.intelligence?.riskDrivers ?? [])[0] ?? 'Confidence depends on the latest timeline evidence.'}`,
    staleTasks.length ? `Check: ${staleTasks.length} older open action${staleTasks.length === 1 ? '' : 's'} may already be done or out of date. Confirm before treating them as current.` : null,
    `Next: ${dealContext.intelligence?.nextAction ?? dealContext.deal.aiNextAction ?? 'Add a concrete next action.'}`,
  ].filter(Boolean).join('\n')
}

function explainDeal(deal: any) {
  const reasons = [
    ...(deal.riskDrivers ?? []),
    ...(deal.missingData ?? []).map((item: string) => `${item}, which lowers confidence.`),
  ].filter(Boolean)
  if (reasons.length) return `${deal.companyName ?? deal.title}: ${reasons[0]}`
  if (deal.aiNextAction) return `${deal.companyName ?? deal.title} has a next action, but the evidence should be checked before trusting the forecast.`
  return `${deal.companyName ?? deal.title} has limited evidence, so Halvex cannot be confident yet.`
}

function normalizeText(value?: string | null) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function findMentionedDeal(message: string, deals: any[]) {
  const normalizedMessage = normalizeText(message)
  const target = normalizeText(message.match(/\b(?:for|on|about)\s+(.+?)(?:[.?]|$)/i)?.[1])
  const candidates = deals
    .map(deal => {
      const title = normalizeText(deal.title)
      const company = normalizeText(deal.companyName)
      const score = [
        title && normalizedMessage.includes(title) ? 4 : 0,
        company && normalizedMessage.includes(company) ? 4 : 0,
        target && title && target.includes(title) ? 3 : 0,
        target && company && target.includes(company) ? 3 : 0,
      ].reduce((sum, item) => sum + item, 0)
      return { deal, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (!candidates.length) return null
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null
  return candidates[0].deal
}

function looksDealSpecific(lower: string) {
  return /\b(draft|summaris|summariz|prep|follow.?up|email)\b/.test(lower) && /\b(for|on|about)\b/.test(lower)
}

function isStaleDate(value: unknown, days: number) {
  if (!value) return false
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return false
  return Date.now() - date.getTime() > days * 86_400_000
}

function compact(value: string, max: number) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 3).trim()}...`
}
