import { describe, it, expect } from 'vitest'
import { extractDealSignalText, buildHalvexSection } from '../linear-signal-match'

describe('extractDealSignalText', () => {
  it('concatenates all signal fields', () => {
    const text = extractDealSignalText({
      notes: 'no bulk export feature',
      meetingNotes: 'they mentioned API rate limits',
      dealRisks: ['missing CSV export', 'competitor has this'],
      lostReason: null,
      description: null,
    })
    expect(text).toContain('bulk export')
    expect(text).toContain('API rate limits')
    expect(text).toContain('missing CSV export')
    expect(text).toContain('competitor has this')
  })

  it('returns empty string when all fields are null/empty', () => {
    const text = extractDealSignalText({
      notes: null,
      meetingNotes: null,
      dealRisks: [],
      lostReason: null,
      description: null,
    })
    expect(text).toBe('')
  })

  it('handles dealRisks as non-array gracefully', () => {
    const text = extractDealSignalText({
      notes: 'test',
      meetingNotes: null,
      dealRisks: null,
      lostReason: null,
      description: null,
    })
    expect(text).toBe('test')
  })
})

describe('buildHalvexSection', () => {
  it('builds markdown section with deal details', () => {
    const section = buildHalvexSection([
      { dealName: 'Acme Corp', prospectCompany: 'Acme', stage: 'proposal', dealValue: 5000000 },
    ])
    expect(section).toContain('Acme Corp')
    expect(section).toContain('Halvex')
    expect(section).toContain('proposal')
  })

  it('returns empty string for empty deals array', () => {
    expect(buildHalvexSection([])).toBe('')
  })

  it('pluralises "deal" correctly', () => {
    const one = buildHalvexSection([
      { dealName: 'A', prospectCompany: 'B', stage: 'discovery', dealValue: null },
    ])
    const two = buildHalvexSection([
      { dealName: 'A', prospectCompany: 'B', stage: 'discovery', dealValue: null },
      { dealName: 'C', prospectCompany: 'D', stage: 'proposal', dealValue: null },
    ])
    expect(one).toContain('1 deal in Halvex')
    expect(two).toContain('2 deals in Halvex')
  })
})
