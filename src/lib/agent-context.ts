import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { semanticSearch } from './semantic-search'

interface AgentContext {
  relevantDeals: any[]
  pipelineSummary: {
    totalValue: number
    dealCount: number
    avgScore: number
    wins: number
    losses: number
    topRisks: string[]
  }
}

export async function getRelevantContext(
  workspaceId: string,
  userMessage: string,
  maxDeals: number = 5
): Promise<AgentContext> {
  // 1. Get all deals for name matching
  const allDeals = await db.select().from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))

  // 2. Find deals mentioned by name in the message
  const mentionedIds = new Set<string>()
  for (const d of allDeals) {
    const name = (d.dealName || '').toLowerCase()
    const company = (d.prospectCompany || '').toLowerCase()
    const msg = userMessage.toLowerCase()
    if (name && name.length > 2 && msg.includes(name)) mentionedIds.add(d.id)
    if (company && company.length > 2 && msg.includes(company)) mentionedIds.add(d.id)
  }

  // 3. If we have enough mentioned deals, skip semantic search
  let semanticIds: string[] = []
  let searchPath = 'name-match'
  if (mentionedIds.size < maxDeals) {
    const needed = maxDeals - mentionedIds.size
    try {
      const results = await semanticSearch(workspaceId, userMessage, {
        entityTypes: ['deal'],
        limit: needed,
        minSimilarity: 0.1,
      })
      semanticIds = results.map(r => r.entityId)
      if (semanticIds.length > 0) {
        searchPath = mentionedIds.size > 0 ? 'name-match+semantic' : 'semantic'
      } else {
        throw new Error('no semantic results')
      }
    } catch {
      // Last resort: most recently updated deals
      searchPath = mentionedIds.size > 0 ? 'name-match+recency' : 'recency'
      semanticIds = allDeals
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
        .slice(0, maxDeals)
        .map(d => d.id)
    }
  }
  console.log(`[agent-context] search path="${searchPath}" mentioned=${mentionedIds.size} semantic=${semanticIds.length}`)

  // 4. Merge mentioned + semantic (deduped)
  const targetIds = new Set([...mentionedIds, ...semanticIds])
  const relevantDeals = allDeals.filter(d => targetIds.has(d.id)).slice(0, maxDeals)

  // 5. Compute compact pipeline summary
  const openDeals = allDeals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const closedWon = allDeals.filter(d => d.stage === 'closed_won' || d.outcome === 'won')
  const closedLost = allDeals.filter(d => d.stage === 'closed_lost' || d.outcome === 'lost')

  return {
    relevantDeals,
    pipelineSummary: {
      totalValue: openDeals.reduce((s, d) => s + (d.dealValue || 0), 0),
      dealCount: openDeals.length,
      avgScore: openDeals.length > 0
        ? Math.round(openDeals.reduce((s, d) => s + (d.conversionScore || 0), 0) / openDeals.length)
        : 0,
      wins: closedWon.length,
      losses: closedLost.length,
      topRisks: [],
    },
  }
}
