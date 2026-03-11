export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companyProfiles, competitors, caseStudies, dealLogs, productGaps } from '@/lib/db/schema'
import Anthropic from '@anthropic-ai/sdk'
import { getWorkspaceContext } from '@/lib/workspace'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { messages } = await req.json()
    if (!messages?.length) return NextResponse.json({ error: 'messages required' }, { status: 400 })
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
      dealRows.slice(0, 10).forEach(d => kbParts.push(`- ${d.prospectCompany} (${d.stage}): $${d.dealValue ? (d.dealValue/100).toLocaleString() : '?'}. Notes: ${(d.notes ?? '').slice(0, 80)}`))
    }
    if (gapRows.length > 0) {
      kbParts.push(`## Product Gaps (${gapRows.length})`)
      gapRows.forEach(g => kbParts.push(`- ${g.title} [${g.priority}/${g.status}]: ${g.description.slice(0, 80)}`))
    }
    const systemPrompt = `You are DealKit AI, an expert sales intelligence assistant for this workspace. Answer questions about their company, competitors, deals, case studies, and product gaps. Be concise and actionable.\n\n${kbParts.join('\n\n') || 'No knowledge base data found yet. Help the user set up their profile via AI Setup.'}`
    const response = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system: systemPrompt, messages: messages.map((m: any) => ({ role: m.role, content: m.content })) })
    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
