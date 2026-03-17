/**
 * AI Agent Tool Definitions
 *
 * Re-exports all tool definitions as a flat object compatible with the
 * Vercel AI SDK `tools` parameter. Each entry provides:
 * - description: string
 * - parameters: Zod schema
 * - execute: (params, ctx: ToolContext) => Promise<ToolResult>
 */

// Types
export type { ToolContext, ToolResult, ActionCard } from './types'

// Deal management tools
export {
  search_deals,
  get_deal_details,
  create_deal,
  update_deal,
  manage_todos,
  add_contact,
  delete_deal,
  delete_deal_confirmed,
  process_meeting_notes,
  update_project_plan,
  update_success_criteria,
} from './deal-tools'

// Content generation tools
export {
  generate_content,
  generate_battlecard,
  draft_email,
} from './content-tools'

// Knowledge management tools
export {
  create_competitor,
  update_competitor,
  update_company_profile,
  create_case_study,
  log_product_gap,
  manage_product_gap,
} from './knowledge-tools'

// Analytics & search tools
export {
  query_pipeline,
  get_competitor_intel,
  search_workspace,
  get_workspace_overview,
} from './analytics-tools'

// ─────────────────────────────────────────────────────────────────────────────
// Flat tools object for Vercel AI SDK
// ─────────────────────────────────────────────────────────────────────────────

import * as dealTools from './deal-tools'
import * as contentTools from './content-tools'
import * as knowledgeTools from './knowledge-tools'
import * as analyticsTools from './analytics-tools'

/**
 * All agent tools as a flat Record<string, { description, parameters, execute }>.
 *
 * Usage with Vercel AI SDK:
 * ```ts
 * import { allTools } from '@/lib/ai/tools'
 * const result = await generateText({ tools: allTools, ... })
 * ```
 *
 * Note: Each tool's `execute` expects `(params, ctx: ToolContext)` — you must
 * bind the ToolContext before passing to the AI SDK, or wrap the execute calls.
 */
export const allTools = {
  // Deal management
  search_deals: dealTools.search_deals,
  get_deal_details: dealTools.get_deal_details,
  create_deal: dealTools.create_deal,
  update_deal: dealTools.update_deal,
  manage_todos: dealTools.manage_todos,
  add_contact: dealTools.add_contact,
  delete_deal: dealTools.delete_deal,
  delete_deal_confirmed: dealTools.delete_deal_confirmed,
  process_meeting_notes: dealTools.process_meeting_notes,
  update_project_plan: dealTools.update_project_plan,
  update_success_criteria: dealTools.update_success_criteria,

  // Content generation
  generate_content: contentTools.generate_content,
  generate_battlecard: contentTools.generate_battlecard,
  draft_email: contentTools.draft_email,

  // Knowledge management
  create_competitor: knowledgeTools.create_competitor,
  update_competitor: knowledgeTools.update_competitor,
  update_company_profile: knowledgeTools.update_company_profile,
  create_case_study: knowledgeTools.create_case_study,
  log_product_gap: knowledgeTools.log_product_gap,
  manage_product_gap: knowledgeTools.manage_product_gap,

  // Analytics & search
  query_pipeline: analyticsTools.query_pipeline,
  get_competitor_intel: analyticsTools.get_competitor_intel,
  search_workspace: analyticsTools.search_workspace,
  get_workspace_overview: analyticsTools.get_workspace_overview,
} as const
