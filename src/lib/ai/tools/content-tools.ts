import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { dealLogs, collateral, competitors } from '@/lib/db/schema'
import { anthropic } from '@/lib/ai/client'
import { generateCollateral, generateFreeformCollateral } from '@/lib/ai/generate'
import { requestBrainRebuild } from '@/lib/brain-rebuild'
import { upsertCollateral } from '@/lib/collateral-helpers'
import { getEffectiveDealSummary } from '@/lib/effective-deal-summary'
import type { ToolContext, ToolResult } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a deal context string for grounding content generation in a live deal. */
async function buildDealContext(dealId: string, workspaceId: string): Promise<string | undefined> {
  const [deal] = await db
    .select()
    .from(dealLogs)
    .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
    .limit(1)

  if (!deal) return undefined

  const lines = [
    `Deal: ${deal.dealName} with ${deal.prospectCompany}`,
    `Stage: ${deal.stage}`,
  ]
  if (deal.dealValue) lines.push(`Value: $${deal.dealValue.toLocaleString()}`)
  const effectiveSummary = getEffectiveDealSummary(deal)
  if (effectiveSummary) lines.push(`Summary: ${effectiveSummary}`)

  const risks = (deal.dealRisks as string[]) ?? []
  if (risks.length > 0) lines.push(`Risks: ${risks.join('; ')}`)

  const comps = (deal.competitors as string[]) ?? []
  if (comps.length > 0) lines.push(`Competitors: ${comps.join(', ')}`)

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// generate_content
// ─────────────────────────────────────────────────────────────────────────────

export const generate_content = {
  description: 'Generate ANY type of sales content, collateral, or business document — timelines, integration plans, proposals, one-pagers, battle plans, project briefs, risk assessments, executive summaries, or any freeform output. The content is saved to the collateral library. Use this for any content generation request.',
  parameters: z.object({
    title: z.string().describe('Title for the content piece'),
    description: z.string().describe('Description of what to generate and its purpose'),
    dealId: z.string().optional().describe('Optional deal ID to tailor content for a specific deal'),
    customPrompt: z.string().optional().describe('Additional instructions for content generation'),
  }),
  execute: async (
    params: { title: string; description: string; dealId?: string; customPrompt?: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const dealContext = params.dealId
      ? await buildDealContext(params.dealId, ctx.workspaceId)
      : undefined

    const generated = await generateFreeformCollateral({
      workspaceId: ctx.workspaceId,
      title: params.title,
      description: params.description,
      dealContext,
      customPrompt: params.customPrompt,
    })

    // Save to collateral table (custom type always inserts fresh via upsertCollateral)
    const saved = await upsertCollateral({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      type: 'custom',
      title: generated.title,
      status: 'ready',
      content: generated.content,
      rawResponse: generated.rawResponse,
      generatedAt: new Date(),
      customTypeName: params.title,
      generationSource: 'agent',
      sourceDealLogId: params.dealId ?? null,
    })

    return {
      result: `Content **"${generated.title}"** has been generated and saved to your collateral library.`,
      actions: [{
        type: 'collateral_generating',
        colType: 'custom',
        title: generated.title,
      }],
      uiHint: 'refresh_collateral',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// generate_battlecard
// ─────────────────────────────────────────────────────────────────────────────

export const generate_battlecard = {
  description: 'Generate a competitive battlecard for a specific competitor. The battlecard is saved to the collateral library.',
  parameters: z.object({
    competitorId: z.string().describe('The UUID of the competitor to generate a battlecard for'),
  }),
  execute: async (
    params: { competitorId: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    // Verify competitor exists in this workspace
    const [comp] = await db
      .select({ id: competitors.id, name: competitors.name })
      .from(competitors)
      .where(and(eq(competitors.id, params.competitorId), eq(competitors.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!comp) {
      return { result: 'Competitor not found. Please check the competitor ID.' }
    }

    const generated = await generateCollateral({
      workspaceId: ctx.workspaceId,
      type: 'battlecard',
      competitorId: params.competitorId,
    })

    // Save to collateral table — upsert prevents duplicate battlecards for same competitor
    const saved = await upsertCollateral({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      type: 'battlecard',
      title: generated.title,
      status: 'ready',
      content: generated.content,
      rawResponse: generated.rawResponse,
      generatedAt: new Date(),
      sourceCompetitorId: params.competitorId,
      generationSource: 'agent',
    })

    return {
      result: `Battlecard **"${generated.title}"** has been generated and saved to your collateral library.`,
      actions: [{
        type: 'collateral_generating',
        colType: 'battlecard',
        title: generated.title,
      }],
      uiHint: 'refresh_collateral',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// draft_email
// ─────────────────────────────────────────────────────────────────────────────

export const draft_email = {
  description: 'Draft a personalized sales email. Returns the email as text for review (not saved as collateral).',
  parameters: z.object({
    dealId: z.string().optional().describe('Optional deal ID to personalize the email for'),
    recipientRole: z.string().optional().describe('Role/title of the email recipient (e.g. "VP of Engineering")'),
    context: z.string().optional().describe('Additional context or purpose for the email'),
    tone: z.string().optional().describe('Desired tone (e.g. "professional", "casual", "urgent")'),
  }),
  execute: async (
    params: { dealId?: string; recipientRole?: string; context?: string; tone?: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const dealContext = params.dealId
      ? await buildDealContext(params.dealId, ctx.workspaceId)
      : undefined

    const promptParts = ['Draft a sales email with the following parameters:']
    if (params.recipientRole) promptParts.push(`Recipient role: ${params.recipientRole}`)
    if (params.tone) promptParts.push(`Tone: ${params.tone}`)
    if (params.context) promptParts.push(`Context/Purpose: ${params.context}`)
    if (dealContext) promptParts.push(`\nDeal context:\n${dealContext}`)

    promptParts.push(
      '\nReturn the email with clear Subject: and Body: sections.',
      'Make it personalized, concise, and actionable.',
      'Use {{first_name}} and {{company_name}} as placeholders if deal context is not available.',
    )

    const msg = await anthropic.messages.create({
      model: 'gpt-5.4-mini',
      max_tokens: 1500,
      messages: [{ role: 'user', content: promptParts.join('\n') }],
    })

    const emailText = ((msg.content[0] as any).text ?? '').trim()

    return {
      result: `Here's the drafted email:\n\n${emailText}`,
    }
  },
}
