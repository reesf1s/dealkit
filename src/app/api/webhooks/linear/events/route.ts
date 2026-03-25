/**
 * POST /api/webhooks/linear/events
 *
 * Receives issue update webhooks from Linear and syncs deal_linear_links status.
 * When an issue ships (stateType = 'completed'), sends a Slack DM to the assigned rep.
 *
 * Register this URL in Linear workspace settings → API → Webhooks.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dealLinearLinks, dealLogs, slackUserMappings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { getSlackBotToken, slackOpenDm, slackPostMessage } from '@/lib/slack-client'
import { markdownToBlocks } from '@/lib/slack-blocks'

interface LinearWebhookPayload {
  action: string
  type: string
  data: {
    id: string
    title?: string
    state?: {
      type: string
      name: string
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LinearWebhookPayload

    if (body.type !== 'Issue' || body.action !== 'update') {
      return NextResponse.json({ ok: true })
    }

    const issueId = body.data?.id
    const stateType = body.data?.state?.type
    const stateName = body.data?.state?.name ?? ''
    const issueTitle = body.data?.title ?? 'the feature'

    if (!issueId || !stateType) {
      return NextResponse.json({ ok: true })
    }

    let newStatus: string | null = null
    if (stateType === 'completed') newStatus = 'deployed'
    else if (stateType === 'started') newStatus = 'in_cycle'

    if (!newStatus) {
      return NextResponse.json({ ok: true })
    }

    // Find all deal_linear_links for this issue that need updating
    const links = await db
      .select({
        id: dealLinearLinks.id,
        dealId: dealLinearLinks.dealId,
        workspaceId: dealLinearLinks.workspaceId,
        status: dealLinearLinks.status,
        slackNotifiedAt: dealLinearLinks.slackNotifiedAt,
      })
      .from(dealLinearLinks)
      .where(eq(dealLinearLinks.linearIssueId, issueId))

    if (links.length === 0) {
      return NextResponse.json({ ok: true })
    }

    for (const link of links) {
      if (link.status === newStatus) continue

      // Update status
      await db
        .update(dealLinearLinks)
        .set({
          status: newStatus,
          updatedAt: new Date(),
          ...(newStatus === 'deployed' ? { deployedAt: new Date() } : {}),
        })
        .where(eq(dealLinearLinks.id, link.id))

      // For deployed (shipped): send Slack DM to the assigned rep
      if (newStatus === 'deployed' && !link.slackNotifiedAt) {
        try {
          // Get deal + assigned rep
          const [deal] = await db
            .select({
              dealName: dealLogs.dealName,
              prospectCompany: dealLogs.prospectCompany,
              assignedRepId: sql<string | null>`assigned_rep_id`,
              userId: dealLogs.userId,
              workspaceId: dealLogs.workspaceId,
            })
            .from(dealLogs)
            .where(eq(dealLogs.id, link.dealId))
            .limit(1)

          if (deal) {
            const repClerkId = (deal.assignedRepId as string | null) ?? deal.userId ?? null
            if (repClerkId) {
              const botToken = await getSlackBotToken(deal.workspaceId)
              if (botToken) {
                // Look up Slack user ID for this clerk user
                const [mapping] = await db
                  .select({ slackUserId: slackUserMappings.slackUserId })
                  .from(slackUserMappings)
                  .where(and(
                    eq(slackUserMappings.workspaceId, deal.workspaceId),
                    eq(slackUserMappings.clerkUserId, repClerkId),
                  ))
                  .limit(1)

                if (mapping) {
                  const dmChannel = await slackOpenDm(botToken, mapping.slackUserId)
                  if (dmChannel) {
                    const msg = `🚀 Great news! *${issueTitle}* for *${deal.prospectCompany}* has shipped in Linear (${stateName}). Time to follow up with your champion and close the loop.`
                    await slackPostMessage(
                      botToken,
                      dmChannel,
                      markdownToBlocks(msg),
                      `${issueTitle} shipped for ${deal.prospectCompany}!`,
                    )
                    // Mark as notified
                    await db
                      .update(dealLinearLinks)
                      .set({ slackNotifiedAt: new Date() })
                      .where(eq(dealLinearLinks.id, link.id))
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn('[linear-webhook] Slack DM failed (non-fatal):', e)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    console.error('[linear-webhook] Error:', msg)
    return NextResponse.json({ ok: true }) // Always 200 to Linear to avoid retries
  }
}
