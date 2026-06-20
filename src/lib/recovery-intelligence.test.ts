import { describe, expect, it } from 'vitest'
import { buildRecoveryIntelligence, classifyRecoveryIntent } from './recovery-intelligence'

const now = new Date('2026-06-13T12:00:00Z')

describe('recovery intelligence', () => {
  it('classifies sales records into actionable intents', () => {
    expect(classifyRecoveryIntent({
      id: 'a',
      title: 'Retail lead needs demo follow up',
      status: 'open',
      valueAmount: 180,
      probability: 70,
    }, now)).toBe('rebook')

    expect(classifyRecoveryIntent({
      id: 'b',
      title: 'Friday decision tentative, confirm timeline',
      status: 'open',
      valueAmount: 220,
      probability: 30,
      expectedCloseDate: '2026-06-15',
    }, now)).toBe('reduce_no_show')
  })

  it('clusters similar records and produces recommendations', () => {
    const result = buildRecoveryIntelligence({
      now,
      records: [
        { id: '1', title: 'Thursday pipeline gap', companyName: 'Soho', status: 'open', valueAmount: 120, probability: 20 },
        { id: '2', title: 'Friday gap needs offer', companyName: 'Soho', status: 'open', valueAmount: 160, probability: 25 },
        { id: '3', title: 'Lapsed prospect win back', companyName: 'Chelsea', status: 'lost', valueAmount: 300, probability: 0 },
      ],
      tasks: [{ id: 't1', title: 'Send meeting follow-up messages', priority: 'high' }],
    })

    expect(result.summary.openCapacity).toBeGreaterThan(0)
    expect(result.intents.map(intent => intent.id)).toContain('fill_capacity')
    expect(result.clusters[0].count).toBeGreaterThanOrEqual(1)
    expect(result.recommendations.length).toBeGreaterThan(0)
  })
})
