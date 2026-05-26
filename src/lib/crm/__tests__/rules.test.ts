import { describe, expect, it } from 'vitest'
import {
  extractDeterministicSignals,
  mapLegacyStage,
  mapLegacyStatus,
  parseDomain,
  riskFromScore,
  scoreDeal,
  splitName,
  titleCaseName,
} from '@/lib/crm/rules'

describe('crm rules', () => {
  it('maps legacy stages and statuses into the native CRM vocabulary', () => {
    expect(mapLegacyStage('prospecting')).toBe('lead_in')
    expect(mapLegacyStage('qualification')).toBe('qualified')
    expect(mapLegacyStage('negotiation')).toBe('contract')
    expect(mapLegacyStage('closed_won')).toBe('won')
    expect(mapLegacyStage('closed_lost')).toBe('lost')
    expect(mapLegacyStage(undefined)).toBe('lead_in')

    expect(mapLegacyStatus('closed_won')).toBe('won')
    expect(mapLegacyStatus('closed_lost')).toBe('lost')
    expect(mapLegacyStatus('proposal')).toBe('open')
  })

  it('normalizes names and domains used during backfill', () => {
    expect(titleCaseName('  acme   ltd  ')).toBe('Acme Ltd')
    expect(splitName('Ada Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' })
    expect(splitName('Ada')).toEqual({ firstName: 'Ada', lastName: null })
    expect(parseDomain('founder@acme.com')).toBe('acme.com')
    expect(parseDomain('https://www.acme.com/pricing')).toBe('acme.com')
    expect(parseDomain('not a url')).toBe(null)
  })

  it('scores deals with explainable V1 heuristics', () => {
    const now = new Date('2026-05-26T12:00:00Z')
    expect(scoreDeal({
      status: 'won',
      probability: 20,
      lastActivityAt: null,
      nextStepDueAt: null,
      expectedCloseDate: null,
    }, now)).toBe(100)

    expect(scoreDeal({
      status: 'open',
      probability: 60,
      lastActivityAt: new Date('2026-05-25T12:00:00Z'),
      nextStepDueAt: new Date('2026-05-27T12:00:00Z'),
      expectedCloseDate: new Date('2026-06-15T12:00:00Z'),
    }, now)).toBe(82)

    expect(scoreDeal({
      status: 'open',
      probability: 60,
      lastActivityAt: new Date('2026-05-01T12:00:00Z'),
      nextStepDueAt: null,
      expectedCloseDate: new Date('2026-05-20T12:00:00Z'),
    }, now)).toBe(12)
  })

  it('turns scores and staleness into risk labels', () => {
    expect(riskFromScore(80, 0)).toBe('low')
    expect(riskFromScore(55, 0)).toBe('medium')
    expect(riskFromScore(80, 14)).toBe('medium')
    expect(riskFromScore(34, 0)).toBe('high')
    expect(riskFromScore(80, 21)).toBe('high')
  })

  it('extracts deterministic signals without an LLM', () => {
    const signals = extractDeterministicSignals({
      status: 'open',
      probability: 50,
      lastActivityAt: new Date('2026-05-01T12:00:00Z'),
      nextStepDueAt: null,
      expectedCloseDate: new Date('2026-05-20T12:00:00Z'),
      hasOpenTasks: false,
      hasNextAction: false,
      hasUpcomingMeeting: true,
      daysInStage: 30,
      closeDateMovedCount: 2,
      valueChangeAmount: -5000,
      evidenceActivityIds: ['act_1'],
      now: new Date('2026-05-26T12:00:00Z'),
    })

    expect(signals.map(signal => signal.type)).toEqual([
      'stale_deal',
      'no_next_step',
      'close_date_overdue',
      'stage_stagnant',
      'close_date_slipped',
      'value_changed',
      'meeting_booked',
    ])
    expect(signals.every(signal => signal.evidenceActivityIds.includes('act_1'))).toBe(true)
  })
})
