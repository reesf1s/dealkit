import { eq, and } from 'drizzle-orm'
import { anthropic } from './client'
import { db } from '../db'
import { companyProfiles, competitors, caseStudies, dealLogs } from '../db/schema'
import {
  BattlecardSchema,
  CaseStudyDocSchema,
  OnePagerSchema,
  ObjectionHandlerSchema,
  TalkTrackSchema,
  EmailSequenceSchema,
} from './schemas'
import {
  battlecardPrompt,
  caseStudyDocPrompt,
  onePagerPrompt,
  objectionHandlerPrompt,
  talkTrackPrompt,
  emailSequencePrompt,
} from './prompts'
import { buildWorkspaceContext } from './context'
import { getWorkspaceBrain, formatBrainContext } from '../workspace-brain'
import type { CollateralType, CollateralContent, CompanyProfile, Product, DealLog, CaseStudy } from '@/types'
import type { ZodSchema } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateCollateralInput {
  workspaceId: string
  type: CollateralType
  competitorId?: string
  caseStudyId?: string
  productName?: string
  buyerRole?: string
  customPrompt?: string
  dealContext?: string   // injected from a specific deal — risks, objections, competitor, summary
  context?: Record<string, unknown>
}

interface GenerateResult {
  content: CollateralContent
  rawResponse: unknown
  title: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function callMiniModel(
  system: string,
  messages: Array<{ role: 'user'; content: string }>,
  temperature: number,
): Promise<string> {
  const attempt = async () => {
    const message = await anthropic.messages.create({
      model: 'gpt-5.4-mini',
      max_tokens: 4096,
      temperature,
      // Pass system as a cached block so the large workspace context is reused
      // across requests within the same session (saves ~90% of system token cost).
      system: system as string,
      messages,
    })
    const block = message.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') throw new Error('No text content in model response')
    return block.text
  }

  try {
    return await attempt()
  } catch (err: unknown) {
    // Retry once on rate limit (429) after a short backoff
    const status = (err as { status?: number })?.status
    if (status === 429) {
      await new Promise(r => setTimeout(r, 8000))
      return attempt()
    }
    throw err
  }
}

function extractJson(raw: string): unknown {
  // Strip markdown code fences if present (handles partial/truncated responses too)
  let cleaned = raw.trim()
  // Remove opening fence (may have newline or space after)
  cleaned = cleaned.replace(/^```(?:json)?[\s\n]*/i, '')
  // Remove closing fence (may be absent if response was truncated)
  cleaned = cleaned.replace(/[\s\n]*```\s*$/i, '')
  cleaned = cleaned.trim()
  // If there's text before the first { or [, strip it (LLM sometimes adds preamble)
  const firstBrace = cleaned.indexOf('{')
  const firstBracket = cleaned.indexOf('[')
  const jsonStart = firstBrace >= 0 && firstBracket >= 0 ? Math.min(firstBrace, firstBracket)
    : firstBrace >= 0 ? firstBrace : firstBracket
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart)

  // If JSON is incomplete (truncated by max_tokens), try to repair by closing open braces/brackets
  try {
    return JSON.parse(cleaned)
  } catch {
    // Attempt repair: count open vs close braces and brackets
    let openBraces = 0, openBrackets = 0
    let inString = false, escaped = false
    for (const ch of cleaned) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\' && inString) { escaped = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '{') openBraces++
      if (ch === '}') openBraces--
      if (ch === '[') openBrackets++
      if (ch === ']') openBrackets--
    }
    // Close any unclosed strings, then brackets/braces
    let repaired = cleaned
    if (inString) repaired += '"'
    // Trim trailing comma
    repaired = repaired.replace(/,\s*$/, '')
    for (let i = 0; i < openBrackets; i++) repaired += ']'
    for (let i = 0; i < openBraces; i++) repaired += '}'
    return JSON.parse(repaired)
  }
}

async function generateAndValidate<T>(
  system: string,
  messages: Array<{ role: 'user'; content: string }>,
  schema: ZodSchema<T>,
  temperature: number,
): Promise<{ validated: T; raw: string }> {
  const raw = await callMiniModel(system, messages, temperature)

  let parsed: unknown
  try {
    parsed = extractJson(raw)
  } catch {
    throw new Error(`Model returned non-JSON response: ${raw.slice(0, 200)}`)
  }

  const result = schema.safeParse(parsed)

  if (result.success) {
    return { validated: result.data, raw }
  }

  // Retry once with correction prompt
  const correctionMessages: Array<{ role: 'user'; content: string }> = [
    ...messages,
    { role: 'user' as const, content: `Previous attempt had validation errors: ${result.error.message}\n\nPlease fix the JSON and return ONLY valid JSON with no additional text or markdown.` },
  ]

  const retryRaw = await callMiniModel(system, correctionMessages, temperature)

  let retryParsed: unknown
  try {
    retryParsed = extractJson(retryRaw)
  } catch {
    throw new Error(`Retry also returned non-JSON: ${retryRaw.slice(0, 200)}`)
  }

  const retryResult = schema.safeParse(retryParsed)
  if (!retryResult.success) {
    throw new Error(`Schema validation failed after retry: ${retryResult.error.message}`)
  }

  return { validated: retryResult.data, raw: retryRaw }
}

// Prepend deal context and custom instructions to the START of the user message
// so the AI reads them before any other content. This is the most reliable way to
// ensure they are incorporated — no fragile schema-position detection needed.

function withDealContext(
  messages: Array<{ role: 'user'; content: string }>,
  dealContext?: string,
  type?: CollateralType,
): Array<{ role: 'user'; content: string }> {
  if (!dealContext?.trim()) return messages
  const typeGuidance: Partial<Record<CollateralType, string>> = {
    case_study_doc: 'Frame the challenge section to directly mirror this prospect\'s active deal risks. Choose proof points that counter their evaluated competitors. Weight results toward outcomes that would unblock this specific deal stage.',
    email_sequence: 'Personalise every email to this specific prospect: use {{company_name}} as a placeholder for their company name alongside {{first_name}}. Root each email\'s pain point in the deal risks listed above. Reference their evaluated competitors where relevant. Match urgency to the deal stage.',
    battlecard: 'Make win themes and landmine questions specific to this deal\'s active risks and stage. Weight objection responses toward the competitors listed in the deal context.',
    objection_handler: 'Prioritise objections that map to this deal\'s active risks. Include targeted responses for the competitors the prospect is evaluating.',
    one_pager: 'Lead the problem statement with the prospect\'s specific pain points from the deal risks. Choose social proof that resonates with their industry and deal stage.',
    talk_track: 'Open the script referencing this prospect\'s specific situation. Name their evaluated competitors. Frame the pitch around the deal\'s active risks.',
  }
  const guidance = type ? typeGuidance[type] : undefined
  const prefix =
    `DEAL CONTEXT — tailor ALL content specifically for this live deal:\n${dealContext.trim()}` +
    (guidance ? `\n\nTailoring guidance for ${type}: ${guidance}` : '')
  const last = messages[messages.length - 1]
  return [
    ...messages.slice(0, -1),
    { ...last, content: prefix + '\n\n---\n\n' + last.content },
  ]
}

function withCustomPrompt(
  messages: Array<{ role: 'user'; content: string }>,
  customPrompt?: string,
): Array<{ role: 'user'; content: string }> {
  if (!customPrompt?.trim()) return messages
  const prefix = `SPECIFIC INSTRUCTIONS — follow these exactly, they override defaults:\n${customPrompt.trim()}`
  const last = messages[messages.length - 1]
  return [
    ...messages.slice(0, -1),
    { ...last, content: prefix + '\n\n---\n\n' + last.content },
  ]
}

function buildTitle(type: CollateralType, context: {
  competitorName?: string
  customerName?: string
  productName?: string
  buyerRole?: string
}): string {
  const { competitorName, customerName, productName, buyerRole } = context
  switch (type) {
    case 'battlecard':
      return `Battlecard: vs ${competitorName ?? 'Competitor'}`
    case 'case_study_doc':
      return `Case Study: ${customerName ?? 'Customer'}`
    case 'one_pager':
      return `One-Pager: ${productName ?? 'Product'}`
    case 'objection_handler':
      return buyerRole ? `Objection Handler — ${buyerRole}` : 'Objection Handler'
    case 'talk_track':
      return buyerRole ? `Talk Track — ${buyerRole}` : 'Talk Track'
    case 'email_sequence':
      return buyerRole ? `Email Sequence — ${buyerRole}` : 'Email Sequence'
    default:
      return 'Generated Collateral'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function generateCollateral(
  input: GenerateCollateralInput,
): Promise<GenerateResult> {
  const { workspaceId, type, competitorId, caseStudyId, productName, buyerRole, customPrompt, dealContext } = input

  // 1. Fetch company profile (required)
  const [profileRow] = await db
    .select()
    .from(companyProfiles)
    .where(eq(companyProfiles.workspaceId, workspaceId))
    .limit(1)

  if (!profileRow) {
    throw new Error('No company profile found. Please complete your company profile before generating collateral.')
  }

  const company: CompanyProfile = {
    id: profileRow.id,
    userId: profileRow.userId ?? '',
    companyName: profileRow.companyName,
    website: profileRow.website,
    industry: profileRow.industry,
    description: profileRow.description,
    products: (profileRow.products as Product[]) ?? [],
    valuePropositions: (profileRow.valuePropositions as string[]) ?? [],
    differentiators: (profileRow.differentiators as string[]) ?? [],
    commonObjections: (profileRow.commonObjections as string[]) ?? [],
    targetMarket: profileRow.targetMarket,
    competitiveAdvantage: profileRow.competitiveAdvantage,
    founded: profileRow.founded,
    employeeCount: profileRow.employeeCount,
    createdAt: profileRow.createdAt,
    updatedAt: profileRow.updatedAt,
  }

  // 2. Fetch all entity data + brain in parallel
  // Brain-first: only fall back to lightweight buildWorkspaceContext if brain is missing
  const [allDeals, allCaseStudies, brain] = await Promise.all([
    db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)),
    db.select().from(caseStudies).where(eq(caseStudies.workspaceId, workspaceId)),
    getWorkspaceBrain(workspaceId),
  ])

  let workspaceContext = ''
  if (brain) {
    try { workspaceContext = formatBrainContext(brain) }
    catch { /* non-fatal */ }
  }
  if (!workspaceContext) {
    workspaceContext = await buildWorkspaceContext(workspaceId)
  }

  // ─── BATTLECARD ─────────────────────────────────────────────────────────────
  if (type === 'battlecard') {
    if (!competitorId) throw new Error('competitorId is required for battlecard generation')

    const [competitorRow] = await db
      .select()
      .from(competitors)
      .where(and(eq(competitors.id, competitorId), eq(competitors.workspaceId, workspaceId)))
      .limit(1)

    if (!competitorRow) throw new Error('Competitor not found')

    const competitor = {
      id: competitorRow.id,
      userId: competitorRow.userId ?? '',
      name: competitorRow.name,
      website: competitorRow.website,
      description: competitorRow.description,
      strengths: (competitorRow.strengths as string[]) ?? [],
      weaknesses: (competitorRow.weaknesses as string[]) ?? [],
      pricing: competitorRow.pricing,
      targetMarket: competitorRow.targetMarket,
      keyFeatures: (competitorRow.keyFeatures as string[]) ?? [],
      differentiators: (competitorRow.differentiators as string[]) ?? [],
      notes: competitorRow.notes,
      createdAt: competitorRow.createdAt,
      updatedAt: competitorRow.updatedAt,
    }

    // Filter deals involving this competitor
    const competitorDeals = allDeals.filter((d) =>
      (d.competitors as string[]).some((c) =>
        c.toLowerCase().includes(competitor.name.toLowerCase()),
      ),
    )

    const { system, messages: bcMsgs } = battlecardPrompt(company, competitor, competitorDeals as unknown as DealLog[], allCaseStudies as unknown as CaseStudy[], workspaceContext)
    const { validated, raw } = await generateAndValidate(system, withCustomPrompt(withDealContext(bcMsgs, dealContext, type), customPrompt), BattlecardSchema, 0.4)

    return {
      content: validated as CollateralContent,
      rawResponse: raw,
      title: buildTitle(type, { competitorName: competitor.name }),
    }
  }

  // ─── CASE STUDY DOC ─────────────────────────────────────────────────────────
  if (type === 'case_study_doc') {
    if (!caseStudyId) throw new Error('caseStudyId is required for case study doc generation')

    const [csRow] = await db
      .select()
      .from(caseStudies)
      .where(and(eq(caseStudies.id, caseStudyId), eq(caseStudies.workspaceId, workspaceId)))
      .limit(1)

    if (!csRow) throw new Error('Case study not found')

    const caseStudy = {
      id: csRow.id,
      userId: csRow.userId ?? '',
      customerName: csRow.customerName,
      customerIndustry: csRow.customerIndustry,
      customerSize: csRow.customerSize,
      challenge: csRow.challenge,
      solution: csRow.solution,
      results: csRow.results,
      metrics: (csRow.metrics as Array<{ label: string; value: string; unit?: string }>) ?? [],
      generatedNarrative: csRow.generatedNarrative,
      isPublic: csRow.isPublic,
      createdAt: csRow.createdAt,
      updatedAt: csRow.updatedAt,
    }

    const { system, messages: csMsgs } = caseStudyDocPrompt(company, caseStudy as unknown as CaseStudy, workspaceContext)
    const { validated, raw } = await generateAndValidate(system, withCustomPrompt(withDealContext(csMsgs, dealContext, type), customPrompt), CaseStudyDocSchema, 0.6)

    return {
      content: validated as CollateralContent,
      rawResponse: raw,
      title: buildTitle(type, { customerName: caseStudy.customerName }),
    }
  }

  // ─── ONE-PAGER ──────────────────────────────────────────────────────────────
  if (type === 'one_pager') {
    const products = company.products ?? []
    const rawProduct = products.find((p) => p.name === productName) ?? products[0]

    // Fall back to a synthetic product built from company info if no products are defined
    const product = rawProduct
      ? {
          ...rawProduct,
          keyFeatures: (rawProduct.keyFeatures as unknown as string[] | null) ?? [],
          targetPersonas: (rawProduct.targetPersonas as unknown as string[] | null) ?? [],
        }
      : {
          id: 'fallback',
          name: company.companyName,
          description: company.description ?? `${company.companyName} — ${company.industry ?? 'software'} product`,
          keyFeatures: (company.valuePropositions ?? []).slice(0, 5),
          targetPersonas: [],
          pricingModel: null,
          pricingDetails: null,
        }

    const { system, messages: opMsgs } = onePagerPrompt(company, product, allCaseStudies as unknown as CaseStudy[], workspaceContext)
    const { validated, raw } = await generateAndValidate(system, withCustomPrompt(withDealContext(opMsgs, dealContext, type), customPrompt), OnePagerSchema, 0.6)

    return {
      content: validated as CollateralContent,
      rawResponse: raw,
      title: buildTitle(type, { productName: product.name }),
    }
  }

  // ─── OBJECTION HANDLER ──────────────────────────────────────────────────────
  if (type === 'objection_handler') {
    const { system, messages: ohMsgs } = objectionHandlerPrompt(company, allDeals as unknown as DealLog[], workspaceContext)
    const { validated, raw } = await generateAndValidate(system, withCustomPrompt(withDealContext(ohMsgs, dealContext, type), customPrompt), ObjectionHandlerSchema, 0.4)

    return {
      content: validated as CollateralContent,
      rawResponse: raw,
      title: buildTitle(type, { buyerRole }),
    }
  }

  // ─── TALK TRACK ─────────────────────────────────────────────────────────────
  if (type === 'talk_track') {
    const role = buyerRole ?? 'Decision Maker'
    const { system, messages: ttMsgs } = talkTrackPrompt(company, role, allDeals as unknown as DealLog[], workspaceContext)
    const { validated, raw } = await generateAndValidate(system, withCustomPrompt(withDealContext(ttMsgs, dealContext, type), customPrompt), TalkTrackSchema, 0.6)

    return {
      content: validated as CollateralContent,
      rawResponse: raw,
      title: buildTitle(type, { buyerRole: role }),
    }
  }

  // ─── EMAIL SEQUENCE ─────────────────────────────────────────────────────────
  if (type === 'email_sequence') {
    const persona = buyerRole ?? 'Decision Maker'
    const { system, messages: esMsgs } = emailSequencePrompt(company, persona, allCaseStudies as unknown as CaseStudy[], workspaceContext)
    const { validated, raw } = await generateAndValidate(system, withCustomPrompt(withDealContext(esMsgs, dealContext, type), customPrompt), EmailSequenceSchema, 0.6)

    return {
      content: validated as CollateralContent,
      rawResponse: raw,
      title: buildTitle(type, { buyerRole: persona }),
    }
  }

  // ─── CUSTOM (freeform) ────────────────────────────────────────────────────
  if (type === 'custom') {
    // Custom types use the freeform generator directly
    throw new Error('Use generateFreeformCollateral() for custom collateral types')
  }

  throw new Error(`Unknown collateral type: ${type}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Freeform collateral generation (for custom / dynamic types)
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateFreeformInput {
  workspaceId: string
  title: string
  description: string
  dealContext?: string
  customPrompt?: string
}

interface FreeformResult {
  title: string
  content: {
    format: 'markdown'
    title: string
    sections: { heading: string; content: string }[]
  }
  rawResponse: unknown
}

export async function generateFreeformCollateral(
  input: GenerateFreeformInput,
): Promise<FreeformResult> {
  const { workspaceId, title, description, dealContext, customPrompt } = input

  // 1. Fetch company profile
  const [profileRow] = await db
    .select()
    .from(companyProfiles)
    .where(eq(companyProfiles.workspaceId, workspaceId))
    .limit(1)

  if (!profileRow) {
    throw new Error('No company profile found. Please complete your company profile before generating collateral.')
  }

  // 2. Fetch workspace brain for grounding
  const brain = await getWorkspaceBrain(workspaceId)
  let workspaceContext = ''
  if (brain) {
    try { workspaceContext = formatBrainContext(brain) }
    catch { /* non-fatal */ }
  }
  if (!workspaceContext) {
    workspaceContext = await buildWorkspaceContext(workspaceId)
  }

  // 3. Build company summary for personalisation
  const companySummary = [
    `Company: ${profileRow.companyName}`,
    profileRow.industry ? `Industry: ${profileRow.industry}` : null,
    profileRow.description ? `Description: ${profileRow.description}` : null,
    profileRow.competitiveAdvantage ? `Competitive Advantage: ${profileRow.competitiveAdvantage}` : null,
    profileRow.targetMarket ? `Target Market: ${profileRow.targetMarket}` : null,
    (profileRow.valuePropositions as string[])?.length
      ? `Value Propositions: ${(profileRow.valuePropositions as string[]).join('; ')}`
      : null,
    (profileRow.differentiators as string[])?.length
      ? `Differentiators: ${(profileRow.differentiators as string[]).join('; ')}`
      : null,
  ].filter(Boolean).join('\n')

  // 4. Build system + user prompts
  const system = `You are a professional sales content writer. You produce polished, actionable sales documents grounded in real company data and deal intelligence.

Your output MUST be a single JSON object with this exact structure — no markdown fences, no preamble:
{
  "title": "<document title>",
  "sections": [
    { "heading": "<section heading>", "content": "<markdown content for this section>" }
  ]
}

Rules:
- Each section's "content" field should contain well-formatted markdown (headings within sections use ### or ####, bullet points, bold, etc.)
- Produce 3–8 sections depending on the document scope
- Ground every claim in the company data and workspace intelligence provided — do not fabricate metrics or customer names
- Write in a professional but conversational sales tone
- If deal context is provided, tailor the document specifically for that deal`

  let userContent = `COMPANY PROFILE:\n${companySummary}`

  if (workspaceContext) {
    userContent += `\n\nWORKSPACE INTELLIGENCE:\n${workspaceContext}`
  }

  if (dealContext?.trim()) {
    userContent += `\n\nDEAL CONTEXT:\n${dealContext.trim()}`
  }

  if (customPrompt?.trim()) {
    userContent += `\n\nADDITIONAL INSTRUCTIONS:\n${customPrompt.trim()}`
  }

  userContent += `\n\nGENERATE THE FOLLOWING DOCUMENT:\nTitle: ${title}\nDescription: ${description}\n\nReturn ONLY the JSON object.`

  const messages: Array<{ role: 'user'; content: string }> = [
    { role: 'user', content: userContent },
  ]

  // 5. Call the mini model
  const raw = await callMiniModel(system, messages, 0.5)

  // 6. Parse response
  let parsed: { title: string; sections: { heading: string; content: string }[] }
  try {
    parsed = extractJson(raw) as typeof parsed
  } catch {
    throw new Error(`Model returned non-JSON response: ${raw.slice(0, 200)}`)
  }

  if (!parsed.sections || !Array.isArray(parsed.sections)) {
    throw new Error('Response missing required "sections" array')
  }

  return {
    title: parsed.title || title,
    content: {
      format: 'markdown' as const,
      title: parsed.title || title,
      sections: parsed.sections,
    },
    rawResponse: raw,
  }
}
