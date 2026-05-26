import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { listActivity, listPipeline, listToday } from '@/lib/crm/core'
import { answerAssistantWithAI } from '@/lib/crm/ai'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, plan } = await getWorkspaceContext(userId)
    const { message } = await req.json()
    const today = await listToday(workspaceId, userId)
    const pipeline = await listPipeline(workspaceId, userId)
    const activity = await listActivity(workspaceId, userId)
    const openDeals = pipeline.deals.filter(deal => deal.status === 'open')
    const noNextStepDeals = openDeals.filter(deal => !deal.aiNextAction && !deal.nextStepDueAt)
    const missingDataDeals = openDeals.filter(deal => !deal.valueAmount || !deal.expectedCloseDate)
    const lower = String(message ?? '').toLowerCase()

    let fallbackAnswer = ''
    const links: Array<{ label: string; href: string }> = []
    if (lower.includes('no next') || lower.includes('next step')) {
      fallbackAnswer = noNextStepDeals.length
        ? [
            `What happened: ${noNextStepDeals.length} open deal${noNextStepDeals.length === 1 ? '' : 's'} have no recorded next step.`,
            `What it means: confidence should stay limited until each deal has a named action and owner.`,
            `Next: start with ${noNextStepDeals[0].companyName ?? noNextStepDeals[0].title} and add a concrete follow-up.`,
          ].join('\n')
        : 'No open deals are missing a next step right now.'
      links.push(...noNextStepDeals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('slipping') || lower.includes('stale') || lower.includes('stuck')) {
      fallbackAnswer = today.staleDeals.length
        ? [
            `What happened: ${today.staleDeals.length} deal${today.staleDeals.length === 1 ? '' : 's'} look stale or stuck.`,
            `What it means: these deals need fresh customer evidence before the pipeline can be trusted.`,
            `Next: re-open ${today.staleDeals[0].companyName ?? today.staleDeals[0].title} and either set a next action or qualify it out.`,
          ].join('\n')
        : 'No stale deals are currently flagged.'
      links.push(...today.staleDeals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('at risk') || lower.includes('risk')) {
      fallbackAnswer = today.atRiskDeals.length
        ? [
            `What happened: ${today.atRiskDeals.length} deal${today.atRiskDeals.length === 1 ? '' : 's'} are showing elevated risk.`,
            `What it means: Halvex sees weak momentum, stale activity, missing next steps, or explicit risk signals.`,
            `Next: start with ${today.atRiskDeals[0].companyName ?? today.atRiskDeals[0].title}. Score ${today.atRiskDeals[0].aiScore ?? 'unknown'}, risk ${today.atRiskDeals[0].aiRiskLevel}.`,
          ].join('\n')
        : 'No high-risk deals are showing right now.'
      links.push(...today.atRiskDeals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
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
      pipeline: { ...pipeline, deals: pipeline.deals.slice(0, 30) },
      activity: activity.slice(0, 12),
      fallbackAnswer,
    })

    return NextResponse.json({ data: { answer, links } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
