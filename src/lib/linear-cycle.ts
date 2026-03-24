/**
 * Linear cycle GraphQL helpers — Phase 3 cycle planning.
 *
 * Provides primitives for:
 * - Getting the upcoming/active cycle for a team
 * - Adding an issue to a cycle
 * - Assigning an issue to a team member
 * - Updating issue description with scoped content
 * - Listing team members for assignment
 */

const LINEAR_API_URL = 'https://api.linear.app/graphql'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LinearCycle {
  id: string
  number: number
  name: string | null
  startsAt: string | null
  endsAt: string | null
  issueCount: number
  completedIssueCount: number
}

export interface LinearTeamMember {
  id: string
  name: string
  email: string
  displayName: string
}

export interface CycleIssue {
  id: string
  identifier: string
  title: string
  assignee: { id: string; name: string } | null
  state: { name: string; type: string }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal fetch helper (mirrors linear-client.ts pattern)
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
// getUpcomingCycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the next scheduled or currently active cycle for a team.
 * Prefers the active cycle; falls back to the soonest upcoming cycle.
 * Returns null if no cycles exist.
 */
export async function getUpcomingCycle(
  teamId: string,
  apiKey: string,
): Promise<LinearCycle | null> {
  const data = await gql<{
    team: {
      activeCycle: LinearCycle | null
      cycles: {
        nodes: LinearCycle[]
      }
    }
  }>(
    apiKey,
    `query GetUpcomingCycle($teamId: String!) {
      team(id: $teamId) {
        activeCycle {
          id number name startsAt endsAt issueCount completedIssueCount
        }
        cycles(
          first: 3
          filter: { startsAt: { gte: "now()" } }
          orderBy: startsAt
        ) {
          nodes { id number name startsAt endsAt issueCount completedIssueCount }
        }
      }
    }`,
    { teamId },
  )

  // Prefer active cycle, fall back to first upcoming
  return data.team.activeCycle ?? data.team.cycles.nodes[0] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// getCycleIssues
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns issues currently in a cycle (up to 50).
 */
export async function getCycleIssues(
  cycleId: string,
  apiKey: string,
): Promise<CycleIssue[]> {
  const data = await gql<{
    cycle: {
      issues: { nodes: CycleIssue[] }
    }
  }>(
    apiKey,
    `query GetCycleIssues($cycleId: String!) {
      cycle(id: $cycleId) {
        issues(first: 50) {
          nodes {
            id identifier title
            assignee { id name }
            state { name type }
          }
        }
      }
    }`,
    { cycleId },
  )

  return data.cycle.issues.nodes
}

// ─────────────────────────────────────────────────────────────────────────────
// scopeIssueToCycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds an issue to a cycle.
 * Linear requires the cycleId to belong to the same team as the issue.
 */
export async function scopeIssueToCycle(
  issueId: string,
  cycleId: string,
  apiKey: string,
): Promise<void> {
  await gql<{ cycleCreate: { success: boolean } }>(
    apiKey,
    `mutation AddIssueToCycle($issueId: String!, $cycleId: String!) {
      issueUpdate(id: $issueId, input: { cycleId: $cycleId }) {
        success
      }
    }`,
    { issueId, cycleId },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// assignIssue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assigns a Linear issue to a team member.
 */
export async function assignIssue(
  issueId: string,
  assigneeId: string,
  apiKey: string,
): Promise<void> {
  await gql<{ issueUpdate: { success: boolean } }>(
    apiKey,
    `mutation AssignIssue($issueId: String!, $assigneeId: String!) {
      issueUpdate(id: $issueId, input: { assigneeId: $assigneeId }) {
        success
      }
    }`,
    { issueId, assigneeId },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// updateIssueDescription
// ─────────────────────────────────────────────────────────────────────────────

const HALVEX_SCOPE_MARKER = '\n\n---\n## Halvex Scoped User Story\n'

/**
 * Replaces or appends a Halvex scoped user story section in the issue description.
 * Preserves any content before the marker.
 */
export async function updateIssueDescription(
  issueId: string,
  scopedContent: string,
  currentDescription: string | null,
  apiKey: string,
): Promise<void> {
  const base = currentDescription?.includes(HALVEX_SCOPE_MARKER)
    ? currentDescription.slice(0, currentDescription.indexOf(HALVEX_SCOPE_MARKER))
    : (currentDescription ?? '')

  const newDescription = `${base}${HALVEX_SCOPE_MARKER}${scopedContent.trim()}`

  await gql<{ issueUpdate: { success: boolean } }>(
    apiKey,
    `mutation UpdateIssueDescription($issueId: String!, $description: String!) {
      issueUpdate(id: $issueId, input: { description: $description }) {
        success
      }
    }`,
    { issueId: issueId, description: newDescription },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// getTeamMembers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all members of a Linear team — used for assigning issues.
 */
export async function getTeamMembers(
  teamId: string,
  apiKey: string,
): Promise<LinearTeamMember[]> {
  const data = await gql<{
    team: {
      members: { nodes: LinearTeamMember[] }
    }
  }>(
    apiKey,
    `query GetTeamMembers($teamId: String!) {
      team(id: $teamId) {
        members(first: 50) {
          nodes { id name email displayName }
        }
      }
    }`,
    { teamId },
  )

  return data.team.members.nodes
}
