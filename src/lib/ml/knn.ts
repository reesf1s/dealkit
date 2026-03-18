function euclidean(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, ai, i) => sum + Math.pow(ai - (b[i] ?? 0), 2), 0))
}

export interface ClosedDealPoint {
  id: string
  dealName: string
  company: string
  outcome: 'won' | 'lost'
  features: number[]
  value: number
  closedAt: string
}

export interface SimilarDeal {
  id: string
  dealName: string
  company: string
  outcome: 'won' | 'lost'
  similarity: number // 0-100
  value: number
  closedAt: string
}

export function findSimilarDeals(
  queryFeatures: number[],
  closedDeals: ClosedDealPoint[],
  k = 5
): SimilarDeal[] {
  if (closedDeals.length === 0) return []
  const withDist = closedDeals.map(d => ({
    ...d,
    distance: euclidean(queryFeatures, d.features)
  }))
  withDist.sort((a, b) => a.distance - b.distance)
  const nearest = withDist.slice(0, k)
  const maxDist = Math.max(...nearest.map(d => d.distance), 0.001)
  return nearest.map(d => ({
    id: d.id,
    dealName: d.dealName,
    company: d.company,
    outcome: d.outcome,
    similarity: Math.round((1 - d.distance / maxDist) * 100),
    value: d.value,
    closedAt: d.closedAt
  }))
}
