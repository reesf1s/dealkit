/**
 * PM approval flow — Slack + Linear integration removed.
 * This file is kept as a stub to avoid import errors from any remaining references.
 * The PM approval workflow is now handled externally via Claude MCP.
 */

import { db } from '@/lib/db'
import { slackUserMappings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────────────────
// Look up Clerk user ID from Slack user ID
// ─────────────────────────────────────────────────────────────────────────────

export async function getClerkUserIdFromSlack(
  slackUserId: string,
  workspaceId: string,
): Promise<string | null> {
  const [mapping] = await db
    .select({ clerkUserId: slackUserMappings.clerkUserId })
    .from(slackUserMappings)
    .where(and(
      eq(slackUserMappings.workspaceId, workspaceId),
      eq(slackUserMappings.slackUserId, slackUserId),
    ))
    .limit(1)
  return mapping?.clerkUserId ?? null
}

export interface PmApprovalResult {
  succeeded: { issueId: string; title: string; userStory: string }[]
  failed: { issueId: string; error: string }[]
  cycleName: string
}

export async function requestPmApproval(_params: {
  workspaceId: string
  repSlackUserId: string
  repChannelId: string
  dealId: string
  dealName: string
  company: string
  dealValue: number | null
  issueIds: string[]
}): Promise<string> {
  return 'PM approval via Slack is no longer supported. Use Claude MCP to coordinate with your product team.'
}

export async function executePmApproval(
  _pendingActionId: string,
  _workspaceId: string,
): Promise<PmApprovalResult> {
  return { succeeded: [], failed: [], cycleName: '' }
}

export async function declinePmApproval(
  _pendingActionId: string,
  _workspaceId: string,
): Promise<void> {
  // no-op
}
