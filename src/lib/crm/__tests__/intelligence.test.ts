import { describe, expect, it, vi } from 'vitest'
import { deriveDealIntelligence } from '../intelligence'

vi.mock('server-only', () => ({}))

describe('deriveDealIntelligence', () => {
  it('uses latest substantive evidence instead of generic field-change rows', () => {
    const intelligence = deriveDealIntelligence({
      deal: {
        id: 'deal-boe',
        title: 'BOE',
        companyName: 'Bank of England',
        stageName: 'Negotiation',
        status: 'open',
        probability: 80,
        valueAmount: 216000,
        expectedCloseDate: new Date('2026-07-01T00:00:00Z'),
        lastActivityAt: new Date('2026-05-26T15:52:00Z'),
      },
      latestActivities: [
        {
          id: 'generic-1',
          title: 'Updated deal facts',
          body: 'Deal facts were updated inline.',
          source: 'manual',
          type: 'stage_change',
          occurredAt: new Date('2026-05-26T16:21:00Z'),
        },
        {
          id: 'approved-update',
          title: 'Approved deal update',
          body: 'Darren from Bank of England was very keen but wanted to make sure we had changes/improvements underway. Awaiting what these are.',
          source: 'ai_assisted_update',
          type: 'note',
          occurredAt: new Date('2026-05-26T15:52:00Z'),
        },
        {
          id: 'legacy-note',
          title: 'Legacy notes',
          body: 'Critical path items: data RFI due 4 Feb, floorplans due 20 Feb, people/occupancy data loading pending.',
          source: 'legacy_backfill',
          type: 'note',
          occurredAt: new Date('2026-05-19T07:42:00Z'),
        },
      ],
      openTasks: [],
      contacts: [{ id: 'darren', fullName: 'Darren' }],
      meetings: [],
    }, new Date('2026-05-26T16:31:00Z'))

    expect(intelligence.latestEvidence?.id).toBe('approved-update')
    expect(intelligence.summary).toContain('changes/improvements')
    expect(intelligence.summary).not.toContain('Deal facts were updated inline')
    expect(intelligence.riskLevel).toBe('high')
    expect(intelligence.confidence).toBeLessThan(88)
    expect(intelligence.riskDrivers.join(' ')).toMatch(/clarification|data|requirements|unresolved/i)
  })

  it('treats overdue next actions as risk instead of healthy momentum', () => {
    const intelligence = deriveDealIntelligence({
      deal: {
        id: 'deal-overdue',
        title: 'Cedar Finance rollout',
        companyName: 'Cedar Finance',
        stageName: 'Proposal',
        status: 'open',
        probability: 72,
        valueAmount: 64000,
        expectedCloseDate: new Date('2026-06-12T00:00:00Z'),
        lastActivityAt: new Date('2026-05-25T09:00:00Z'),
      },
      latestActivities: [
        {
          id: 'meeting-note',
          title: 'Meeting notes',
          body: 'Cedar liked the proposal, but procurement wants a clearer implementation timeline before approval.',
          source: 'manual',
          type: 'meeting',
          occurredAt: new Date('2026-05-25T09:00:00Z'),
        },
      ],
      openTasks: [
        {
          id: 'task-overdue',
          title: 'Send revised implementation timeline',
          dueAt: new Date('2026-05-24T17:00:00Z'),
        },
      ],
      contacts: [{ id: 'contact-1', fullName: 'Amelia Ross' }],
      meetings: [],
    }, new Date('2026-05-27T09:00:00Z'))

    expect(intelligence.riskDrivers.join(' ')).toContain('Next action is overdue')
    expect(intelligence.positiveSignals.join(' ')).not.toContain('Next action is explicit')
    expect(intelligence.riskLevel).not.toBe('low')
    expect(intelligence.confidence).toBeLessThan(82)
  })

  it('treats old imported tasks as cleanup context, not current next actions', () => {
    const intelligence = deriveDealIntelligence({
      deal: {
        id: 'deal-legacy',
        title: 'Atlassian',
        companyName: 'Atlassian',
        stageName: 'Negotiation',
        status: 'open',
        probability: 70,
        valueAmount: 138000,
        expectedCloseDate: null,
        aiNextAction: '[17 Mar 2026] Follow up with Morgan about feature access.',
        lastActivityAt: new Date('2026-05-27T08:52:00Z'),
      },
      latestActivities: [
        {
          id: 'completed-no-body',
          title: 'Completed task: old setup action',
          body: null,
          summary: null,
          source: 'crm',
          type: 'task',
          occurredAt: new Date('2026-05-27T08:52:00Z'),
        },
        {
          id: 'legacy-note',
          title: 'Legacy notes',
          body: 'A product demo was conducted with Morgan. Follow-up depends on confirming feature access and setup.',
          source: 'legacy_backfill',
          type: 'note',
          occurredAt: new Date('2026-03-17T10:00:00Z'),
        },
      ],
      openTasks: [
        {
          id: 'old-task',
          title: 'Initiate access approval process with Atlassian IT stakeholder',
          dueAt: new Date('2026-03-17T11:00:00Z'),
        },
      ],
      contacts: [{ id: 'contact-1', fullName: 'Morgan' }],
      meetings: [],
    }, new Date('2026-05-27T10:00:00Z'))

    expect(intelligence.nextAction).toContain('Add a concrete next action')
    expect(intelligence.missingData).toContain('No current next action recorded')
    expect(intelligence.missingData).toContain('Old open tasks need review')
    expect(intelligence.riskDrivers.join(' ')).toContain('old open task')
    expect(intelligence.summary).not.toContain('Completed task: old setup action')
    expect(intelligence.confidence).toBeLessThan(70)
  })

  it('does not trust a closed deal when status and stage conflict', () => {
    const intelligence = deriveDealIntelligence({
      deal: {
        id: 'deal-irs',
        title: 'IRS',
        companyName: 'GSA',
        stageName: 'Closed lost',
        status: 'won',
        probability: 92,
        valueAmount: 100000,
        expectedCloseDate: new Date('2026-04-10T00:00:00Z'),
        lastActivityAt: new Date('2026-04-10T00:00:00Z'),
      },
      latestActivities: [
        {
          id: 'meeting-note',
          title: 'Meeting notes',
          body: 'The workshop showed useful pilot results, but the record is inconsistent about whether this was won or lost.',
          source: 'legacy_backfill',
          type: 'note',
          occurredAt: new Date('2026-04-10T00:00:00Z'),
        },
      ],
      openTasks: [
        {
          id: 'old-task',
          title: 'Prepare expansion brief',
          dueAt: new Date('2026-03-12T12:00:00Z'),
        },
      ],
      contacts: [],
      meetings: [],
    }, new Date('2026-05-27T10:00:00Z'))

    expect(intelligence.score).toBeLessThan(60)
    expect(intelligence.riskLevel).toBe('high')
    expect(intelligence.confidence).toBeLessThan(70)
    expect(intelligence.riskDrivers.join(' ')).toContain('status is won but the stage label says closed lost')
  })

  it('does not use cleanup audit rows as customer evidence', () => {
    const intelligence = deriveDealIntelligence({
      deal: {
        id: 'deal-cleanup',
        title: 'RELX',
        companyName: 'RELX',
        stageName: 'Negotiation',
        status: 'open',
        probability: 50,
        valueAmount: 44000,
        expectedCloseDate: new Date('2026-06-10T00:00:00Z'),
        lastActivityAt: new Date('2026-05-27T11:00:00Z'),
      },
      latestActivities: [
        {
          id: 'cleanup',
          title: 'Stale legacy tasks archived',
          body: '14 old imported tasks were marked cancelled so Halvex no longer treats them as current next steps.',
          source: 'system_cleanup',
          type: 'note',
          occurredAt: new Date('2026-05-27T11:00:00Z'),
        },
        {
          id: 'customer-note',
          title: 'Meeting notes',
          body: 'RELX has gone quiet after move packs were delivered and Drew is trying to convert the POC.',
          source: 'legacy_backfill',
          type: 'note',
          occurredAt: new Date('2026-05-05T09:00:00Z'),
        },
      ],
      openTasks: [],
      contacts: [{ id: 'contact-1', fullName: 'Drew' }],
      meetings: [],
    }, new Date('2026-05-27T12:00:00Z'))

    expect(intelligence.latestEvidence?.id).toBe('customer-note')
    expect(intelligence.summary).not.toContain('old imported tasks were marked cancelled')
    expect(intelligence.ignoredEvidence.map(item => item.reason)).toContain('System cleanup audit record')
  })
})
