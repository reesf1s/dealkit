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
 *   halvex_get_win_loss_signals         — workspace win/loss intelligence
 *   halvex_get_revenue_intelligence     — structured deal intelligence: win probability + gaps + win conditions
 *   halvex_get_gap_revenue_map          — PM view: which features are blocking the most revenue
 *   halvex_list_deals_for_matching      — structured deal list for Claude to analyse against issues
 *   halvex_save_issue_link              — save a deal ↔ issue URL link (simple URL storage)
 *   halvex_prepare_customer_followup    — prepare follow-up for a deal once linked product work moves forward
 *   halvex_draft_release_email          — draft release notification email for a prospect
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, not, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces, dealLogs, productGaps, dealLinearLinks, mcpActionLog } from '@/lib/db/schema'
import { ensureIndexes } from '@/lib/api-helpers'
import {
  getDealHealth,
  findAtRiskDeals,
  getWinLossSignals,
} from '@/lib/mcp-tools'
import { halvexDraftReleaseEmail } from '@/lib/mcp-external-tools'
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
    name: 'halvex_get_win_loss_signals',
    description: 'Return workspace-level win/loss intelligence — win rate, top win patterns, top loss reasons, and competitor records.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
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
    description: '[PM tool] Returns all product gaps ranked by revenue at stake. Shows which features are costing the most revenue and how many deals they block.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'halvex_list_deals_for_matching',
    description: 'Returns all open deals with their requirements, pain points, and product gaps — structured for Claude to analyse against a list of issues and identify matches. Call this before halvex_save_issue_link.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'halvex_save_issue_link',
    description: 'Save a deal ↔ issue link that Claude has identified as relevant. Stores the URL and title — no external API calls. Users can confirm or dismiss it in the Halvex UI.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: {
          type: 'string',
          description: 'Halvex deal UUID (from halvex_list_deals_for_matching)',
        },
        url: {
          type: 'string',
          description: 'Full URL to the issue (Linear, GitHub, Jira, etc.)',
        },
        title: {
          type: 'string',
          description: 'Title of the issue',
        },
        source: {
          type: 'string',
          description: 'Source system identifier, e.g. "ENG-42" or "GH-123"',
        },
        relevance_reason: {
          type: 'string',
          description: 'Brief explanation of why this issue is relevant to the deal (1-2 sentences)',
        },
        relevance_score: {
          type: 'number',
          description: 'How relevant this issue is to the deal, 0-100',
        },
      },
      required: ['deal_id', 'url', 'title', 'relevance_reason'],
    },
  },
  {
    name: 'halvex_prepare_customer_followup',
    description: 'Given a deal and a product gap, prepare the customer follow-up context around already-linked product work and draft a re-engagement email.',
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
  {
    name: 'halvex_draft_release_email',
    description: 'Draft a release notification email to a prospect informing them that a feature they requested is now live.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: {
          type: 'string',
          description: 'Halvex deal UUID',
        },
        issue_id: {
          type: 'string',
          description: 'Issue identifier of the shipped feature (e.g. "ENG-42")',
        },
      },
      required: ['deal_id', 'issue_id'],
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
            return `${i + 1}. **${g.title}**\n   Revenue at risk: £${Math.round(g.revenueAtRisk ?? 0).toLocaleString()} · ${g.dealsBlocked} deals blocked\n   Issue: ${linked ? '✓ Linked' : '○ Not linked'}`
          }),
        ].join('\n')

        return mcpText(lines)
      }

      // ── halvex_list_deals_for_matching ──────────────────────────────────────
      case 'halvex_list_deals_for_matching': {
        const deals = await db
          .select({
            id: dealLogs.id,
            dealName: dealLogs.dealName,
            prospectCompany: dealLogs.prospectCompany,
            stage: dealLogs.stage,
            dealValue: dealLogs.dealValue,
            dealRisks: dealLogs.dealRisks,
            nextSteps: dealLogs.nextSteps,
          })
          .from(dealLogs)
          .where(
            and(
              eq(dealLogs.workspaceId, workspaceId),
              not(inArray(dealLogs.stage, ['closed_won', 'closed_lost'])),
            )
          )

        if (deals.length === 0) {
          return mcpText('No open deals found in this workspace.')
        }

        // Fetch product gaps — sourceDeals is a JSONB array of deal IDs
        const gaps = await db
          .select({ title: productGaps.title, sourceDeals: productGaps.sourceDeals })
          .from(productGaps)
          .where(eq(productGaps.workspaceId, workspaceId))

        const gapsByDeal: Record<string, string[]> = {}
        for (const g of gaps) {
          const dealIds = (g.sourceDeals as string[]) ?? []
          for (const dId of dealIds) {
            if (!gapsByDeal[dId]) gapsByDeal[dId] = []
            gapsByDeal[dId].push(g.title)
          }
        }

        const lines = [
          `**${deals.length} open deals** — structured for issue matching:`,
          '',
          ...deals.map(d => {
            const value = d.dealValue ? `£${Math.round(d.dealValue).toLocaleString()}` : '—'
            const risks = (d.dealRisks as string[])?.join(', ') || 'none'
            const dealGaps = gapsByDeal[d.id]?.join(', ') || 'none logged'
            return [
              `**${d.dealName}** (${d.prospectCompany}) | ${d.stage} | ${value}`,
              `  deal_id: ${d.id}`,
              `  Risks: ${risks}`,
              `  Product gaps needed: ${dealGaps}`,
              `  Next steps: ${d.nextSteps || 'not set'}`,
            ].join('\n')
          }),
          '',
          'To save a match: call halvex_save_issue_link with deal_id + url + title + relevance_reason.',
        ].join('\n')

        return mcpText(lines)
      }

      // ── halvex_save_issue_link ───────────────────────────────────────────────
      case 'halvex_save_issue_link': {
        const dealId = parameters.deal_id as string | undefined
        const url = parameters.url as string | undefined
        const title = parameters.title as string | undefined
        const source = (parameters.source as string | undefined) ?? ''
        const relevanceReason = parameters.relevance_reason as string | undefined
        const relevanceScore = (parameters.relevance_score as number | undefined) ?? 60

        if (!dealId) return mcpError('Missing parameter: deal_id')
        if (!url) return mcpError('Missing parameter: url')
        if (!title) return mcpError('Missing parameter: title')
        if (!relevanceReason) return mcpError('Missing parameter: relevance_reason')

        // Verify deal belongs to workspace
        const [deal] = await db
          .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany })
          .from(dealLogs)
          .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
          .limit(1)

        if (!deal) return mcpError(`Deal not found: ${dealId}`)

        // Upsert the link (status = identified — user must confirm in UI)
        await db
          .insert(dealLinearLinks)
          .values({
            workspaceId,
            dealId,
            linearIssueId: source || url,
            linearIssueUrl: url,
            title,
            relevanceScore: Math.round(relevanceScore),
            status: 'identified',
            matchSource: 'claude_mcp',
          } as any)
          .onConflictDoNothing()

        // Log action
        await db.insert(mcpActionLog).values({
          workspaceId,
          actionType: 'save_issue_link',
          dealId,
          triggeredBy: 'mcp',
          payload: { url, title, source, relevanceReason, relevanceScore },
          result: { saved: true },
          status: 'complete',
        })

        return mcpText(
          `Saved link: **${deal.dealName}** ↔ **${title}**\n` +
          `URL: ${url}\n` +
          `Relevance: ${Math.round(relevanceScore)}% — "${relevanceReason}"\n` +
          `Status: suggested (user will confirm or dismiss in Halvex)`
        )
      }

      // ── halvex_prepare_customer_followup ───────────────────────────────────
      case 'halvex_prepare_customer_followup':
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

        // Look for existing issue links for this deal
        const existingLinks = await db
          .select({ id: dealLinearLinks.id, linearIssueId: dealLinearLinks.linearIssueId })
          .from(dealLinearLinks)
          .where(eq(dealLinearLinks.dealId, dealId))

        // Draft re-engagement email
        const { generateText } = await import('ai')
        const { createOpenAI } = await import('@ai-sdk/openai')
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const { text: emailDraft } = await generateText({
          model: openai('gpt-5.4-mini'),
          prompt: `You are a sales rep. Draft a short re-engagement email (max 4 sentences) to ${deal.prospectCompany} letting them know that "${gap}" is now on the roadmap. Be specific, professional, and warm. Just the email body, no subject line.`,
          providerOptions: {
            openai: {
              maxCompletionTokens: 200,
            },
          },
        })

        // Log the follow-up preparation action
        await db.insert(mcpActionLog).values({
          workspaceId,
          actionType: 'prepare_customer_followup',
          dealId,
          triggeredBy: 'mcp',
          payload: { gap, dealName: deal.dealName },
          result: { emailDraft, existingLinkCount: existingLinks.length },
          status: 'complete',
        })

        const lines = [
          `**Customer follow-up prepared: ${deal.dealName} × ${gap}**`,
          '',
          existingLinks.length > 0
            ? `Found ${existingLinks.length} existing issue link(s) for this deal.`
            : 'No existing issue links found yet. Review the deal in Claude with Halvex MCP and save a relevant issue link first.',
          '',
          '**Re-engagement email draft:**',
          emailDraft,
          '',
          'Next steps:',
          '1. Link an issue via halvex_save_issue_link',
          '2. Send the email above to the prospect',
          '3. Log the outreach in Halvex',
        ].join('\n')

        return mcpText(lines)
      }

      // ── halvex_draft_release_email ─────────────────────────────────────────
      case 'halvex_draft_release_email': {
        const dealId = parameters.deal_id as string | undefined
        const issueId = parameters.issue_id as string | undefined

        if (!dealId) return mcpError('Missing parameter: deal_id')
        if (!issueId) return mcpError('Missing parameter: issue_id')

        const result = await halvexDraftReleaseEmail(workspaceId, {
          deal_id: dealId,
          issue_id: issueId,
        })

        const text = [
          `**To:** ${result.to.length ? result.to.join(', ') : '(no contacts on file)'}`,
          `**Subject:** ${result.subject}`,
          '',
          result.body,
        ].join('\n')

        return mcpText(text)
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
