import { describe, expect, it } from 'vitest'
import { computeUrgencyScore } from '../ml/urgency'

describe('computeUrgencyScore', () => {
  it('does not suggest completing todos as the top action', () => {
    const result = computeUrgencyScore({
      conversionScore: 52,
      dealValue: 44000,
      daysSinceUpdate: 4,
      closeDate: null,
      risks: [],
      pendingTodos: ['Send proposal', 'Update legal notes'],
      stage: 'proposal',
      company: 'RELX',
      name: 'RELX expansion',
    })

    expect(result.topAction.toLowerCase()).not.toContain('todo')
    expect(result.topAction.toLowerCase()).not.toContain('open todo')
  })

  it('uses a requalification action for stale deals instead of a generic follow-up prompt', () => {
    const result = computeUrgencyScore({
      conversionScore: 48,
      dealValue: 120000,
      daysSinceUpdate: 19,
      closeDate: null,
      risks: [],
      pendingTodos: [],
      stage: 'qualification',
      company: 'Infoblox',
      name: 'Infoblox renewal',
    })

    expect(result.topAction).toContain('Requalify Infoblox')
    expect(result.topAction.toLowerCase()).not.toContain('follow up')
  })
})
