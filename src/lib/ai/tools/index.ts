/**
 * AI Agent Tool Definitions — 5 Consolidated Tools
 *
 * Re-exports all tool definitions as a flat object compatible with the
 * Vercel AI SDK `tools` parameter. Each entry provides:
 * - description: string
 * - parameters: Zod schema
 * - execute: (params, ctx: ToolContext) => Promise<ToolResult>
 */

// Types
export type { ToolContext, ToolResult, ActionCard } from './types'

// 5 consolidated deal tools
export {
  get_deal,
  update_deal,
  search_deals,
  generate_content,
  answer_question,
} from './deal-tools'

import * as dealTools from './deal-tools'

/**
 * All agent tools as a flat Record<string, { description, parameters, execute }>.
 * Exactly 5 tools — consolidated from the previous 30+ fragmented tools.
 */
export const allTools = {
  get_deal: dealTools.get_deal,
  update_deal: dealTools.update_deal,
  search_deals: dealTools.search_deals,
  generate_content: dealTools.generate_content,
  answer_question: dealTools.answer_question,
} as const
