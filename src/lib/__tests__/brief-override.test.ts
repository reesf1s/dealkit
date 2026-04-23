import { describe, expect, it } from 'vitest'
import {
  clearManualBriefOverride,
  getManualBriefOverride,
  setManualBriefOverride,
} from '../brief-override'

describe('brief override helpers', () => {
  it('stores and retrieves a manual briefing override', () => {
    const review = setManualBriefOverride({ grade: 'B' }, 'Custom morning briefing', 'agent')
    const override = getManualBriefOverride(review)

    expect(override?.text).toBe('Custom morning briefing')
    expect(override?.source).toBe('agent')
    expect(typeof override?.updatedAt).toBe('string')
    expect((review as Record<string, unknown>).grade).toBe('B')
  })

  it('clears the override but preserves other review fields', () => {
    const review = setManualBriefOverride({ overall: 82, summary: 'Existing review' }, 'Pinned brief')
    const cleared = clearManualBriefOverride(review) as Record<string, unknown>

    expect(getManualBriefOverride(cleared)).toBeNull()
    expect(cleared.overall).toBe(82)
    expect(cleared.summary).toBe('Existing review')
  })
})
