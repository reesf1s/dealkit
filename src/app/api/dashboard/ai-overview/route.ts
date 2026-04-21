import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, workspaces, companyProfiles, competitors } from '@/lib/db/schema'
import { dbErrResponse, ensureLinksColumn } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { anthropic } from '@/lib/ai/client'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getWorkspaceBrain, formatBrainContext } from '@/lib/workspace-brain'
import { parseMeetingEntries } from '@/lib/text-signals'

type PipelineConfig = {
  stages?: Array<{ id: string; label: string }>
}

type ScheduledEvent = {
  date?: string | null
  description?: string
  time?: string | null
}

type IntentSignals = {
  budgetStatus?: string | null
  championStatus?: string | null
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
    const allNotes = [d.meetingNotes, d.hubspotNotes, typeof d.notes === 'string' ? d.notes : null]
      .filter(Boolean)
      .join('\n---\n')
    const entries = parseMeetingEntries(allNotes)
    const sortedEntries = entries
      .filter(e => e.date && !isNaN(e.date.getTime()))
      .sort((a, b) => (b.date!.getTime() - a.date!.getTime()))
    const lastEntry = sortedEntries[0]
    const lastNoteDate = lastEntry?.date ? lastEntry.date.toISOString().split('T')[0] : null
    const daysSinceLastNote = lastEntry?.date
      ? Math.round((Date.now() - lastEntry.date.getTime()) / 86400000)
      : null
    const lastNoteOneLiner = lastEntry?.text
      ? lastEntry.text.replace(/\[?\d{4}[-/]\d{1,2}[-/]\d{1,2}\]?\s*/, '').trim().slice(0, 120)
      : null
    const recentNotes = sortedEntries.slice(0, 3).map(entry => {
      const dateStr = entry.date
        ? entry.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : '?'
      const summary = entry.text.replace(/\[?\d{4}[-/]\d{1,2}[-/]\d{1,2}\]?\s*/, '').trim().slice(0, 140)
      return `${dateStr}: ${summary}`
    })
    const uploadedNotes = typeof d.notes === 'string' && d.notes.trim().length > 0
      ? d.notes.trim().slice(-600)
      : null
    const dealRisks = (d.dealRisks as string[]) ?? []
    const scheduledEvents = (d.scheduledEvents as ScheduledEvent[] | null) ?? []
    const upcomingEvents = scheduledEvents
      .filter(event => {
        const eventDate = safeDate(event.date)
        return eventDate !== null && eventDate.getTime() >= Date.now() - 7 * 86400000
      })
      .slice(0, 5)
    const recentConfirmationNotes = sortedEntries
      .slice(0, 5)
      .map(entry => entry.text.replace(/\[?\d{4}[-/]\d{1,2}[-/]\d{1,2}\]?\s*/, '').trim().split(/[.\n]/)[0].trim())
      .filter(sentence => confirmationKeywords.test(sentence))
      .slice(0, 3)

    const parts = [
      `- "${d.dealName}" @ ${d.prospectCompany} | Stage: ${sl(d.stage)} | Value: ${fmt(d.dealValue ?? 0)} | Score: ${d.conversionScore ?? 'N/A'} | Close: ${safeDate(d.closeDate)?.toLocaleDateString('en-GB') ?? 'TBD'} | Competitors: ${((d.competitors as string[]) ?? []).join(', ') || 'none'}`,
      dealRisks[0] ? `  Primary blocker: ${dealRisks[0]}` : null,
      daysSinceLastNote != null ? `  Days since last note: ${daysSinceLastNote}` : null,
      lastNoteDate && lastNoteOneLiner ? `  Latest note (${lastNoteDate}): "${lastNoteOneLiner}"` : null,
      d.nextSteps ? `  Latest stated next step: ${d.nextSteps}` : null,
      upcomingEvents.length > 0
        ? `  CONFIRMED EVENTS (already booked — do NOT re-suggest):\n${upcomingEvents.map(event => `    - ${event.description ?? 'event'}${event.date ? ` — ${event.date}` : ''}${event.time ? ` ${event.time}` : ''}`).join('\n')}`
        : null,
      recentConfirmationNotes.length > 0
        ? `  CONFIRMED IN NOTES (already done — do NOT re-suggest):\n${recentConfirmationNotes.map(note => `    - "${note}"`).join('\n')}`
        : null,
      recentNotes.length > 0
        ? `  Recent note evidence:\n${recentNotes.map(note => `    - ${note}`).join('\n')}`
        : null,
      uploadedNotes ? `  Uploaded notes:\n    ${uploadedNotes}` : null,
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

  // Enrich context with workspace brain if available (includes per-deal summaries + risks from analyze-notes)
  const brain = await getWorkspaceBrain(workspaceId)
  let brainContext = ''
  if (brain) {
    try {
      const baseBrainCtx = formatBrainContext(brain, Object.keys(stageLabels).length > 0 ? stageLabels : undefined)

      // Churn risk alerts — deals overdue for follow-up
      const churnAlerts = (brain.mlPredictions ?? [])
        .filter(p => (p.churnRisk ?? 0) >= 65)
        .sort((a, b) => (b.churnRisk ?? 0) - (a.churnRisk ?? 0))
        .slice(0, 5)
      const churnCtx = churnAlerts.length > 0
        ? `\nCHURN RISK ALERTS:\n${churnAlerts.map(p => {
            const deal = openDeals.find(d => d.id === p.dealId)
            return `- ${deal?.dealName ?? p.dealId}: ${p.churnRisk}% churn risk${p.churnDaysOverdue ? ` (${p.churnDaysOverdue}d overdue)` : ''}`
          }).join('\n')}`
        : ''

      // Product gap win rate deltas
      const gapDeltas = (brain.productGapPriority ?? [])
        .filter(g => typeof g.winRateDelta === 'number' && g.winRateDelta <= -10)
        .slice(0, 3)
      const gapCtx = gapDeltas.length > 0
        ? `\nPRODUCT GAPS HURTING WIN RATE:\n${gapDeltas.map(g =>
            `- "${g.title}": ${g.winRateWithGap}% win rate with gap vs ${g.winRateWithoutGap}% without (▼${Math.abs(g.winRateDelta!)}pts impact)`
          ).join('\n')}`
        : ''

      brainContext = `\n\nDEAL INTELLIGENCE (from meeting analysis):\n${baseBrainCtx}${churnCtx}${gapCtx}`
    }
    catch { /* non-fatal: stale/corrupt brain snapshot */ }
  }

  // --- Deterministic: topAttentionDeals ---
  const predictions = brain?.mlPredictions ?? []
  type AttentionDeal = { dealId: string; dealName: string; company: string; reason: string; urgency: 'high' | 'medium'; _sortKey: number }
  const nowMs = Date.now()
  const attentionDeals: AttentionDeal[] = []
  for (const d of openDeals) {
    const pred = predictions.find(p => p.dealId === d.id)
    const churnRisk = pred?.churnRisk ?? 0
    const score = d.conversionScore ?? 100
    const closeDateMs = safeDate(d.closeDate)?.getTime() ?? null
    const daysToClose = closeDateMs != null ? Math.round((closeDateMs - nowMs) / 86400000) : null
    const closeSoon = daysToClose != null && daysToClose <= 14 && !['negotiation', 'closed_won', 'closed_lost'].includes(d.stage)

    if (churnRisk >= 65 || score <= 30 || closeSoon) {
      let reason: string
      let urgency: 'high' | 'medium'
      let sortKey: number

      // Build deal-specific signal fragments
      const intentSignals = d.intentSignals as IntentSignals | null
      const budgetStatus = intentSignals?.budgetStatus
      const championStatus = intentSignals?.championStatus
      const dealRisks = (d.dealRisks as string[]) ?? []
      const dealCompetitors = (d.competitors as string[]) ?? []
      const stageLabel = sl(d.stage)
      const noteEntries = parseMeetingEntries([d.meetingNotes, d.hubspotNotes, typeof d.notes === 'string' ? d.notes : null].filter(Boolean).join('\n---\n'))
      const sortedNoteEntries = noteEntries
        .filter(entry => entry.date && !isNaN(entry.date.getTime()))
        .sort((a, b) => (b.date!.getTime() - a.date!.getTime()))
      const lastNote = sortedNoteEntries[0]?.text
        ? sortedNoteEntries[0].text.replace(/^\[.*?\]\s*/, '').trim().slice(0, 80)
        : null
      const daysSinceNote = sortedNoteEntries[0]?.date
        ? Math.round((Date.now() - sortedNoteEntries[0].date!.getTime()) / 86400000)
        : null

      // Compose signal-rich reason text
      const signals: string[] = []
      if (churnRisk >= 65) {
        const overdue = pred?.churnDaysOverdue ?? 0
        signals.push(`${churnRisk}% churn risk, ${overdue}d since last contact`)
        if (budgetStatus === 'not_discussed' || !budgetStatus) signals.push('budget never confirmed')
        if (championStatus === 'none' || !championStatus) signals.push('no champion identified')
        if (dealRisks.length > 0) signals.push(dealRisks[0].slice(0, 60))
        if (dealCompetitors.length > 0) signals.push(`competing with ${dealCompetitors[0]}`)
        urgency = 'high'
        sortKey = churnRisk * 1000
      } else if (score <= 30) {
        signals.push(`score ${score}/100 in ${stageLabel}`)
        if (budgetStatus === 'not_discussed' || !budgetStatus) signals.push('budget unconfirmed')
        if (budgetStatus === 'blocked') signals.push('budget blocked')
        if (championStatus === 'none' || !championStatus) signals.push('no champion')
        if (dealCompetitors.length > 0) signals.push(`${dealCompetitors[0]} in evaluation`)
        if (dealRisks.length > 0) signals.push(dealRisks[0].slice(0, 60))
        if (daysSinceNote != null) signals.push(`${daysSinceNote}d since last note`)
        urgency = score <= 20 ? 'high' : 'medium'
        sortKey = (100 - score) * 100
      } else {
        // closeSoon
        signals.push(`close date in ${daysToClose}d, still in ${stageLabel}`)
        if (budgetStatus === 'not_discussed' || !budgetStatus) signals.push('budget not confirmed')
        if (budgetStatus === 'blocked') signals.push('budget blocked')
        if (championStatus === 'none' || !championStatus) signals.push('no champion identified')
        if (dealCompetitors.length > 0) signals.push(`${dealCompetitors[0]} competing`)
        if (daysSinceNote != null) signals.push(`${daysSinceNote}d since last note`)
        urgency = 'medium'
        sortKey = daysToClose != null ? (14 - daysToClose) * 10 : 0
      }

      // Build sentence: lead with stage + primary trigger, then supporting signals
      const signalStr = signals.slice(0, 3).join('; ')
      reason = signalStr.charAt(0).toUpperCase() + signalStr.slice(1) + '.'
      if (lastNote && reason.length < 80) {
        reason = `${reason} Last note: "${lastNote.slice(0, 60)}${lastNote.length > 60 ? '…' : ''}"`
      }

      attentionDeals.push({
        dealId: d.id,
        dealName: d.dealName,
        company: d.prospectCompany ?? '',
        reason,
        urgency,
        _sortKey: sortKey,
      })
    }
  }
  attentionDeals.sort((a, b) => b._sortKey - a._sortKey)
  const topAttentionDeals = attentionDeals.slice(0, 3).map(item => ({
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
    const allNotes = [d.meetingNotes, d.hubspotNotes, typeof d.notes === 'string' ? d.notes : null].filter(Boolean).join('\n---\n')
    const noteEntries = parseMeetingEntries(allNotes)
    const sortedNotes = noteEntries.filter(e => e.date && !isNaN(e.date.getTime())).sort((a, b) => (b.date!.getTime() - a.date!.getTime()))
    for (const entry of sortedNotes.slice(0, 5)) {
      const firstSentence = entry.text.replace(/\[?\d{4}[-/]\d{1,2}[-/]\d{1,2}\]?\s*/, '').trim().split(/[.\n]/)[0].trim()
      if (confirmKw.test(firstSentence)) {
        confirmedNoteTexts.push(`${d.dealName}: ${firstSentence}`)
      }
    }
    // Also check the raw notes field (populated by Ask AI interactions)
    const rawNotes = (d.notes || '').trim()
    if (rawNotes && confirmKw.test(rawNotes)) {
      // Extract sentences containing confirmation keywords
      const sentences = rawNotes.split(/[.\n]/).filter((s: string) => confirmKw.test(s))
      for (const s of sentences.slice(0, 3)) {
        confirmedNoteTexts.push(`${d.dealName}: ${s.trim().slice(0, 120)}`)
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

  return {
    summary: String(parsed.summary ?? ''),
    keyActions: dedupedActions,
    focusBullets,
    pipelineHealth: String(parsed.pipelineHealth ?? ''),
    momentum: parsed.momentum ? String(parsed.momentum) : null,
    topRisk: parsed.topRisk ? String(parsed.topRisk) : null,
    generatedAt: new Date().toISOString(),
    briefingHealth,
    topAttentionDeals,
    singleMostImportantAction: String(parsed.singleMostImportantAction ?? ''),
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
    if (row?.ai_overview) {
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
    if (cached?.ai_overview && cached?.ai_overview_generated_at) {
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
