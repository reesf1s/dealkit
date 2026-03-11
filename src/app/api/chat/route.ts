export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companyProfiles, competitors, caseStudies, dealLogs, productGaps, collateral, events } from '@/lib/db/schema'
import Anthropic from '@anthropic-ai/sdk'
import { getWorkspaceContext } from '@/lib/workspace'
import { generateCollateral } from '@/lib/ai/generate'
import { PLAN_LIMITS, isWithinLimit } from '@/lib/stripe/plans'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MEETING_KEYWORDS = [
  'action item', 'follow up', 'next step', 'discussed', 'agenda',
  'attendee', 'participant', 'meeting notes', 'call notes', 'recap',
  'meeting with', 'call with', 'talked to', 'spoke with',
]

function looksLikeMeetingTranscript(text: string): boolean {
  if (text.length < 250) return false
  const lower = text.toLowerCase()
  const keywordMatches = MEETING_KEYWORDS.filter(kw => lower.includes(kw)).length
  const lineCount = text.split('\n').length
  return keywordMatches >= 2 || (lineCount >= 8 && keywordMatches >= 1)
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { messages } = await req.json()
    if (!messages?.length) return NextResponse.json({ error: 'messages required' }, { status: 400 })

    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    const lastText: string = lastUserMsg?.content ?? ''

    // ── Competitor battlecard creation branch ──────────────────────────────────
    const battlecardKeywords = ['battlecard', 'battle card', 'add competitor', 'create competitor', 'new competitor']
    const looksLikeBattlecardRequest = battlecardKeywords.some(kw => lastText.toLowerCase().includes(kw))

    if (looksLikeBattlecardRequest) {
      const { workspaceId, plan } = await getWorkspaceContext(userId)

      // Check for company profile upfront — required for battlecard generation
      const [profileRow] = await db.select({ id: companyProfiles.id }).from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1)
      const hasCompanyProfile = !!profileRow

      // Extract rich competitor data via AI (names + descriptions + strengths/weaknesses)
      const extractMsg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Extract competitor information from this text. Return ONLY a JSON array of competitor objects, no markdown, no extra text.

Each object must have:
- "name": string (required)
- "description": string (what they do, 1-2 sentences)
- "strengths": string[] (up to 5 key strengths)
- "weaknesses": string[] (up to 5 key weaknesses)
- "keyFeatures": string[] (up to 5 main features)
- "notes": string (any other relevant notes)

Return [] if no competitors are clearly mentioned.

Text: ${lastText.slice(0, 6000)}`,
        }],
      })

      interface ExtractedCompetitor {
        name: string
        description?: string
        strengths?: string[]
        weaknesses?: string[]
        keyFeatures?: string[]
        notes?: string
      }

      let extracted: ExtractedCompetitor[] = []
      try {
        const raw = (extractMsg.content[0] as { type: string; text: string }).text.trim()
        const parsed = JSON.parse(raw.replace(/^```json?\n?/, '').replace(/\n?```$/, ''))
        if (Array.isArray(parsed)) extracted = parsed.filter((c: ExtractedCompetitor) => c?.name)
      } catch { extracted = [] }

      if (extracted.length === 0) {
        return NextResponse.json({ reply: "I couldn't find specific competitor names in your message. Try: _\"Create battlecards for Salesforce, HubSpot, Pipedrive\"_" })
      }

      const limits = PLAN_LIMITS[plan]
      const created: string[] = []
      const savedOnly: string[] = [] // saved competitor but no battlecard
      const failed: string[] = []

      for (const comp of extracted.slice(0, 15)) {
        const name = comp.name?.trim()
        if (!name) continue
        try {
          // Check competitor plan limit
          if (limits.competitors !== null) {
            const [{ value: currentCount }] = await db.select({ value: count() }).from(competitors).where(eq(competitors.workspaceId, workspaceId))
            if (!isWithinLimit(Number(currentCount), limits.competitors)) {
              failed.push(`${name} (competitor limit reached — upgrade your plan)`)
              continue
            }
          }

          // Create competitor record with rich extracted data
          const now = new Date()
          const [competitor] = await db.insert(competitors).values({
            workspaceId, userId, name,
            description: comp.description ?? null,
            strengths: comp.strengths ?? [],
            weaknesses: comp.weaknesses ?? [],
            keyFeatures: comp.keyFeatures ?? [],
            differentiators: [],
            notes: comp.notes ?? null,
            createdAt: now, updatedAt: now,
          }).returning()

          await db.insert(events).values({ workspaceId, userId, type: 'competitor.created', metadata: { competitorId: competitor.id, name: competitor.name, source: 'ai_chat' }, createdAt: now })

          // Skip battlecard if no company profile — competitor data is saved though
          if (!hasCompanyProfile) {
            savedOnly.push(name)
            continue
          }

          // Check collateral plan limit
          if (limits.collateral !== null) {
            const [{ value: collCount }] = await db.select({ value: count() }).from(collateral).where(eq(collateral.workspaceId, workspaceId))
            if (!isWithinLimit(Number(collCount), limits.collateral)) {
              savedOnly.push(`${name} (collateral limit reached)`)
              continue
            }
          }

          // Create collateral placeholder — generation runs after response via after()
          const colRecord = await db.insert(collateral).values({
            workspaceId, userId, type: 'battlecard', title: `Battlecard: ${name}`,
            status: 'generating', sourceCompetitorId: competitor.id,
            sourceCaseStudyId: null, sourceDealLogId: null, content: null, rawResponse: null,
            generatedAt: null, createdAt: now, updatedAt: now,
          }).returning()

          const colId = colRecord[0].id
          const competitorId = competitor.id

          // Fire generation AFTER the response is sent — avoids timeout
          after(async () => {
            try {
              const result = await generateCollateral({ workspaceId, type: 'battlecard', competitorId })
              const generatedAt = new Date()
              await db.update(collateral).set({ title: result.title, status: 'ready', content: result.content, rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt }).where(eq(collateral.id, colId))
              await db.insert(events).values({ workspaceId, userId, type: 'collateral.generated', metadata: { collateralId: colId, collateralType: 'battlecard', title: result.title }, createdAt: new Date() })
            } catch {
              await db.update(collateral).set({ status: 'stale', updatedAt: new Date() }).where(eq(collateral.id, colId))
            }
          })

          created.push(name)
        } catch {
          failed.push(name)
        }
      }

      let reply = ''
      if (created.length > 0) {
        reply += `✅ Saved ${created.length} competitor${created.length > 1 ? 's' : ''} and started generating battlecard${created.length > 1 ? 's' : ''} in the background:\n${created.map(n => `• **${n}**`).join('\n')}\n\nBattlecards will be ready in **Collateral → Battlecards** in about 1–2 minutes (generating now).`
      }
      if (savedOnly.length > 0) {
        if (!hasCompanyProfile) {
          reply += `\n\n📋 Saved ${savedOnly.length} competitor${savedOnly.length > 1 ? 's' : ''} to your Competitors section:\n${savedOnly.map(n => `• **${n}**`).join('\n')}\n\n⚠️ **Battlecards couldn't be generated yet** — you need to complete your [Company Profile](/company) first. Once done, go to **Collateral** and generate battlecards for each competitor.`
        } else {
          reply += `\n\n📋 Saved (no battlecard): ${savedOnly.join(', ')}`
        }
      }
      if (failed.length > 0) reply += `\n\n❌ Couldn't process: ${failed.join(', ')}`
      if (!reply) reply = 'No competitors were found in your message.'

      return NextResponse.json({ reply })
    }

    // ── Meeting transcript branch ──────────────────────────────────────────────
    if (looksLikeMeetingTranscript(lastText)) {
      // Load open deals for matching
      const openDeals = await db
        .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany, stage: dealLogs.stage, todos: dealLogs.todos, dealValue: dealLogs.dealValue })
        .from(dealLogs)
        .where(and(
          eq(dealLogs.workspaceId, workspaceId),
          sql`${dealLogs.stage} NOT IN ('closed_won', 'closed_lost')`,
        ))
        .limit(20)

      const dealList = openDeals.map(d => `id:${d.id} | "${d.dealName}" — ${d.prospectCompany} (${d.stage})`).join('\n')

      const analysisMsg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are analyzing B2B sales meeting notes. Extract structured updates and return ONLY valid JSON.

Meeting notes:
${lastText}

Open deals in the CRM:
${dealList || 'No open deals yet.'}

Return this exact JSON:
{
  "matchedDealId": "uuid-of-best-matching-deal-or-null",
  "matchedDealName": "name of matched deal or null",
  "summary": "2-3 sentence summary of what was discussed",
  "todos": [{"text": "specific action item"}],
  "productGaps": [{"title": "feature name", "description": "what they need", "priority": "high"}],
  "dealUpdate": {"stage": "new_stage_or_null", "dealValue": null_or_number_in_cents, "notes": "brief notes to append or null"},
  "risks": ["potential risk or blocker"]
}

Rules: matchedDealId must be one of the IDs listed above (or null). stage values: prospecting|qualification|discovery|proposal|negotiation|closed_won|closed_lost. dealValue in cents (e.g. 50000 = $500). priority: critical|high|medium|low.`,
        }],
      })

      let parsed: {
        matchedDealId: string | null
        matchedDealName: string | null
        summary: string
        todos: { text: string }[]
        productGaps: { title: string; description: string; priority: string }[]
        dealUpdate: { stage: string | null; dealValue: number | null; notes: string | null }
        risks: string[]
      } = {
        matchedDealId: null, matchedDealName: null, summary: '',
        todos: [], productGaps: [], dealUpdate: { stage: null, dealValue: null, notes: null }, risks: [],
      }

      try {
        const raw = (analysisMsg.content[0] as { type: string; text: string }).text.trim()
        parsed = JSON.parse(raw.replace(/^```json?\n?/, '').replace(/\n?```$/, ''))
      } catch { /* use defaults */ }

      const updates: string[] = []

      // Update the matched deal
      if (parsed.matchedDealId) {
        const [existingDeal] = await db.select().from(dealLogs)
          .where(and(eq(dealLogs.id, parsed.matchedDealId), eq(dealLogs.workspaceId, workspaceId)))
          .limit(1)

        if (existingDeal) {
          const newTodos = (parsed.todos ?? []).map((t: { text: string }) => ({
            id: crypto.randomUUID(), text: t.text, done: false, createdAt: new Date().toISOString(),
          }))
          const mergedTodos = [...((existingDeal.todos as unknown[]) ?? []), ...newTodos]

          const updatePayload: Record<string, unknown> = {
            todos: mergedTodos,
            meetingNotes: lastText,
            updatedAt: new Date(),
          }
          if (parsed.dealUpdate?.stage) updatePayload.stage = parsed.dealUpdate.stage
          if (parsed.dealUpdate?.dealValue) updatePayload.dealValue = parsed.dealUpdate.dealValue
          if (parsed.dealUpdate?.notes) updatePayload.notes = (existingDeal.notes ?? '') + '\n\n' + parsed.dealUpdate.notes

          await db.update(dealLogs).set(updatePayload).where(eq(dealLogs.id, parsed.matchedDealId))

          if (newTodos.length) updates.push(`Added ${newTodos.length} action item${newTodos.length > 1 ? 's' : ''} to **${existingDeal.dealName}**`)
          if (parsed.dealUpdate?.stage) updates.push(`Updated stage to **${parsed.dealUpdate.stage}**`)
          if (parsed.dealUpdate?.dealValue) updates.push(`Updated deal value to **$${(parsed.dealUpdate.dealValue / 100).toLocaleString()}**`)
        }
      }

      // Create/update product gaps
      const createdGapTitles: string[] = []
      for (const gap of (parsed.productGaps ?? [])) {
        if (!gap.title) continue
        const [existing] = await db.select().from(productGaps)
          .where(and(eq(productGaps.workspaceId, workspaceId), eq(productGaps.title, gap.title)))
          .limit(1)
        if (existing) {
          await db.update(productGaps).set({
            frequency: (existing.frequency ?? 1) + 1,
            sourceDeals: parsed.matchedDealId
              ? [...((existing.sourceDeals as string[]) ?? []), parsed.matchedDealId]
              : (existing.sourceDeals as string[]) ?? [],
            updatedAt: new Date(),
          }).where(eq(productGaps.id, existing.id))
          createdGapTitles.push(`${gap.title} (frequency +1)`)
        } else {
          await db.insert(productGaps).values({
            workspaceId, userId, title: gap.title,
            description: gap.description ?? '',
            priority: gap.priority ?? 'medium',
            frequency: 1,
            sourceDeals: parsed.matchedDealId ? [parsed.matchedDealId] : [],
            status: 'open',
            createdAt: new Date(), updatedAt: new Date(),
          })
          createdGapTitles.push(gap.title)
        }
      }
      if (createdGapTitles.length) updates.push(`Logged ${createdGapTitles.length} product gap${createdGapTitles.length > 1 ? 's' : ''}: ${createdGapTitles.join(', ')}`)

      // Build response
      const dealContext = parsed.matchedDealName ? ` for **${parsed.matchedDealName}**` : ''
      let reply = `I detected meeting notes${dealContext} and automatically updated your records.\n\n`
      reply += `**Summary:** ${parsed.summary}\n\n`
      if (updates.length) reply += `**Updates made:**\n${updates.map(u => `• ${u}`).join('\n')}\n\n`
      if (parsed.risks?.length) reply += `**Risks/blockers to watch:**\n${parsed.risks.map((r: string) => `⚠️ ${r}`).join('\n')}\n\n`
      if (!parsed.matchedDealId && openDeals.length > 0) {
        reply += `_I couldn't match these notes to a specific deal. Visit the deal page and paste notes there for a precise match._`
      } else if (!parsed.matchedDealId) {
        reply += `_No open deals found. Log a deal first, then I can link meeting notes to it._`
      }

      return NextResponse.json({ reply })
    }

    // ── Standard Q&A branch ───────────────────────────────────────────────────
    const [profileRows, competitorRows, caseStudyRows, dealRows, gapRows] = await Promise.all([
      db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1),
      db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)),
      db.select().from(caseStudies).where(eq(caseStudies.workspaceId, workspaceId)),
      db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)).limit(20),
      db.select().from(productGaps).where(eq(productGaps.workspaceId, workspaceId)).limit(20),
    ])

    const profile = profileRows[0]
    const kbParts: string[] = []
    if (profile) {
      kbParts.push(`## Company: ${profile.companyName}\nIndustry: ${profile.industry ?? 'unknown'}\nDescription: ${profile.description ?? 'none'}\nTarget market: ${profile.targetMarket ?? 'none'}\nValue props: ${(profile.valuePropositions as string[]).join(', ')}\nDifferentiators: ${(profile.differentiators as string[]).join(', ')}\nCommon objections: ${(profile.commonObjections as string[]).join('; ')}`)
    }
    if (competitorRows.length > 0) {
      kbParts.push(`## Competitors (${competitorRows.length})`)
      competitorRows.forEach(c => kbParts.push(`- ${c.name}: ${c.description ?? ''}. Strengths: ${(c.strengths as string[]).join(', ')}. Weaknesses: ${(c.weaknesses as string[]).join(', ')}. Pricing: ${c.pricing ?? 'unknown'}`))
    }
    if (caseStudyRows.length > 0) {
      kbParts.push(`## Case Studies (${caseStudyRows.length})`)
      caseStudyRows.forEach(cs => kbParts.push(`- ${cs.customerName}: Challenge: ${cs.challenge.slice(0, 100)}. Results: ${cs.results.slice(0, 100)}`))
    }
    if (dealRows.length > 0) {
      const won = dealRows.filter(d => d.stage === 'closed_won')
      const lost = dealRows.filter(d => d.stage === 'closed_lost')
      const open = dealRows.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
      kbParts.push(`## Deals — ${won.length} won, ${lost.length} lost, ${open.length} open`)
      dealRows.slice(0, 10).forEach(d => {
        const pendingTodos = ((d.todos as { done: boolean }[]) ?? []).filter(t => !t.done).length
        kbParts.push(`- ${d.prospectCompany} (${d.stage}): $${d.dealValue ? (d.dealValue / 100).toLocaleString() : '?'}. Pending todos: ${pendingTodos}. Notes: ${(d.notes ?? '').slice(0, 80)}`)
      })
    }
    if (gapRows.length > 0) {
      kbParts.push(`## Product Gaps (${gapRows.length})`)
      gapRows.forEach(g => kbParts.push(`- ${g.title} [${g.priority}/${g.status}]: ${g.description.slice(0, 80)}`))
    }

    const systemPrompt = `You are DealKit AI, an expert sales intelligence assistant. You can answer questions AND update records when users paste meeting notes. Be concise and actionable.\n\nTip: If the user pastes meeting notes or a call transcript, I will automatically detect it and update todos, product gaps, and deal records.\n\n${kbParts.join('\n\n') || 'No knowledge base data found yet. Help the user set up their profile via AI Setup.'}`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
