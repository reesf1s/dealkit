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

async function callClaude(
  system: string,
  messages: Array<{ role: 'user'; content: string }>,
  temperature: number,
): Promise<string> {
  const attempt = async () => {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      temperature,
      system,
      messages,
    })
    const block = message.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') throw new Error('No text content in Claude response')
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
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  return JSON.parse(cleaned)
}

async function generateAndValidate<T>(
  system: string,
  messages: Array<{ role: 'user'; content: string }>,
  schema: ZodSchema<T>,
  temperature: number,
): Promise<{ validated: T; raw: string }> {
  const raw = await callClaude(system, messages, temperature)

  let parsed: unknown
  try {
    parsed = extractJson(raw)
  } catch {
    throw new Error(`Claude returned non-JSON response: ${raw.slice(0, 200)}`)
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

  const retryRaw = await callClaude(system, correctionMessages, temperature)

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

function appendCustomPrompt(
  messages: Array<{ role: 'user'; content: string }>,
  customPrompt?: string,
): Array<{ role: 'user'; content: string }> {
  if (!customPrompt?.trim()) return messages
  const last = messages[messages.length - 1]
  return [
    ...messages.slice(0, -1),
    { ...last, content: last.content + `\n\nADDITIONAL CONTEXT FROM USER:\n${customPrompt.trim()}` },
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
  const { workspaceId, type, competitorId, caseStudyId, productName, buyerRole, customPrompt } = input

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

  // 2. Fetch additional data based on type
  const allDeals = await db
    .select()
    .from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))

  const allCaseStudies = await db
    .select()
    .from(caseStudies)
    .where(eq(caseStudies.workspaceId, workspaceId))

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

    const { system, messages: bcMsgs } = battlecardPrompt(company, competitor, competitorDeals as unknown as DealLog[], allCaseStudies as unknown as CaseStudy[])
    const { validated, raw } = await generateAndValidate(system, appendCustomPrompt(bcMsgs, customPrompt), BattlecardSchema, 0.4)

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

    const { system, messages: csMsgs } = caseStudyDocPrompt(company, caseStudy as unknown as CaseStudy)
    const { validated, raw } = await generateAndValidate(system, appendCustomPrompt(csMsgs, customPrompt), CaseStudyDocSchema, 0.6)

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

    const { system, messages: opMsgs } = onePagerPrompt(company, product, allCaseStudies as unknown as CaseStudy[])
    const { validated, raw } = await generateAndValidate(system, appendCustomPrompt(opMsgs, customPrompt), OnePagerSchema, 0.6)

    return {
      content: validated as CollateralContent,
      rawResponse: raw,
      title: buildTitle(type, { productName: product.name }),
    }
  }

  // ─── OBJECTION HANDLER ──────────────────────────────────────────────────────
  if (type === 'objection_handler') {
    const { system, messages: ohMsgs } = objectionHandlerPrompt(company, allDeals as unknown as DealLog[])
    const { validated, raw } = await generateAndValidate(system, appendCustomPrompt(ohMsgs, customPrompt), ObjectionHandlerSchema, 0.4)

    return {
      content: validated as CollateralContent,
      rawResponse: raw,
      title: buildTitle(type, { buyerRole }),
    }
  }

  // ─── TALK TRACK ─────────────────────────────────────────────────────────────
  if (type === 'talk_track') {
    const role = buyerRole ?? 'Decision Maker'
    const { system, messages: ttMsgs } = talkTrackPrompt(company, role, allDeals as unknown as DealLog[])
    const { validated, raw } = await generateAndValidate(system, appendCustomPrompt(ttMsgs, customPrompt), TalkTrackSchema, 0.6)

    return {
      content: validated as CollateralContent,
      rawResponse: raw,
      title: buildTitle(type, { buyerRole: role }),
    }
  }

  // ─── EMAIL SEQUENCE ─────────────────────────────────────────────────────────
  if (type === 'email_sequence') {
    const persona = buyerRole ?? 'Decision Maker'
    const { system, messages: esMsgs } = emailSequencePrompt(company, persona, allCaseStudies as unknown as CaseStudy[])
    const { validated, raw } = await generateAndValidate(system, appendCustomPrompt(esMsgs, customPrompt), EmailSequenceSchema, 0.6)

    return {
      content: validated as CollateralContent,
      rawResponse: raw,
      title: buildTitle(type, { buyerRole: persona }),
    }
  }

  throw new Error(`Unknown collateral type: ${type}`)
}
