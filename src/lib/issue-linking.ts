const DEFAULT_APP_URL = 'https://halvex.ai'

export const ISSUE_LINKING_MODE = 'claude_mcp_assisted' as const

export function getHalvexAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL).trim().replace(/\/$/, '')
}

export function getHalvexMcpUrl(): string {
  return `${getHalvexAppUrl()}/api/mcp`
}

type ReviewPromptArgs = {
  dealId: string
  company: string
  dealName?: string | null
}

export function buildClaudeIssueReviewPrompt({ dealId, company, dealName }: ReviewPromptArgs): string {
  const label = dealName?.trim() || company

  return [
    `Using my connected Halvex MCP, review the deal "${label}" (${dealId}).`,
    'Pull the deal context, review the linked or relevant Linear issues from my Linear-connected Claude workspace, and save any genuinely relevant issue links back into Halvex.',
    'Only save high-confidence links and include a short reason for each one.',
  ].join(' ')
}
