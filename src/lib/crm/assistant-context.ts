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
      const titleAcronym = acronymFor(deal.title)
      const companyAcronym = acronymFor(deal.companyName)
      const score = [
        title && normalizedMessage.includes(title) ? 4 : 0,
        company && normalizedMessage.includes(company) ? 4 : 0,
        titleAcronym && wordMatch(normalizedMessage, titleAcronym) ? 4 : 0,
        companyAcronym && wordMatch(normalizedMessage, companyAcronym) ? 4 : 0,
        target && title && target.includes(title) ? 3 : 0,
        target && company && target.includes(company) ? 3 : 0,
        target && titleAcronym && wordMatch(target, titleAcronym) ? 3 : 0,
        target && companyAcronym && wordMatch(target, companyAcronym) ? 3 : 0,
      ].reduce((sum, item) => sum + item, 0)
      return { deal, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (!candidates.length) return null
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null
  return candidates[0].deal
}

export type AssistantIntent =
  | 'draft_follow_up'
  | 'meeting_prep'
  | 'deal_summary'
  | 'deal_update'
  | 'pipeline_risk'
  | 'next_steps'
  | 'today'
  | 'data_quality'
  | 'general'

export function classifyAssistantIntent(message: string): { intent: AssistantIntent; requiresDeal: boolean } {
  const lower = message.toLowerCase()
  if (/\b(draft|write|compose)\b/.test(lower) && /\b(follow.?up|email|reply)\b/.test(lower)) {
    return { intent: 'draft_follow_up', requiresDeal: true }
  }
  if (/\b(prep|prepare|meeting)\b/.test(lower)) return { intent: 'meeting_prep', requiresDeal: /\b(for|about|with|on)\b/.test(lower) }
  if (/\b(summaris|summariz|recap|brief)\b/.test(lower) && /\b(deal|account|company|boe|gsa|relx|irs)\b/.test(lower)) {
    return { intent: 'deal_summary', requiresDeal: true }
  }
  if (/\b(update|changed|note)\b/.test(lower) && /\b(deal|account|company|for|on|about)\b/.test(lower)) {
    return { intent: 'deal_update', requiresDeal: true }
  }
  if (/\b(risk|slipping|stale|stuck|blocked)\b/.test(lower)) return { intent: 'pipeline_risk', requiresDeal: false }
  if (/\b(no next|next step|follow.?up|what should i do)\b/.test(lower)) return { intent: 'next_steps', requiresDeal: false }
  if (/\b(today|day|priorit|morning)\b/.test(lower)) return { intent: 'today', requiresDeal: false }
  if (/\b(missing|data|cleanup|clean up|quality)\b/.test(lower)) return { intent: 'data_quality', requiresDeal: false }
  return { intent: 'general', requiresDeal: false }
}

export function answerMentionsOtherDeal(answer: string, allowedDeal: any, deals: any[]) {
  const normalized = normalizeAssistantText(answer)
  const allowed = new Set([
    normalizeAssistantText(allowedDeal?.title),
    normalizeAssistantText(allowedDeal?.companyName),
    acronymFor(allowedDeal?.title),
    acronymFor(allowedDeal?.companyName),
  ].filter(Boolean))

  return deals.some(deal => {
    if (deal.id === allowedDeal?.id) return false
    const names = [
      normalizeAssistantText(deal.title),
      normalizeAssistantText(deal.companyName),
      acronymFor(deal.title),
      acronymFor(deal.companyName),
    ].filter(Boolean)
    return names.some(name => !allowed.has(name) && wordOrPhraseMatch(normalized, name))
  })
}

export function enforceAssistantStructure(answer: string, fallback: string, opts: { draft?: boolean } = {}) {
  const text = compactAssistantText(answer.trim(), opts.draft ? 1600 : 900)
  if (!text) return fallback
  if (opts.draft) return text
  const lower = text.toLowerCase()
  const hasStructure = lower.includes('what happened') && (lower.includes('what it means') || lower.includes('meaning')) && lower.includes('next')
  if (hasStructure) return text
  return fallback
}

function acronymFor(value?: string | null) {
  const words = String(value ?? '')
    .replace(/&/g, ' and ')
    .split(/[^A-Za-z0-9]+/)
    .filter(word => word.length > 1 && !['the', 'and', 'for', 'with', 'deal'].includes(word.toLowerCase()))
  if (words.length < 2) return ''
  return words.map(word => word[0]).join('').toLowerCase()
}

function wordMatch(haystack: string, needle: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(needle)}(?:\\s|$)`, 'i').test(haystack)
}

function wordOrPhraseMatch(haystack: string, needle: string) {
  if (needle.length <= 3) return wordMatch(haystack, needle)
  return haystack.includes(needle)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
