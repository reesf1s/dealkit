/**
 * Unit tests for the Halvex NLP matching engine (smart-match.ts).
 *
 * Tests cover:
 *  - scoreMatch()           — core NLP scoring function
 *  - linearStatusToLoopStatus() — Linear status → loop status mapping
 *  - checkIsRealFeature()   — gap text quality guard
 */

import { describe, it, expect } from 'vitest'
import { scoreMatch, linearStatusToLoopStatus, checkIsRealFeature } from '../smart-match'

// ─────────────────────────────────────────────────────────────────────────────
// scoreMatch
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreMatch', () => {
  // ── Edge cases ────────────────────────────────────────────────────────────

  it('returns 0 for empty gap text', () => {
    expect(scoreMatch('', 'CSV export feature', null)).toBe(0)
  })

  it('returns 0 for a single word that has no match at all', () => {
    // Single word, zero keyword/synonym hits → combined = 0 → score = 0
    expect(scoreMatch('wayfinding', 'CSV export feature', null)).toBe(0)
  })

  it('scores non-zero for a single-word gap that exactly matches the title', () => {
    // Guard condition: totalHits < 2 AND combined < 40 → does NOT fire when combined ≥ 40
    // "export" matches "export" — 1 keyword hit, combined ≈ 48 (≥ 40) → no guard
    const score = scoreMatch('export', 'CSV export feature', null)
    expect(score).toBeGreaterThan(0)
  })

  it('returns 0 when issue title is empty', () => {
    expect(scoreMatch('bulk CSV export', '', null)).toBe(0)
  })

  // ── High-confidence matches ───────────────────────────────────────────────

  it('scores ≥ 60 for identical gap and title', () => {
    // Max score is ~65 — synonym signal (35%) is 0 when tokens match directly
    const score = scoreMatch('bulk CSV export', 'bulk CSV export', null)
    expect(score).toBeGreaterThanOrEqual(60)
  })

  it('scores ≥ 50 for exact substring match (gap fully contained in title)', () => {
    const score = scoreMatch('CSV export', 'Bulk CSV export for contacts', null)
    expect(score).toBeGreaterThanOrEqual(50)
  })

  it('scores ≥ 45 for near-identical title with minor reordering', () => {
    // Same tokens, slightly different order and one extra token
    const score = scoreMatch('bulk CSV export', 'CSV bulk export feature', null)
    expect(score).toBeGreaterThanOrEqual(45)
  })

  // ── Synonym / concept-phrase matches ─────────────────────────────────────

  it('scores ≥ 45 for strong CSV export keyword match', () => {
    // Both share "csv", "export", "data" — high keyword overlap
    const score = scoreMatch('CSV export data', 'CSV data export feature', null)
    expect(score).toBeGreaterThanOrEqual(45)
  })

  it('scores ≥ 40 for SSO concept phrase match', () => {
    // "Single sign-on" → normalised to "sso auth" by concept phrase
    // Gap "SSO auth" directly matches both tokens
    const score = scoreMatch('SSO auth', 'Single sign-on support', null)
    expect(score).toBeGreaterThanOrEqual(40)
  })

  it('scores ≥ 40 for synonym group match (import ↔ export)', () => {
    // "download" and "export" are in the same synonym group
    const score = scoreMatch('CSV data export', 'CSV data download', null)
    expect(score).toBeGreaterThanOrEqual(40)
  })

  // ── Low-confidence / no-match ─────────────────────────────────────────────

  it('scores < 30 for unrelated gap and title (export vs HRIS import)', () => {
    // "export leads" vs "HRIS import connector" — export/import are synonyms
    // but there are zero keyword hits and only 1 synonym hit → guard fires → 0
    const score = scoreMatch('Export leads via CSV', 'HRIS import connector', null)
    expect(score).toBeLessThan(30)
  })

  it('scores < 30 for completely unrelated gap and title', () => {
    const score = scoreMatch('calendar integration outlook', 'mobile floor plan map', null)
    expect(score).toBeLessThan(30)
  })

  // ── Description contribution ──────────────────────────────────────────────

  it('uses description tokens when title has no overlap', () => {
    // Gap matches description but not title — should still produce some score
    const scoreWithDesc = scoreMatch('CSV export', 'Data feature', 'Export data to CSV format')
    const scoreNoDesc = scoreMatch('CSV export', 'Data feature', null)
    expect(scoreWithDesc).toBeGreaterThan(scoreNoDesc)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// linearStatusToLoopStatus — regression tests
// ─────────────────────────────────────────────────────────────────────────────

describe('linearStatusToLoopStatus', () => {
  it('maps null to "identified"', () => {
    expect(linearStatusToLoopStatus(null)).toBe('identified')
  })

  it('maps "Done" to "shipped"', () => {
    expect(linearStatusToLoopStatus('Done')).toBe('shipped')
  })

  it('maps "Cancelled" to "shipped" (cancelled issues are no longer blocking)', () => {
    // Cancelled issues are treated as done/non-blocking in the loop view
    expect(linearStatusToLoopStatus('Cancelled')).toBe('shipped')
  })

  it('maps "Canceled" (US spelling) to "shipped"', () => {
    expect(linearStatusToLoopStatus('Canceled')).toBe('shipped')
  })

  it('maps "In Progress" to "in_progress"', () => {
    expect(linearStatusToLoopStatus('In Progress')).toBe('in_progress')
  })

  it('maps "In QA" to "in_progress"', () => {
    expect(linearStatusToLoopStatus('In QA')).toBe('in_progress')
  })

  it('maps "In Review" to "in_review"', () => {
    expect(linearStatusToLoopStatus('In Review')).toBe('in_review')
  })

  it('maps "Backlog" to "identified"', () => {
    expect(linearStatusToLoopStatus('Backlog')).toBe('identified')
  })

  it('maps "Triage" to "identified"', () => {
    expect(linearStatusToLoopStatus('Triage')).toBe('identified')
  })

  it('is case-insensitive', () => {
    expect(linearStatusToLoopStatus('IN PROGRESS')).toBe('in_progress')
    expect(linearStatusToLoopStatus('cancelled')).toBe('shipped')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// checkIsRealFeature — regression tests
// ─────────────────────────────────────────────────────────────────────────────

describe('checkIsRealFeature', () => {
  it('accepts a valid short feature request', () => {
    expect(checkIsRealFeature('Export leads as CSV file')).toBe(true)
  })

  it('accepts a valid medium-length feature request', () => {
    expect(checkIsRealFeature('Bulk CSV export for all contacts with custom field mapping')).toBe(true)
  })

  it('rejects strings shorter than 10 characters', () => {
    expect(checkIsRealFeature('CSV')).toBe(false)
    expect(checkIsRealFeature('export')).toBe(false)
  })

  it('rejects strings longer than 150 characters', () => {
    const longString = 'A'.repeat(151)
    expect(checkIsRealFeature(longString)).toBe(false)
  })

  it('accepts strings exactly 150 characters', () => {
    const exactString = 'A'.repeat(150)
    expect(checkIsRealFeature(exactString)).toBe(true)
  })

  it('rejects date-pattern strings', () => {
    expect(checkIsRealFeature('15 Jan meeting recap')).toBe(false)
    expect(checkIsRealFeature('[3 Feb] notes from call')).toBe(false)
  })

  it('rejects meeting-note artifact prefixes', () => {
    expect(checkIsRealFeature('Page 2 of the proposal')).toBe(false)
    expect(checkIsRealFeature('What success looks like for them')).toBe(false)
    expect(checkIsRealFeature('The POC will include...')).toBe(false)
  })

  it('rejects vague meta-request prefixes', () => {
    expect(checkIsRealFeature('Need the ability to export data')).toBe(false)
    expect(checkIsRealFeature('We need better reporting')).toBe(false)
    expect(checkIsRealFeature('They need SSO support')).toBe(false)
  })

  it('rejects strings with ellipsis (truncated text)', () => {
    expect(checkIsRealFeature('Export leads as CSV...')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Threshold behaviour (pure NLP scoring guard)
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreMatch threshold behaviour', () => {
  it('a score below 25 (NLP-only threshold) yields 0 due to guard', () => {
    // Minimal overlap gap — only 1 total hit → guard fires
    const score = scoreMatch('CSV export', 'HRIS connector', null)
    expect(score).toBe(0)
  })

  it('a score with 2+ hits is not zeroed by the guard', () => {
    // "csv export data" vs "csv data export" — all 3 tokens match title
    const score = scoreMatch('csv export data', 'csv data export', null)
    expect(score).toBeGreaterThan(0)
  })
})
