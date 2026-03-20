import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { competitors, companyProfiles, caseStudies, productGaps } from '@/lib/db/schema'
import { rebuildWorkspaceBrain } from '@/lib/workspace-brain'
import type { ToolContext, ToolResult } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// create_competitor
// ─────────────────────────────────────────────────────────────────────────────

export const create_competitor = {
  description: 'Create a new competitor profile in the workspace. Use this when the user mentions a new competitor.',
  parameters: z.object({
    name: z.string().describe('Competitor company name'),
    description: z.string().optional().describe('Brief description of the competitor'),
    strengths: z.array(z.string()).optional().describe('Known strengths'),
    weaknesses: z.array(z.string()).optional().describe('Known weaknesses'),
    keyFeatures: z.array(z.string()).optional().describe('Key product features'),
  }),
  execute: async (
    params: {
      name: string
      description?: string
      strengths?: string[]
      weaknesses?: string[]
      keyFeatures?: string[]
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    // Check for existing competitor with same name
    const [existing] = await db
      .select({ id: competitors.id })
      .from(competitors)
      .where(and(
        eq(competitors.workspaceId, ctx.workspaceId),
        eq(competitors.name, params.name),
      ))
      .limit(1)

    if (existing) {
      return { result: `A competitor named **${params.name}** already exists. Use update_competitor to modify it.` }
    }

    const [created] = await db
      .insert(competitors)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        name: params.name,
        description: params.description ?? null,
        strengths: params.strengths ?? [],
        weaknesses: params.weaknesses ?? [],
        keyFeatures: params.keyFeatures ?? [],
      })
      .returning()

    after(async () => {
      try { console.log(`[brain] Rebuild triggered by: knowledge_tool_call at ${new Date().toISOString()}`); await rebuildWorkspaceBrain(ctx.workspaceId, 'knowledge_tool_call') } catch { /* non-fatal */ }
    })

    return {
      result: `Competitor **${created.name}** has been created.${params.strengths?.length ? ` ${params.strengths.length} strengths recorded.` : ''}${params.weaknesses?.length ? ` ${params.weaknesses.length} weaknesses recorded.` : ''}`,
      actions: [{
        type: 'competitor_created',
        names: [created.name],
        battlecardsStarted: false,
      }],
      uiHint: 'refresh_collateral',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// update_competitor
// ─────────────────────────────────────────────────────────────────────────────

export const update_competitor = {
  description: 'Update an existing competitor profile. Can add strengths, weaknesses, key features, or update description and notes.',
  parameters: z.object({
    competitorId: z.string().describe('The UUID of the competitor to update'),
    addStrengths: z.array(z.string()).optional().describe('Strengths to add'),
    addWeaknesses: z.array(z.string()).optional().describe('Weaknesses to add'),
    addKeyFeatures: z.array(z.string()).optional().describe('Key features to add'),
    description: z.string().optional().describe('Updated description'),
    notes: z.string().optional().describe('Notes to append'),
  }),
  execute: async (
    params: {
      competitorId: string
      addStrengths?: string[]
      addWeaknesses?: string[]
      addKeyFeatures?: string[]
      description?: string
      notes?: string
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [existing] = await db
      .select()
      .from(competitors)
      .where(and(eq(competitors.id, params.competitorId), eq(competitors.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!existing) return { result: 'Competitor not found.' }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() }
    const changes: string[] = []

    if (params.addStrengths?.length) {
      const current = (existing.strengths as string[]) ?? []
      updateFields.strengths = [...current, ...params.addStrengths]
      changes.push(`${params.addStrengths.length} strength(s) added`)
    }
    if (params.addWeaknesses?.length) {
      const current = (existing.weaknesses as string[]) ?? []
      updateFields.weaknesses = [...current, ...params.addWeaknesses]
      changes.push(`${params.addWeaknesses.length} weakness(es) added`)
    }
    if (params.addKeyFeatures?.length) {
      const current = (existing.keyFeatures as string[]) ?? []
      updateFields.keyFeatures = [...current, ...params.addKeyFeatures]
      changes.push(`${params.addKeyFeatures.length} feature(s) added`)
    }
    if (params.description) {
      updateFields.description = params.description
      changes.push('Description updated')
    }
    if (params.notes) {
      const currentNotes = existing.notes ?? ''
      updateFields.notes = currentNotes ? `${currentNotes}\n\n${params.notes}` : params.notes
      changes.push('Notes appended')
    }

    if (changes.length === 0) {
      return { result: 'No changes specified.' }
    }

    await db.update(competitors).set(updateFields).where(eq(competitors.id, params.competitorId))

    after(async () => {
      try { console.log(`[brain] Rebuild triggered by: knowledge_tool_call at ${new Date().toISOString()}`); await rebuildWorkspaceBrain(ctx.workspaceId, 'knowledge_tool_call') } catch { /* non-fatal */ }
    })

    return {
      result: `Updated competitor **${existing.name}**:\n${changes.map(c => `- ${c}`).join('\n')}`,
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// update_company_profile
// ─────────────────────────────────────────────────────────────────────────────

export const update_company_profile = {
  description: 'Update the workspace company profile (your own company info, value props, differentiators, etc.).',
  parameters: z.object({
    companyName: z.string().optional().describe('Company name'),
    description: z.string().optional().describe('Company description'),
    industry: z.string().optional().describe('Industry vertical'),
    valuePropositions: z.array(z.string()).optional().describe('Core value propositions (replaces existing)'),
    differentiators: z.array(z.string()).optional().describe('Key differentiators (replaces existing)'),
    targetMarket: z.string().optional().describe('Target market description'),
    competitiveAdvantage: z.string().optional().describe('Overall competitive advantage statement'),
  }),
  execute: async (
    params: {
      companyName?: string
      description?: string
      industry?: string
      valuePropositions?: string[]
      differentiators?: string[]
      targetMarket?: string
      competitiveAdvantage?: string
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [existing] = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.workspaceId, ctx.workspaceId))
      .limit(1)

    const updateFields: Record<string, unknown> = { updatedAt: new Date() }
    const changes: string[] = []

    if (params.companyName) { updateFields.companyName = params.companyName; changes.push('Company name') }
    if (params.description) { updateFields.description = params.description; changes.push('Description') }
    if (params.industry) { updateFields.industry = params.industry; changes.push('Industry') }
    if (params.valuePropositions) { updateFields.valuePropositions = params.valuePropositions; changes.push('Value propositions') }
    if (params.differentiators) { updateFields.differentiators = params.differentiators; changes.push('Differentiators') }
    if (params.targetMarket) { updateFields.targetMarket = params.targetMarket; changes.push('Target market') }
    if (params.competitiveAdvantage) { updateFields.competitiveAdvantage = params.competitiveAdvantage; changes.push('Competitive advantage') }

    if (changes.length === 0) {
      return { result: 'No changes specified.' }
    }

    if (existing) {
      await db.update(companyProfiles).set(updateFields).where(eq(companyProfiles.id, existing.id))
    } else {
      if (!params.companyName) {
        return { result: 'No company profile exists yet. Please provide at least a companyName to create one.' }
      }
      await db.insert(companyProfiles).values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        companyName: params.companyName,
        description: params.description ?? null,
        industry: params.industry ?? null,
        valuePropositions: params.valuePropositions ?? [],
        differentiators: params.differentiators ?? [],
        targetMarket: params.targetMarket ?? null,
        competitiveAdvantage: params.competitiveAdvantage ?? null,
      })
    }

    return {
      result: `Company profile updated:\n${changes.map(c => `- ${c}`).join('\n')}`,
      actions: [{ type: 'company_updated', fields: changes }],
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// create_case_study
// ─────────────────────────────────────────────────────────────────────────────

export const create_case_study = {
  description: 'Create a new case study from a customer success story.',
  parameters: z.object({
    customerName: z.string().describe('Customer/company name'),
    customerIndustry: z.string().optional().describe('Customer industry'),
    challenge: z.string().describe('The challenge the customer faced'),
    solution: z.string().describe('How your product/service solved the challenge'),
    results: z.string().describe('The measurable results achieved'),
    metrics: z.array(z.object({
      label: z.string().describe('Metric label (e.g. "Revenue increase")'),
      value: z.string().describe('Metric value (e.g. "42%")'),
      unit: z.string().optional().describe('Unit of measurement'),
    })).optional().describe('Key metrics from the case study'),
  }),
  execute: async (
    params: {
      customerName: string
      customerIndustry?: string
      challenge: string
      solution: string
      results: string
      metrics?: { label: string; value: string; unit?: string }[]
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [created] = await db
      .insert(caseStudies)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        customerName: params.customerName,
        customerIndustry: params.customerIndustry ?? null,
        challenge: params.challenge,
        solution: params.solution,
        results: params.results,
        metrics: params.metrics ?? [],
      })
      .returning()

    after(async () => {
      try { console.log(`[brain] Rebuild triggered by: knowledge_tool_call at ${new Date().toISOString()}`); await rebuildWorkspaceBrain(ctx.workspaceId, 'knowledge_tool_call') } catch { /* non-fatal */ }
    })

    return {
      result: `Case study for **${created.customerName}** has been created.${params.metrics?.length ? ` ${params.metrics.length} metrics recorded.` : ''}`,
      actions: [{
        type: 'case_study_created',
        id: created.id,
        customerName: created.customerName,
      }],
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// log_product_gap
// ─────────────────────────────────────────────────────────────────────────────

export const log_product_gap = {
  description: 'Log a product gap or missing feature that a prospect or customer has raised.',
  parameters: z.object({
    title: z.string().describe('Short title for the product gap'),
    description: z.string().describe('Description of what is missing or needed'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Priority level (defaults to medium)'),
    sourceDealId: z.string().optional().describe('The deal where this gap was identified'),
  }),
  execute: async (
    params: {
      title: string
      description: string
      priority?: string
      sourceDealId?: string
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    // Check if a gap with the same title already exists
    const [existing] = await db
      .select()
      .from(productGaps)
      .where(and(eq(productGaps.workspaceId, ctx.workspaceId), eq(productGaps.title, params.title)))
      .limit(1)

    if (existing) {
      // Increment frequency and add source deal
      const sourceDeals = (existing.sourceDeals as string[]) ?? []
      if (params.sourceDealId && !sourceDeals.includes(params.sourceDealId)) {
        sourceDeals.push(params.sourceDealId)
      }
      await db.update(productGaps).set({
        frequency: (existing.frequency ?? 1) + 1,
        sourceDeals,
        updatedAt: new Date(),
      }).where(eq(productGaps.id, existing.id))

      return {
        result: `Product gap **"${params.title}"** already exists. Frequency incremented to ${(existing.frequency ?? 1) + 1}.`,
        actions: [{ type: 'gaps_logged', gaps: [params.title], count: 1 }],
      }
    }

    const [created] = await db
      .insert(productGaps)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        title: params.title,
        description: params.description,
        priority: params.priority ?? 'medium',
        frequency: 1,
        sourceDeals: params.sourceDealId ? [params.sourceDealId] : [],
        status: 'open',
      })
      .returning()

    return {
      result: `Product gap **"${created.title}"** logged with ${params.priority ?? 'medium'} priority.`,
      actions: [{ type: 'gaps_logged', gaps: [created.title], count: 1 }],
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// manage_product_gap
// ─────────────────────────────────────────────────────────────────────────────

export const manage_product_gap = {
  description: 'Update the status or priority of an existing product gap.',
  parameters: z.object({
    gapId: z.string().describe('The UUID of the product gap to update'),
    status: z.enum(['open', 'in_review', 'on_roadmap', 'wont_fix', 'shipped']).optional().describe('New status'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('New priority level'),
  }),
  execute: async (
    params: { gapId: string; status?: string; priority?: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [existing] = await db
      .select()
      .from(productGaps)
      .where(and(eq(productGaps.id, params.gapId), eq(productGaps.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!existing) return { result: 'Product gap not found.' }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() }
    const changes: string[] = []

    if (params.status) {
      updateFields.status = params.status
      changes.push(`Status: ${existing.status} -> ${params.status}`)
    }
    if (params.priority) {
      updateFields.priority = params.priority
      changes.push(`Priority: ${existing.priority} -> ${params.priority}`)
    }

    if (changes.length === 0) {
      return { result: 'No changes specified.' }
    }

    await db.update(productGaps).set(updateFields).where(eq(productGaps.id, params.gapId))

    return {
      result: `Updated product gap **"${existing.title}"**:\n${changes.map(c => `- ${c}`).join('\n')}`,
    }
  },
}
