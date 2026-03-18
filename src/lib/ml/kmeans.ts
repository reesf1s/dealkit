function euclidean(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, ai, i) => sum + Math.pow(ai - (b[i] ?? 0), 2), 0))
}

export interface ClusterResult {
  centroid: number[]
  memberIds: string[]
}

export function kMeans(
  points: Array<{ id: string; features: number[] }>,
  k: number,
  maxIter = 100
): ClusterResult[] {
  if (points.length < k) return []
  const p = points[0].features.length

  // k-means++ initialisation
  const centroids: number[][] = [points[0].features.slice()]
  for (let c = 1; c < k; c++) {
    const dists = points.map(pt => {
      const minD = Math.min(...centroids.map(ctr => euclidean(pt.features, ctr)))
      return minD * minD
    })
    const total = dists.reduce((s, d) => s + d, 0)
    let r = Math.random() * total
    let idx = 0
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i]
      if (r <= 0) { idx = i; break }
    }
    centroids.push(points[idx].features.slice())
  }

  let assignments = new Array(points.length).fill(0)

  for (let iter = 0; iter < maxIter; iter++) {
    const prev = assignments.slice()
    for (let i = 0; i < points.length; i++) {
      let minD = Infinity, best = 0
      for (let c = 0; c < k; c++) {
        const d = euclidean(points[i].features, centroids[c])
        if (d < minD) { minD = d; best = c }
      }
      assignments[i] = best
    }
    if (assignments.every((a, i) => a === prev[i])) break

    // Update centroids
    for (let c = 0; c < k; c++) {
      const members = points.filter((_, i) => assignments[i] === c)
      if (members.length === 0) continue
      centroids[c] = Array.from({ length: p }, (_, j) =>
        members.reduce((s, m) => s + m.features[j], 0) / members.length
      )
    }
  }

  return centroids.map((centroid, c) => ({
    centroid,
    memberIds: points.filter((_, i) => assignments[i] === c).map(pt => pt.id)
  }))
}

// Silhouette score to pick best k (returns 0 if can't compute)
export function silhouetteScore(
  points: Array<{ features: number[] }>,
  assignments: number[],
  k: number
): number {
  if (points.length < 2 || k < 2) return 0
  let totalS = 0
  for (let i = 0; i < points.length; i++) {
    const myCluster = assignments[i]
    const sameCluster = points.filter((_, j) => j !== i && assignments[j] === myCluster)
    if (sameCluster.length === 0) continue
    const a = sameCluster.reduce((s, p) => s + euclidean(points[i].features, p.features), 0) / sameCluster.length
    let b = Infinity
    for (let c = 0; c < k; c++) {
      if (c === myCluster) continue
      const other = points.filter((_, j) => assignments[j] === c)
      if (other.length === 0) continue
      const avg = other.reduce((s, p) => s + euclidean(points[i].features, p.features), 0) / other.length
      if (avg < b) b = avg
    }
    if (b === Infinity) continue
    const maxAB = Math.max(a, b)
    if (maxAB > 0) totalS += (b - a) / maxAB
  }
  return totalS / points.length
}
