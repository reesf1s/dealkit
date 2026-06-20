export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { buildFallbackDraft, getDemoCrmLead, getLeadForWorkspace, recordAiDraft, type CrmLeadDto } from '@/lib/sme-crm'
import { classifyRecoveryIntent } from '@/lib/recovery-intelligence'

async function generateWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
      input: prompt,
      max_output_tokens: 260,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`OpenAI request failed: ${response.status} ${detail}`)
  }

  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }
  return payload.output_text || payload.output?.flatMap(item => item.content ?? []).map(item => item.text).filter(Boolean).join('\n') || null
}

function requestLead(value: unknown): CrmLeadDto | null {
  if (!value || typeof value !== 'object') return null

  const lead = value as Partial<CrmLeadDto>
  if (typeof lead.id !== 'string' || typeof lead.title !== 'string') return null

  return {
    id: lead.id,
    title: lead.title,
    owner: typeof lead.owner === 'string' ? lead.owner : 'Sales owner',
    score: typeof lead.score === 'number' ? lead.score : 50,
    status: typeof lead.status === 'string' ? lead.status : 'open',
    stage: typeof lead.stage === 'string' ? lead.stage : 'New',
    stageName: typeof lead.stageName === 'string' ? lead.stageName : lead.stage ?? 'New',
    description: typeof lead.description === 'string' ? lead.description : 'New sales opportunity.',
    nextStep: typeof lead.nextStep === 'string' ? lead.nextStep : 'Confirm the next milestone.',
    companyName: typeof lead.companyName === 'string' ? lead.companyName : lead.title,
    primaryPersonName: typeof lead.primaryPersonName === 'string' ? lead.primaryPersonName : 'New contact',
    valueAmount: typeof lead.valueAmount === 'number' ? lead.valueAmount : 0,
    probability: typeof lead.probability === 'number' ? lead.probability : 25,
    expectedCloseDate: typeof lead.expectedCloseDate === 'string' ? lead.expectedCloseDate : undefined,
    latestActivityAt: typeof lead.latestActivityAt === 'string' ? lead.latestActivityAt : new Date().toISOString(),
    openTaskCount: typeof lead.openTaskCount === 'number' ? lead.openTaskCount : 0,
    channel: lead.channel === 'instagram' || lead.channel === 'linkedin' || lead.channel === 'webchat' || lead.channel === 'mail' ? lead.channel : 'mail',
    risk: lead.risk === 'hot' || lead.risk === 'warm' || lead.risk === 'new' ? lead.risk : 'new',
    notes: typeof lead.notes === 'string' ? lead.notes : `# ${lead.title}`,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { leadId?: unknown; channel?: unknown; instruction?: unknown; lead?: unknown }
    if (typeof body.leadId !== 'string') return NextResponse.json({ error: 'leadId is required' }, { status: 400 })

    if (process.env.NODE_ENV !== 'production' && process.env.HALVEX_LOCAL_DATABASE !== '1') {
      const lead = getDemoCrmLead(body.leadId) ?? requestLead(body.lead)
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      const intent = classifyRecoveryIntent(lead)
      return NextResponse.json({ draft: buildFallbackDraft(lead, intent), model: 'demo-fallback', intent })
    }

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress
    const { workspaceId } = await getWorkspaceContext(userId, email)
    const lead = await getLeadForWorkspace(workspaceId, body.leadId)
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const intent = classifyRecoveryIntent(lead)
    const prompt = [
      'You are the LLM core of Halvex, a simple sales CRM for SMEs.',
      'Write one concise, natural, channel-aware sales follow-up message. Do not use placeholders.',
      `Channel: ${typeof body.channel === 'string' ? body.channel : lead.channel}`,
      `Lead: ${lead.title}`,
      `Contact: ${lead.primaryPersonName}`,
      `Company: ${lead.companyName}`,
      `Stage: ${lead.stageName}`,
      `Intent: ${intent}`,
      `Next step: ${lead.nextStep || 'Clarify the next milestone.'}`,
      `Notes: ${lead.notes}`,
      typeof body.instruction === 'string' ? `Rep instruction: ${body.instruction}` : '',
    ].filter(Boolean).join('\n')

    let model = 'fallback'
    let draft = buildFallbackDraft(lead, intent)

    try {
      const generated = await generateWithOpenAI(prompt)
      if (generated?.trim()) {
        draft = generated.trim()
        model = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini'
      }
    } catch (error) {
      console.error('[POST /api/ai/draft] OpenAI fallback used', error)
    }

    await recordAiDraft({ workspaceId, leadId: lead.id, prompt, result: draft, model })
    return NextResponse.json({ draft, model, intent })
  } catch (error) {
    console.error('[POST /api/ai/draft]', error)
    return NextResponse.json({ error: 'Unable to generate draft' }, { status: 500 })
  }
}
