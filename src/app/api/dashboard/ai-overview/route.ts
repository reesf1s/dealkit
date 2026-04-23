import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, workspaces, companyProfiles, competitors } from '@/lib/db/schema'
import { dbErrResponse, ensureLinksColumn } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { anthropic } from '@/lib/ai/client'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getWorkspaceBrain, type WorkspaceBrain } from '@/lib/workspace-brain'
import {
  buildBriefingNoteFocus,
  buildNoteCentricBrainContext,
  buildPreferredNoteCorpus,
  buildStructuredNoteCorpus,
  daysSince,
  extractDatedEntries,
  formatDatedNote,
  sentenceCase,
  stripDatePrefix,
} from '@/lib/note-intelligence'

const OVERVIEW_VERSION = 5
const MS_PER_DAY = 86_400_000
const CURRENT_SIGNAL_WINDOW_DAYS = 10
const NOTE_CONTEXT_WINDOW_DAYS = 30

type PipelineConfig = {
  stages?: Array<{ id: string; label: string }>
}

type ScheduledEvent = {
  date?: string | null
  description?: string
  time?: string | null
}

// Safe date construction — never throws "Invalid time value"
function safeDate(val: unknown): Date | null {
  if (!val) return null
  const d = new Date(val as string)
  return isNaN(d.getTime()) ? null : d
}

// Helper to load pipeline stage labels
async function loadStageLabels(workspaceId: string): Promise<Record<string, string>> {
  try {
    const [ws] = await db
      .select({ pipelineConfig: workspaces.pipelineConfig })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)
    const pConfig = ws?.pipelineConfig as PipelineConfig | null | undefined
    if (pConfig?.stages?.length) {
      const labels: Record<string, string> = {}
      for (const s of pConfig.stages) labels[s.id] = s.label
      return labels
    }
  } catch { /* non-fatal */ }
  return {}
}

export type AIOverview = {
  version?: number
  summary: string
  keyActions: string[]
  focusBullets: string[]
  pipelineHealth: string
  momentum: string | null
  topRisk: string | null
  generatedAt: string
  briefingHealth: 'green' | 'amber' | 'red'
  topAttentionDeals: { dealId: string; dealName: string; company: string; reason: string; urgency: 'high' | 'medium' }[]
  singleMostImportantAction: string
}

type DealSignalMeta = {
  dealId: string
  dealName: string
  company: string
  stage: string
  dealValue: number
  conversionScore: number | null
  closeDate: string | null
  lastNoteAt: string | null
  daysSinceLastNote: number | null
  lastNoteSummary: string | null
  outstandingNoteSummary: string | null
  topRisk: string | null
  futureEventText: string | null
  futureEventAt: string | null
  scoreShift: { delta: number; from: number; to: number; days: number } | null
}

function recentScoreShift(
  history: WorkspaceBrain['deals'][number]['scoreHistory'] | undefined,
  nowMs = Date.now(),
): { delta: number; from: number; to: number; days: number } | null {
  if (!history || history.length < 2) return null
  const recent = history
    .map(point => ({ ...point, dateObj: safeDate(point.date) }))
    .filter((point): point is typeof point & { dateObj: Date } => point.dateObj !== null && nowMs - point.dateObj.getTime() <= CURRENT_SIGNAL_WINDOW_DAYS * MS_PER_DAY)
    .sort((left, right) => left.dateObj.getTime() - right.dateObj.getTime())

  if (recent.length < 2) return null
  const first = recent[0]
  const last = recent[recent.length - 1]
  const delta = last.score - first.score
  if (Math.abs(delta) < 8) return null

  return {
    delta,
    from: first.score,
    to: last.score,
    days: Math.max(1, Math.round((last.dateObj.getTime() - first.dateObj.getTime()) / MS_PER_DAY)),
  }
}

function deriveFreshMomentum(signalMeta: DealSignalMeta[]): string | null {
  const candidates = signalMeta
    .filter(item =>
      (item.daysSinceLastNote != null && item.daysSinceLastNote <= CURRENT_SIGNAL_WINDOW_DAYS) ||
      item.futureEventAt !== null,
    )
    .map(item => {
      let text: string | null = null
      if (item.scoreShift && item.futureEventText) {
        const delta = item.scoreShift.delta >= 0 ? `+${item.scoreShift.delta}` : `${item.scoreShift.delta}`
        text = `${item.dealName} ${delta}pts (${item.scoreShift.from}→${item.scoreShift.to}) over ${item.scoreShift.days}d — ${item.futureEventText}.`
      } else if (item.futureEventText) {
        text = `${item.dealName}: ${item.futureEventText}.`
      } else if (item.lastNoteSummary) {
        text = `${item.dealName}: ${sentenceCase(item.lastNoteSummary)}`
      }

      const freshnessBoost = item.daysSinceLastNote == null ? 0 : Math.max(0, CURRENT_SIGNAL_WINDOW_DAYS - item.daysSinceLastNote)
      const eventBoost = item.futureEventAt ? 18 : 0
      const shiftBoost = item.scoreShift ? Math.abs(item.scoreShift.delta) : 0
      const valueBoost = Math.min(item.dealValue / 10_000, 20)

      return {
        text,
        sortKey: freshnessBoost + eventBoost + shiftBoost + valueBoost,
      }
    })
    .filter((item): item is { text: string; sortKey: number } => Boolean(item.text))
    .sort((left, right) => right.sortKey - left.sortKey)

  return candidates[0]?.text ?? null
}

async function generateOverview(workspaceId: string): Promise<AIOverview> {
  await ensureLinksColumn()
  const [deals, companyRows, comps, stageLabels] = await Promise.all([
    db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)),
    db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1),
    db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)),
    loadStageLabels(workspaceId),
  ])
  const sl = (stageId: string) => stageLabels[stageId] ?? stageId

  const openDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const wonDeals = deals.filter(d => d.stage === 'closed_won')
  const lostDeals = deals.filter(d => d.stage === 'closed_lost')
  const closedCount = wonDeals.length + lostDeals.length
  const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0
  const totalPipelineValue = openDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
  const nowMs = Date.now()
  const brain = await getWorkspaceBrain(workspaceId)
  const brainDealMap = new Map((brain?.deals ?? []).map(deal => [deal.id, deal]))
  const dealSignalMeta: DealSignalMeta[] = []

  // Stage breakdown
  const stageMap: Record<string, { count: number; value: number }> = {}
  for (const d of openDeals) {
    if (!stageMap[d.stage]) stageMap[d.stage] = { count: 0, value: 0 }
    stageMap[d.stage].count++
    stageMap[d.stage].value += d.dealValue ?? 0
  }

  // Risks across open deals
  const allRisks = openDeals.flatMap(d =>
    ((d.dealRisks as string[]) ?? []).map(r => ({ risk: r, deal: d.dealName }))
  )

  // Active competitors in pipeline
  const activeCompetitors = [...new Set(openDeals.flatMap(d => (d.competitors as string[]) ?? []))]

  const fmt = (v: number) => v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const confirmationKeywords = /\b(confirmed|scheduled|booked|agreed|arranged|set up|locked in)\b/i

  const dealContexts = openDeals.slice(0, 12).map(d => {
    const structuredNotes = buildStructuredNoteCorpus({
      meetingNotes: d.meetingNotes,
      hubspotNotes: d.hubspotNotes,
      notes: typeof d.notes === 'string' ? d.notes : null,
    })
    const preferredNotes = structuredNotes || buildPreferredNoteCorpus({
      meetingNotes: d.meetingNotes,
      hubspotNotes: d.hubspotNotes,
      notes: typeof d.notes === 'string' ? d.notes : null,
    })
    const noteFocus = buildBriefingNoteFocus({
      meetingNotes: d.meetingNotes,
      hubspotNotes: d.hubspotNotes,
      notes: typeof d.notes === 'string' ? d.notes : null,
    })
    const sortedEntries = extractDatedEntries(preferredNotes)
    const lastEntry = noteFocus.latestEntries[0] ?? sortedEntries[0]
    const lastNoteDate = lastEntry?.date ? lastEntry.date.toISOString().split('T')[0] : null
    const daysSinceLastNote = lastEntry?.date ? daysSince(lastEntry.date, nowMs) : null
    const lastNoteOneLiner = lastEntry?.text ? stripDatePrefix(lastEntry.text).slice(0, 120) : null
    const contextualEntries = sortedEntries.filter(entry => nowMs - entry.date.getTime() <= NOTE_CONTEXT_WINDOW_DAYS * MS_PER_DAY)
    const currentEntries = contextualEntries.filter(entry => nowMs - entry.date.getTime() <= CURRENT_SIGNAL_WINDOW_DAYS * MS_PER_DAY)
    const noteEvidence = (currentEntries.length > 0 ? currentEntries : contextualEntries).slice(0, 3)
    const outstandingNoteSummary = noteFocus.outstandingEntries[0]
      ? stripDatePrefix(noteFocus.outstandingEntries[0].text).slice(0, 120)
      : null
    const legacyContext = preferredNotes && noteEvidence.length === 0 ? preferredNotes.slice(-240) : null
    const dealRisks = (d.dealRisks as string[]) ?? []
    const scheduledEvents = (d.scheduledEvents as ScheduledEvent[] | null) ?? []
    const upcomingEvents = scheduledEvents
      .filter(event => {
        const eventDate = safeDate(event.date)
        return eventDate !== null && eventDate.getTime() >= nowMs - 7 * MS_PER_DAY
      })
      .slice(0, 5)
    const recentConfirmationNotes = noteEvidence
      .slice(0, 5)
      .map(entry => {
        const dateLabel = entry.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        const sentence = stripDatePrefix(entry.text).split(/[.\n]/)[0].trim()
        return `${dateLabel}: ${sentence}`
      })
      .filter(sentence => confirmationKeywords.test(sentence))
      .slice(0, 3)
    const primaryFutureEvent = upcomingEvents[0]
    const primaryFutureEventText = primaryFutureEvent
      ? `${primaryFutureEvent.description ?? 'Upcoming meeting'} on ${safeDate(primaryFutureEvent.date)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) ?? primaryFutureEvent.date}`
      : null

    dealSignalMeta.push({
      dealId: d.id,
      dealName: d.dealName,
      company: d.prospectCompany ?? '',
      stage: d.stage,
      dealValue: d.dealValue ?? 0,
      conversionScore: d.conversionScore ?? null,
      closeDate: safeDate(d.closeDate)?.toISOString() ?? null,
      lastNoteAt: lastEntry?.date?.toISOString() ?? null,
      daysSinceLastNote,
      lastNoteSummary: lastNoteOneLiner,
      outstandingNoteSummary,
      topRisk: dealRisks[0] ?? null,
      futureEventText: primaryFutureEventText,
      futureEventAt: safeDate(primaryFutureEvent?.date)?.toISOString() ?? null,
      scoreShift: recentScoreShift(brainDealMap.get(d.id)?.scoreHistory, nowMs),
    })

    const parts = [
      `- "${d.dealName}" @ ${d.prospectCompany} | Stage: ${sl(d.stage)} | Value: ${fmt(d.dealValue ?? 0)} | Score: ${d.conversionScore ?? 'N/A'} | Close: ${safeDate(d.closeDate)?.toLocaleDateString('en-GB') ?? 'TBD'} | Competitors: ${((d.competitors as string[]) ?? []).join(', ') || 'none'}`,
      dealRisks[0] ? `  Primary blocker: ${dealRisks[0]}` : null,
      daysSinceLastNote != null ? `  Days since last note: ${daysSinceLastNote}` : null,
      lastNoteDate && lastNoteOneLiner ? `  Latest note (${lastNoteDate}): "${lastNoteOneLiner}"` : null,
      daysSinceLastNote != null && daysSinceLastNote > CURRENT_SIGNAL_WINDOW_DAYS
        ? `  NOTE RECENCY WARNING: latest dated note is ${daysSinceLastNote} days old — treat older notes as history, not current momentum.`
        : null,
      d.nextSteps ? `  Latest stated next step: ${d.nextSteps}` : null,
      upcomingEvents.length > 0
        ? `  CONFIRMED EVENTS (already booked — do NOT re-suggest):\n${upcomingEvents.map(event => `    - ${event.description ?? 'event'}${event.date ? ` — ${event.date}` : ''}${event.time ? ` ${event.time}` : ''}`).join('\n')}`
        : null,
      recentConfirmationNotes.length > 0
        ? `  CONFIRMED IN NOTES (already done — do NOT re-suggest):\n${recentConfirmationNotes.map(note => `    - "${note}"`).join('\n')}`
        : null,
      noteEvidence.length > 0
        ? `  DATED NOTE EVIDENCE (relative words like "tomorrow" or "next week" refer to the note date, not today):\n${noteEvidence.map(note => `    - ${formatDatedNote(note, nowMs)}`).join('\n')}`
        : null,
      legacyContext
        ? `  LEGACY CONTEXT (undated — use cautiously and never as current momentum): ${legacyContext}`
        : null,
    ]

    return parts.filter(Boolean).join('\n')
  })

  const contextStr = [
    `Company: ${companyRows[0]?.companyName ?? 'Unknown'}`,
    `Date: ${today}`,
    '',
    'PIPELINE SUMMARY:',
    `- Open deals: ${openDeals.length} worth ${fmt(totalPipelineValue)} total pipeline value`,
    `- Win rate: ${winRate}% (${wonDeals.length} won, ${lostDeals.length} lost)`,
    `- Known competitors: ${comps.map(c => c.name).join(', ') || 'none'}`,
    '',
    'STAGE BREAKDOWN:',
    ...Object.entries(stageMap).map(([stage, { count, value }]) =>
      `- ${sl(stage)}: ${count} deal${count > 1 ? 's' : ''} (${fmt(value)})`
    ),
    '',
    'OPEN DEALS (top 12) — use note evidence as the source of truth:',
    ...dealContexts,
    '',
    'ACTIVE RISKS:',
    ...(allRisks.length > 0
      ? allRisks.slice(0, 6).map(r => `- [${r.deal}] ${r.risk}`)
      : ['- No risks flagged']),
    '',
    'COMPETITORS IN ACTIVE DEALS:',
    activeCompetitors.join(', ') || 'None',
  ].join('\n')

  const brainContext = buildNoteCentricBrainContext(brain, openDeals)
  const freshMomentum = deriveFreshMomentum(dealSignalMeta)

  // --- Deterministic: topAttentionDeals ---
  const predictions = brain?.mlPredictions ?? []
  type AttentionDeal = { dealId: string; dealName: string; company: string; reason: string; urgency: 'high' | 'medium'; _sortKey: number }
  const attentionDeals: AttentionDeal[] = dealSignalMeta
    .map(meta => {
      const prediction = predictions.find(item => item.dealId === meta.dealId)
      const closeDateMs = safeDate(meta.closeDate)?.getTime() ?? null
      const daysToClose = closeDateMs != null ? Math.round((closeDateMs - nowMs) / MS_PER_DAY) : null
      const stageName = sl(meta.stage)
      const valueBoost = Math.min(meta.dealValue / 12_500, 18)
      const lastNoteSnippet = meta.lastNoteSummary
        ? `${meta.lastNoteSummary.slice(0, 88)}${meta.lastNoteSummary.length > 88 ? '…' : ''}`
        : null

      let reason: string | null = null
      let urgency: 'high' | 'medium' = 'medium'
      let sortKey = 0

      if (meta.outstandingNoteSummary && meta.lastNoteSummary) {
        reason = `Outstanding from notes: ${meta.outstandingNoteSummary}${meta.daysSinceLastNote != null ? ` · latest note ${meta.daysSinceLastNote}d ago` : ''}`
        urgency = meta.daysSinceLastNote != null && meta.daysSinceLastNote >= 10 ? 'high' : 'medium'
        sortKey = 145 + valueBoost + Math.max(0, 10 - (meta.daysSinceLastNote ?? 0))
      } else if (meta.topRisk && meta.daysSinceLastNote != null && meta.daysSinceLastNote <= 14 && lastNoteSnippet) {
        reason = `${sentenceCase(meta.topRisk)} Latest dated note was ${meta.daysSinceLastNote}d ago: ${lastNoteSnippet}`
        urgency = meta.daysSinceLastNote <= 7 ? 'high' : 'medium'
        sortKey = 140 + Math.max(0, 14 - meta.daysSinceLastNote) + valueBoost
      } else if (meta.scoreShift && meta.scoreShift.delta < 0 && meta.daysSinceLastNote != null && meta.daysSinceLastNote <= 10) {
        reason = `Score dropped ${Math.abs(meta.scoreShift.delta)}pts (${meta.scoreShift.from}→${meta.scoreShift.to}) over ${meta.scoreShift.days}d in ${stageName}${lastNoteSnippet ? ` — ${lastNoteSnippet}` : ''}`
        urgency = Math.abs(meta.scoreShift.delta) >= 14 ? 'high' : 'medium'
        sortKey = 130 + Math.abs(meta.scoreShift.delta) + valueBoost
      } else if (daysToClose != null && daysToClose <= 14 && meta.daysSinceLastNote != null) {
        reason = `Close date in ${daysToClose}d, but latest dated note is ${meta.daysSinceLastNote}d old${lastNoteSnippet ? ` — ${lastNoteSnippet}` : ''}`
        urgency = daysToClose <= 7 || meta.daysSinceLastNote >= 14 ? 'high' : 'medium'
        sortKey = 120 + Math.max(0, 14 - daysToClose) + Math.max(0, meta.daysSinceLastNote - 6) + valueBoost
      } else if (meta.daysSinceLastNote != null && meta.daysSinceLastNote >= 14 && lastNoteSnippet) {
        reason = `No fresh dated note for ${meta.daysSinceLastNote}d. Last recorded context: ${lastNoteSnippet}`
        urgency = meta.daysSinceLastNote >= 21 ? 'high' : 'medium'
        sortKey = 110 + meta.daysSinceLastNote + valueBoost
      } else if (meta.futureEventText && meta.topRisk) {
        reason = `Before ${meta.futureEventText.toLowerCase()}, resolve ${meta.topRisk.toLowerCase()}`
        urgency = 'medium'
        sortKey = 105 + valueBoost
      } else if (meta.topRisk && lastNoteSnippet) {
        reason = `${sentenceCase(meta.topRisk)}${meta.daysSinceLastNote != null ? ` Latest evidence ${meta.daysSinceLastNote}d ago` : ''}${lastNoteSnippet ? `: ${lastNoteSnippet}` : ''}`
        urgency = 'medium'
        sortKey = 95 + valueBoost
      } else if ((prediction?.churnRisk ?? 0) >= 70 && lastNoteSnippet) {
        reason = `${prediction?.churnRisk}% churn risk with no stronger fresh signal. Latest dated note: ${lastNoteSnippet}`
        urgency = 'medium'
        sortKey = 85 + ((prediction?.churnRisk ?? 0) / 5)
      }

      if (!reason) return null

      return {
        dealId: meta.dealId,
        dealName: meta.dealName,
        company: meta.company,
        reason,
        urgency,
        _sortKey: sortKey,
      }
    })
    .flatMap(item => (item ? [item] : []))
  attentionDeals.sort((a, b) => b._sortKey - a._sortKey)
  const topAttentionDeals = attentionDeals.slice(0, 5).map(item => ({
    dealId: item.dealId,
    dealName: item.dealName,
    company: item.company,
    reason: item.reason,
    urgency: item.urgency,
  }))

  // --- Deterministic: briefingHealth ---
  const allPreds = predictions
  const hasRed = openDeals.some(d => {
    const pred = allPreds.find(p => p.dealId === d.id)
    return (pred?.churnRisk ?? 0) >= 80 || (d.conversionScore ?? 100) <= 15
  })
  const hasAmber = openDeals.some(d => {
    const pred = allPreds.find(p => p.dealId === d.id)
    return (pred?.churnRisk ?? 0) >= 50 || (d.conversionScore ?? 100) <= 30
  })
  const briefingHealth: 'green' | 'amber' | 'red' = hasRed ? 'red' : hasAmber ? 'amber' : 'green'

  // ── focusBullets: ML-computed inputs → Haiku formatting only (max 150 tokens) ──
  // Pre-computed TypeScript inputs are passed; Haiku only reformats into short bullets.
  let focusBullets: string[] = []
  try {
    if (topAttentionDeals.length > 0) {
      const dealLines = topAttentionDeals
        .map(d => `- ${d.dealName} (${d.company}) [${d.urgency}]: ${d.reason}`)
        .join('\n')

      const focusMsg = await anthropic.messages.create({
        model: 'gpt-5.4-mini',
        max_tokens: 150,
        system: 'Convert these pre-analysed deal alerts into ≤4 action bullets. Each bullet: ≤12 words, starts with an action verb, is specific. Respond with a plain list (one bullet per line, no numbers, no dash prefix). No preamble.',
        messages: [{ role: 'user', content: dealLines }],
      })

      const raw = (focusMsg.content[0] as { type: string; text: string }).text.trim()
      focusBullets = raw
        .split('\n')
        .map(l => l.replace(/^[-•*]\s*/, '').trim())
        .filter(l => l.length > 0)
        .slice(0, 4)
    } else if (openDeals.length > 0) {
      focusBullets = ['Pipeline looks healthy — stay close to the latest note signal.']
    }
  } catch {
    // non-fatal: fallback to topAttentionDeals reason strings
    focusBullets = topAttentionDeals.slice(0, 4).map(d =>
      `Review ${d.dealName} — ${d.reason.slice(0, 60)}`.replace(/\s+/g, ' ').trim()
    )
  }

  // ── Try AI generation — gracefully degrade if Claude API fails or returns non-JSON ──
  let aiParsed: Record<string, unknown> | null = null
  try {
    const msg = await anthropic.messages.create({
      model: 'gpt-5.4-mini',
      max_tokens: 1500,
      system: `You are a senior sales strategist reviewing a sales team's pipeline. Analyse the data and respond with ONLY a JSON object — no markdown, no explanation — with these exact keys:
- "summary": string — 2–3 sentences summarising pipeline health and outlook, using specific numbers (deals, values, win rate). Be direct and honest.
- "keyActions": string[] — exactly 3–5 specific, actionable items the rep should do TODAY. Each must start with a verb and be under 15 words. Prioritise by urgency/value. CRITICAL: Each action must reference at least ONE specific signal from the deal data — a named deal, a person, a specific objection, a day count, a competitor, or a missing qualifier. DO NOT use generic phrases like "check in on progress", "ensure next steps are clear", or "follow up with prospects". BAD: "Follow up on stalled deals". GOOD: "Push RELX for budget confirmation — 14d to close date, still in Proposal".

CRITICAL: Every action MUST be unique. If two deals have similar scores, their actions must STILL differ because their context differs. Reference the specific last meeting, specific risk, specific person, or specific next step for each deal.

STALE ACTION DETECTION — CRITICAL:
Before suggesting ANY action for a deal, CHECK ALL of the following:

1. NOTES: Treat recent meeting notes and uploaded notes as the source of truth. If a note mentions something is "confirmed", "scheduled", "booked", "done", "completed", "already arranged", or "set up" — that action is DONE. Do not suggest it.

2. SCHEDULED EVENTS: If the deal has scheduled events, those meetings are CONFIRMED. Do not suggest "confirm" or "schedule" anything that's already in the events list.

3. DATE CHECK: Today is ${today}. Do not suggest actions for past dates. "Confirm Monday 23 March call" on March 25 is stale.

4. DO NOT use todos, project plans, or success criteria as evidence. Ground every action in notes, risks, competitors, stage movement, scheduled events, and explicit next steps captured in the deal record.

BANNED PATTERNS:
- "Confirm [event that's already in notes/events]"
- "Schedule [meeting that's already booked]"
- "Follow up on [thing that was just discussed yesterday]"
- "Define the final step" / "Keep momentum" / "Push for close" (generic filler)
- "Confirm the next concrete step"

Each action must be the GENUINE NEXT STEP that hasn't been started. Reference specific people, dates, and deliverables.

BAD: "Confirm BOE QA call for Monday" (already in notes as confirmed)
GOOD: "Prepare QA test scenarios for the BOE Monday call — ensure the floor plan data covers all 3 buildings Phil mentioned."
- "pipelineHealth": string — a short phrase rating overall health (e.g. "Strong — 3 deals in late stage", "Caution — pipeline stagnating", "Healthy — £120k in negotiation").
- "momentum": string | null — one short positive signal or win to note, or null if there is none. If a deal's score improved, include the delta and before/after: e.g. "BOE +18pts (74→92%) — POC trial started". Never use vague phrases like "Engagement strengthening"; cite the specific event.
- Only treat note evidence from the last ${CURRENT_SIGNAL_WINDOW_DAYS} days as current momentum. Older notes are historical context only.
- Never interpret "tomorrow", "next week", or weekday references in notes as relative to today unless an absolute future scheduled event confirms them.
- "topRisk": string | null — the single biggest risk or blocker across the pipeline, or null if pipeline is empty or risk-free.
- "singleMostImportantAction": string — one sentence describing the single most impactful action the rep should take today, chosen from the full context. Must be specific, start with a verb, reference a specific deal or person, and be under 20 words.`,
      messages: [{ role: 'user', content: `Pipeline data for ${today}:\n\n${contextStr}${brainContext}` }],
    })
    const rawText = (msg.content[0] as { type: string; text: string }).text.trim()
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    aiParsed = JSON.parse(cleaned)
  } catch (aiErr) {
    console.error('[ai-overview] AI generation failed — returning deterministic fallback:', aiErr)
  }

  // ── Deterministic fallback if AI layer failed ──────────────────────────────
  const parsed: Record<string, unknown> = aiParsed ?? {
    summary: `${openDeals.length} open deal${openDeals.length !== 1 ? 's' : ''} worth ${fmt(totalPipelineValue)} total pipeline value. Win rate: ${winRate}% (${wonDeals.length} won, ${lostDeals.length} lost). AI briefing temporarily unavailable — check back shortly.`,
    keyActions: topAttentionDeals.slice(0, 3).map(d => `Review ${d.dealName} — ${d.reason.slice(0, 80)}`),
    pipelineHealth: openDeals.length > 5 ? `Active — ${openDeals.length} deals in pipeline` : openDeals.length > 0 ? `${openDeals.length} deal${openDeals.length !== 1 ? 's' : ''} in pipeline` : 'No active deals',
    momentum: null,
    topRisk: allRisks.length > 0 ? `${allRisks[0].deal}: ${allRisks[0].risk}` : null,
    singleMostImportantAction: topAttentionDeals[0] ? `Review ${topAttentionDeals[0].dealName} — ${topAttentionDeals[0].reason.slice(0, 80)}` : 'Review your pipeline and update deal statuses.',
  }

  // ── Action deduplication: filter out suggestions already reflected in notes or booked events ──
  const existingActionTexts: string[] = []
  // Build a map of deal name → scheduled event descriptions for stale-confirm detection
  const dealScheduledDescriptions: { dealName: string; description: string }[] = []
  // Collect confirmation phrases from recent notes
  const confirmedNoteTexts: string[] = []
  const confirmKw = /\b(confirmed|scheduled|booked|agreed|arranged|set up|locked in)\b/i

  for (const d of openDeals) {
    if (typeof d.nextSteps === 'string' && d.nextSteps.trim().length > 0) {
      existingActionTexts.push(d.nextSteps.trim())
    }
    // Collect scheduled events per deal
    const events = (d.scheduledEvents as ScheduledEvent[] | null) ?? []
    for (const ev of events) {
      if (ev.description) {
        dealScheduledDescriptions.push({ dealName: d.dealName, description: ev.description })
      }
    }
    // Collect confirmation notes from meeting notes
    const preferredNotes = buildPreferredNoteCorpus({
      meetingNotes: d.meetingNotes,
      hubspotNotes: d.hubspotNotes,
      notes: typeof d.notes === 'string' ? d.notes : null,
    })
    const sortedNotes = extractDatedEntries(preferredNotes)
    for (const entry of sortedNotes.slice(0, 5)) {
      const firstSentence = stripDatePrefix(entry.text).split(/[.\n]/)[0].trim()
      if (confirmKw.test(firstSentence)) {
        confirmedNoteTexts.push(`${d.dealName}: ${firstSentence}`)
      }
    }
  }

  const normaliseWords = (s: string): Set<string> => {
    const words = s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)
    return new Set(words)
  }

  const existingWordSets = existingActionTexts.map(normaliseWords)

  // Check if an action is suggesting to "confirm" or "schedule" something that's already a scheduled event
  const isStaleConfirmAction = (action: string): boolean => {
    const lower = action.toLowerCase()
    const isConfirmAction = /\b(confirm|schedule|book|arrange|set up|lock in)\b/.test(lower)
    if (!isConfirmAction) return false

    // Check against scheduled events
    for (const { dealName, description } of dealScheduledDescriptions) {
      const dealNameLower = dealName.toLowerCase()
      const descLower = description.toLowerCase()
      // If the action mentions the deal name and the event description overlaps
      if (lower.includes(dealNameLower) || lower.includes(descLower.slice(0, 20))) {
        const descWords = normaliseWords(description)
        const actionWords = normaliseWords(action)
        let overlap = 0
        for (const w of descWords) {
          if (actionWords.has(w)) overlap++
        }
        if (descWords.size > 0 && overlap / descWords.size > 0.4) return true
      }
    }

    // Check against confirmation notes
    for (const noteText of confirmedNoteTexts) {
      const noteWords = normaliseWords(noteText)
      const actionWords = normaliseWords(action)
      let overlap = 0
      for (const w of noteWords) {
        if (actionWords.has(w)) overlap++
      }
      if (noteWords.size > 0 && overlap / noteWords.size > 0.4) return true
    }

    return false
  }

  // CHANGE 3: Date-based filtering — filter out actions referencing past dates
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)

  const referencesPastDate = (action: string): boolean => {
    const dateMatch = action.match(/(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)/i)
    if (dateMatch) {
      const mentionedDate = new Date(`${dateMatch[2]} ${dateMatch[1]}, ${todayDate.getFullYear()}`)
      if (!isNaN(mentionedDate.getTime()) && mentionedDate < todayDate) {
        return true
      }
    }
    return false
  }

  const isDuplicate = (action: string): boolean => {
    // Filter out actions referencing past dates
    if (referencesPastDate(action)) return true

    // First check stale confirm/schedule actions against scheduled events & notes
    if (isStaleConfirmAction(action)) return true

    const actionWords = normaliseWords(action)
    if (actionWords.size === 0) return false
    for (const existingWords of existingWordSets) {
      if (existingWords.size === 0) continue
      let overlap = 0
      for (const w of actionWords) {
        if (existingWords.has(w)) overlap++
      }
      // If >60% of the existing action's words appear in the suggested action, it's a duplicate
      const overlapRatio = overlap / Math.min(actionWords.size, existingWords.size)
      if (overlapRatio > 0.6) return true
    }
    return false
  }

  const rawActions: string[] = Array.isArray(parsed.keyActions) ? parsed.keyActions.map(String) : []
  const dedupedActions = rawActions.filter(a => !isDuplicate(a))
  const rawSingleAction = String(parsed.singleMostImportantAction ?? '')
  const singleMostImportantAction =
    rawSingleAction && !isDuplicate(rawSingleAction)
      ? rawSingleAction
      : topAttentionDeals[0]
        ? `Review ${topAttentionDeals[0].dealName} — ${topAttentionDeals[0].reason.slice(0, 90)}`
        : 'Review your pipeline and update deal statuses.'

  return {
    version: OVERVIEW_VERSION,
    summary: String(parsed.summary ?? ''),
    keyActions: dedupedActions,
    focusBullets,
    pipelineHealth: String(parsed.pipelineHealth ?? ''),
    momentum: freshMomentum,
    topRisk: parsed.topRisk ? String(parsed.topRisk) : null,
    generatedAt: new Date().toISOString(),
    briefingHealth,
    topAttentionDeals,
    singleMostImportantAction,
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    // Return cached overview only — generation happens via POST (refresh button)
    const rows = await db.execute<{
      ai_overview: AIOverview | null
      ai_overview_generated_at: Date | null
    }>(sql`SELECT ai_overview, ai_overview_generated_at FROM workspaces WHERE id = ${workspaceId} LIMIT 1`)

    const row = rows[0]
    if (row?.ai_overview?.version === OVERVIEW_VERSION) {
      return NextResponse.json({ data: row.ai_overview, cached: true })
    }

    return NextResponse.json({ data: null, cached: false })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(userId, 'ai-overview', 3)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    const { workspaceId } = await getWorkspaceContext(userId)

    // Check if cached briefing is less than 4 hours old — skip regeneration
    const cachedRows = await db.execute<{ ai_overview: AIOverview | null; ai_overview_generated_at: Date | null }>(
      sql`SELECT ai_overview, ai_overview_generated_at FROM workspaces WHERE id = ${workspaceId} LIMIT 1`
    )
    const cached = cachedRows[0]
    if (cached?.ai_overview?.version === OVERVIEW_VERSION && cached?.ai_overview_generated_at) {
      const genDate = safeDate(cached.ai_overview_generated_at)
      const ageMs = genDate ? Date.now() - genDate.getTime() : Infinity
      if (ageMs < 4 * 60 * 60 * 1000) {
        return NextResponse.json({ data: cached.ai_overview, cached: true })
      }
    }

    let overview: AIOverview
    try {
      overview = await generateOverview(workspaceId)
    } catch (genErr) {
      console.error('[ai-overview] generateOverview crashed — returning fallback:', genErr)
      // Never return 500 — build a real fallback from DB deal counts
      try {
        const fallbackDeals = await db
          .select({ stage: dealLogs.stage, dealValue: dealLogs.dealValue })
          .from(dealLogs)
          .where(eq(dealLogs.workspaceId, workspaceId))
        const open = fallbackDeals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
        const won  = fallbackDeals.filter(d => d.stage === 'closed_won')
        const lost = fallbackDeals.filter(d => d.stage === 'closed_lost')
        const totalValue = open.reduce((s, d) => s + (d.dealValue ?? 0), 0)
        const fmtFb = (v: number) => v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`
        const closedCount = won.length + lost.length
        const winRate = closedCount > 0 ? Math.round((won.length / closedCount) * 100) : 0
        overview = {
          version: OVERVIEW_VERSION,
          summary: `${open.length} open deal${open.length !== 1 ? 's' : ''} worth ${fmtFb(totalValue)} in pipeline. Win rate: ${winRate}%. AI briefing temporarily unavailable — refresh to retry.`,
          keyActions: [],
          focusBullets: [],
          pipelineHealth: open.length > 0 ? `${open.length} active deal${open.length !== 1 ? 's' : ''}` : 'No active deals',
          momentum: null,
          topRisk: null,
          generatedAt: new Date().toISOString(),
          briefingHealth: 'amber',
          topAttentionDeals: [],
          singleMostImportantAction: open.length > 0
            ? `Review your ${open.length} open deal${open.length !== 1 ? 's' : ''} and update statuses.`
            : 'Add new deals to your pipeline.',
        }
      } catch {
        // Absolute last-resort — no DB access, no date calculations
        overview = {
          version: OVERVIEW_VERSION,
          summary: 'AI briefing temporarily unavailable. Refresh to retry.',
          keyActions: [],
          focusBullets: [],
          pipelineHealth: 'Unknown',
          momentum: null,
          topRisk: null,
          generatedAt: new Date().toISOString(),
          briefingHealth: 'amber',
          topAttentionDeals: [],
          singleMostImportantAction: 'Review your pipeline manually.',
        }
      }
    }

    await db.execute(sql`
      UPDATE workspaces
      SET ai_overview = ${JSON.stringify(overview)}::jsonb,
          ai_overview_generated_at = NOW()
      WHERE id = ${workspaceId}
    `)

    return NextResponse.json({ data: overview, cached: false })
  } catch (err) {
    return dbErrResponse(err)
  }
}
