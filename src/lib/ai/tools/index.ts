/**
 * AI Agent Tool Definitions
 *
 * Flat tool registry for the Ask AI agent.
 * Includes deal operations, analytics/intelligence lookups,
 * knowledge management, and content actions.
 */

// Types
export type { ToolContext, ToolResult, ActionCard } from './types'

// Core deal tools
export {
  get_deal,
  create_deal,
  update_deal,
  search_deals,
  generate_content,
  answer_question,
} from './deal-tools'
export {
  query_pipeline,
  get_competitor_intel,
  search_workspace,
  find_similar_deals,
  get_deal_intelligence,
  get_win_playbook,
  get_rep_performance,
  get_pipeline_forecast,
  get_workspace_overview,
  get_deal_score_history,
  get_score_trends,
} from './analytics-tools'
export {
  create_competitor,
  update_competitor,
  update_company_profile,
  create_case_study,
  log_product_gap,
  manage_product_gap,
} from './knowledge-tools'
export {
  generate_battlecard,
  draft_email,
} from './content-tools'

import * as dealTools from './deal-tools'
import * as analyticsTools from './analytics-tools'
import * as knowledgeTools from './knowledge-tools'
import * as contentTools from './content-tools'

/**
 * Full agent tool registry as a flat Record<string, { description, parameters, execute }>.
 */
export const allTools = {
  // Core deal workflows
  get_deal: dealTools.get_deal,
  create_deal: dealTools.create_deal,
  update_deal: dealTools.update_deal,
  search_deals: dealTools.search_deals,
  generate_content: dealTools.generate_content,
  answer_question: dealTools.answer_question,
  // Analytics + intelligence
  query_pipeline: analyticsTools.query_pipeline,
  get_competitor_intel: analyticsTools.get_competitor_intel,
  search_workspace: analyticsTools.search_workspace,
  find_similar_deals: analyticsTools.find_similar_deals,
  get_deal_intelligence: analyticsTools.get_deal_intelligence,
  get_win_playbook: analyticsTools.get_win_playbook,
  get_rep_performance: analyticsTools.get_rep_performance,
  get_pipeline_forecast: analyticsTools.get_pipeline_forecast,
  get_workspace_overview: analyticsTools.get_workspace_overview,
  get_deal_score_history: analyticsTools.get_deal_score_history,
  get_score_trends: analyticsTools.get_score_trends,
  // Knowledge management
  create_competitor: knowledgeTools.create_competitor,
  update_competitor: knowledgeTools.update_competitor,
  update_company_profile: knowledgeTools.update_company_profile,
  create_case_study: knowledgeTools.create_case_study,
  log_product_gap: knowledgeTools.log_product_gap,
  manage_product_gap: knowledgeTools.manage_product_gap,
  // Content helpers
  generate_battlecard: contentTools.generate_battlecard,
  draft_email: contentTools.draft_email,
} as const
