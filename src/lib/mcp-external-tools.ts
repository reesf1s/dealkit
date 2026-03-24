/**
 * MCP external tool implementations.
 *
 * These two tools are exposed through the external MCP HTTP server
 * (/api/mcp) and match the signed tool signatures from the product plan.
 *
 * halvexScopeIssue        — generate user story + ACs, update Linear, add to cycle
 * halvexDraftReleaseEmail — draft release notification email for a prospect
 */

import { db } from '@/lib/db'
import {
  dealLinearLinks,
  linearIssuesCache,
  linearIntegrations,
  dealLogs,
  mcpActionLog,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'
import {
  getUpcomingCycle,
  scopeIssueToCycle,
  updateIssueDescription,
} from '@/lib/linear-cycle'
import { generateScopedIssue } from '@/lib/scope-generator'
import { getOrGenerateReleaseEmail } from '@/lib/release-email-generator'
import type { LinearIssue } from '@/lib/linear-client'

// ─────────────────────────────────────────────────────────────────────────────
// halvexScopeIssue
// ─────────────────────────────────────────────────────────────────────────────

export interface ScopeIssueInput {
  linear_issue_id: string
  deal_id: string
  add_to_cycle?: boolean
}

export interface ScopeIssueResult {
  updated_issue: Pick<LinearIssue, 'id' | 'identifier' | 'title' | 'description'>
  cycle_assigned: boolean
}

export async function halvexScopeIssue(
  workspaceId: string,
  input: ScopeIssueInput,
): Promise<ScopeIssueResult> {
  const issueIdUpper = input.linear_issue_id.toUpperCase()

  // Deal
  const [deal] = await db
    .select({
      id: dealLogs.id,
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      notes: dealLogs.notes,
      dealRisks: dealLogs.dealRisks,
    })
    .from(dealLogs)
    .where(and(eq(dealLogs.id, input.deal_id), eq(dealLogs.workspaceId, workspaceId)))
    .limit(1)

  if (!deal) throw new Error(`Deal not found: ${input.deal_id}`)

  // Cached issue
  const [cachedIssue] = await db
    .select()
    .from(linearIssuesCache)
    .where(and(
      eq(linearIssuesCache.workspaceId, workspaceId),
      eq(linearIssuesCache.linearIssueId, issueIdUpper),
    ))
    .limit(1)

  const issueTitle = cachedIssue?.title ?? issueIdUpper
  const issueDescription = cachedIssue?.description ?? null

  // Linear integration
  const [integration] = await db
    .select({ apiKeyEnc: linearIntegrations.apiKeyEnc, teamId: linearIntegrations.teamId })
    .from(linearIntegrations)
    .where(eq(linearIntegrations.workspaceId, workspaceId))
    .limit(1)

  if (!integration) throw new Error('Linear is not connected for this workspace')
  const apiKey = decrypt(integration.apiKeyEnc, getEncryptionKey())

  // Check for cached scoped content
  const [existingLink] = await db
    .select()
    .from(dealLinearLinks)
    .where(and(
      eq(dealLinearLinks.workspaceId, workspaceId),
      eq(dealLinearLinks.dealId, input.deal_id),
      eq(dealLinearLinks.linearIssueId, issueIdUpper),
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

  // Update Linear issue description
  const halvexContent = [
    `**Deal:** ${deal.dealName} (${deal.prospectCompany})`,
    '',
    `**User Story:** ${userStory}`,
    '',
    '**Acceptance Criteria:**',
    ...acceptanceCriteria.map(ac => `- [ ] ${ac}`),
  ].join('\n')

  try {
    await updateIssueDescription(issueIdUpper, halvexContent, issueDescription, apiKey)
  } catch {
    // Non-fatal — Linear update failure shouldn't block the response
  }

  // Optionally add to upcoming cycle
  let cycleAssigned = false
  if (input.add_to_cycle !== false) {
    const cycle = await getUpcomingCycle(integration.teamId, apiKey)
    if (cycle) {
      try {
        await scopeIssueToCycle(issueIdUpper, cycle.id, apiKey)
        cycleAssigned = true
      } catch {
        // Non-fatal
      }
    }
  }

  // Persist to DB
  const linkUpdate = {
    status: cycleAssigned ? 'in_cycle' : 'confirmed',
    scopedAt: new Date(),
    updatedAt: new Date(),
    scopedDescription,
    scopedUserStory: userStory,
    scopedAcceptanceCriteria: acceptanceCriteria.join('\n'),
  } as const

  if (existingLink) {
    await db
      .update(dealLinearLinks)
      .set(linkUpdate)
      .where(and(
        eq(dealLinearLinks.workspaceId, workspaceId),
        eq(dealLinearLinks.dealId, input.deal_id),
        eq(dealLinearLinks.linearIssueId, issueIdUpper),
      ))
  } else {
    await db.insert(dealLinearLinks).values({
      workspaceId,
      dealId: input.deal_id,
      linearIssueId: issueIdUpper,
      linearTitle: issueTitle,
      linearIssueUrl: cachedIssue?.linearIssueUrl ?? null,
      relevanceScore: 0,
      linkType: 'manual',
      ...linkUpdate,
    })
  }

  // Audit log
  await db.insert(mcpActionLog).values({
    workspaceId,
    actionType: 'scope_issue',
    dealId: input.deal_id,
    linearIssueId: issueIdUpper,
    triggeredBy: 'claude',
    status: 'complete',
    result: { userStory, cycleAssigned },
  })

  return {
    updated_issue: {
      id: cachedIssue?.linearIssueId ?? issueIdUpper,
      identifier: issueIdUpper,
      title: issueTitle,
      description: `${halvexContent}\n\n---\n${issueDescription ?? ''}`.trim(),
    },
    cycle_assigned: cycleAssigned,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// halvexDraftReleaseEmail
// ─────────────────────────────────────────────────────────────────────────────

export interface DraftReleaseEmailInput {
  deal_id: string
  linear_issue_id: string
}

export interface DraftReleaseEmailResult {
  to: string[]
  subject: string
  body: string
}

export async function halvexDraftReleaseEmail(
  workspaceId: string,
  input: DraftReleaseEmailInput,
): Promise<DraftReleaseEmailResult> {
  const issueIdUpper = input.linear_issue_id.toUpperCase()

  // Get deal contacts for the `to` field
  const [deal] = await db
    .select({ contacts: dealLogs.contacts, prospectCompany: dealLogs.prospectCompany })
    .from(dealLogs)
    .where(and(eq(dealLogs.id, input.deal_id), eq(dealLogs.workspaceId, workspaceId)))
    .limit(1)

  if (!deal) throw new Error(`Deal not found: ${input.deal_id}`)

  const contacts = (deal.contacts as { email?: string }[]) ?? []
  const to = contacts.map(c => c.email).filter((e): e is string => !!e)

  const email = await getOrGenerateReleaseEmail(workspaceId, input.deal_id, issueIdUpper)
  if (!email) throw new Error('Failed to generate release email — check deal and issue IDs')

  return { to, subject: email.subject, body: email.body }
}
