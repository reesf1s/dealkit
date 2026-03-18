// Ordinary Least Squares for trend detection and close date prediction

export interface OLSResult {
  slope: number
  intercept: number
  rSquared: number
}

export function fitOLS(x: number[], y: number[]): OLSResult {
  const n = x.length
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0, rSquared: 0 }
  const xMean = x.reduce((s, v) => s + v, 0) / n
  const yMean = y.reduce((s, v) => s + v, 0) / n
  const ssXX = x.reduce((s, xi) => s + Math.pow(xi - xMean, 2), 0)
  const ssXY = x.reduce((s, xi, i) => s + (xi - xMean) * (y[i] - yMean), 0)
  if (ssXX === 0) return { slope: 0, intercept: yMean, rSquared: 0 }
  const slope = ssXY / ssXX
  const intercept = yMean - slope * xMean
  const ssTotal = y.reduce((s, yi) => s + Math.pow(yi - yMean, 2), 0)
  const ssRes = y.reduce((s, yi, i) => s + Math.pow(yi - (slope * x[i] + intercept), 2), 0)
  const rSquared = ssTotal > 0 ? Math.max(0, 1 - ssRes / ssTotal) : 0
  return { slope, intercept, rSquared }
}

export function predictOLS(model: OLSResult, x: number): number {
  return model.slope * x + model.intercept
}
