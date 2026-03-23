import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { generateQueryEmbedding } from './openai-embeddings'

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

  // 3. If we have enough mentioned deals, skip vector search
  let semanticIds: string[] = []
  if (mentionedIds.size < maxDeals) {
    try {
      const queryEmbedding = await generateQueryEmbedding(userMessage)
      const results = await db.execute(sql`
        SELECT id, 1 - (deal_embedding::vector <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM deal_logs
        WHERE workspace_id = ${workspaceId}
          AND deal_embedding IS NOT NULL
        ORDER BY deal_embedding::vector <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${maxDeals}
      `)
      semanticIds = (results as any[]).map(r => r.id)
    } catch (err) {
      console.error('[agent-context] Vector search failed, falling back:', err)
      // Fallback: use most recently updated deals
      semanticIds = allDeals
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
        .slice(0, maxDeals)
        .map(d => d.id)
    }
  }

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
