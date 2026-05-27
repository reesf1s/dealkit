import 'server-only'

export function normalizeAssistantText(value?: string | null) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function findMentionedDeal(message: string, deals: any[]) {
  const normalizedMessage = normalizeAssistantText(message)
  const target = normalizeAssistantText(message.match(/\b(?:for|on|about)\s+(.+?)(?:[.?]|$)/i)?.[1])
  const candidates = deals
    .map(deal => {
      const title = normalizeAssistantText(deal.title)
      const company = normalizeAssistantText(deal.companyName)
      const score = [
        title && normalizedMessage.includes(title) ? 4 : 0,
        company && normalizedMessage.includes(company) ? 4 : 0,
        target && title && target.includes(title) ? 3 : 0,
        target && company && target.includes(company) ? 3 : 0,
      ].reduce((sum, item) => sum + item, 0)
      return { deal, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (!candidates.length) return null
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null
  return candidates[0].deal
}

export function looksDealSpecific(lower: string) {
  return /\b(draft|summaris|summariz|prep|follow.?up|email)\b/.test(lower) && /\b(for|on|about)\b/.test(lower)
}

export function isStaleDate(value: unknown, days: number, now = new Date()) {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return false
  return now.getTime() - date.getTime() > days * 86_400_000
}

export function makeDealPromptContext(dealContext: any, now = new Date()) {
  const freshActivities = (dealContext.latestActivities ?? [])
    .filter((activity: any) => !isStaleDate(activity.occurredAt, 60, now))
    .slice(0, 8)
  const staleActivities = (dealContext.latestActivities ?? [])
    .filter((activity: any) => isStaleDate(activity.occurredAt, 60, now))
    .slice(0, 4)
  const currentOpenTasks = (dealContext.openTasks ?? [])
    .filter((task: any) => !isStaleDate(task.dueAt, 21, now))
    .slice(0, 8)
  const staleOpenTasks = (dealContext.openTasks ?? [])
    .filter((task: any) => isStaleDate(task.dueAt, 21, now))
    .slice(0, 8)

  return {
    deal: dealContext.deal,
    company: dealContext.company,
    contacts: dealContext.contacts,
    openTasks: currentOpenTasks,
    staleOpenTasks,
    latestActivities: freshActivities.length ? freshActivities : staleActivities.slice(0, 2),
    staleActivities,
    intelligence: dealContext.intelligence,
    contextPolicy: {
      scope: 'single_deal',
      rule: 'Use only this deal. Treat staleOpenTasks and staleActivities as historical context to verify, not fresh instructions.',
    },
  }
}

export function compactAssistantText(value: string, max: number) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 3).trim()}...`
}
