/**
 * Tests for linear-cycle.ts and scope-generator.ts
 *
 * All Linear API calls are mocked via vi.stubGlobal('fetch', ...).
 * Anthropic SDK is mocked via vi.mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getUpcomingCycle,
  scopeIssueToCycle,
  assignIssue,
  updateIssueDescription,
  getTeamMembers,
  getCycleIssues,
} from '../linear-cycle'
import { generateScopedIssue } from '../scope-generator'
import Anthropic from '@anthropic-ai/sdk'

// Module-level mock — factory registered before any test runs
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}))

const MockedAnthropic = vi.mocked(Anthropic)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockFetch(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data }),
    text: () => Promise.resolve(JSON.stringify(data)),
  })
}

const FAKE_API_KEY = 'lin_api_test_key'
const FAKE_TEAM_ID = 'team-uuid-123'

// ─────────────────────────────────────────────────────────────────────────────
// getUpcomingCycle
// ─────────────────────────────────────────────────────────────────────────────

describe('getUpcomingCycle', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns the active cycle when one exists', async () => {
    const activeCycle = {
      id: 'cycle-active',
      number: 5,
      name: 'Sprint 5',
      startsAt: '2026-03-20T00:00:00Z',
      endsAt: '2026-04-03T00:00:00Z',
      issueCount: 12,
      completedIssueCount: 4,
    }

    vi.stubGlobal('fetch', mockFetch({
      team: {
        activeCycle,
        cycles: { nodes: [] },
      },
    }))

    const result = await getUpcomingCycle(FAKE_TEAM_ID, FAKE_API_KEY)

    expect(result).not.toBeNull()
    expect(result!.id).toBe('cycle-active')
    expect(result!.name).toBe('Sprint 5')
    expect(result!.issueCount).toBe(12)
  })

  it('falls back to first upcoming cycle when no active cycle', async () => {
    const upcomingCycle = {
      id: 'cycle-upcoming',
      number: 6,
      name: 'Sprint 6',
      startsAt: '2026-04-03T00:00:00Z',
      endsAt: '2026-04-17T00:00:00Z',
      issueCount: 0,
      completedIssueCount: 0,
    }

    vi.stubGlobal('fetch', mockFetch({
      team: {
        activeCycle: null,
        cycles: { nodes: [upcomingCycle] },
      },
    }))

    const result = await getUpcomingCycle(FAKE_TEAM_ID, FAKE_API_KEY)

    expect(result).not.toBeNull()
    expect(result!.id).toBe('cycle-upcoming')
    expect(result!.number).toBe(6)
  })

  it('returns null when no cycles exist', async () => {
    vi.stubGlobal('fetch', mockFetch({
      team: {
        activeCycle: null,
        cycles: { nodes: [] },
      },
    }))

    const result = await getUpcomingCycle(FAKE_TEAM_ID, FAKE_API_KEY)
    expect(result).toBeNull()
  })

  it('throws on Linear API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ errors: [{ message: 'Not authenticated' }] }),
    }))

    await expect(getUpcomingCycle(FAKE_TEAM_ID, FAKE_API_KEY))
      .rejects.toThrow('Not authenticated')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// scopeIssueToCycle
// ─────────────────────────────────────────────────────────────────────────────

describe('scopeIssueToCycle', () => {
  afterEach(() => vi.restoreAllMocks())

  it('calls issueUpdate mutation with correct variables', async () => {
    const fakeFetch = mockFetch({ issueUpdate: { success: true } })
    vi.stubGlobal('fetch', fakeFetch)

    await scopeIssueToCycle('issue-uuid-99', 'cycle-uuid-5', FAKE_API_KEY)

    expect(fakeFetch).toHaveBeenCalledOnce()
    const [, options] = fakeFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string) as { variables: { issueId: string; cycleId: string } }
    expect(body.variables.issueId).toBe('issue-uuid-99')
    expect(body.variables.cycleId).toBe('cycle-uuid-5')
  })

  it('throws if Linear returns an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ errors: [{ message: 'Issue not found' }] }),
    }))

    await expect(scopeIssueToCycle('bad-id', 'cycle-5', FAKE_API_KEY))
      .rejects.toThrow('Issue not found')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// assignIssue
// ─────────────────────────────────────────────────────────────────────────────

describe('assignIssue', () => {
  afterEach(() => vi.restoreAllMocks())

  it('calls issueUpdate with assigneeId', async () => {
    const fakeFetch = mockFetch({ issueUpdate: { success: true } })
    vi.stubGlobal('fetch', fakeFetch)

    await assignIssue('issue-uuid-99', 'user-uuid-42', FAKE_API_KEY)

    const [, options] = fakeFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string) as { variables: { issueId: string; assigneeId: string } }
    expect(body.variables.issueId).toBe('issue-uuid-99')
    expect(body.variables.assigneeId).toBe('user-uuid-42')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// updateIssueDescription
// ─────────────────────────────────────────────────────────────────────────────

describe('updateIssueDescription', () => {
  afterEach(() => vi.restoreAllMocks())

  it('appends Halvex section to existing description', async () => {
    const fakeFetch = mockFetch({ issueUpdate: { success: true } })
    vi.stubGlobal('fetch', fakeFetch)

    await updateIssueDescription(
      'issue-uuid-99',
      'User Story: As a dev, I want X so that Y.',
      'Existing description',
      FAKE_API_KEY,
    )

    const [, options] = fakeFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string) as { variables: { issueId: string; description: string } }
    expect(body.variables.description).toContain('Existing description')
    expect(body.variables.description).toContain('Halvex Scoped User Story')
    expect(body.variables.description).toContain('User Story: As a dev')
  })

  it('replaces existing Halvex section on re-scope', async () => {
    const fakeFetch = mockFetch({ issueUpdate: { success: true } })
    vi.stubGlobal('fetch', fakeFetch)

    const existingWithSection = 'Original content\n\n---\n## Halvex Scoped User Story\nOld content here'

    await updateIssueDescription(
      'issue-uuid-99',
      'New scoped content',
      existingWithSection,
      FAKE_API_KEY,
    )

    const [, options] = fakeFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string) as { variables: { description: string } }
    expect(body.variables.description).toContain('Original content')
    expect(body.variables.description).toContain('New scoped content')
    expect(body.variables.description).not.toContain('Old content here')
  })

  it('handles null existing description', async () => {
    const fakeFetch = mockFetch({ issueUpdate: { success: true } })
    vi.stubGlobal('fetch', fakeFetch)

    await updateIssueDescription('issue-uuid-99', 'New content', null, FAKE_API_KEY)

    const [, options] = fakeFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string) as { variables: { description: string } }
    expect(body.variables.description).toContain('New content')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getTeamMembers
// ─────────────────────────────────────────────────────────────────────────────

describe('getTeamMembers', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns team members', async () => {
    vi.stubGlobal('fetch', mockFetch({
      team: {
        members: {
          nodes: [
            { id: 'u1', name: 'Alice Smith', email: 'alice@acme.com', displayName: 'Alice' },
            { id: 'u2', name: 'Bob Jones', email: 'bob@acme.com', displayName: 'Bob' },
          ],
        },
      },
    }))

    const members = await getTeamMembers(FAKE_TEAM_ID, FAKE_API_KEY)
    expect(members).toHaveLength(2)
    expect(members[0].name).toBe('Alice Smith')
    expect(members[1].id).toBe('u2')
  })

  it('returns empty array when no members', async () => {
    vi.stubGlobal('fetch', mockFetch({
      team: { members: { nodes: [] } },
    }))

    const members = await getTeamMembers(FAKE_TEAM_ID, FAKE_API_KEY)
    expect(members).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getCycleIssues
// ─────────────────────────────────────────────────────────────────────────────

describe('getCycleIssues', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns cycle issues with assignee and state', async () => {
    vi.stubGlobal('fetch', mockFetch({
      cycle: {
        issues: {
          nodes: [
            {
              id: 'i1',
              identifier: 'ENG-36',
              title: 'Bulk CSV Export',
              assignee: { id: 'u1', name: 'Alice' },
              state: { name: 'In Progress', type: 'started' },
            },
            {
              id: 'i2',
              identifier: 'ENG-42',
              title: 'API Rate Limits',
              assignee: null,
              state: { name: 'Todo', type: 'unstarted' },
            },
          ],
        },
      },
    }))

    const issues = await getCycleIssues('cycle-uuid', FAKE_API_KEY)
    expect(issues).toHaveLength(2)
    expect(issues[0].identifier).toBe('ENG-36')
    expect(issues[0].assignee?.name).toBe('Alice')
    expect(issues[1].assignee).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// scope-generator
// ─────────────────────────────────────────────────────────────────────────────

describe('generateScopedIssue', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  })

  afterEach(() => vi.restoreAllMocks())

  it('parses valid Haiku JSON response', async () => {
    const mockResponse = {
      description: 'Bulk CSV export lets Coke users export their data quickly.',
      userStory: 'As a Coca-Cola data analyst, I want to export records as CSV, so that I can import data into our BI tools.',
      acceptanceCriteria: [
        'Export button appears in the data table view',
        'CSV file downloads within 10 seconds for up to 10,000 rows',
        'Exported columns match the current table view',
      ],
    }

    MockedAnthropic.mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        }),
      },
    }) as unknown as Anthropic)

    const result = await generateScopedIssue({
      dealName: 'Coke Q2',
      prospectCompany: 'Coca-Cola',
      dealNotes: 'They need data export capabilities',
      dealRisks: ['No export feature'],
      issueTitle: 'Bulk CSV Export',
      issueDescription: 'Add ability to export large datasets as CSV',
    })

    expect(result.userStory).toContain('As a')
    expect(result.userStory).toContain('so that')
    expect(result.acceptanceCriteria).toHaveLength(3)
    expect(result.description).toContain('Coke')
  })

  it('throws on malformed JSON', async () => {
    MockedAnthropic.mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'not json at all' }],
        }),
      },
    }) as unknown as Anthropic)

    await expect(generateScopedIssue({
      dealName: 'Test',
      prospectCompany: 'Test Co',
      dealNotes: null,
      dealRisks: [],
      issueTitle: 'Test Issue',
      issueDescription: null,
    })).rejects.toThrow('scope-generator')
  })
})
