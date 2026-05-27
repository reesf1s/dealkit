import { describe, expect, it, vi } from 'vitest'
import { findMentionedDeal, makeDealPromptContext } from '../assistant-context'

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
})
