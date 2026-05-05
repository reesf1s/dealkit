/**
 * GET /api/dashboard/summary
 * Returns the "Revenue at Risk" panel data for the Today tab.
 *
 * Urgency algorithm (no LLM):
 *   urgency = (1 - winProb) × dealValue × ln(daysStale + 1) × riskMultiplier
 *
 * Focus bullets: grounded AI generation with deterministic fallbacks.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq, and, not, inArray } from 'drizzle-orm'
import { dbErrResponse } from '@/lib/api-helpers'
import { buildDealSnapshot, isActionableNextStep as isSnapshotActionable } from '@/lib/deal-snapshot'

// In-memory focus bullet cache keyed by workspaceId
const focusCache: Record<string, { bullets: string[]; builtAt: number; latestUpdateAt: number }> = {}
const FOCUS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

type OpenDealRow = {
  id: string
  dealName: string
  prospectCompany: string
  prospectName: string | null
  prospectTitle: string | null
  stage: string
  dealValue: number | null
  conversionScore: number | null
  updatedAt: string | Date
  nextSteps: string | null
  notes: string | null
  aiSummary: string | null
  closeDate: string | Date | null
  meetingNotes: string | null
  contacts: unknown
  dealRisks: unknown
}

type FocusItem = {
  dealId: string
  company: string
  status: string
  action: string
  blocker: string | null
  latestSnapshot: string | null
  previousSnapshot: string | null
  why: string
  dueLabel: string
  riskLevel: 'high' | 'medium' | 'low'
  daysStale: number
  latestActivityAt: string
}

type HygieneItem = {
  dealId: string
  company: string
  missing: string[]
  daysStale: number
  latestActivityAt: string
  value: number
}

type DataQualitySummary = {
  missingNextStep: number
  missingCloseDate: number
  missingPrimaryContact: number
  missingDealValue: number
}

type RankedDeal = {
  id: string
  name: string
  company: string
  contactName: string | null
  closeDate: string | Date | null
  value: number
  stage: string
  urgencyScore: number
  primaryBlocker: string | null
  latestSnapshot: string | null
  previousSnapshot: string | null
  latestAction: string | null
  statusSummary: string
  topAction: string
  riskLevel: 'high' | 'medium' | 'low'
  daysStale: number
  latestActivityAt: string
}

function hasPrimaryContact(deal: OpenDealRow): boolean {
  if (String(deal.prospectName ?? '').trim().length > 0) return true
  const contacts = Array.isArray(deal.contacts) ? (deal.contacts as Array<{ name?: string | null }>) : []
  return contacts.some(contact => String(contact?.name ?? '').trim().length > 0)
}

function clipAtWord(input: string, max = 96): string {
  const text = input.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const clipped = text.slice(0, max)
  const lastSpace = clipped.lastIndexOf(' ')
  return (lastSpace > 18 ? clipped.slice(0, lastSpace) : clipped).trim()
}

function normalizeFreeText(input: string | null | undefined, max = 120): string {
  if (!input) return ''
  const cleaned = input
    .replace(/\[[^\]]*?\]/g, ' ')
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, ' ')
    .replace(/\b\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\b/g, ' ')
    .replace(/#+/g, ' ')
    .replace(/[*`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:\-–—\s]+/, '')
  return clipAtWord(cleaned, max)
}

function normalizeFreeTextUnbounded(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/\[[^\]]*?\]/g, ' ')
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, ' ')
    .replace(/\b\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\b/g, ' ')
    .replace(/#+/g, ' ')
    .replace(/[*`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:\-–—\s]+/, '')
}

function firstSentence(input: string | null | undefined, max = 120): string {
  const normalized = normalizeFreeText(input, 220)
  if (!normalized) return ''
  const sentence = normalized.split(/[.!?]/)[0]?.trim() ?? normalized
  return clipAtWord(sentence, max)
}

function firstSentenceUnbounded(input: string | null | undefined): string {
  const normalized = normalizeFreeTextUnbounded(input)
  if (!normalized) return ''
  return normalized.split(/[.!?]/)[0]?.trim() ?? normalized
}

function extractLatestUpdateSnapshot(deal: OpenDealRow): string | null {
  const meetingText = (deal.meetingNotes ?? '').replace(/\r/g, '').trim()
  if (meetingText) {
    const lines = meetingText.split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^\[\d{4}-\d{2}-\d{2}\]\s*$/.test(lines[i]?.trim() ?? '')) {
        const candidate = normalizeFreeTextUnbounded(lines.slice(i + 1).join(' '))
        if (candidate) return candidate
      }
    }
    const blocks = meetingText
      .split(/\n{2,}/)
      .map(segment => normalizeFreeTextUnbounded(segment))
      .filter(Boolean)
    if (blocks.length > 0) return blocks[blocks.length - 1]
  }

  const next = normalizeFreeTextUnbounded(deal.nextSteps)
  if (next) return next

  const notes = normalizeFreeTextUnbounded(deal.notes)
  if (notes) return notes

  return null
}

function inferBlockerText(deal: OpenDealRow, latestSnapshot: string | null): string | null {
  const inline = firstSentenceUnbounded((latestSnapshot ?? '').match(/(?:blocker(?: is|:)?|risk(?: is|:)?|held up by)\s+([^.;]+)/i)?.[1])
  if (inline) return inline

  if (!latestSnapshot) {
    const explicitRisk = Array.isArray(deal.dealRisks) && (deal.dealRisks as string[]).length > 0
      ? firstSentenceUnbounded((deal.dealRisks as string[])[0])
      : ''
    if (explicitRisk) return explicitRisk
  }
  return null
}

function prioritizeDealsForFocus(scored: RankedDeal[]): RankedDeal[] {
  const nowMs = Date.now()

  const priorityScore = (deal: RankedDeal): number => {
    const closeDays = deal.closeDate ? Math.ceil((new Date(deal.closeDate).getTime() - nowMs) / 86_400_000) : null
    const riskWeight = deal.riskLevel === 'high' ? 1200 : deal.riskLevel === 'medium' ? 760 : 260
    const staleWeight = Math.min(420, deal.daysStale * 26)
    const valueWeight = Math.min(420, Math.round((deal.value || 0) / 1_800))
    const blockerWeight = deal.primaryBlocker ? 220 : 0
    const closeWeight = closeDays == null ? 0 : closeDays < 0 ? 520 : Math.max(0, 360 - (closeDays * 32))
    return riskWeight + staleWeight + valueWeight + blockerWeight + closeWeight
  }

  const candidate = scored.filter(deal => {
    const closeDays = deal.closeDate ? Math.ceil((new Date(deal.closeDate).getTime() - nowMs) / 86_400_000) : null
    return (
      deal.riskLevel !== 'low' ||
      deal.daysStale >= 7 ||
      (deal.value || 0) >= 100_000 ||
      (closeDays != null && closeDays <= 14) ||
      Boolean(deal.primaryBlocker)
    )
  })

  const pool = candidate.length > 0 ? candidate : scored
  return [...pool].sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 6)
}

function computeUrgency(
  deal: { conversionScore: number | null; dealValue: number | null; updatedAt: string | Date },
  hasGapPriority: boolean,
): number {
  const winProb = deal.conversionScore ? deal.conversionScore / 100 : 0.5
  const value = deal.dealValue || 0
  const daysStale = Math.floor(
    (Date.now() - new Date(deal.updatedAt).getTime()) / 86400000,
  )
  const riskMultiplier = hasGapPriority ? 1.3 : 1.0
  return (1 - winProb) * value * Math.log(daysStale + 1) * riskMultiplier
}

function computeTopAction(
  deal: OpenDealRow,
  explicitAction: string | null,
  _latestSnapshot: string | null,
  _blocker: string | null,
  _linearIssueLinked: boolean,
): string {
  const nextStep = firstSentence(deal.nextSteps)

  if (explicitAction && isSnapshotActionable(explicitAction)) {
    return clipAtWord(explicitAction, 180)
  }

  if (nextStep && isSnapshotActionable(nextStep)) return clipAtWord(nextStep, 180)
  return ''
}

function normalizeFocusBullet(line: string): string {
  return line
    .replace(/^\s*[-*•\d.)]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isGenericFocusBullet(line: string): boolean {
  const lower = line.toLowerCase()
  return [
    'follow up',
    'check in',
    'review pipeline',
    'stay close',
    'monitor',
    'touch base',
  ].some(phrase => lower.includes(phrase))
}

function buildDeterministicFocusBullets(topDeals: Array<{
  company: string
  topAction: string
  daysStale: number
  riskLevel: 'high' | 'medium' | 'low'
  primaryBlocker: string | null
  latestSnapshot?: string | null
  previousSnapshot?: string | null
  closeDate?: string | Date | null
  contactName?: string | null
}>): string[] {
  const today = new Date()
  const deadline = new Date(today.getTime() + (24 * 60 * 60 * 1000))
  const deadlineLabel = deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

  return topDeals.slice(0, 4).map(deal => {
    const snapshot = deal.latestSnapshot ? ` Update: ${clipAtWord(deal.latestSnapshot, 72)}.` : ''
    const blocker = deal.primaryBlocker ? ` Why: ${clipAtWord(deal.primaryBlocker, 60)}.` : ''
    const contact = deal.contactName ? ` with ${deal.contactName}` : ''
    const closeDate = deal.closeDate ? new Date(deal.closeDate) : null
    const closeLabel = closeDate ? closeDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : null

    if (closeDate && closeDate.getTime() > today.getTime() && (closeDate.getTime() - today.getTime()) / 86_400_000 <= 7) {
      return `${deal.company} — Confirm close plan${contact} before ${closeLabel}.${snapshot}${blocker}`.trim()
    }
    if (deal.daysStale >= 10) {
      return `${deal.company} — Re-engage${contact} by ${deadlineLabel}; ${deal.daysStale}d stale.${snapshot}${blocker}`.trim()
    }
    if (deal.topAction) {
      const riskPrefix = deal.riskLevel === 'high' ? 'Escalate' : deal.riskLevel === 'medium' ? 'Advance' : 'Progress'
      return `${deal.company} — ${riskPrefix} now: ${deal.topAction}.${snapshot}${blocker}`.trim()
    }
    return `${deal.company} — Latest: ${clipAtWord(deal.latestSnapshot ?? 'No recent update captured', 90)}.${blocker}`.trim()
  })
}

function buildFocusItems(topDeals: Array<{
  id: string
  company: string
  statusSummary: string
  latestAction: string | null
  topAction: string
  value: number
  daysStale: number
  riskLevel: 'high' | 'medium' | 'low'
  primaryBlocker: string | null
  latestSnapshot?: string | null
  previousSnapshot?: string | null
  closeDate?: string | Date | null
  contactName?: string | null
  latestActivityAt: string
}>): FocusItem[] {
  const now = new Date()
  const twoDaysOut = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000))
  const weekday = twoDaysOut.toLocaleDateString('en-GB', { weekday: 'short' })

  return topDeals.slice(0, 4).map(deal => {
    const closeDate = deal.closeDate ? new Date(deal.closeDate) : null
    const closeDays = closeDate ? Math.ceil((closeDate.getTime() - now.getTime()) / 86_400_000) : null

    let dueLabel = 'This week'
    if (closeDays != null && closeDays < 0) dueLabel = 'Overdue'
    if (deal.riskLevel === 'high' || deal.daysStale >= 10) dueLabel = 'Today'
    if (deal.riskLevel === 'medium' || deal.value >= 100_000) dueLabel = 'Next 48h'
    if (closeDays != null && closeDays >= 0 && closeDays <= 7 && closeDate) {
      dueLabel = closeDays <= 2
        ? 'Next 24h'
        : `Before ${closeDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
    }
    if (!closeDate && deal.riskLevel === 'low' && deal.daysStale < 5) dueLabel = `By ${weekday}`

    return {
      dealId: deal.id,
      company: deal.company,
      status: normalizeFreeTextUnbounded(deal.statusSummary),
      action: normalizeFreeTextUnbounded(deal.latestAction ?? deal.topAction),
      blocker: deal.primaryBlocker ?? null,
      latestSnapshot: deal.latestSnapshot ?? null,
      previousSnapshot: deal.previousSnapshot ?? null,
      why: normalizeFreeTextUnbounded(
        deal.latestSnapshot ??
        deal.primaryBlocker ??
        `${deal.daysStale}d since last meaningful update`,
      ),
      dueLabel,
      riskLevel: deal.riskLevel,
      daysStale: deal.daysStale,
      latestActivityAt: deal.latestActivityAt,
    }
  })
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)
    const brain = await getWorkspaceBrain(workspaceId)

    // Load open deals
    const CLOSED = ['closed_won', 'closed_lost'] as const
    const openDeals: OpenDealRow[] = await db
      .select({
        id: dealLogs.id,
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        prospectName: dealLogs.prospectName,
        prospectTitle: dealLogs.prospectTitle,
        stage: dealLogs.stage,
        dealValue: dealLogs.dealValue,
        conversionScore: dealLogs.conversionScore,
        updatedAt: dealLogs.updatedAt,
        nextSteps: dealLogs.nextSteps,
        notes: dealLogs.notes,
        aiSummary: dealLogs.aiSummary,
        closeDate: dealLogs.closeDate,
        meetingNotes: dealLogs.meetingNotes,
        contacts: dealLogs.contacts,
        dealRisks: dealLogs.dealRisks,
      })
      .from(dealLogs)
      .where(
        and(
          eq(dealLogs.workspaceId, workspaceId),
          not(inArray(dealLogs.stage, CLOSED)),
        ),
      )

    const latestOpenUpdateAt = openDeals.reduce((max, deal) => {
      const ts = new Date(deal.updatedAt).getTime()
      return ts > max ? ts : max
    }, 0)

    // Build top deals sorted by urgency
    const scored: RankedDeal[] = openDeals.map(deal => {
      // Check if deal appears in brain's urgent list
      const isUrgent = (brain?.urgentDeals ?? []).some(u => u.dealId === deal.id)
      const urgencyScore = computeUrgency(deal, isUrgent)

      // Risk level
      const riskLevel =
        urgencyScore > 50000 ? 'high'
        : urgencyScore > 10000 ? 'medium'
        : 'low'

      const snapshot = buildDealSnapshot(deal)
      const latestSnapshot = snapshot.latestUpdate ?? extractLatestUpdateSnapshot(deal)
      const previousSnapshot = snapshot.previousUpdate
      const statusSummary = snapshot.whereWeAre
      const latestAction = snapshot.nextAction
      // Primary blocker from explicit risk first, otherwise infer from latest update signal
      const primaryBlocker = snapshot.blocker ?? inferBlockerText(deal, latestSnapshot)

      const topAction = computeTopAction(deal, latestAction, latestSnapshot, primaryBlocker, false)

      return {
        id: deal.id,
        name: deal.dealName,
        company: deal.prospectCompany,
        contactName: deal.prospectName,
        closeDate: deal.closeDate,
        value: deal.dealValue ?? 0,
        stage: deal.stage,
        urgencyScore,
        primaryBlocker,
        latestSnapshot,
        previousSnapshot,
        latestAction,
        statusSummary,
        topAction,
        riskLevel: riskLevel as 'high' | 'medium' | 'low',
        daysStale: Math.floor(
          (Date.now() - new Date(deal.updatedAt).getTime()) / 86400000,
        ),
        latestActivityAt: new Date(deal.updatedAt).toISOString(),
      }
    })

    scored.sort((a, b) => b.urgencyScore - a.urgencyScore)
    const topDeals = scored.slice(0, 8)
    const focusDeals = prioritizeDealsForFocus(scored)

    // Revenue at risk = sum of (1 - winProb) × value for all open deals
    const revenueAtRisk = openDeals.reduce((acc, deal) => {
      const winProb = deal.conversionScore ? deal.conversionScore / 100 : 0.5
      return acc + (1 - winProb) * (deal.dealValue ?? 0)
    }, 0)
    const staleDeals = openDeals.filter(d => (Date.now() - new Date(d.updatedAt).getTime()) / 86400000 >= 10).length
    const executionGaps = openDeals.filter(d => !String(d.nextSteps ?? '').trim()).length

    const dataQuality: DataQualitySummary = {
      missingNextStep: 0,
      missingCloseDate: 0,
      missingPrimaryContact: 0,
      missingDealValue: 0,
    }

    const hygieneQueue: HygieneItem[] = []
    for (const deal of openDeals) {
      const missing: string[] = []
      const missingNextStep = !String(deal.nextSteps ?? '').trim()
      const missingCloseDate = !deal.closeDate
      const missingPrimaryContact = !hasPrimaryContact(deal)
      const missingDealValue = !(deal.dealValue && deal.dealValue > 0)

      if (missingNextStep) {
        dataQuality.missingNextStep += 1
        missing.push('next step')
      }
      if (missingCloseDate) {
        dataQuality.missingCloseDate += 1
        missing.push('close date')
      }
      if (missingPrimaryContact) {
        dataQuality.missingPrimaryContact += 1
        missing.push('primary contact')
      }
      if (missingDealValue) {
        dataQuality.missingDealValue += 1
        missing.push('deal value')
      }

      if (missing.length > 0) {
        const daysStale = Math.max(0, Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / 86400000))
        hygieneQueue.push({
          dealId: deal.id,
          company: deal.prospectCompany,
          missing,
          daysStale,
          latestActivityAt: new Date(deal.updatedAt).toISOString(),
          value: deal.dealValue ?? 0,
        })
      }
    }

    hygieneQueue.sort((a, b) => {
      if (b.missing.length !== a.missing.length) return b.missing.length - a.missing.length
      if (b.value !== a.value) return b.value - a.value
      return b.daysStale - a.daysStale
    })

    // Focus bullets — cached per workspace and invalidated when deals are updated
    let focusBullets: string[] = []
    const cached = focusCache[workspaceId]
    if (
      cached &&
      Date.now() - cached.builtAt < FOCUS_CACHE_TTL &&
      cached.latestUpdateAt === latestOpenUpdateAt
    ) {
      focusBullets = cached.bullets
    } else if (focusDeals.length > 0) {
      try {
        const { createOpenAI } = await import('@ai-sdk/openai')
        const { generateText } = await import('ai')
        const openai = createOpenAI()
        const now = new Date()
        const todayLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
        const context = focusDeals
          .slice(0, 4)
          .map((d, i) => {
            const source = openDeals.find(item => item.id === d.id)
            const next = normalizeFreeText(source?.nextSteps, 120) || 'none'
            const latest = d.latestSnapshot ? clipAtWord(d.latestSnapshot, 120) : 'none'
            const contact = source?.prospectName ? `${source.prospectName}${source.prospectTitle ? ` (${source.prospectTitle})` : ''}` : 'unknown'
            const closeDate = source?.closeDate ? new Date(source.closeDate).toISOString().slice(0, 10) : 'unset'
            return `${i + 1}. ${d.company} | stage=${d.stage} | value=£${d.value} | stale=${d.daysStale}d | risk=${d.riskLevel} | contact=${contact} | close=${closeDate} | latest=${latest} | blocker=${d.primaryBlocker ?? 'none'} | next=${next} | recommended=${d.topAction} | updated=${new Date(source?.updatedAt ?? now).toISOString().slice(0, 10)}`
          })
          .join('\n')
        const { text } = await generateText({
          model: openai('gpt-5.4-mini'),
          prompt: `You are the daily sales operator for an enterprise AE team.
Today is ${todayLabel}.
Write exactly 4 action lines for today's execution queue.

FORMAT:
Company — Specific action with owner + timing. Why: concrete risk/opportunity.

RULES:
- Each line must include the company name.
- Use specific details from context (contact, blocker, deadline, stale days, next step).
- Prefer explicit actions like "Call", "Send", "Book", "Confirm", "Escalate", "Finalize".
- Do not write generic advice ("follow up", "review pipeline", "check in").
- Make the action immediate and current (today or this week) with a concrete timing cue.
- Keep each line under 150 characters.
- No numbering, no markdown bullets.

DEAL CONTEXT:
${context}`,
          providerOptions: {
            openai: {
              maxCompletionTokens: 320,
            },
          },
        })
        const parsed = text
          .split('\n')
          .map(normalizeFocusBullet)
          .filter(Boolean)
          .filter(line => !isGenericFocusBullet(line))
          .slice(0, 4)
        focusBullets = parsed.length >= 3
          ? parsed
          : buildDeterministicFocusBullets(focusDeals)
        focusCache[workspaceId] = {
          bullets: focusBullets,
          builtAt: Date.now(),
          latestUpdateAt: latestOpenUpdateAt,
        }
      } catch {
        focusBullets = buildDeterministicFocusBullets(focusDeals)
      }
    }

    return NextResponse.json({
      data: {
        revenueAtRisk: Math.round(revenueAtRisk),
        dealsAtRisk: scored.filter(d => d.riskLevel !== 'low').length,
        staleDeals,
        executionGaps,
        topDeals,
        focusBullets,
        focusItems: buildFocusItems(focusDeals),
        dataQuality,
        hygieneQueue: hygieneQueue.slice(0, 6),
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    return dbErrResponse(err)
  }
}
