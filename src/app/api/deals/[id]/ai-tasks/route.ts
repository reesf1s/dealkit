export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { anthropic } from '@/lib/ai/client'
import { db } from '@/lib/db'
import { dealLogs, dealTodos } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export interface AiTaskItem {
  id: string
  text: string
  done: false
  source: 'ai'
  priority?: 'low' | 'normal' | 'high'
  createdAt: string
}

function normalizeTaskText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkRateLimit(userId, 'ai-tasks', 15)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params

    const [deal] = await db.select({
      id:                 dealLogs.id,
      dealName:           dealLogs.dealName,
      prospectCompany:    dealLogs.prospectCompany,
      stage:              dealLogs.stage,
      meetingNotes:       dealLogs.meetingNotes,
      nextSteps:          dealLogs.nextSteps,
      aiSummary:          dealLogs.aiSummary,
      dealRisks:          dealLogs.dealRisks,
      conversionInsights: dealLogs.conversionInsights,
      todos:              dealLogs.todos,
    }).from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const contextLines = [
      `Deal: ${deal.dealName || deal.prospectCompany}`,
      `Stage: ${deal.stage?.replace(/_/g, ' ')}`,
      deal.aiSummary?.trim() ? `AI summary: ${deal.aiSummary.trim()}` : '',
      deal.nextSteps?.trim() ? `Agreed next steps: ${deal.nextSteps.trim()}` : '',
      (deal.dealRisks as string[] | null)?.length
        ? `Risks: ${(deal.dealRisks as string[]).join('; ')}`
        : '',
      (deal.conversionInsights as string[] | null)?.length
        ? `Key insights: ${(deal.conversionInsights as string[]).slice(0, 3).join('; ')}`
        : '',
      deal.meetingNotes
        ? `Recent meeting notes:\n${String(deal.meetingNotes).slice(-3000)}`
        : '',
    ].filter(Boolean).join('\n')

    if (!contextLines.trim()) {
      return NextResponse.json({ error: 'Not enough deal context to generate tasks' }, { status: 400 })
    }

    const prompt = `You are an enterprise sales AI. Extract 3–5 specific, actionable next steps from this deal context.

DEAL CONTEXT:
${contextLines}

Rules:
- Tasks must be SPECIFIC to this deal — no generic advice
- Each task should reference a real detail (person, topic, risk, date mentioned in notes)
- Start each with an action verb (e.g. "Send", "Schedule", "Follow up", "Confirm", "Request")
- Keep each task under 120 characters
- priority: "high" = must happen this week, "normal" = this sprint, "low" = nice to have

Respond ONLY with this JSON (no markdown fences):
{"tasks":[{"text":"...","priority":"high|normal|low"},...]}`

    const message = await anthropic.messages.create({
      model: 'gpt-5.4-mini',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    let rawTasks: Array<{ text: string; priority?: string }> = []
    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
      rawTasks = JSON.parse(cleaned).tasks ?? []
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const existing = (deal.todos as AiTaskItem[] | null) ?? []
    const existingKeys = new Set(existing.map(t => normalizeTaskText(t.text ?? '')))

    const now = new Date().toISOString()
    const dedupedTasks = rawTasks
      .map(t => ({ text: t.text?.trim() ?? '', priority: t.priority }))
      .filter(t => t.text.length >= 10)
      .filter(t => !existingKeys.has(normalizeTaskText(t.text)))
      .slice(0, 5)

    const newTasks: AiTaskItem[] = dedupedTasks.map(t => ({
      id: crypto.randomUUID(),
      text: t.text,
      done: false as const,
      source: 'ai' as const,
      priority: (t.priority as AiTaskItem['priority']) ?? 'normal',
      createdAt: now,
    }))

    if (newTasks.length > 0) {
      await db.insert(dealTodos).values(
        newTasks.map(task => ({
          id: task.id,
          workspaceId,
          dealId: id,
          text: task.text,
          done: false,
          priority: task.priority ?? 'normal',
          createdBy: userId,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.createdAt),
        }))
      )
    }

    // Prepend AI tasks to existing todos JSONB array
    const updated = [...newTasks, ...existing]

    await db.update(dealLogs)
      .set({ todos: updated })
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))

    return NextResponse.json({ data: newTasks })
  } catch (err: unknown) {
    console.error('[ai-tasks]', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
