// Pure TypeScript logistic regression — no external dependencies

export function sigmoid(z: number): number {
  // Clamp to prevent overflow
  const clamped = Math.max(-500, Math.min(500, z))
  return 1 / (1 + Math.exp(-clamped))
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0)
}

export interface LogisticModel {
  weights: number[]
  bias: number
  featureCount: number
}

export function trainLogisticRegression(
  X: number[][],
  y: number[], // 1 = won, 0 = lost
  options: { learningRate?: number; iterations?: number; l2Lambda?: number } = {}
): LogisticModel {
  const { learningRate = 0.1, iterations = 2000, l2Lambda = 0.01 } = options
  const n = X.length
  const p = X[0]?.length ?? 0
  if (n < 2 || p === 0) return { weights: new Array(p).fill(0), bias: 0, featureCount: p }

  let weights = new Array(p).fill(0)
  let bias = 0

  for (let iter = 0; iter < iterations; iter++) {
    const dw = new Array(p).fill(0)
    let db = 0

    for (let i = 0; i < n; i++) {
      const z = dotProduct(X[i], weights) + bias
      const pred = sigmoid(z)
      const error = pred - y[i]
      for (let j = 0; j < p; j++) {
        dw[j] += (error * X[i][j] + (l2Lambda * weights[j]) / n)
      }
      db += error
    }

    for (let j = 0; j < p; j++) {
      weights[j] -= (learningRate / n) * dw[j]
    }
    bias -= (learningRate / n) * db
  }

  return { weights, bias, featureCount: p }
}

export function predictProbability(model: LogisticModel, x: number[]): number {
  const z = dotProduct(x, model.weights) + model.bias
  return sigmoid(z)
}

export function leaveOneOutAccuracy(X: number[][], y: number[]): number {
  if (X.length < 4) return 0
  let correct = 0
  for (let i = 0; i < X.length; i++) {
    const trainX = [...X.slice(0, i), ...X.slice(i + 1)]
    const trainY = [...y.slice(0, i), ...y.slice(i + 1)]
    // Need at least one of each class in training set
    if (!trainY.includes(0) || !trainY.includes(1)) continue
    const model = trainLogisticRegression(trainX, trainY)
    const prob = predictProbability(model, X[i])
    if ((prob >= 0.5 ? 1 : 0) === y[i]) correct++
  }
  return correct / X.length
}

// Compute feature importance as absolute weight values normalised to sum to 1
export function featureImportance(model: LogisticModel, featureNames: string[]): Array<{ name: string; importance: number }> {
  const absWeights = model.weights.map(Math.abs)
  const total = absWeights.reduce((s, w) => s + w, 0) || 1
  return featureNames
    .map((name, i) => ({ name, importance: absWeights[i] / total }))
    .sort((a, b) => b.importance - a.importance)
}
