/**
 * Slack Block Kit formatters.
 *
 * `markdownToBlocks()` — converts the agent's markdown output to Slack Block Kit.
 * Also exports individual block builders for proactive notifications.
 *
 * Slack Block Kit reference: https://api.slack.com/block-kit
 */

import type { SlackBlock } from '@/lib/slack-client'

// ─────────────────────────────────────────────────────────────────────────────
// Block builders
// ─────────────────────────────────────────────────────────────────────────────

function headerBlock(text: string): SlackBlock {
  return {
    type: 'header',
    text: { type: 'plain_text', text: text.slice(0, 150), emoji: true },
  }
}

function sectionBlock(text: string): SlackBlock {
  return {
    type: 'section',
    text: { type: 'mrkdwn', text: text.slice(0, 3000) },
  }
}

function contextBlock(text: string): SlackBlock {
  return {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: text.slice(0, 3000) }],
  }
}

function dividerBlock(): SlackBlock {
  return { type: 'divider' }
}

function actionsBlock(buttons: { text: string; url?: string; actionId?: string; style?: 'primary' | 'danger' }[]): SlackBlock {
  return {
    type: 'actions',
    elements: buttons.map(b => ({
      type: b.url ? 'button' : 'button',
      text: { type: 'plain_text', text: b.text.slice(0, 75), emoji: true },
      ...(b.url ? { url: b.url } : {}),
      ...(b.actionId ? { action_id: b.actionId } : {}),
      ...(b.style ? { style: b.style } : {}),
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown → Block Kit converter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert agent markdown output to Slack Block Kit blocks.
 *
 * Strategy:
 * - Lines starting with # → header block
 * - Long content → section block
 * - Short confirmations → single section block
 * - Max 50 blocks (Slack limit)
 */
export function markdownToBlocks(markdown: string): SlackBlock[] {
  if (!markdown?.trim()) return [sectionBlock('…')]

  const blocks: SlackBlock[] = []
  const lines = markdown.split('\n')

  // Short response (≤ 2 lines, ≤ 200 chars) → just a single section
  const trimmed = markdown.trim()
  if (trimmed.length <= 200 && !trimmed.includes('\n\n')) {
    return [sectionBlock(slackifyMarkdown(trimmed))]
  }

  let currentSectionLines: string[] = []

  const flushSection = () => {
    if (currentSectionLines.length > 0) {
      const text = currentSectionLines.join('\n').trim()
      if (text) {
        // Long sections get split at ~2500 chars to stay under block limit
        if (text.length > 2500) {
          blocks.push(sectionBlock(slackifyMarkdown(text.slice(0, 2500))))
          const remainder = text.slice(2500)
          if (remainder.trim()) blocks.push(sectionBlock(slackifyMarkdown(remainder)))
        } else {
          blocks.push(sectionBlock(slackifyMarkdown(text)))
        }
      }
      currentSectionLines = []
    }
  }

  for (const line of lines) {
    // H1/H2 → header block
    if (/^#{1,2}\s/.test(line)) {
      flushSection()
      const headerText = line.replace(/^#{1,2}\s+/, '').replace(/\*\*/g, '')
      if (headerText.trim()) {
        blocks.push(headerBlock(headerText.trim()))
      }
      continue
    }

    // H3 → bold section
    if (/^#{3}\s/.test(line)) {
      flushSection()
      currentSectionLines.push(`*${line.replace(/^#{3}\s+/, '')}*`)
      continue
    }

    // Empty line → flush section (paragraph break)
    if (line.trim() === '') {
      flushSection()
      continue
    }

    // Divider patterns
    if (/^---+$/.test(line.trim())) {
      flushSection()
      blocks.push(dividerBlock())
      continue
    }

    currentSectionLines.push(line)
  }

  flushSection()

  // Enforce Slack's 50-block limit
  return blocks.slice(0, 50)
}

/**
 * Convert markdown syntax to Slack mrkdwn.
 * Slack uses *bold* and _italic_, not **bold** and *italic*.
 */
function slackifyMarkdown(text: string): string {
  return text
    // **bold** → *bold*
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // __bold__ → *bold*
    .replace(/__(.+?)__/g, '*$1*')
    // [text](url) → <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
}

// ─────────────────────────────────────────────────────────────────────────────
// Proactive notification formatters
// ─────────────────────────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.halvex.io'

/**
 * Format a health-drop alert as a Slack DM.
 */
export function healthDropBlocks(alert: {
  dealName: string
  company: string
  dealId: string
  previousScore: number
  currentScore: number
  possibleCause: string
}): SlackBlock[] {
  const delta = alert.previousScore - alert.currentScore
  return [
    sectionBlock(
      `⚠️ *${alert.dealName}* health dropped *${alert.previousScore} → ${alert.currentScore}* (−${delta} pts)\n` +
      `*Company:* ${alert.company}\n` +
      `*Top risk:* ${alert.possibleCause}`
    ),
    actionsBlock([
      { text: '📊 View deal', url: `${APP_URL}/deals/${alert.dealId}` },
      { text: '🤖 Get actions', actionId: `get_actions_${alert.dealId}` },
    ]),
  ]
}

/**
 * Format a new high-relevance Linear issue link as a Slack DM.
 */
export function newIssueLinkBlocks(link: {
  dealName: string
  company: string
  dealId: string
  linearIssueId: string
  linearTitle: string
  linearIssueUrl?: string | null
  relevanceScore: number
}): SlackBlock[] {
  return [
    sectionBlock(
      `🔗 New issue match for *${link.dealName}* (${link.company})\n` +
      `*${link.linearIssueId}* — ${link.linearTitle} (relevance: ${link.relevanceScore}%)`
    ),
    actionsBlock([
      ...(link.linearIssueUrl ? [{ text: '🔧 View issue', url: link.linearIssueUrl }] : []),
      { text: '📊 View deal', url: `${APP_URL}/deals/${link.dealId}` },
    ]),
  ]
}

/**
 * Format an issue-deployed notification asking if a release email should be drafted.
 */
export function issueDeployedBlocks(info: {
  dealName: string
  company: string
  dealId: string
  linearIssueId: string
  linearTitle: string
}): SlackBlock[] {
  return [
    sectionBlock(
      `🚀 *${info.linearIssueId}* is live!\n` +
      `This was linked to *${info.dealName}* (${info.company}) as a potential conversion factor.`
    ),
    sectionBlock(`Shall I write *${info.company}* a release email to try to convert them?`),
    actionsBlock([
      { text: '✉️ Yes, draft email', actionId: `draft_release_email_${info.dealId}_${info.linearIssueId}`, style: 'primary' },
      { text: 'Skip', actionId: `skip_release_email_${info.dealId}` },
    ]),
  ]
}

/**
 * Simple error/fallback block.
 */
export function errorBlocks(message: string): SlackBlock[] {
  return [contextBlock(`_${message}_`)]
}
