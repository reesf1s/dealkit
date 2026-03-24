import type { WorkspaceBrain } from '@/lib/workspace-brain'

export interface ToolContext {
  workspaceId: string
  userId: string
  plan: string
  brain: WorkspaceBrain | null
  activeDealId: string | null
  /** Map of stage ID → display label from pipeline config (e.g. { negotiation: 'Verbal Commit' }) */
  stageLabels?: Record<string, string>
  /**
   * Slack channel ID for the current conversation — only set in the Slack agent context.
   * Used by tools that need to store pending confirmations referencing the conversation.
   */
  channelId?: string
}

export interface ToolResult {
  result: string        // Markdown text for the LLM to incorporate
  actions?: ActionCard[] // Rich UI cards for the frontend
  uiHint?: string       // 'refresh_deals' | 'refresh_collateral' | etc
  confirmationRequired?: boolean
  pendingAction?: any
}

export type ActionCard =
  | { type: 'deal_updated'; dealId: string; dealName: string; changes: string[] }
  | { type: 'deal_created'; dealId: string; dealName: string; company: string }
  | { type: 'competitor_created'; names: string[]; battlecardsStarted: boolean }
  | { type: 'company_updated'; fields: string[] }
  | { type: 'collateral_generating'; colType: string; title: string }
  | { type: 'case_study_created'; id: string; customerName: string }
  | { type: 'gaps_logged'; gaps: string[]; count: number }
  | { type: 'todos_updated'; added: number; removed: number; completed: number; dealName: string }
  | { type: 'deal_deleted'; dealId: string; dealName: string }
