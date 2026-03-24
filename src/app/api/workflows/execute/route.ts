/**
 * POST /api/workflows/execute
 * Executes a saved workflow and persists the output to lastOutput + lastRunAt.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workflows, dealLogs, dealLinearLinks } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Load workflow — must belong to this workspace
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.workspaceId, workspaceId)))
      .limit(1)

    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const output = await executeWorkflow(workspaceId, workflow)

    await db
      .update(workflows)
      .set({ lastOutput: output, lastRunAt: new Date() })
      .where(eq(workflows.id, id))

    return NextResponse.json({ data: { output } })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// ── Execution logic ────────────────────────────────────────────────────────────

async function executeWorkflow(
  workspaceId: string,
  workflow: { name: string; description: string | null; actions: unknown },
): Promise<string> {
  const actionsArr = Array.isArray(workflow.actions) ? workflow.actions : []
  const actionLabel: string = (actionsArr[0] as { label?: string })?.label ?? workflow.description ?? ''
  const lower = actionLabel.toLowerCase()

  // ── Daily sprint briefing — in-cycle Linear issues linked to deals ──────────
  if (lower.includes('@linear') && (lower.includes('@cyclecurrent') || lower.includes('cycle'))) {
    return await runSprintBriefing(workspaceId)
  }

  // ── Deal risk alert — flag low-score deals ────────────────────────────────
  if (lower.includes('risk') || lower.includes('score drop') || lower.includes('health drop')) {
    return await runDealRiskAlert(workspaceId)
  }

  // ── Release loop — shipped issues linked to deals ──────────────────────────
  if (lower.includes('release') || lower.includes('ships') || lower.includes('deployed')) {
    return await runReleaseLoop(workspaceId)
  }

  // ── Generic: Claude Haiku with workspace context ───────────────────────────
  return await runGenericWorkflow(workspaceId, workflow.name, actionLabel)
}

async function runSprintBriefing(workspaceId: string): Promise<string> {
  const links = await db
    .select({
      dealId: dealLinearLinks.dealId,
      linearIssueId: dealLinearLinks.linearIssueId,
      linearTitle: dealLinearLinks.linearTitle,
      addressesRisk: dealLinearLinks.addressesRisk,
      scopedAt: dealLinearLinks.scopedAt,
    })
    .from(dealLinearLinks)
    .where(and(
      eq(dealLinearLinks.workspaceId, workspaceId),
      eq(dealLinearLinks.status, 'in_cycle'),
    ))

  if (links.length === 0) return 'No Linear issues in the current cycle are linked to deals.'

  const deals = await db
    .select({ id: dealLogs.id, dealName: dealLogs.dealName })
    .from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))

  const dealMap = new Map(deals.map(d => [d.id, d.dealName]))

  const lines = links.slice(0, 10).map(l => {
    const dealName = dealMap.get(l.dealId) ?? 'unknown deal'
    const prefix = l.linearIssueId ? `${l.linearIssueId} ` : ''
    const risk = l.addressesRisk ? ' ⚡ addresses risk' : ''
    return `• ${prefix}${l.linearTitle ?? 'Issue'} → ${dealName}${risk}`
  })

  return `${links.length} issue${links.length !== 1 ? 's' : ''} in the current cycle:\n${lines.join('\n')}`
}

async function runDealRiskAlert(workspaceId: string): Promise<string> {
  const brain = await getWorkspaceBrain(workspaceId)
  const atRisk = (brain?.deals ?? [])
    .filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
    .filter(d => d.conversionScore != null && d.conversionScore < 40)
    .sort((a, b) => (a.conversionScore ?? 0) - (b.conversionScore ?? 0))
    .slice(0, 5)

  if (atRisk.length === 0) return 'No deals at risk right now — all scores are above 40%.'

  const lines = atRisk.map(d => {
    const score = d.conversionScore != null ? `${d.conversionScore}%` : '?'
    const topRisk = d.risks?.[0] ? ` — "${d.risks[0]}"` : ''
    return `• ${d.company} "${d.name}" | score: ${score} | ${d.stage}${topRisk}`
  })

  return `${atRisk.length} deal${atRisk.length !== 1 ? 's' : ''} need attention:\n${lines.join('\n')}`
}

async function runReleaseLoop(workspaceId: string): Promise<string> {
  // Find done/completed issues linked to deals
  const links = await db
    .select({
      dealId: dealLinearLinks.dealId,
      linearIssueId: dealLinearLinks.linearIssueId,
      linearTitle: dealLinearLinks.linearTitle,
    })
    .from(dealLinearLinks)
    .where(and(
      eq(dealLinearLinks.workspaceId, workspaceId),
      eq(dealLinearLinks.status, 'confirmed'),
    ))

  if (links.length === 0) return 'No confirmed Linear issues linked to deals.'

  const deals = await db
    .select({ id: dealLogs.id, dealName: dealLogs.dealName })
    .from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))

  const dealMap = new Map(deals.map(d => [d.id, d.dealName]))

  const lines = links.slice(0, 8).map(l => {
    const prefix = l.linearIssueId ? `${l.linearIssueId} ` : ''
    return `• ${prefix}${l.linearTitle ?? 'Issue'} → ${dealMap.get(l.dealId) ?? 'deal'}`
  })

  return `${links.length} confirmed issue${links.length !== 1 ? 's' : ''} linked to deals:\n${lines.join('\n')}`
}

async function runGenericWorkflow(
  workspaceId: string,
  name: string,
  actionLabel: string,
): Promise<string> {
  const brain = await getWorkspaceBrain(workspaceId)
  const activeDeals = (brain?.deals ?? []).filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const dealSummary = activeDeals.slice(0, 8)
    .map(d => `${d.company}: stage=${d.stage}, score=${d.conversionScore ?? '?'}%`)
    .join('; ') || 'No active deals'

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `You are an output generator for a sales intelligence workflow platform.

Workflow: "${name}"
Action: "${actionLabel}"
Live pipeline: ${dealSummary}

Generate a concise (2-4 sentences) workflow output providing actionable insight based on the pipeline data. Be specific and data-driven. Plain text, no markdown headers.`,
    }],
  })

  return (msg.content[0] as { type: string; text: string }).text.trim()
}
