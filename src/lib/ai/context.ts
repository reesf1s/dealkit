import { db } from '../db'
import { competitors, dealLogs, caseStudies } from '../db/schema'
import { eq } from 'drizzle-orm'

/**
 * Builds a lean (~150 token) cross-entity workspace context block.
 * Called once per generation and injected into every collateral prompt so
 * the AI knows about competitors, real win/loss patterns, and proof points
 * regardless of which collateral type is being generated.
 */
export async function buildWorkspaceContext(workspaceId: string): Promise<string> {
  const [compList, dealList, csList] = await Promise.all([
    db.select({ name: competitors.name, weaknesses: competitors.weaknesses })
      .from(competitors).where(eq(competitors.workspaceId, workspaceId)).limit(6),
    db.select({ stage: dealLogs.stage, prospectCompany: dealLogs.prospectCompany, lostReason: dealLogs.lostReason })
      .from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)).limit(30),
    db.select({ customerName: caseStudies.customerName, results: caseStudies.results })
      .from(caseStudies).where(eq(caseStudies.workspaceId, workspaceId)).limit(4),
  ])

  const lines: string[] = []

  // Competitor landscape — most valuable for positioning in any collateral type
  if (compList.length > 0) {
    const compLines = compList.map(c => {
      const w = (c.weaknesses as string[])?.slice(0, 2).filter(Boolean).join(', ')
      return w ? `${c.name} (weak: ${w})` : c.name
    }).join(' | ')
    lines.push(`Competitors we face: ${compLines}`)
  }

  // Win/loss intel — grounds messaging in real deal outcomes
  const won = dealList.filter(d => d.stage === 'closed_won')
  const lost = dealList.filter(d => d.stage === 'closed_lost')
  if (won.length > 0) {
    lines.push(`Deals won: ${won.slice(0, 3).map(d => d.prospectCompany).join(', ')}${won.length > 3 ? ` + ${won.length - 3} more` : ''}`)
  }
  if (lost.length > 0) {
    const reasons = [...new Set(
      lost.filter(d => d.lostReason).map(d => d.lostReason!),
    )].slice(0, 3)
    if (reasons.length > 0) lines.push(`Why we lose: ${reasons.join(', ')}`)
  }

  // Customer proof — informs all collateral with real outcomes
  if (csList.length > 0) {
    const proof = csList
      .filter(cs => cs.results)
      .map(cs => `${cs.customerName}: ${cs.results!.split('.')[0]}`)
      .join(' | ')
    if (proof) lines.push(`Customer proof: ${proof}`)
  }

  return lines.join('\n')
}
