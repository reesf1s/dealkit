import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { listToday } from '@/lib/crm/core'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { message } = await req.json()
    const today = await listToday(workspaceId, userId)
    const lower = String(message ?? '').toLowerCase()

    let answer = ''
    const links: Array<{ label: string; href: string }> = []
    if (lower.includes('at risk') || lower.includes('risk')) {
      answer = today.atRiskDeals.length
        ? `You have ${today.atRiskDeals.length} at-risk deal${today.atRiskDeals.length === 1 ? '' : 's'}. Start with ${today.atRiskDeals[0].companyName ?? today.atRiskDeals[0].title}; its score is ${today.atRiskDeals[0].aiScore ?? 'unknown'} and the risk level is ${today.atRiskDeals[0].aiRiskLevel}.`
        : 'No high-risk deals are showing right now.'
      links.push(...today.atRiskDeals.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else if (lower.includes('close') || lower.includes('month')) {
      answer = today.likelyClosers.length
        ? `Likely closers this week: ${today.likelyClosers.map(deal => deal.companyName ?? deal.title).join(', ')}.`
        : 'No likely closers are flagged in the next 7 days yet.'
      links.push(...today.likelyClosers.slice(0, 5).map(deal => ({ label: deal.companyName ?? deal.title, href: `/deals/${deal.id}` })))
    } else {
      answer = today.priorities.length
        ? `Start with these priorities: ${today.priorities.slice(0, 3).map(priority => priority.title).join('; ')}.`
        : 'There are no urgent priorities yet. Add deals, tasks, or sync Google Calendar to give Halvex more context.'
      links.push(...today.priorities.filter(priority => priority.dealId).slice(0, 5).map(priority => ({ label: priority.title, href: `/deals/${priority.dealId}` })))
    }

    return NextResponse.json({ data: { answer, links } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
