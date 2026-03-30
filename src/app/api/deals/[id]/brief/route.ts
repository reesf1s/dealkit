/**
 * GET /api/deals/[id]/brief
 *
 * Returns an AI-generated briefing paragraph for a deal.
 * - If the deal has an existing aiSummary, returns it immediately.
 * - Otherwise, calls Claude Haiku to generate a concise brief and returns it.
 *   The brief is NOT persisted — callers can optionally PATCH the deal to save it.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { anthropic } from '@/lib/ai/client'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'


type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { workspaceId } = await getWorkspaceContext(userId)

    const [deal] = await db
      .select()
      .from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Return existing summary immediately if available
    if (deal.aiSummary) {
      return NextResponse.json({
        data: { brief: deal.aiSummary, generatedAt: deal.updatedAt },
      })
    }

    // Build deal context for prompt
    const dealRisks = (deal.dealRisks as string[] | null) ?? []
    const insights = (deal.conversionInsights as string[] | null) ?? []
    const contacts = (deal.contacts as any[] | null) ?? []

    const lines = [
      `Company: ${deal.prospectCompany ?? 'Unknown'}`,
      `Deal name: ${deal.dealName ?? 'Untitled'}`,
      `Stage: ${(deal.stage ?? 'unknown').replace(/_/g, ' ')}`,
      deal.dealValue ? `Value: £${Number(deal.dealValue).toLocaleString()}` : null,
      contacts.length > 0 ? `Primary contact: ${contacts[0]?.name ?? ''}${contacts[0]?.title ? `, ${contacts[0].title}` : ''}` : null,
      deal.description ? `Description: ${deal.description}` : null,
      deal.nextSteps ? `Next steps: ${deal.nextSteps}` : null,
      dealRisks.length > 0 ? `Known risks: ${dealRisks.slice(0, 3).join('; ')}` : null,
      insights.length > 0 ? `Key insights: ${insights.slice(0, 2).join('; ')}` : null,
    ].filter(Boolean).join('\n')

    if (!lines.trim() || (!deal.description && !deal.nextSteps && dealRisks.length === 0)) {
      return NextResponse.json({ data: { brief: null, generatedAt: null } })
    }

    const response = await anthropic.messages.create({
      model: 'gpt-4.1-mini',
      max_tokens: 280,
      messages: [
        {
          role: 'user',
          content: `You are a sales intelligence assistant. Write a concise 2–3 sentence briefing for a sales rep going into this deal. Focus on: deal status, the main risk or opportunity, and what they should prioritise next. Be direct and specific — no generic filler.\n\n${lines}`,
        },
      ],
    })

    const brief =
      response.content[0].type === 'text' ? response.content[0].text.trim() : null

    return NextResponse.json({
      data: { brief, generatedAt: new Date().toISOString() },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
