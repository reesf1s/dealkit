/**
 * POST /api/deals/[id]/start-loop
 * Sends a Slack DM to the rep listing suggested Linear issues
 * and asking if they want to scope them to the next cycle.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, dealLinearLinks, slackUserMappings } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { getSlackBotToken, slackOpenDm, slackPostMessage } from '@/lib/slack-client'
import { markdownToBlocks } from '@/lib/slack-blocks'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params

    const [deal] = await db
      .select({ id: dealLogs.id, prospectCompany: dealLogs.prospectCompany })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const issues = await db
      .select({
        linearIssueId: dealLinearLinks.linearIssueId,
        linearTitle: dealLinearLinks.linearTitle,
      })
      .from(dealLinearLinks)
      .where(and(eq(dealLinearLinks.dealId, dealId), eq(dealLinearLinks.status, 'suggested')))
      .limit(5)

    if (issues.length === 0) {
      return NextResponse.json({ error: 'No suggested issues found for this deal' }, { status: 400 })
    }

    const [mapping] = await db
      .select({ slackUserId: slackUserMappings.slackUserId })
      .from(slackUserMappings)
      .where(and(
        eq(slackUserMappings.workspaceId, workspaceId),
        eq(slackUserMappings.clerkUserId, userId),
      ))
      .limit(1)

    if (!mapping) {
      return NextResponse.json({ error: 'No Slack mapping found. Connect Slack first.' }, { status: 400 })
    }

    const botToken = await getSlackBotToken(workspaceId)
    if (!botToken) return NextResponse.json({ error: 'Slack not connected' }, { status: 400 })

    const dmChannel = await slackOpenDm(botToken, mapping.slackUserId)
    if (!dmChannel) return NextResponse.json({ error: 'Could not open DM channel' }, { status: 500 })

    const issueList = issues.map(i => `• ${i.linearTitle ?? i.linearIssueId}`).join('\n')
    const company = deal.prospectCompany ?? 'this deal'
    const msg = `🎯 *${company}* has ${issues.length} matching Linear issue${issues.length !== 1 ? 's' : ''}:\n\n${issueList}\n\nWant me to scope them to the next cycle? Reply *yes* to request PM prioritization.`

    await slackPostMessage(botToken, dmChannel, markdownToBlocks(msg), msg)

    return NextResponse.json({ data: { sent: true, issueCount: issues.length } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
