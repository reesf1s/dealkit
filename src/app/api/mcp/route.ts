/**
 * External MCP HTTP server — Halvex tools for Claude Desktop and external agents.
 *
 * Auth: Authorization: Bearer <mcp_api_key>
 * The key is stored on the workspace row (mcp_api_key column).
 *
 * GET  /api/mcp          — returns tool definitions (discovery)
 * POST /api/mcp          — dispatches to a tool by tool_name
 *
 * Tools:
 *   halvex_get_deal_health              — deal health score + risks for a named deal
 *   halvex_find_at_risk_deals           — deals needing immediate attention
 *   halvex_get_linked_issues            — Linear issues linked to a deal
 *   halvex_get_win_loss_signals         — workspace win/loss intelligence
 *   halvex_scope_issue                  — generate user story + ACs, update Linear, add to cycle
 *   halvex_draft_release_email          — draft release notification email for a prospect
 *
 *   halvex_get_revenue_intelligence     — [NEW] structured deal intelligence: win probability + gaps + win conditions
 *   halvex_get_gap_revenue_map          — [NEW] PM view: which features are blocking the most revenue
 *   halvex_close_the_loop               — [NEW] given deal + gap: find/create Linear issue, scope, draft email
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, not, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces, dealLogs, productGaps, dealLinearLinks, linearIssuesCache, mcpActionLog } from '@/lib/db/schema'
import { ensureIndexes } from '@/lib/api-helpers'
import {
  getDealHealth,
  findAtRiskDeals,
  getLinkedIssues,
  getWinLossSignals,
} from '@/lib/mcp-tools'
import { halvexScopeIssue, halvexDraftReleaseEmail } from '@/lib/mcp-external-tools'
import { getWorkspaceBrain } from '@/lib/workspace-brain'

// Vercel Serverless Function — allow up to 5 minutes for long-running AI calls
export const maxDuration = 300

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions (returned by GET for discovery)
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    name: 'halvex_get_deal_health',
    description: 'Get the health score, risks, pending todos, and recommendations for a specific deal. Identify the deal by name or company.',
    input_schema: {
      type: 'object',
      properties: {
        deal_name: {
          type: 'string',
          description: 'Deal name or prospect company name to look up',
        },
      },
      required: ['deal_name'],
    },
  },
  {
    name: 'halvex_find_at_risk_deals',
    description: 'Return all deals in the pipeline that need immediate attention — score drops, stale deals, and urgent close dates.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'halvex_get_linked_issues',
    description: 'Get the Linear issues linked to a specific deal — feature requests, blockers, and signals that could convert the deal.',
    input_schema: {
      type: 'object',
      properties: {
        deal_name: {
          type: 'string',
          description: 'Deal name or prospect company name to look up',
        },
      },
      required: ['deal_name'],
    },
  },
  {
    name: 'halvex_get_win_loss_signals',
    description: 'Return workspace-level win/loss intelligence — win rate, top win patterns, top loss reasons, and competitor records.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'halvex_scope_issue',
    description: 'Scope a Linear issue for a specific deal: generates a customer-centric user story and acceptance criteria, updates the Linear issue description, and optionally adds the issue to the upcoming sprint cycle.',
    input_schema: {
      type: 'object',
      properties: {
        linear_issue_id: {
          type: 'string',
          description: 'Linear issue identifier, e.g. "ENG-42"',
        },
        deal_id: {
          type: 'string',
          description: 'Halvex deal UUID',
        },
        add_to_cycle: {
          type: 'boolean',
          description: 'Whether to add the issue to the upcoming sprint cycle (default: true)',
        },
      },
      required: ['linear_issue_id', 'deal_id'],
    },
  },
  {
    name: 'halvex_draft_release_email',
    description: 'Draft a release notification email to a prospect informing them that a feature they requested is now live — closing the loop on the deal.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: {
          type: 'string',
          description: 'Halvex deal UUID',
        },
        linear_issue_id: {
          type: 'string',
          description: 'Linear issue identifier of the shipped feature, e.g. "ENG-42"',
        },
      },
      required: ['deal_id', 'linear_issue_id'],
    },
  },
  {
    name: 'halvex_get_revenue_intelligence',
    description: '[Category-defining] Structured revenue intelligence for a specific deal. Combines ML win probability, product gap coverage, competitive position, and win conditions. The sales rep\'s full picture in one call.',
    input_schema: {
      type: 'object',
      properties: {
        deal_name: {
          type: 'string',
          description: 'Deal name or prospect company name to look up',
        },
      },
      required: ['deal_name'],
    },
  },
  {
    name: 'halvex_get_gap_revenue_map',
    description: '[PM tool] Returns all product gaps ranked by revenue at stake. Shows which features are costing the most revenue, how many deals they block, and whether a Linear issue exists.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'halvex_close_the_loop',
    description: '[Signature action] Given a deal and a product gap: find or create the matching Linear issue, scope it to the upcoming cycle, draft a re-engagement email, and log the loop closure. This is the Revenue-to-Product loop in one tool call.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: {
          type: 'string',
          description: 'Halvex deal UUID',
        },
        gap: {
          type: 'string',
          description: 'The product gap title to act on (e.g. "SSO / OAuth", "API rate limits")',
        },
      },
      required: ['deal_id', 'gap'],
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper — look up workspace by mcp_api_key
// ─────────────────────────────────────────────────────────────────────────────

async function resolveWorkspace(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return null

  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.mcpApiKey, token))
    .limit(1)

  return ws?.id ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP response helper
// ─────────────────────────────────────────────────────────────────────────────

function mcpText(text: string) {
  return NextResponse.json({
    content: [{ type: 'text', text }],
  })
}

function mcpError(message: string, status = 400) {
  return NextResponse.json(
    { error: { type: 'invalid_request_error', message } },
    { status },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — tool discovery
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  await ensureIndexes()
  const workspaceId = await resolveWorkspace(req)
  if (!workspaceId) return mcpError('Invalid or missing API key', 401)

  return NextResponse.json({ tools: TOOL_DEFINITIONS })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — tool dispatch
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  await ensureIndexes()

  const workspaceId = await resolveWorkspace(req)
  if (!workspaceId) return mcpError('Invalid or missing API key', 401)

  let body: { tool_name?: string; parameters?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return mcpError('Request body must be valid JSON')
  }

  const { tool_name, parameters = {} } = body
  if (!tool_name) return mcpError('Missing required field: tool_name')

  try {
    switch (tool_name) {
      // ── halvex_get_deal_health ─────────────────────────────────────────────
      case 'halvex_get_deal_health': {
        const dealName = parameters.deal_name as string | undefined
        if (!dealName) return mcpError('Missing parameter: deal_name')

        const result = await getDealHealth(workspaceId, dealName)

        if (!result.found) {
          return mcpText(`No deal found matching "${dealName}".`)
        }

        const lines = [
          `**${result.dealName}** (${result.company}) — ${result.stage}`,
          `Health score: ${result.score ?? 'N/A'}${result.scoreTrend ? ` (${result.scoreTrend})` : ''}`,
          result.scoreVelocity != null ? `Score velocity: ${result.scoreVelocity > 0 ? '+' : ''}${result.scoreVelocity} over 14 days` : '',
          result.closeDate ? `Close date: ${result.closeDate}` : '',
          result.daysSinceUpdate != null ? `Last updated: ${result.daysSinceUpdate} days ago` : '',
          '',
          result.risks?.length ? `**Risks:**\n${result.risks.map(r => `- ${r}`).join('\n')}` : '',
          result.pendingTodos?.length ? `**Pending todos:**\n${result.pendingTodos.map(t => `- ${t}`).join('\n')}` : '',
          result.recommendations?.length ? `**Recommendations:**\n${result.recommendations.map(r => `- ${r}`).join('\n')}` : '',
        ].filter(Boolean).join('\n')

        return mcpText(lines)
      }

      // ── halvex_find_at_risk_deals ──────────────────────────────────────────
      case 'halvex_find_at_risk_deals': {
        const deals = await findAtRiskDeals(workspaceId)

        if (deals.length === 0) {
          return mcpText('No at-risk deals found — pipeline looks healthy.')
        }

        const lines = deals.map(d =>
          `**${d.dealName}** (${d.company}) — ${d.stage} — score: ${d.score ?? 'N/A'}\n  ${d.reason}`
        ).join('\n\n')

        return mcpText(`${deals.length} deal${deals.length !== 1 ? 's' : ''} need attention:\n\n${lines}`)
      }

      // ── halvex_get_linked_issues ───────────────────────────────────────────
      case 'halvex_get_linked_issues': {
        const dealName = parameters.deal_name as string | undefined
        if (!dealName) return mcpError('Missing parameter: deal_name')

        const result = await getLinkedIssues(workspaceId, dealName)

        if (!result.found) {
          return mcpText(`No deal found matching "${dealName}".`)
        }

        if (!result.issues?.length) {
          return mcpText(`No Linear issues linked to **${result.dealName}** (${result.company}).`)
        }

        const lines = result.issues.map(i =>
          `**${i.linearIssueId}** — ${i.title}\n  Status: ${i.status}${i.issueStatus ? ` / ${i.issueStatus}` : ''} · Relevance: ${i.relevanceScore}%${i.linearIssueUrl ? `\n  ${i.linearIssueUrl}` : ''}`
        ).join('\n\n')

        return mcpText(`Linear issues linked to **${result.dealName}** (${result.company}):\n\n${lines}`)
      }

      // ── halvex_get_win_loss_signals ────────────────────────────────────────
      case 'halvex_get_win_loss_signals': {
        const result = await getWinLossSignals(workspaceId)

        if (!result.hasData) {
          return mcpText('No win/loss data yet — close some deals to build intelligence.')
        }

        const lines = [
          `Win rate: ${result.winRate != null ? `${Math.round(result.winRate * 100)}%` : 'N/A'} (${result.winCount ?? 0} won / ${result.lossCount ?? 0} lost)`,
          '',
          result.topWinSignals?.length ? `**Top win signals:**\n${result.topWinSignals.map(s => `- ${s}`).join('\n')}` : '',
          result.topLossReasons?.length ? `**Top loss reasons:**\n${result.topLossReasons.map(r => `- ${r}`).join('\n')}` : '',
          result.competitorRecord?.length
            ? `**Competitor record:**\n${result.competitorRecord.map(c => `- ${c.name}: ${c.wins}W / ${c.losses}L (${Math.round(c.winRate * 100)}% win rate)`).join('\n')}`
            : '',
        ].filter(Boolean).join('\n')

        return mcpText(lines)
      }

      // ── halvex_scope_issue ─────────────────────────────────────────────────
      case 'halvex_scope_issue': {
        const linearIssueId = parameters.linear_issue_id as string | undefined
        const dealId = parameters.deal_id as string | undefined
        const addToCycle = parameters.add_to_cycle as boolean | undefined

        if (!linearIssueId) return mcpError('Missing parameter: linear_issue_id')
        if (!dealId) return mcpError('Missing parameter: deal_id')

        const result = await halvexScopeIssue(workspaceId, {
          linear_issue_id: linearIssueId,
          deal_id: dealId,
          add_to_cycle: addToCycle,
        })

        const text = [
          `**${result.updated_issue.identifier}** — ${result.updated_issue.title}`,
          `Cycle assigned: ${result.cycle_assigned ? 'yes' : 'no'}`,
          '',
          result.updated_issue.description
            ? `**Updated description:**\n${result.updated_issue.description.slice(0, 600)}`
            : '',
        ].filter(Boolean).join('\n')

        return mcpText(text)
      }

      // ── halvex_draft_release_email ─────────────────────────────────────────
      case 'halvex_draft_release_email': {
        const dealId = parameters.deal_id as string | undefined
        const linearIssueId = parameters.linear_issue_id as string | undefined

        if (!dealId) return mcpError('Missing parameter: deal_id')
        if (!linearIssueId) return mcpError('Missing parameter: linear_issue_id')

        const result = await halvexDraftReleaseEmail(workspaceId, {
          deal_id: dealId,
          linear_issue_id: linearIssueId,
        })

        const text = [
          `**To:** ${result.to.length ? result.to.join(', ') : '(no contacts on file)'}`,
          `**Subject:** ${result.subject}`,
          '',
          result.body,
        ].join('\n')

        return mcpText(text)
      }

      // ── halvex_get_revenue_intelligence ───────────────────────────────────
      case 'halvex_get_revenue_intelligence': {
        const dealName = parameters.deal_name as string | undefined
        if (!dealName) return mcpError('Missing parameter: deal_name')

        // Find the deal
        const nameLower = dealName.toLowerCase()
        const allDeals = await db
          .select({
            id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany,
            stage: dealLogs.stage, dealValue: dealLogs.dealValue, conversionScore: dealLogs.conversionScore,
            dealRisks: dealLogs.dealRisks,
          })
          .from(dealLogs)
          .where(eq(dealLogs.workspaceId, workspaceId))
        const deal = allDeals.find(d =>
          d.dealName.toLowerCase().includes(nameLower) ||
          d.prospectCompany.toLowerCase().includes(nameLower),
        )
        if (!deal) return mcpText(`No deal found matching "${dealName}".`)

        const brain = await getWorkspaceBrain(workspaceId)
        const mlPred = brain?.mlPredictions?.find(p => p.dealId === deal.id)
        const winProb = mlPred?.winProbability ?? (deal.conversionScore ? deal.conversionScore / 100 : null)
        const revenueAtRisk = winProb != null ? Math.round((1 - winProb) * (deal.dealValue ?? 0)) : null

        const gapEntries = (brain?.productGapPriority ?? [])
        const winConditions = (brain?.winPlaybook?.topObjectionWinPatterns ?? []).slice(0, 3)

        const lines = [
          `**Revenue Intelligence: ${deal.dealName} (${deal.prospectCompany})**`,
          `Stage: ${deal.stage} · Value: ${deal.dealValue ? `£${Math.round(deal.dealValue).toLocaleString()}` : '—'}`,
          winProb != null ? `Win probability: ${Math.round(winProb * 100)}%` : 'Win probability: No model data yet',
          revenueAtRisk != null ? `Revenue at risk: £${revenueAtRisk.toLocaleString()}` : '',
          '',
          (deal.dealRisks as string[])?.length ? `**Key risks:**\n${(deal.dealRisks as string[]).map(r => `- ${r}`).join('\n')}` : '',
          gapEntries.length ? `**Product gaps in workspace:**\n${gapEntries.slice(0, 3).map(g => `- ${g.title} (£${Math.round(g.revenueAtRisk ?? 0).toLocaleString()} at stake across ${g.dealsBlocked} deals)`).join('\n')}` : '',
          winConditions.length ? `**Win conditions to hit:**\n${winConditions.map(w => `- ${w.theme}: ${Math.round(w.winRateWithTheme)}% win rate when resolved`).join('\n')}` : '',
        ].filter(Boolean).join('\n')

        return mcpText(lines)
      }

      // ── halvex_get_gap_revenue_map ─────────────────────────────────────────
      case 'halvex_get_gap_revenue_map': {
        const brain = await getWorkspaceBrain(workspaceId)
        const gaps = brain?.productGapPriority ?? []

        if (gaps.length === 0) {
          return mcpText('No product gaps logged. Add deal notes to extract feature gaps automatically.')
        }

        const lines = [
          '**Product Gap → Revenue Map** (sorted by revenue at stake)',
          '',
          ...gaps.map((g, i) => {
            const linked = g.status === 'on_roadmap' || g.status === 'shipped'
            return `${i + 1}. **${g.title}**\n   Revenue at risk: £${Math.round(g.revenueAtRisk ?? 0).toLocaleString()} · ${g.dealsBlocked} deals blocked\n   Linear: ${linked ? '✓ Linked' : '○ Not linked'}`
          }),
        ].join('\n')

        return mcpText(lines)
      }

      // ── halvex_close_the_loop ──────────────────────────────────────────────
      case 'halvex_close_the_loop': {
        const dealId = parameters.deal_id as string | undefined
        const gap = parameters.gap as string | undefined

        if (!dealId) return mcpError('Missing parameter: deal_id')
        if (!gap) return mcpError('Missing parameter: gap')

        // Fetch the deal
        const [deal] = await db
          .select({
            id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany,
            stage: dealLogs.stage,
          })
          .from(dealLogs)
          .where(and(eq(dealLogs.workspaceId, workspaceId), eq(dealLogs.id, dealId)))
          .limit(1)

        if (!deal) return mcpError(`Deal not found: ${dealId}`)

        // Look for an existing Linear issue for this gap
        const existingLinks = await db
          .select({ id: dealLinearLinks.id, linearIssueId: dealLinearLinks.linearIssueId })
          .from(dealLinearLinks)
          .where(eq(dealLinearLinks.dealId, dealId))

        // Scope the gap as a user story using Haiku
        const { generateText } = await import('ai')
        const { createAnthropic } = await import('@ai-sdk/anthropic')
        const anthropic = createAnthropic()
        const { text: emailDraft } = await generateText({
          model: anthropic('claude-haiku-4-5-20251001'),
          prompt: `You are a sales rep. Draft a short re-engagement email (max 4 sentences) to ${deal.prospectCompany} letting them know that "${gap}" is now on the roadmap. Be specific, professional, and warm. Just the email body, no subject line.`,
          maxTokens: 200,
        })

        // Log the loop action
        await db.insert(mcpActionLog).values({
          workspaceId,
          actionType: 'close_the_loop',
          dealId,
          triggeredBy: 'mcp',
          payload: { gap, dealName: deal.dealName },
          result: { emailDraft, existingLinkCount: existingLinks.length },
          status: 'complete',
        })

        const lines = [
          `**Loop closed: ${deal.dealName} × ${gap}**`,
          '',
          existingLinks.length > 0
            ? `Found ${existingLinks.length} existing Linear link(s) for this deal.`
            : 'No existing Linear links found — consider linking a Linear issue via halvex_scope_issue.',
          '',
          '**Re-engagement email draft:**',
          emailDraft,
          '',
          'Next steps:',
          '1. Link a Linear issue via halvex_scope_issue',
          '2. Send the email above to the prospect',
          '3. Log the outreach in Halvex',
        ].join('\n')

        return mcpText(lines)
      }

      default:
        return mcpError(`Unknown tool: ${tool_name}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[mcp] tool=${tool_name} error:`, message)
    return mcpError(`Tool execution failed: ${message}`, 500)
  }
}
