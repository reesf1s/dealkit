export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/ai/client'


import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(userId, 'onboarding:parse', 5)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

    const msg = await anthropic.messages.create({
      model: 'gpt-5.4-mini',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract company and competitor information from this text. Return ONLY valid JSON, no markdown.

Text:
${text.slice(0, 4000)}

Return this exact JSON:
{
  "company": {
    "companyName": "",
    "website": "",
    "industry": "",
    "description": "",
    "targetMarket": "",
    "valuePropositions": [],
    "differentiators": [],
    "products": [{"name": "", "description": ""}],
    "commonObjections": []
  },
  "competitors": [
    {"name": "", "description": "", "strengths": [], "weaknesses": []}
  ]
}

Only include fields you can infer from the text. Return empty arrays for fields with no data.`
      }],
    })

    let parsed: any = { company: {}, competitors: [] }
    try {
      const raw = (msg.content[0] as any).text.trim()
      parsed = JSON.parse(raw.replace(/^```json?\n?/, '').replace(/\n?```$/, ''))
    } catch { /* use defaults */ }

    return NextResponse.json(parsed)
  } catch (e: unknown) {
    console.error('[onboarding/parse] failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
  }
}
