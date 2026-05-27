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
})
