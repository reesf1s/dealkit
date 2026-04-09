/**
 * MCP external tool implementations.
 *
 * halvexDraftReleaseEmail — draft release notification email for a prospect
 */

import { db } from '@/lib/db'
import {
  dealLogs,
  mcpActionLog,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getOrGenerateReleaseEmail } from '@/lib/release-email-generator'

// ─────────────────────────────────────────────────────────────────────────────
// halvexDraftReleaseEmail
// ─────────────────────────────────────────────────────────────────────────────

export interface DraftReleaseEmailInput {
  deal_id: string
  issue_id: string
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
  const issueIdUpper = input.issue_id.toUpperCase()

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
