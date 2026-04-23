import { describe, expect, it } from 'vitest'

import { getEffectiveDealSummary, getEffectiveDealSummarySnippet } from '@/lib/effective-deal-summary'
import { setManualBriefOverride } from '@/lib/brief-override'

describe('effective deal summary', () => {
  it('prefers manual override over stored aiSummary', () => {
    const value = getEffectiveDealSummary({
      aiSummary: 'Generated summary',
      dealReview: setManualBriefOverride(null, 'Manual summary', 'ui'),
    })

    expect(value).toBe('Manual summary')
  })

  it('falls back to aiSummary when no override exists', () => {
    const value = getEffectiveDealSummary({
      aiSummary: 'Generated summary',
      dealReview: { grade: 'A' },
    })

    expect(value).toBe('Generated summary')
  })

  it('returns truncated snippets cleanly', () => {
    const snippet = getEffectiveDealSummarySnippet({
      aiSummary: 'This is a longer summary that should be clipped for compact surfaces.',
    }, 24)

    expect(snippet).toBe('This is a longer summar…')
  })
})
