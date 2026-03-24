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
 *   halvex_find_at_risk_deals    — pipeline: deals needing attention now
 *   halvex_get_win_loss_signals  — workspace-level win/loss intelligence
 */

import { z } from 'zod'
import { db } from '@/lib/db'
import { dealLinearLinks, linearIssuesCache, linearIntegrations, dealLogs, mcpActionLog } from '@/lib/db/schema'
import { eq, and, like, or } from 'drizzle-orm'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { getRelevantContext } from '@/lib/agent-context'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'
import { getIssue } from '@/lib/linear-client'
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
  description: 'Generate a user story and acceptance criteria for a Linear issue based on deal context, ready to add to the next cycle. Use when user says "scope issue X for the Coke deal" or "add ENG-42 to cycle". Returns the user story — Phase 3 will auto-add to cycle.',
  parameters: z.object({
    dealQuery: z.string().describe('Deal name or company name'),
    linearIssueId: z.string().describe('Linear issue identifier e.g. "ENG-42"'),
  }),
  execute: async (
    { dealQuery, linearIssueId }: { dealQuery: string; linearIssueId: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    // Get deal context
    const context = await getRelevantContext(ctx.workspaceId, dealQuery, 1)
    const deal = context.relevantDeals[0]
    if (!deal) return { result: `No deal found matching "${dealQuery}"` }

    // Get issue from cache or live
    const [cached] = await db
      .select()
      .from(linearIssuesCache)
      .where(and(
        eq(linearIssuesCache.workspaceId, ctx.workspaceId),
        eq(linearIssuesCache.linearIssueId, linearIssueId.toUpperCase()),
      ))
      .limit(1)

    const issueTitle = cached?.title ?? linearIssueId
    const issueDesc = cached?.description ?? ''

    // Update link status to in_cycle
    await db
      .update(dealLinearLinks)
      .set({ status: 'in_cycle', scopedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(dealLinearLinks.workspaceId, ctx.workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
        eq(dealLinearLinks.linearIssueId, linearIssueId.toUpperCase()),
      ))

    const dealRisks = (deal.dealRisks as string[]) ?? []
    const riskContext = dealRisks.length > 0 ? `\nDeal risks that this solves: ${dealRisks.slice(0, 2).join(', ')}` : ''

    return {
      result: [
        `📋 **User Story for ${linearIssueId}** (scoped for ${deal.dealName}/${deal.prospectCompany}):`,
        '',
        `**Issue:** ${issueTitle}`,
        issueDesc ? `**Description:** ${issueDesc.slice(0, 200)}` : '',
        riskContext,
        '',
        `**User Story:**`,
        `As a ${deal.prospectCompany} user, I want ${issueTitle.toLowerCase()} so that I can [benefit relevant to their use case].`,
        '',
        `**Acceptance Criteria:**`,
        `- [ ] Feature works as described in the issue`,
        `- [ ] ${deal.prospectCompany} can access it in their account`,
        `- [ ] No regression in existing functionality`,
        '',
        `Link status updated to **in_cycle**. ✅`,
        `_(Note: Automatic cycle assignment coming in Phase 3)_`,
      ].filter(Boolean).join('\n'),
    }
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
// Combined export for the Slack agent
// ─────────────────────────────────────────────────────────────────────────────

export const slackTools = {
  halvex_get_linked_issues,
  halvex_link_issue_to_deal,
  halvex_confirm_link,
  halvex_dismiss_link,
  halvex_mark_issue_released,
  halvex_scope_issue_to_cycle,
  halvex_search_linear_issues,
  halvex_get_linear_issue,
  halvex_find_at_risk_deals,
  halvex_get_win_loss_signals,
} as const
