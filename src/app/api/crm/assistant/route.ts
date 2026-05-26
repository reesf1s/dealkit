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
    const today = await listToday(workspaceId, userId)
    const pipeline = await listPipeline(workspaceId, userId)
    const activity = await listActivity(workspaceId, userId)
    const dealContext = typeof dealId === 'string' && dealId ? await getDealContextNative(dealId, workspaceId) : null
    const openDeals = pipeline.deals.filter(deal => deal.status === 'open')
    const noNextStepDeals = openDeals.filter(deal => !deal.aiNextAction && !deal.nextStepDueAt)
    const missingDataDeals = openDeals.filter(deal => !deal.valueAmount || !deal.expectedCloseDate)
    const intelligenceDeals = openDeals
      .map(deal => ({
        ...deal,
        riskDrivers: deal.intelligence?.riskDrivers ?? [],
        missingData: deal.intelligence?.missingData ?? [],
        positiveSignals: deal.intelligence?.positiveSignals ?? [],
      }))
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
    const lower = String(message ?? '').toLowerCase()

    let fallbackAnswer = ''
    const links: Array<{ label: string; href: string }> = []
    if (dealContext && (lower.includes('summar') || lower.includes('this deal') || lower.includes(dealContext.deal.title.toLowerCase()))) {
      fallbackAnswer = [
        `What happened: ${dealContext.intelligence?.summary ?? dealContext.deal.aiSummary ?? `${dealContext.deal.title} has limited evidence.`}`,
        `What it means: ${(dealContext.intelligence?.riskDrivers ?? [])[0] ?? 'Confidence depends on the available timeline evidence.'}`,
        `Next: ${dealContext.intelligence?.nextAction ?? dealContext.deal.aiNextAction ?? 'Add a concrete next action.'}`,
      ].join('\n')
      links.push({ label: dealContext.company?.name ?? dealContext.deal.title, href: `/deals/${dealContext.deal.id}` })
    } else if (dealContext && lower.includes('draft')) {
      fallbackAnswer = [
        `Subject: Next steps on ${dealContext.company?.name ?? dealContext.deal.title}`,
        '',
        `Hi,`,
        '',
        `${dealContext.intelligence?.latestEvidence?.text ? `Thanks again for the recent update. I understood that ${dealContext.intelligence.latestEvidence.text}` : 'Thanks again for the recent conversation.'}`,
        '',
        `${dealContext.intelligence?.nextAction ?? 'Could you confirm the best next step and timing from your side?'}`,
        '',
        `Best,`,
      ].join('\n')
      links.push({ label: dealContext.company?.name ?? dealContext.deal.title, href: `/deals/${dealContext.deal.id}` })
    } else if (lower.includes('no next') || lower.includes('next step')) {
      fallbackAnswer = noNextStepDeals.length
        ? [
            `What happened: ${noNextStepDeals.length} open deal${noNextStepDeals.length === 1 ? '' : 's'} have no recorded next step.`,
            `What it means: confidence should stay limited until each deal has a named action and owner.`,
            `Next: start with ${noNextStepDeals[0].companyName ?? noNextStepDeals[0].title} and add a concrete follow-up.`,
          ].join('\n')
        : 'No open deals are missing a next step right now.'
      links.push(...noNextStepDeals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('slipping') || lower.includes('stale') || lower.includes('stuck')) {
      const deals = slippingDeals.length ? slippingDeals : today.staleDeals
      fallbackAnswer = deals.length
        ? [
            `What happened: ${deals.length} deal${deals.length === 1 ? '' : 's'} look like they may be slipping.`,
            `What it means: ${explainDeal(deals[0])}`,
            `Next: open ${deals[0].companyName ?? deals[0].title} and resolve the highest-confidence blocker or add a dated next action.`,
          ].join('\n')
        : 'No slipping deals are currently flagged from the available CRM evidence.'
      links.push(...deals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('at risk') || lower.includes('risk')) {
      const deals = atRiskDeals.length ? atRiskDeals : today.atRiskDeals
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
            `What it means: score may still show momentum, but confidence should remain lower until the facts are complete.`,
            `Next: update ${missingDataDeals[0].companyName ?? missingDataDeals[0].title} first.`,
          ].join('\n')
        : 'No open deals are missing value or close date.'
      links.push(...missingDataDeals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('close') || lower.includes('month') || lower.includes('likely')) {
      fallbackAnswer = today.likelyClosers.length
        ? [
            `What happened: ${today.likelyClosers.length} deal${today.likelyClosers.length === 1 ? '' : 's'} look closest to closing soon.`,
            `What it means: these have better timing or momentum, but still need evidence checked before forecasting.`,
            `Next: review ${today.likelyClosers[0].companyName ?? today.likelyClosers[0].title} and confirm the buyer-side next step.`,
          ].join('\n')
        : 'No likely closers are flagged in the next 7 days yet.'
      links.push(...today.likelyClosers.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('meeting') || lower.includes('prep')) {
      fallbackAnswer = today.upcomingMeetings.length
        ? [
            `What happened: your next matched meeting is ${today.upcomingMeetings[0].title}.`,
            `What it means: prep should start from the linked company, deal, last touch, and open tasks.`,
            `Next: open the meeting or linked deal and add notes after the call so Halvex can propose updates.`,
          ].join('\n')
        : 'No upcoming matched meetings are visible yet. Connect Google Calendar or add meetings to build prep context.'
      links.push(...today.upcomingMeetings.slice(0, 5).map(meeting => ({ label: meeting.title, href: meeting.dealId ? `/deals/${meeting.dealId}` : '/calendar' })))
    } else {
      fallbackAnswer = today.priorities.length
        ? [
            `What happened: Halvex found ${today.priorities.length} item${today.priorities.length === 1 ? '' : 's'} that need attention today.`,
            `What it means: these are the actions most likely to improve pipeline truth or move active deals.`,
            `Next: ${today.priorities.slice(0, 3).map(priority => priority.title).join('; ')}.`,
          ].join('\n')
        : 'There are no urgent priorities yet. Add deals, tasks, or sync Google Calendar to give Halvex more context.'
      links.push(...today.priorities.filter(priority => priority.dealId).slice(0, 5).map(priority => ({ label: priority.title, href: `/deals/${priority.dealId}` })))
    }

    const answer = await answerAssistantWithAI({
      message: String(message ?? ''),
      plan,
      today,
      pipeline: {
        stages: pipeline.stages,
        deals: intelligenceDeals.slice(0, 30).map(deal => ({
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
      activity: activity.slice(0, 12),
      dealContext: dealContext ? {
        deal: dealContext.deal,
        company: dealContext.company,
        contacts: dealContext.contacts,
        openTasks: dealContext.openTasks,
        latestActivities: dealContext.latestActivities.slice(0, 12),
        intelligence: dealContext.intelligence,
      } : null,
      fallbackAnswer,
    })

    return NextResponse.json({ data: { answer, links } })
  } catch (err) {
    return dbErrResponse(err)
  }
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
