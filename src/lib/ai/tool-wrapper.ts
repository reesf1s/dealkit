/**
 * Tool Wrapper — Parameter normalisation and verified execution
 *
 * normaliseParams: fixes common LLM parameter name mistakes before Zod validation
 * executeWithVerification: verifies deal ownership + row write confirmation
 */

import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────────────────
// Parameter normalisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise LLM parameter names before Zod validation.
 * Maps snake_case, alternate names, and common typos to the canonical camelCase.
 */
export function normaliseParams(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw

  const mapped: any = { ...raw }

  const aliases: Record<string, string> = {
    // snake_case → camelCase
    deal_id: 'dealId',
    workspace_id: 'workspaceId',
    deal_name: 'dealName',
    deal_value: 'value',
    close_date: 'closeDate',
    search_query: 'searchQuery',
    content_type: 'contentType',
    contact_name: 'contactName',
    prospect_company: 'prospectCompany',
    prospect_name: 'prospectName',
    prospect_title: 'prospectTitle',
    next_steps: 'nextSteps',
    ai_summary: 'aiSummary',
    deal_risks: 'dealRisks',
    lost_reason: 'lostReason',
    meeting_notes: 'notes',
    // Alternate names
    note_content: 'notes',
    note: 'notes',
    query: 'searchQuery',
    todo_text: 'addTodo',
    todo: 'addTodo',
    todo_item: 'addTodo',
    add_note: 'addNote',
    set_stage: 'setStage',
    set_value: 'setValue',
    set_close_date: 'setCloseDate',
    add_contact: 'addContact',
    complete_todo: 'completeTodo',
    // Content tool aliases
    custom_prompt: 'customPrompt',
    recipient_role: 'recipientRole',
    competitor_id: 'competitorId',
  }

  for (const [wrong, right] of Object.entries(aliases)) {
    if (raw[wrong] !== undefined && raw[right] === undefined) {
      mapped[right] = raw[wrong]
      delete mapped[wrong]
    }
  }

  // Normalise nested 'changes' object if present
  if (mapped.changes && typeof mapped.changes === 'object') {
    mapped.changes = normaliseParams(mapped.changes)
  }

  return mapped
}

// ─────────────────────────────────────────────────────────────────────────────
// Verified execution wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify deal belongs to workspace, execute the DB operation, and verify rows
 * were actually written. Returns a structured result with success/error.
 */
export async function executeWithVerification(
  toolName: string,
  workspaceId: string,
  dealId: string,
  operation: () => Promise<any[]>,
): Promise<{ success: boolean; result?: any; error?: string }> {
  // Pre-check: deal exists in this workspace
  const [deal] = await db
    .select({ id: dealLogs.id, name: dealLogs.dealName })
    .from(dealLogs)
    .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
    .limit(1)

  if (!deal) {
    return {
      success: false,
      error: `TOOL FAILED: Deal ${dealId} not found in this workspace. DO NOT tell the user this succeeded. Report the failure.`,
    }
  }

  const rows = await operation()

  if (!rows || rows.length === 0) {
    return {
      success: false,
      error: `TOOL FAILED: ${toolName} wrote 0 rows — operation failed silently. DO NOT tell the user this succeeded. Report the failure.`,
    }
  }

  return { success: true, result: rows[0] }
}
