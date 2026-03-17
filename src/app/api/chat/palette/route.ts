export const dynamic = 'force-dynamic'
export const maxDuration = 30
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const anthropic = new Anthropic()

// Lightweight streaming endpoint for the command palette.
// Unlike /api/chat (which loads all deals/competitors/case studies for full CRUD support),
// this loads only the cached brain snapshot — one DB query, sub-100ms to first token.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkRateLimit(userId, 'palette-chat', 20)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    const { workspaceId } = await getWorkspaceContext(userId)
    const { question } = await req.json()
    if (!question?.trim()) return NextResponse.json({ error: 'No question' }, { status: 400 })

    // One DB read — brain is already computed and cached
    const brain = await getWorkspaceBrain(workspaceId)

    // Build a tight context from the cached brain snapshot
    const contextLines: string[] = []

    if (brain) {
      const { pipeline, urgentDeals, staleDeals, keyPatterns, winLossIntel, deals, productGapPriority, winPlaybook } = brain

      const winRate = winLossIntel?.winRate != null ? `${winLossIntel.winRate}%` : 'N/A'
      contextLines.push(`Pipeline: ${pipeline.totalActive} open deals, £${pipeline.totalValue.toLocaleString()} total value, ${winRate} win rate.`)

      if (urgentDeals?.length) {
        contextLines.push(`Urgent: ${urgentDeals.slice(0, 3).map(d => d.dealName).join(', ')}.`)
      }
      if (staleDeals?.length) {
        contextLines.push(`Stale (no activity 14+ days): ${staleDeals.slice(0, 3).map(d => d.dealName).join(', ')}.`)
      }
      if (keyPatterns?.length) {
        contextLines.push(`Common risk themes: ${keyPatterns.slice(0, 4).map(p => p.label).join('; ')}.`)
      }
      if (winLossIntel?.competitorRecord?.length) {
        contextLines.push(`Active competitors: ${winLossIntel.competitorRecord.slice(0, 5).map(c => `${c.name} (${c.winRate}% win rate)`).join(', ')}.`)
      }

      // Top deals by score
      const topDeals = (deals ?? [])
        .filter(d => !['closed_won', 'closed_lost'].includes(d.stage) && d.conversionScore != null)
        .sort((a, b) => (b.conversionScore ?? 0) - (a.conversionScore ?? 0))
        .slice(0, 8)

      if (topDeals.length) {
        contextLines.push('\nTop open deals:')
        for (const d of topDeals) {
          contextLines.push(`- ${d.name} @ ${d.company} | ${d.stage} | £${(d.dealValue ?? 0).toLocaleString()} | Score: ${d.conversionScore ?? 'N/A'}`)
        }
      }

      // Product gap summary
      if (productGapPriority?.length) {
        contextLines.push(`\nTop product gaps: ${productGapPriority.slice(0, 4).map(g => g.title).join(', ')}.`)
      }

      // Champion lift from win playbook
      if (winPlaybook?.championPattern?.championLift != null) {
        const lift = Math.round(winPlaybook.championPattern.championLift * 100)
        contextLines.push(`Champion lift: +${lift}pts win rate with a champion vs without.`)
      }
    } else {
      contextLines.push('No pipeline data available yet.')
    }

    const context = contextLines.join('\n')

    // Stream response — same SSE format as /api/chat: `data: { t: "..." }`
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const aiStream = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 500,
            stream: true,
            system: `You are a concise B2B sales intelligence assistant. Answer in 2-4 sentences maximum. Be specific and direct — use actual numbers and deal names from the context. Never make up data. If the context doesn't cover what was asked, say so honestly in one sentence.`,
            messages: [{
              role: 'user',
              content: `Pipeline context:\n${context}\n\nQuestion: ${question}`,
            }],
          })

          for await (const event of aiStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: event.delta.text })}\n\n`))
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (err: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: '\n\nSomething went wrong. Please try again.' })}\n\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
