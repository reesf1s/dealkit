/**
 * Slack-specific MCP tools — Linear + deal intelligence tools for the Slack agent.
 *
 * These extend the existing 5 core agent tools with Linear-focused actions
 * that are primarily relevant in the Slack context (issue linking, cycle scoping, etc.).
 *
 * Tools:
 *   halvex_get_linked_issues     — list Linear issues linked to a deal
 *   halvex_link_issue_to_deal    — manually link a Linear issue to a deal
 *   halvex_confirm_link          — confirm a suggested link (sets status → confirmed)
 *   halvex_dismiss_link          — dismiss a suggested link
 *   halvex_mark_issue_released   — mark issue as deployed for a deal (triggers release email prompt)
 *   halvex_scope_issue_to_cycle  — generate user story / AC for an issue (Phase 2; actual cycle add is Phase 3)
 *   halvex_search_linear_issues  — search cached Linear issues by keyword
 *   halvex_get_linear_issue      — get full details of a specific Linear issue
 *   halvex_find_at_risk_deals        — pipeline: deals needing attention now
 *   halvex_get_win_loss_signals      — workspace-level win/loss intelligence
 *   halvex_generate_release_email    — generate/retrieve a release email for a deployed issue
 *   halvex_mark_issue_deployed       — manual override: mark issue deployed + fire notification
 */

import { z } from 'zod'
import { db } from '@/lib/db'
import { dealLinearLinks, linearIssuesCache, linearIntegrations, dealLogs, mcpActionLog } from '@/lib/db/schema'
import { eq, and, like, or } from 'drizzle-orm'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { getRelevantContext } from '@/lib/agent-context'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'
import { getIssue } from '@/lib/linear-client'
import { getOrGenerateReleaseEmail } from '@/lib/release-email-generator'
import { notifyIssueDeployed } from '@/lib/slack-notify'
import {
  getUpcomingCycle,
  getCycleIssues,
  scopeIssueToCycle,
  assignIssue,
  updateIssueDescription,
  getTeamMembers,
} from '@/lib/linear-cycle'
import { generateScopedIssue } from '@/lib/scope-generator'
import { extractDealSignalText } from '@/lib/linear-signal-match'
import { findSimilarLinearIssues } from '@/lib/semantic-search'
import type { ToolContext, ToolResult } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getLinearApiKey(workspaceId: string): Promise<string | null> {
  const [row] = await db
    .select({ apiKeyEnc: linearIntegrations.apiKeyEnc })
    .from(linearIntegrations)
    .where(eq(linearIntegrations.workspaceId, workspaceId))
    .limit(1)
  if (!row) return null
  return decrypt(row.apiKeyEnc, getEncryptionKey())
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_get_linked_issues
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_get_linked_issues = {
  description: 'Get Linear issues linked to a deal. Use when user asks what issues are linked to a deal, what features could convert a deal, or what is in progress for a prospect.',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name to look up'),
  }),
  execute: async (
    { dealQuery }: { dealQuery: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}"` }

    const links = await db
      .select()
      .from(dealLinearLinks)
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
      ))

    const active = links.filter(l => l.status !== 'dismissed')
    if (active.length === 0) {
      return { result: `No Linear issues linked to ${deal.dealName} (${deal.prospectCompany}). Run a sync or link one manually.` }
    }

    // Hydrate with live issue status from cache
    const cached = await db
      .select()
      .from(linearIssuesCache)
      .where(eq(linearIssuesCache.workspaceId, ctx.workspaceId))

    const cacheMap = new Map(cached.map(i => [i.linearIssueId, i]))

    const lines = active
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .map(l => {
        const c = cacheMap.get(l.linearIssueId)
        const statusEmoji = l.status === 'confirmed' ? '✅' : l.status === 'in_cycle' ? '🔄' : l.status === 'deployed' ? '🚀' : '💡'
        const issueStatus = c?.status ? ` [${c.status}]` : ''
        return `${statusEmoji} **${l.linearIssueId}** — ${l.linearTitle ?? 'Untitled'} (relevance: ${l.relevanceScore}%, link: ${l.status}${issueStatus})`
      })
      .join('\n')

    return {
      result: `**${deal.dealName} (${deal.prospectCompany})** — ${active.length} linked issue(s):\n\n${lines}`,
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_link_issue_to_deal
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_link_issue_to_deal = {
  description: 'Manually link a Linear issue to a Halvex deal. Use when the user says "link ENG-42 to the Coke deal" or wants to associate an issue with a deal.',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name'),
    linearIssueId: z.string().describe('Linear issue identifier e.g. "ENG-42"'),
  }),
  execute: async (
    { dealQuery, linearIssueId }: { dealQuery: string; linearIssueId: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}"` }

    // Look up the issue in cache
    const [cached] = await db
      .select()
      .from(linearIssuesCache)
      .where(and(
        eq(linearIssuesCache.workspaceId, ctx.workspaceId),
        eq(linearIssuesCache.linearIssueId, linearIssueId.toUpperCase()),
      ))
      .limit(1)

    const title = cached?.title ?? linearIssueId

    await db
      .insert(dealLinearLinks)
      .values({
        workspaceId: ctx.workspaceId,
        dealId: deal.id,
        linearIssueId: linearIssueId.toUpperCase(),
        linearTitle: title,
        relevanceScore: 100,
        linkType: 'manual',
        status: 'confirmed',
      })
      .onConflictDoUpdate({
        target: [dealLinearLinks.dealId, dealLinearLinks.linearIssueId],
        set: { status: 'confirmed', linkType: 'manual', updatedAt: new Date() },
      })

    await db.insert(mcpActionLog).values({
      workspaceId: ctx.workspaceId,
      actionType: 'link_created',
      dealId: deal.id,
      linearIssueId: linearIssueId.toUpperCase(),
      triggeredBy: 'slack',
      status: 'complete',
      result: { dealName: deal.dealName, issueTitle: title },
    })

    return {
      result: `✅ Linked **${linearIssueId}** ("${title}") to **${deal.dealName}** (${deal.prospectCompany}).`,
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_confirm_link
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_confirm_link = {
  description: 'Confirm a suggested Linear issue link for a deal. Use when user says "yes confirm that link" or "confirm ENG-42 for Coke".',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name'),
    linearIssueId: z.string().describe('Linear issue identifier e.g. "ENG-42"'),
  }),
  execute: async (
    { dealQuery, linearIssueId }: { dealQuery: string; linearIssueId: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}"` }

    const result = await db
      .update(dealLinearLinks)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
        eq(dealLinearLinks.linearIssueId, linearIssueId.toUpperCase()),
      ))

    await db.insert(mcpActionLog).values({
      workspaceId: ctx.workspaceId,
      actionType: 'link_confirmed',
      dealId: deal.id,
      linearIssueId: linearIssueId.toUpperCase(),
      triggeredBy: 'slack',
      status: 'complete',
    })

    return { result: `✅ Confirmed link: **${linearIssueId}** → **${deal.dealName}**.` }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_dismiss_link
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_dismiss_link = {
  description: 'Dismiss a suggested or confirmed Linear issue link for a deal. Use when user says "dismiss" or "that issue is not relevant".',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name'),
    linearIssueId: z.string().describe('Linear issue identifier e.g. "ENG-42"'),
  }),
  execute: async (
    { dealQuery, linearIssueId }: { dealQuery: string; linearIssueId: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}"` }

    await db
      .update(dealLinearLinks)
      .set({ status: 'dismissed', updatedAt: new Date() })
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
        eq(dealLinearLinks.linearIssueId, linearIssueId.toUpperCase()),
      ))

    await db.insert(mcpActionLog).values({
      workspaceId: ctx.workspaceId,
      actionType: 'link_dismissed',
      dealId: deal.id,
      linearIssueId: linearIssueId.toUpperCase(),
      triggeredBy: 'slack',
      status: 'complete',
    })

    return { result: `Dismissed **${linearIssueId}** from **${deal.dealName}**.` }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_mark_issue_released
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_mark_issue_released = {
  description: 'Mark a Linear issue as deployed/released for a deal. Call this when an issue goes live and you want to trigger the release email workflow. This sets the link status to "deployed".',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name'),
    linearIssueId: z.string().describe('Linear issue identifier e.g. "ENG-42"'),
  }),
  execute: async (
    { dealQuery, linearIssueId }: { dealQuery: string; linearIssueId: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}"` }

    await db
      .update(dealLinearLinks)
      .set({ status: 'deployed', deployedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
        eq(dealLinearLinks.linearIssueId, linearIssueId.toUpperCase()),
      ))

    await db.insert(mcpActionLog).values({
      workspaceId: ctx.workspaceId,
      actionType: 'slack_notify',
      dealId: deal.id,
      linearIssueId: linearIssueId.toUpperCase(),
      triggeredBy: 'slack',
      status: 'complete',
      payload: { event: 'issue_deployed' },
    })

    return {
      result: `🚀 **${linearIssueId}** marked as deployed for **${deal.dealName}** (${deal.prospectCompany}).\n\nShall I draft a release email to ${deal.prospectCompany} highlighting this feature to help convert the deal? Reply "yes" to generate it.`,
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_scope_issue_to_cycle
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_scope_issue_to_cycle = {
  description: 'Scope a Linear issue for a deal: generates a customer-centric user story + ACs, updates the Linear issue description, adds it to the upcoming cycle, optionally assigns a dev. Use when user says "scope issue X for Coke" or "add ENG-42 to cycle" or "only issue 36, we have capacity".',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name'),
    linearIssueId: z.string().describe('Linear issue identifier e.g. "ENG-42"'),
    assigneeId: z.string().optional().describe('Linear user ID to assign the issue to (optional)'),
  }),
  execute: async (
    { dealQuery, linearIssueId, assigneeId }: { dealQuery: string; linearIssueId: string; assigneeId?: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    // 1. Deal context
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}"` }

    const issueIdUpper = linearIssueId.toUpperCase()

    // 2. Check for cached scoped content (only call Haiku once per issue+deal)
    const [existingLink] = await db
      .select()
      .from(dealLinearLinks)
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
        eq(dealLinearLinks.linearIssueId, issueIdUpper),
      ))
      .limit(1)

    // 3. Issue from cache
    const [cachedIssue] = await db
      .select()
      .from(linearIssuesCache)
      .where(and(
        eq(linearIssuesCache.workspaceId, ctx.workspaceId),
        eq(linearIssuesCache.linearIssueId, issueIdUpper),
      ))
      .limit(1)

    const issueTitle = cachedIssue?.title ?? issueIdUpper
    const issueDescription = cachedIssue?.description ?? null

    // 4. Get Linear API key + integration
    const [integration] = await db
      .select({ apiKeyEnc: linearIntegrations.apiKeyEnc, teamId: linearIntegrations.teamId })
      .from(linearIntegrations)
      .where(eq(linearIntegrations.workspaceId, ctx.workspaceId))
      .limit(1)

    if (!integration) {
      return { result: 'Linear is not connected. Please connect Linear in Settings.' }
    }

    const apiKey = decrypt(integration.apiKeyEnc, getEncryptionKey())

    // 5. Generate scoped content (use cache if already generated)
    let userStory: string
    let acceptanceCriteria: string[]
    let scopedDescription: string

    if (existingLink?.scopedUserStory) {
      userStory = existingLink.scopedUserStory
      acceptanceCriteria = existingLink.scopedAcceptanceCriteria
        ? existingLink.scopedAcceptanceCriteria.split('\n').filter(Boolean)
        : []
      scopedDescription = existingLink.scopedDescription ?? ''
    } else {
      const dealRisks = Array.isArray(deal.dealRisks) ? (deal.dealRisks as string[]) : []
      const scoped = await generateScopedIssue({
        dealName: deal.dealName,
        prospectCompany: deal.prospectCompany,
        dealNotes: deal.notes ?? null,
        dealRisks,
        issueTitle,
        issueDescription,
      })
      userStory = scoped.userStory
      acceptanceCriteria = scoped.acceptanceCriteria
      scopedDescription = scoped.description
    }

    // 6. Update Linear issue description with scoped content
    const halvexContent = [
      `**Deal:** ${deal.dealName} (${deal.prospectCompany})`,
      '',
      `**User Story:** ${userStory}`,
      '',
      '**Acceptance Criteria:**',
      ...acceptanceCriteria.map(ac => `- [ ] ${ac}`),
    ].join('\n')

    try {
      await updateIssueDescription(
        cachedIssue?.linearIssueId ?? issueIdUpper,
        halvexContent,
        issueDescription,
        apiKey,
      )
    } catch {
      // Non-fatal — we still update our DB and add to cycle
    }

    // 7. Get upcoming cycle and add issue to it
    const cycle = await getUpcomingCycle(integration.teamId, apiKey)
    if (!cycle) {
      return { result: `Could not find an upcoming cycle for this team. Create a cycle in Linear first.` }
    }

    // Linear accepts identifier (e.g. "ENG-36") or UUID in issueUpdate
    try {
      await scopeIssueToCycle(issueIdUpper, cycle.id, apiKey)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { result: `Failed to add ${issueIdUpper} to cycle: ${msg}` }
    }

    // 8. Assign if requested
    let assigneeName: string | null = null
    if (assigneeId) {
      try {
        await assignIssue(issueIdUpper, assigneeId, apiKey)
        // Look up name from team members
        const members = await getTeamMembers(integration.teamId, apiKey)
        assigneeName = members.find(m => m.id === assigneeId)?.name ?? assigneeId
      } catch { /* non-fatal */ }
    }

    // 9. Persist scoped content + cycle info to DB
    await db
      .update(dealLinearLinks)
      .set({
        status: 'in_cycle',
        scopedAt: new Date(),
        updatedAt: new Date(),
        scopedDescription,
        scopedUserStory: userStory,
        scopedAcceptanceCriteria: acceptanceCriteria.join('\n'),
        cycleId: cycle.id,
        ...(assigneeId ? { assigneeId, assigneeName: assigneeName ?? assigneeId } : {}),
      })
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
        eq(dealLinearLinks.linearIssueId, issueIdUpper),
      ))

    // 10. Audit log
    await db.insert(mcpActionLog).values({
      workspaceId: ctx.workspaceId,
      actionType: 'issue_scoped_to_cycle',
      dealId: deal.id,
      linearIssueId: issueIdUpper,
      triggeredBy: 'slack',
      status: 'complete',
      result: {
        cycleName: cycle.name ?? `Cycle #${cycle.number}`,
        cycleId: cycle.id,
        assigneeName,
        userStoryPreview: userStory.slice(0, 100),
      },
    })

    const cycleName = cycle.name ?? `Cycle #${cycle.number}`
    const cycleRange = cycle.startsAt && cycle.endsAt
      ? ` (${new Date(cycle.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–${new Date(cycle.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`
      : ''
    const assigneeNote = assigneeName ? `\n*Assigned to:* ${assigneeName}` : ''

    return {
      result: [
        `✅ *${issueIdUpper}* scoped and added to *${cycleName}*${cycleRange}`,
        assigneeNote,
        '',
        `*User Story:* ${userStory}`,
        '',
        `*Acceptance Criteria:*`,
        ...acceptanceCriteria.map(ac => `• ${ac}`),
        '',
        `*Deal:* ${deal.dealName} (${deal.prospectCompany}) — status updated to \`in_cycle\`.`,
      ].filter(s => s !== null && s !== undefined).join('\n'),
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_get_cycle_candidates
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_get_cycle_candidates = {
  description: 'Get confirmed Linear issues linked to a deal that could go into the next cycle to help convert it. Use when user asks "what can I put in next cycle to convert the Coke deal?" or "what issues should we prioritise for this deal?".',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name'),
  }),
  execute: async (
    { dealQuery }: { dealQuery: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}"` }

    const links = await db
      .select()
      .from(dealLinearLinks)
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
      ))

    const candidates = links.filter(l => l.status === 'confirmed' || l.status === 'suggested')
    const inCycle = links.filter(l => l.status === 'in_cycle')

    if (candidates.length === 0 && inCycle.length === 0) {
      return {
        result: `No confirmed issues linked to *${deal.dealName}* yet. Confirm some suggestions first, or link issues manually.`,
      }
    }

    const lines: string[] = [
      `*${deal.dealName}* (${deal.prospectCompany}) — cycle candidates:`,
      '',
    ]

    if (candidates.length > 0) {
      lines.push('*Available to scope:*')
      for (const l of candidates.sort((a, b) => b.relevanceScore - a.relevanceScore)) {
        const status = l.status === 'suggested' ? '💡 suggested' : '✅ confirmed'
        lines.push(`• *${l.linearIssueId}* — ${l.linearTitle ?? l.linearIssueId} (relevance: ${l.relevanceScore}%, ${status})`)
      }
    }

    if (inCycle.length > 0) {
      lines.push('')
      lines.push('*Already in cycle:*')
      for (const l of inCycle) {
        const cycleName = l.cycleId ? ` (cycle ${l.cycleId.slice(0, 8)})` : ''
        lines.push(`• 🔄 *${l.linearIssueId}* — ${l.linearTitle ?? l.linearIssueId}${cycleName}`)
      }
    }

    if (candidates.length > 0) {
      lines.push('')
      lines.push(`Shall I scope these into user stories and add them to the next cycle? Reply with the issue number(s) if you only want specific ones.`)
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_get_upcoming_cycle
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_get_upcoming_cycle = {
  description: 'Get the upcoming or active Linear cycle for the workspace — name, dates, issues already in it, and capacity. Use when user asks "what is in the next cycle?" or "how full is the upcoming sprint?".',
  parameters: z.object({}),
  execute: async (
    _: Record<string, never>,
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [integration] = await db
      .select({ apiKeyEnc: linearIntegrations.apiKeyEnc, teamId: linearIntegrations.teamId, teamName: linearIntegrations.teamName })
      .from(linearIntegrations)
      .where(eq(linearIntegrations.workspaceId, ctx.workspaceId))
      .limit(1)

    if (!integration) {
      return { result: 'Linear is not connected. Please connect Linear in Settings.' }
    }

    const apiKey = decrypt(integration.apiKeyEnc, getEncryptionKey())

    const cycle = await getUpcomingCycle(integration.teamId, apiKey)
    if (!cycle) {
      return { result: `No upcoming cycle found for ${integration.teamName ?? 'your team'}. Create one in Linear.` }
    }

    const cycleName = cycle.name ?? `Cycle #${cycle.number}`
    const dateRange = cycle.startsAt && cycle.endsAt
      ? `${new Date(cycle.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(cycle.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
      : 'No dates set'

    const total = cycle.issueCount
    const completed = cycle.completedIssueCount
    const remaining = total - completed

    const lines: string[] = [
      `*${cycleName}* — ${dateRange}`,
      `*Issues:* ${total} total (${completed} done, ${remaining} remaining)`,
    ]

    // Fetch cycle issues for context
    try {
      const issues = await getCycleIssues(cycle.id, apiKey)
      if (issues.length > 0) {
        lines.push('')
        lines.push('*In this cycle:*')
        for (const i of issues.slice(0, 8)) {
          const assignee = i.assignee ? ` (${i.assignee.name})` : ''
          const state = i.state.type === 'completed' ? '✅' : i.state.type === 'started' ? '🔄' : '○'
          lines.push(`${state} *${i.identifier}* — ${i.title}${assignee}`)
        }
        if (issues.length > 8) {
          lines.push(`_...and ${issues.length - 8} more_`)
        }
      }
    } catch { /* non-fatal */ }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_search_linear_issues
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_search_linear_issues = {
  description: 'Search cached Linear issues by keyword. Use when user asks "find Linear issues about SSO" or "what issues do we have on authentication".',
  parameters: z.object({
    query: z.string().describe('Keyword or phrase to search for in issue titles and descriptions'),
    limit: z.number().min(1).max(10).default(5).describe('Max results to return'),
  }),
  execute: async (
    { query, limit }: { query: string; limit: number },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const q = `%${query.toLowerCase()}%`
    const issues = await db
      .select()
      .from(linearIssuesCache)
      .where(and(
        eq(linearIssuesCache.workspaceId, ctx.workspaceId),
        or(
          like(linearIssuesCache.title, `%${query}%`),
          like(linearIssuesCache.description, `%${query}%`),
        ),
      ))
      .limit(limit)

    if (issues.length === 0) {
      return { result: `No Linear issues found matching "${query}". Try syncing from Linear Settings.` }
    }

    const lines = issues.map(i => {
      const status = i.status ? ` [${i.status}]` : ''
      const assignee = i.assigneeName ? ` (${i.assigneeName})` : ''
      return `• **${i.linearIssueId}** — ${i.title}${status}${assignee}`
    }).join('\n')

    return { result: `**Linear issues matching "${query}":**\n\n${lines}` }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_get_linear_issue
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_get_linear_issue = {
  description: 'Get full details of a specific Linear issue by ID. Use when user asks about a specific issue like "what is ENG-42?" or "tell me about issue 42".',
  parameters: z.object({
    linearIssueId: z.string().describe('Linear issue identifier e.g. "ENG-42"'),
  }),
  execute: async (
    { linearIssueId }: { linearIssueId: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const issueId = linearIssueId.toUpperCase()

    // Try cache first
    const [cached] = await db
      .select()
      .from(linearIssuesCache)
      .where(and(
        eq(linearIssuesCache.workspaceId, ctx.workspaceId),
        eq(linearIssuesCache.linearIssueId, issueId),
      ))
      .limit(1)

    if (cached) {
      const priorityLabel = ['No priority', 'Urgent', 'High', 'Medium', 'Low'][cached.priority] ?? 'Unknown'
      const assignee = cached.assigneeName ? `\n- **Assignee:** ${cached.assigneeName}` : ''
      const cycle = cached.cycleId ? `\n- **In cycle**` : ''
      return {
        result: [
          `**${issueId}** — ${cached.title}`,
          `- **Status:** ${cached.status ?? 'Unknown'}`,
          `- **Priority:** ${priorityLabel}`,
          assignee,
          cycle,
          cached.description ? `\n**Description:** ${cached.description.slice(0, 500)}` : '',
        ].filter(Boolean).join('\n'),
      }
    }

    // Fall back to live Linear API
    const apiKey = await getLinearApiKey(ctx.workspaceId)
    if (!apiKey) {
      return { result: `Issue ${issueId} not found in cache. Connect Linear in Settings to sync issues.` }
    }

    try {
      const issue = await getIssue(apiKey, issueId)
      if (!issue) return { result: `Issue ${issueId} not found in Linear.` }

      return {
        result: [
          `**${issue.identifier}** — ${issue.title}`,
          `- **Status:** ${issue.state.name}`,
          `- **Assignee:** ${issue.assignee?.name ?? 'Unassigned'}`,
          issue.cycle ? `- **Cycle:** #${issue.cycle.number}` : '',
          issue.description ? `\n**Description:** ${issue.description.slice(0, 500)}` : '',
        ].filter(Boolean).join('\n'),
      }
    } catch {
      return { result: `Could not fetch ${issueId} from Linear.` }
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_find_at_risk_deals
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_find_at_risk_deals = {
  description: 'Find deals that need attention: health score drops, stale deals, urgent close dates. Use when user asks "what deals need attention?" or "show me at-risk deals".',
  parameters: z.object({}),
  execute: async (
    _: Record<string, never>,
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const brain = await getWorkspaceBrain(ctx.workspaceId)
    if (!brain) return { result: 'No pipeline data yet. Add your first deal to get started.' }

    const lines: string[] = []

    // Score drops
    const alerts = brain.scoreAlerts ?? []
    if (alerts.length > 0) {
      lines.push('**⬇️ Health score drops:**')
      for (const a of alerts.slice(0, 4)) {
        lines.push(`• ${a.dealName} (${a.company}): ${a.previousScore} → ${a.currentScore} (${a.possibleCause})`)
      }
    }

    // Urgent
    const urgent = brain.urgentDeals ?? []
    if (urgent.length > 0) {
      lines.push('\n**⏰ Urgent:**')
      for (const u of urgent.slice(0, 3)) {
        lines.push(`• ${u.dealName} (${u.company}): ${u.reason}`)
      }
    }

    // Stale
    const stale = brain.staleDeals ?? []
    if (stale.length > 0) {
      lines.push('\n**💤 Stale (no activity):**')
      for (const s of stale.slice(0, 3)) {
        lines.push(`• ${s.dealName} (${s.company}): ${s.daysSinceUpdate}d since update`)
      }
    }

    if (lines.length === 0) {
      return { result: '✅ No deals currently at risk. Pipeline looks healthy!' }
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_get_win_loss_signals
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_get_win_loss_signals = {
  description: 'Get workspace-level win/loss intelligence from closed deal history. Use when user asks "why are we losing deals?" or "what wins us deals?".',
  parameters: z.object({}),
  execute: async (
    _: Record<string, never>,
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const brain = await getWorkspaceBrain(ctx.workspaceId)
    const intel = brain?.winLossIntel
    if (!intel) return { result: 'No win/loss data yet. Close some deals to build this intelligence.' }

    const lines: string[] = [
      `**Win/Loss Summary:** ${intel.winCount}W / ${intel.lossCount}L (${intel.winRate}% win rate)`,
    ]

    if (intel.topLossReasons.length > 0) {
      lines.push('\n**Top loss reasons:**')
      for (const r of intel.topLossReasons.slice(0, 3)) {
        lines.push(`• ${r}`)
      }
    }

    const playbook = brain?.winPlaybook
    if (playbook?.fastestClosePattern?.commonSignals?.length) {
      lines.push('\n**Win patterns:**')
      for (const s of playbook.fastestClosePattern.commonSignals.slice(0, 3)) {
        lines.push(`• ${s}`)
      }
    }

    const compRec = intel.competitorRecord.filter(c => c.wins + c.losses >= 2).slice(0, 4)
    if (compRec.length > 0) {
      lines.push('\n**Competitor record:**')
      for (const c of compRec) {
        lines.push(`• vs ${c.name}: ${c.wins}W / ${c.losses}L (${c.winRate}% win rate)`)
      }
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_generate_release_email
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_generate_release_email = {
  description: 'Generate (or retrieve cached) a release email for a deal + deployed Linear issue. Use when user says "write a release email for Coke" or "draft an email for ENG-36". Returns subject + body the user can copy and send.',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name'),
    linearIssueId: z.string().describe('Linear issue identifier e.g. "ENG-42"'),
  }),
  execute: async (
    { dealQuery, linearIssueId }: { dealQuery: string; linearIssueId: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}"` }

    const issueId = linearIssueId.toUpperCase()

    // Verify the issue is deployed for this deal
    const [link] = await db
      .select({ status: dealLinearLinks.status, linearTitle: dealLinearLinks.linearTitle })
      .from(dealLinearLinks)
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
        eq(dealLinearLinks.linearIssueId, issueId),
      ))
      .limit(1)

    if (!link) {
      return { result: `${issueId} is not linked to ${deal.dealName}. Link it first with halvex_link_issue_to_deal.` }
    }

    if (link.status !== 'deployed') {
      return {
        result: `${issueId} is currently "${link.status}" for ${deal.dealName} — it needs to be deployed before generating a release email. Use halvex_mark_issue_deployed to mark it live.`,
      }
    }

    try {
      const email = await getOrGenerateReleaseEmail(ctx.workspaceId, deal.id, issueId)
      if (!email) return { result: `Could not generate release email — missing deal or issue context.` }

      return {
        result: [
          `✉️ *Release email for ${deal.prospectCompany}*`,
          '',
          `*Subject:* ${email.subject}`,
          '',
          `*Body:*`,
          email.body,
          '',
          `_Copy this and send from your email client. No auto-send in v1._`,
        ].join('\n'),
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { result: `Failed to generate release email: ${msg.slice(0, 200)}` }
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_mark_issue_deployed
// ─────────────────────────────────────────────────────────────────────────────

export const halvex_mark_issue_deployed = {
  description: 'Manual override: mark a Linear issue as deployed for a deal and fire the proactive deployment notification. Use when the webhook did not fire or the user says "mark ENG-42 as live for Coke". This updates the link status and sends a Slack DM prompt to write a release email.',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name'),
    linearIssueId: z.string().describe('Linear issue identifier e.g. "ENG-42"'),
  }),
  execute: async (
    { dealQuery, linearIssueId }: { dealQuery: string; linearIssueId: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}"` }

    const issueId = linearIssueId.toUpperCase()

    // Fetch link + issue title
    const [link] = await db
      .select({ linearTitle: dealLinearLinks.linearTitle, status: dealLinearLinks.status })
      .from(dealLinearLinks)
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
        eq(dealLinearLinks.linearIssueId, issueId),
      ))
      .limit(1)

    if (!link) {
      return { result: `${issueId} is not linked to ${deal.dealName}. Use halvex_link_issue_to_deal first.` }
    }

    if (link.status === 'deployed') {
      return { result: `${issueId} is already marked as deployed for ${deal.dealName}.` }
    }

    // Mark deployed
    await db
      .update(dealLinearLinks)
      .set({ status: 'deployed', deployedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
        eq(dealLinearLinks.linearIssueId, issueId),
      ))

    await db.insert(mcpActionLog).values({
      workspaceId: ctx.workspaceId,
      actionType: 'issue_deployed_manual',
      dealId: deal.id,
      linearIssueId: issueId,
      triggeredBy: 'slack',
      status: 'complete',
      payload: { manualOverride: true },
    })

    // Fire proactive notification (fire-and-forget)
    notifyIssueDeployed(ctx.workspaceId, {
      dealId: deal.id,
      dealName: deal.dealName,
      company: deal.prospectCompany,
      linearIssueId: issueId,
      linearTitle: link.linearTitle ?? issueId,
    }).catch(err => console.error('[halvex_mark_issue_deployed] notify failed:', err))

    return {
      result: `🚀 *${issueId}* marked as deployed for *${deal.dealName}* (${deal.prospectCompany}).\n\nI've sent you a DM with options to write a release email. Or reply here: "write release email for ${deal.prospectCompany}"`,
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_discover_issues
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Semantic discovery: find Linear issues that match a deal's objection signals,
 * upsert them as suggested links, store a pending bulk-scope confirmation, and
 * return the list with deal health context.
 *
 * This is step 2-4 of the core product flow:
 *   User asks about deal → LLM calls this → bot presents issues → user says "yes" → bulk scope
 */
export const halvex_discover_issues = {
  description: 'Discover Linear issues semantically related to a deal\'s objection signals and risk factors. Use when user asks about a deal and wants to know what product work could help convert it (e.g. "what\'s the latest on the Miro deal?", "what can we build to help close Coke?"). Returns deal health + matched issues and asks if they should be prioritised into the next cycle.',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name to look up'),
  }),
  execute: async (
    { dealQuery }: { dealQuery: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    // 1. Find deal
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}". Try the company or deal name.` }

    // 2. Fetch full deal record for signal extraction
    const [dealRow] = await db
      .select({
        id: dealLogs.id,
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        prospectName: dealLogs.prospectName,
        notes: dealLogs.notes,
        meetingNotes: dealLogs.meetingNotes,
        dealRisks: dealLogs.dealRisks,
        lostReason: dealLogs.lostReason,
        description: dealLogs.description,
        conversionScore: dealLogs.conversionScore,
        stage: dealLogs.stage,
        closeDate: dealLogs.closeDate,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, deal.id), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!dealRow) return { result: `Deal not found.` }

    const risks = (dealRow.dealRisks as string[]) ?? []
    const score = dealRow.conversionScore

    // 3. Extract objection signal text and run semantic match
    const signalText = extractDealSignalText(dealRow)

    let discoveredIssues: { issueId: string; similarity: number }[] = []
    if (signalText) {
      discoveredIssues = await findSimilarLinearIssues(ctx.workspaceId, signalText, {
        limit: 10,
        minSimilarity: 0.25,
      })
    }

    // 4. Hydrate with titles from cache
    const issueIds = discoveredIssues.map(i => i.issueId)
    const cachedIssues = issueIds.length > 0
      ? await db
          .select({
            linearIssueId: linearIssuesCache.linearIssueId,
            title: linearIssuesCache.title,
            linearIssueUrl: linearIssuesCache.linearIssueUrl,
          })
          .from(linearIssuesCache)
          .where(and(
            eq(linearIssuesCache.workspaceId, ctx.workspaceId),
          ))
      : []

    const cacheMap = new Map(cachedIssues.map(i => [i.linearIssueId, i]))

    // Filter to issues that are actually in the cache (have titles)
    const hydratedIssues = discoveredIssues
      .filter(i => cacheMap.has(i.issueId))
      .slice(0, 5)

    // 5. Upsert discovered issues as suggested links
    for (const issue of hydratedIssues) {
      const cached = cacheMap.get(issue.issueId)
      const scoreScaled = Math.round(issue.similarity * 100)

      await db
        .insert(dealLinearLinks)
        .values({
          workspaceId: ctx.workspaceId,
          dealId: dealRow.id,
          linearIssueId: issue.issueId,
          linearTitle: cached?.title ?? issue.issueId,
          linearIssueUrl: cached?.linearIssueUrl ?? null,
          relevanceScore: scoreScaled,
          linkType: 'feature_gap',
          status: 'suggested',
        })
        .onConflictDoUpdate({
          target: [dealLinearLinks.dealId, dealLinearLinks.linearIssueId],
          set: {
            relevanceScore: scoreScaled,
            linearTitle: cached?.title ?? issue.issueId,
            linearIssueUrl: cached?.linearIssueUrl ?? null,
            updatedAt: new Date(),
          },
        })
    }

    // Also include already-confirmed/in-cycle links
    const existingLinks = await db
      .select()
      .from(dealLinearLinks)
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, dealRow.id),
      ))

    const actionableLinks = existingLinks.filter(l =>
      l.status === 'confirmed' || l.status === 'suggested' || l.status === 'in_cycle'
    )

    // 6. Store pending bulk-scope confirmation if we found issues and have channel context
    const newIssueIds = hydratedIssues.map(i => i.issueId)
    const allCandidateIds = [
      ...new Set([
        ...newIssueIds,
        ...existingLinks.filter(l => l.status === 'confirmed' || l.status === 'suggested').map(l => l.linearIssueId),
      ]),
    ]

    if (allCandidateIds.length > 0 && ctx.userId && ctx.channelId) {
      // Clear any existing pending confirmation for this user+channel
      await db
        .update(mcpActionLog)
        .set({ status: 'error' })
        .where(and(
          eq(mcpActionLog.workspaceId, ctx.workspaceId),
          eq(mcpActionLog.triggeredBy, 'slack'),
          eq(mcpActionLog.status, 'awaiting_confirmation'),
          eq(mcpActionLog.actionType, 'bulk_scope_confirmation'),
        ))

      const issueList = allCandidateIds.slice(0, 5).join(', ')
      const promptMsg = `I found ${allCandidateIds.length} Linear issue${allCandidateIds.length > 1 ? 's' : ''} that would help convert ${dealRow.dealName} — ${issueList}. Want me to write user stories and prioritise them into the next cycle?`

      await db.insert(mcpActionLog).values({
        workspaceId: ctx.workspaceId,
        actionType: 'bulk_scope_confirmation',
        dealId: dealRow.id,
        triggeredBy: 'slack',
        status: 'awaiting_confirmation',
        slackChannelId: ctx.channelId,
        payload: {
          slackUserId: ctx.userId,
          channelId: ctx.channelId,
          prompt: promptMsg,
          action: `Call halvex_bulk_scope_to_cycle with dealQuery="${dealRow.dealName}" and issueIds=${JSON.stringify(allCandidateIds.slice(0, 5))}. Scope all issues into user stories and add to the next cycle.`,
          params: {
            dealId: dealRow.id,
            dealName: dealRow.dealName,
            issueIds: allCandidateIds.slice(0, 5),
          },
        },
      })
    }

    // 7. Build response
    const lines: string[] = []

    // Deal health summary
    const stageLabel = ctx.stageLabels?.[dealRow.stage] ?? dealRow.stage
    const closeInfo = dealRow.closeDate
      ? ` — closes ${new Date(dealRow.closeDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
      : ''
    lines.push(`*${dealRow.dealName}* (${dealRow.prospectCompany}) — ${score ?? '?'}% | ${stageLabel}${closeInfo}`)

    if (risks.length > 0) {
      lines.push('')
      lines.push('*Key risk factors:*')
      for (const r of risks.slice(0, 3)) {
        lines.push(`• ${r}`)
      }
    }

    if (actionableLinks.length === 0 && hydratedIssues.length === 0) {
      lines.push('')
      lines.push(`No matching Linear issues found. Try syncing from Settings → Linear.`)
      return { result: lines.join('\n') }
    }

    // Show discovered + existing links
    lines.push('')
    lines.push(`*Matching Linear issues (${allCandidateIds.length} found):*`)

    for (const link of actionableLinks.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5)) {
      const statusEmoji = link.status === 'in_cycle' ? '🔄' : link.status === 'confirmed' ? '✅' : '💡'
      const urlPart = link.linearIssueUrl ? ` <${link.linearIssueUrl}|↗>` : ''
      lines.push(`${statusEmoji} *${link.linearIssueId}* — ${link.linearTitle ?? link.linearIssueId} (${link.relevanceScore}% match)${urlPart}`)
    }

    const candidatesNotInCycle = allCandidateIds.filter(id => {
      const l = actionableLinks.find(al => al.linearIssueId === id)
      return !l || l.status !== 'in_cycle'
    })

    if (candidatesNotInCycle.length > 0) {
      lines.push('')
      lines.push(`I found *${candidatesNotInCycle.length}* Linear issue${candidatesNotInCycle.length > 1 ? 's' : ''} that would help convert ${dealRow.prospectCompany} — want me to prioritise them into the next cycle?`)
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// halvex_bulk_scope_to_cycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scope multiple Linear issues to the next cycle for a deal in one shot.
 * For each issue: generates a customer-centric user story + ACs, updates the
 * Linear issue description, and adds it to the upcoming cycle.
 *
 * This is step 7 of the core product flow (triggered after user says "yes").
 */
export const halvex_bulk_scope_to_cycle = {
  description: 'Scope multiple Linear issues into the next cycle for a deal at once — generates user story + ACs for each, updates Linear, and adds all to the upcoming cycle. Use when user confirms they want to prioritise issues (e.g. "yes", "do it", "go ahead") after halvex_discover_issues has identified matching issues. Also use when user explicitly asks to scope multiple issues.',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name'),
    issueIds: z.array(z.string()).min(1).max(10).describe('Array of Linear issue identifiers to scope, e.g. ["ENG-36", "ENG-42", "ENG-51"]'),
  }),
  execute: async (
    { dealQuery, issueIds }: { dealQuery: string; issueIds: string[] },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    // 1. Deal context
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}"` }

    const [dealRow] = await db
      .select({
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        notes: dealLogs.notes,
        dealRisks: dealLogs.dealRisks,
      })
      .from(dealLogs)
      .where(eq(dealLogs.id, deal.id))
      .limit(1)

    if (!dealRow) return { result: `Deal not found.` }

    // 2. Get Linear integration
    const [integration] = await db
      .select({ apiKeyEnc: linearIntegrations.apiKeyEnc, teamId: linearIntegrations.teamId, teamName: linearIntegrations.teamName })
      .from(linearIntegrations)
      .where(eq(linearIntegrations.workspaceId, ctx.workspaceId))
      .limit(1)

    if (!integration) {
      return { result: 'Linear is not connected. Please connect Linear in Settings.' }
    }

    const apiKey = decrypt(integration.apiKeyEnc, getEncryptionKey())

    // 3. Get upcoming cycle
    const cycle = await getUpcomingCycle(integration.teamId, apiKey)
    if (!cycle) {
      return { result: `No upcoming cycle found for ${integration.teamName ?? 'your team'}. Create one in Linear first.` }
    }

    const cycleName = cycle.name ?? `Cycle #${cycle.number}`
    const dealRisks = Array.isArray(dealRow.dealRisks) ? (dealRow.dealRisks as string[]) : []

    // 4. Process each issue
    const results: { issueId: string; title: string; userStory: string; success: boolean; error?: string }[] = []

    for (const rawId of issueIds.slice(0, 10)) {
      const issueId = rawId.toUpperCase()

      try {
        // Get issue from cache
        const [cachedIssue] = await db
          .select()
          .from(linearIssuesCache)
          .where(and(
            eq(linearIssuesCache.workspaceId, ctx.workspaceId),
            eq(linearIssuesCache.linearIssueId, issueId),
          ))
          .limit(1)

        const issueTitle = cachedIssue?.title ?? issueId
        const issueDescription = cachedIssue?.description ?? null

        // Check for cached scoped content
        const [existingLink] = await db
          .select()
          .from(dealLinearLinks)
          .where(and(
            eq(dealLinearLinks.workspaceId, ctx.workspaceId),
            eq(dealLinearLinks.dealId, deal.id),
            eq(dealLinearLinks.linearIssueId, issueId),
          ))
          .limit(1)

        let userStory: string
        let acceptanceCriteria: string[]
        let scopedDescription: string

        if (existingLink?.scopedUserStory) {
          userStory = existingLink.scopedUserStory
          acceptanceCriteria = existingLink.scopedAcceptanceCriteria
            ? existingLink.scopedAcceptanceCriteria.split('\n').filter(Boolean)
            : []
          scopedDescription = existingLink.scopedDescription ?? ''
        } else {
          const scoped = await generateScopedIssue({
            dealName: dealRow.dealName,
            prospectCompany: dealRow.prospectCompany,
            dealNotes: dealRow.notes ?? null,
            dealRisks,
            issueTitle,
            issueDescription,
          })
          userStory = scoped.userStory
          acceptanceCriteria = scoped.acceptanceCriteria
          scopedDescription = scoped.description
        }

        // Update Linear issue description
        const halvexContent = [
          `**Deal:** ${dealRow.dealName} (${dealRow.prospectCompany})`,
          '',
          `**User Story:** ${userStory}`,
          '',
          '**Acceptance Criteria:**',
          ...acceptanceCriteria.map(ac => `- [ ] ${ac}`),
        ].join('\n')

        try {
          await updateIssueDescription(issueId, halvexContent, issueDescription, apiKey)
        } catch { /* non-fatal — still add to cycle */ }

        // Add to cycle
        await scopeIssueToCycle(issueId, cycle.id, apiKey)

        // Upsert link with scoped content + in_cycle status
        await db
          .insert(dealLinearLinks)
          .values({
            workspaceId: ctx.workspaceId,
            dealId: deal.id,
            linearIssueId: issueId,
            linearTitle: issueTitle,
            relevanceScore: existingLink?.relevanceScore ?? 80,
            linkType: existingLink?.linkType ?? 'feature_gap',
            status: 'in_cycle',
            scopedAt: new Date(),
            scopedDescription,
            scopedUserStory: userStory,
            scopedAcceptanceCriteria: acceptanceCriteria.join('\n'),
            cycleId: cycle.id,
          })
          .onConflictDoUpdate({
            target: [dealLinearLinks.dealId, dealLinearLinks.linearIssueId],
            set: {
              status: 'in_cycle',
              scopedAt: new Date(),
              updatedAt: new Date(),
              scopedDescription,
              scopedUserStory: userStory,
              scopedAcceptanceCriteria: acceptanceCriteria.join('\n'),
              cycleId: cycle.id,
            },
          })

        await db.insert(mcpActionLog).values({
          workspaceId: ctx.workspaceId,
          actionType: 'issue_scoped_to_cycle',
          dealId: deal.id,
          linearIssueId: issueId,
          triggeredBy: 'slack',
          status: 'complete',
          result: {
            cycleName,
            cycleId: cycle.id,
            userStoryPreview: userStory.slice(0, 100),
            bulkScoped: true,
          },
        })

        results.push({ issueId, title: issueTitle, userStory, success: true })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        results.push({ issueId, title: issueId, userStory: '', success: false, error: msg.slice(0, 100) })
      }
    }

    // 5. Build response
    const succeeded = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    const cycleRange = cycle.startsAt && cycle.endsAt
      ? ` (${new Date(cycle.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–${new Date(cycle.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`
      : ''

    const lines: string[] = [
      `✅ *Scoped ${succeeded.length} issue${succeeded.length !== 1 ? 's' : ''} into ${cycleName}${cycleRange} for the ${dealRow.dealName} deal*`,
      '',
    ]

    for (const r of succeeded) {
      lines.push(`• *${r.issueId}* — ${r.title}`)
      lines.push(`  _${r.userStory}_`)
    }

    if (failed.length > 0) {
      lines.push('')
      lines.push(`⚠️ ${failed.length} issue${failed.length !== 1 ? 's' : ''} could not be scoped: ${failed.map(r => `${r.issueId} (${r.error})`).join(', ')}`)
    }

    lines.push('')
    lines.push(`I'll notify you when ${succeeded.length > 1 ? 'these ship' : 'this ships'} so you can send a personalised release email to ${dealRow.prospectCompany} to help close the deal.`)

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined export for the Slack agent
// ─────────────────────────────────────────────────────────────────────────────

export const slackTools = {
  halvex_get_linked_issues,
  halvex_link_issue_to_deal,
  halvex_confirm_link,
  halvex_dismiss_link,
  halvex_mark_issue_released,
  halvex_mark_issue_deployed,
  halvex_scope_issue_to_cycle,
  halvex_bulk_scope_to_cycle,
  halvex_discover_issues,
  halvex_get_cycle_candidates,
  halvex_get_upcoming_cycle,
  halvex_search_linear_issues,
  halvex_get_linear_issue,
  halvex_find_at_risk_deals,
  halvex_get_win_loss_signals,
  halvex_generate_release_email,
} as const
