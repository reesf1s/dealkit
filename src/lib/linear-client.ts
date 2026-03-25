/**
 * Linear GraphQL API client.
 *
 * Uses fetch + the Linear GraphQL endpoint. No SDK dependency.
 * All functions accept the raw API key (caller decrypts before passing).
 *
 * Linear API docs: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
 */

const LINEAR_API_URL = 'https://api.linear.app/graphql'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LinearTeam {
  id: string
  name: string
  key: string        // e.g. "ENG"
}

export interface LinearIssue {
  id: string         // UUID
  identifier: string // e.g. "ENG-36"
  title: string
  description: string | null
  url: string
  priority: number   // 0=none, 1=urgent, 2=high, 3=medium, 4=low
  state: {
    id: string
    name: string     // e.g. "Todo", "In Progress", "Done"
    type: string     // e.g. "started", "unstarted", "completed"
  }
  cycle: { id: string; number: number } | null
  assignee: { id: string; name: string } | null
  updatedAt: string
}

export interface LinearWorkspaceInfo {
  teamId: string
  teamName: string
  teamKey: string
  workspaceName: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal fetch helper
// ─────────────────────────────────────────────────────────────────────────────

interface GqlResponse<T> {
  data?: T
  errors?: { message: string }[]
}

async function gql<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    throw new Error(`Linear API HTTP ${res.status}: ${await res.text()}`)
  }

  const json = (await res.json()) as GqlResponse<T>

  if (json.errors?.length) {
    throw new Error(`Linear API error: ${json.errors.map(e => e.message).join(', ')}`)
  }

  if (!json.data) {
    throw new Error('Linear API returned no data')
  }

  return json.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate an API key and return the first team + workspace name.
 * Throws if the key is invalid.
 */
export async function validateApiKey(apiKey: string): Promise<LinearWorkspaceInfo> {
  const data = await gql<{
    viewer: { organization: { name: string; teams: { nodes: LinearTeam[] } } }
  }>(
    apiKey,
    `query {
      viewer {
        organization {
          name
          teams(first: 1) {
            nodes { id name key }
          }
        }
      }
    }`,
  )

  const team = data.viewer.organization.teams.nodes[0]
  if (!team) throw new Error('No teams found in this Linear workspace')

  return {
    teamId: team.id,
    teamName: team.name,
    teamKey: team.key,
    workspaceName: data.viewer.organization.name,
  }
}

/**
 * Fetch non-completed issues for a team, paginated (100/page — Linear's safe max).
 * Pass `since` (ISO string) to fetch only issues updated after that timestamp.
 */
export async function fetchTeamIssues(
  apiKey: string,
  teamId: string,
  cursor?: string,
  since?: string,
): Promise<{ issues: LinearIssue[]; nextCursor: string | null }> {
  // Use top-level issues query — works across all teams and avoids
  // team-scoped filter issues. Filter out completed/canceled states.
  const sinceVar    = since ? ', $since: DateTimeOrDuration' : ''
  const sinceFilter = since ? ', updatedAt: { gt: $since }' : ''

  const data = await gql<{
    issues: {
      nodes: LinearIssue[]
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  }>(
    apiKey,
    `query FetchIssues($after: String${sinceVar}) {
      issues(
        first: 100
        after: $after
        filter: {
          state: { type: { nin: ["completed", "canceled"] } }
          ${sinceFilter}
        }
        orderBy: updatedAt
      ) {
        nodes {
          id
          identifier
          title
          description
          url
          priority
          state { id name type }
          cycle { id number }
          assignee { id name }
          updatedAt
        }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    { after: cursor ?? null, ...(since ? { since } : {}) },
  )

  const issues = data.issues.nodes
  console.log(`[linear-client] fetchTeamIssues: got ${issues.length} issues, hasNext=${data.issues.pageInfo.hasNextPage}, since=${since ?? 'none'}`)

  return {
    issues,
    nextCursor: data.issues.pageInfo.hasNextPage
      ? data.issues.pageInfo.endCursor
      : null,
  }
}

/**
 * Fetch a single issue by its UUID.
 */
export async function getIssue(
  apiKey: string,
  issueId: string,
): Promise<LinearIssue | null> {
  try {
    const data = await gql<{ issue: LinearIssue }>(
      apiKey,
      `query GetIssue($id: String!) {
        issue(id: $id) {
          id identifier title description url priority
          state { id name type }
          cycle { id number }
          assignee { id name }
          updatedAt
        }
      }`,
      { id: issueId },
    )
    return data.issue
  } catch {
    return null
  }
}

/**
 * Update the description of a Linear issue.
 * Appends (or replaces) a "## Halvex Intelligence" section at the end of the description.
 */
export async function updateIssueDescription(
  apiKey: string,
  issueId: string,
  halvexSection: string,
): Promise<void> {
  // First fetch current description
  const issue = await getIssue(apiKey, issueId)
  if (!issue) throw new Error(`Issue ${issueId} not found`)

  const SECTION_MARKER = '\n\n---\n## Halvex Intelligence\n'
  const currentDesc = issue.description ?? ''

  // Strip existing Halvex section if present
  const baseDesc = currentDesc.includes(SECTION_MARKER)
    ? currentDesc.slice(0, currentDesc.indexOf(SECTION_MARKER))
    : currentDesc

  const newDescription = halvexSection.trim()
    ? `${baseDesc}${SECTION_MARKER}${halvexSection.trim()}`
    : baseDesc

  await gql<{ issueUpdate: { success: boolean } }>(
    apiKey,
    `mutation UpdateIssue($id: String!, $description: String!) {
      issueUpdate(id: $id, input: { description: $description }) {
        success
      }
    }`,
    { id: issueId, description: newDescription },
  )
}
