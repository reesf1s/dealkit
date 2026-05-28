import { describe, expect, it, vi } from 'vitest'
import {
  answerMentionsOtherDeal,
  classifyAssistantIntent,
  enforceAssistantStructure,
  findMentionedDeal,
  makeDealPromptContext,
} from '../assistant-context'

vi.mock('server-only', () => ({}))

describe('assistant deal context', () => {
  it('matches a named deal without blending in another account', () => {
    const deals = [
      { id: 'boe', title: 'BOE', companyName: 'Bank of England' },
      { id: 'gsa', title: 'GSA pilot', companyName: 'GSA' },
    ]

    expect(findMentionedDeal('Draft a follow-up for BOE.', deals)?.id).toBe('boe')
    expect(findMentionedDeal('Draft a follow-up for GSA.', deals)?.id).toBe('gsa')
  })

  it('matches account acronyms when the title is the full company name', () => {
    const deals = [
      { id: 'boe', title: 'Bank of England implementation', companyName: 'Bank of England' },
      { id: 'gsa', title: 'GSA pilot', companyName: 'General Services Administration' },
    ]

    expect(findMentionedDeal('Draft a follow-up for BOE.', deals)?.id).toBe('boe')
    expect(findMentionedDeal('Summarise the GSA deal.', deals)?.id).toBe('gsa')
  })

  it('separates current context from stale tasks and old activity', () => {
    const context = makeDealPromptContext({
      deal: { id: 'boe', title: 'BOE' },
      company: { name: 'Bank of England' },
      contacts: [],
      openTasks: [
        { id: 'current-task', title: 'Confirm next review', dueAt: new Date('2026-05-25T09:00:00Z') },
        { id: 'old-task', title: 'February floorplans', dueAt: new Date('2026-02-20T09:00:00Z') },
      ],
      latestActivities: [
        { id: 'fresh', title: 'Recent note', body: 'Darren asked for revised requirements.', occurredAt: new Date('2026-05-26T09:00:00Z') },
        { id: 'old', title: 'Old note', body: 'February project action.', occurredAt: new Date('2026-02-21T09:00:00Z') },
      ],
      intelligence: {},
    }, new Date('2026-05-27T09:00:00Z'))

    expect(context.openTasks.map((task: any) => task.id)).toEqual(['current-task'])
    expect(context.staleOpenTasks.map((task: any) => task.id)).toEqual(['old-task'])
    expect(context.latestActivities.map((activity: any) => activity.id)).toEqual(['fresh'])
    expect(context.staleActivities.map((activity: any) => activity.id)).toEqual(['old'])
  })

  it('classifies deal-required assistant intents before using workspace context', () => {
    expect(classifyAssistantIntent('Draft a follow-up for BOE')).toEqual({
      intent: 'draft_follow_up',
      requiresDeal: true,
    })
    expect(classifyAssistantIntent('Which deals are slipping?')).toEqual({
      intent: 'pipeline_risk',
      requiresDeal: false,
    })
  })

  it('rejects deal-scoped answers that mention another account', () => {
    const deals = [
      { id: 'boe', title: 'BOE', companyName: 'Bank of England' },
      { id: 'gsa', title: 'GSA pilot', companyName: 'GSA' },
    ]

    expect(answerMentionsOtherDeal('Next: draft a note for GSA.', deals[0], deals)).toBe(true)
    expect(answerMentionsOtherDeal('Next: follow up with BOE.', deals[0], deals)).toBe(false)
  })

  it('requires assistant answers to keep a readable CRM structure', () => {
    const fallback = 'What happened: fallback.\nWhat it means: safer.\nNext: clarify.'
    expect(enforceAssistantStructure('BOE looks risky.', fallback)).toBe(fallback)
    expect(enforceAssistantStructure('What happened: BOE replied.\nWhat it means: risk is lower.\nNext: send a note.', fallback))
      .toBe('What happened: BOE replied. What it means: risk is lower. Next: send a note.')
  })
})
