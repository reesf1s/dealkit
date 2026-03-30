/**
 * Workflow execution engine.
 *
 * Runs a single workflow row against the workspace's deal data.
 * Picks the right tool based on the workflow's action label, generates
 * a brief plain-text summary using Haiku, and updates lastRunAt + lastOutput.
 * For Slack output targets, also sends the output as a channel/DM message.
 */

import { anthropic } from '@/lib/ai/client'
import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { workflows } from '@/lib/db/schema'
import { findAtRiskDeals } from '@/lib/mcp-tools'
import { getWinLossSignals } from '@/lib/mcp-tools'


// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecuteResult {
  output: string
  toolUsed: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Core
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a single workflow for a workspace.
 * Returns the generated output string (also persisted to DB).
 */
export async function executeWorkflow(
  workspaceId: string,
  workflowId: string,
): Promise<ExecuteResult> {
  // 1. Load workflow
  const [wf] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.workspaceId, workspaceId)))
    .limit(1)

  if (!wf) throw new Error('Workflow not found')

  const actionLabel = (wf.actions as any[])?.[0]?.label ?? wf.name
  const label = actionLabel.toLowerCase()

  // 2. Fetch relevant data based on action content
  let contextText = ''
  let toolUsed = 'general'

  if (label.includes('risk') || label.includes('score') || label.includes('health') || label.includes('at-risk') || label.includes('attention')) {
    // Deal risk / health workflow
    const atRisk = await findAtRiskDeals(workspaceId)
    toolUsed = 'findAtRiskDeals'
    if (atRisk.length === 0) {
      contextText = 'No at-risk deals found. Pipeline looks healthy.'
    } else {
      contextText = `At-risk deals (${atRisk.length}):\n` +
        atRisk.slice(0, 5).map(d =>
          `- ${d.dealName} (${d.company}) score=${d.score ?? 'N/A'} stage=${d.stage}: ${d.reason}`
        ).join('\n')
    }
  } else if (label.includes('win') || label.includes('loss') || label.includes('signal')) {
    // Win/loss intelligence workflow
    const wl = await getWinLossSignals(workspaceId)
    toolUsed = 'getWinLossSignals'
    if (!wl.hasData) {
      contextText = 'No win/loss data available yet.'
    } else {
      contextText = `Win rate: ${wl.winRate}% (${wl.winCount}W / ${wl.lossCount}L)\n` +
        `Top win signals: ${(wl.topWinSignals ?? []).join(', ')}\n` +
        `Top loss reasons: ${(wl.topLossReasons ?? []).join(', ')}`
    }
  } else {
    // Sprint briefing / general — at-risk deals are a good default briefing
    const atRisk = await findAtRiskDeals(workspaceId)
    toolUsed = 'findAtRiskDeals'
    if (atRisk.length === 0) {
      contextText = 'No deals need immediate attention. Pipeline looks healthy.'
    } else {
      contextText = `Deals needing attention today (${atRisk.length}):\n` +
        atRisk.slice(0, 5).map(d =>
          `- ${d.dealName} (${d.company}) stage=${d.stage}: ${d.reason}`
        ).join('\n')
    }
  }

  // 3. Use Haiku to generate a brief 1-2 sentence output
  const systemPrompt = `You are a sales intelligence assistant. Summarize the data below into 1-2 concise sentences (max 30 words total) for a ${wf.outputTarget === 'slack' ? 'Slack notification' : 'daily briefing'}. Start with the most important insight. No preamble.`

  const msg = await anthropic.messages.create({
    model: 'gpt-4.1-mini',
    max_tokens: 80,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Workflow: "${wf.name}"\nAction: "${actionLabel}"\nData:\n${contextText}`,
      },
    ],
  })

  const output = (msg.content[0] as any)?.text?.trim() ?? contextText.slice(0, 120)

  // 4. Persist to DB
  await db
    .update(workflows)
    .set({ lastRunAt: new Date(), lastOutput: output })
    .where(eq(workflows.id, workflowId))

  // 5. Slack output — DM all opted-in users (fire-and-forget)
  if (wf.outputTarget === 'slack') {
    import('./slack-notify').then(async () => {
      const { slackOpenDm, slackPostMessage } = await import('./slack-client')
      const { slackConnections, slackUserMappings } = await import('./db/schema')
      const { decrypt, getEncryptionKey } = await import('./encrypt')
      const { eq: eqInner } = await import('drizzle-orm')
      const { db: dbInner } = await import('./db')

      const [conn] = await dbInner
        .select({ botTokenEnc: slackConnections.botTokenEnc })
        .from(slackConnections)
        .where(eqInner(slackConnections.workspaceId, workspaceId))
        .limit(1)
      if (!conn) return

      const botToken = decrypt(conn.botTokenEnc, getEncryptionKey())

      const users = await dbInner
        .select({ slackUserId: slackUserMappings.slackUserId })
        .from(slackUserMappings)
        .where(eqInner(slackUserMappings.workspaceId, workspaceId))

      for (const u of users) {
        try {
          const channel = await slackOpenDm(botToken, u.slackUserId)
          if (channel) await slackPostMessage(botToken, channel, [
            { type: 'section', text: { type: 'mrkdwn', text: `*${wf.name}*\n${output}` } },
          ])
        } catch { /* non-fatal */ }
      }
    }).catch(() => { /* non-fatal */ })
  }

  return { output, toolUsed }
}

/**
 * Run all enabled schedule workflows for a given workspace.
 * Used by the nightly cron.
 */
export async function runScheduledWorkflows(workspaceId: string): Promise<{ ran: number; errors: number }> {
  const scheduled = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(and(
      eq(workflows.workspaceId, workspaceId),
      eq(workflows.isEnabled, true),
      eq(workflows.triggerType, 'schedule'),
    ))

  let ran = 0
  let errors = 0

  for (const wf of scheduled) {
    try {
      await executeWorkflow(workspaceId, wf.id)
      ran++
    } catch (err) {
      console.error('[workflow-executor] failed for', wf.id, err)
      errors++
    }
  }

  return { ran, errors }
}
