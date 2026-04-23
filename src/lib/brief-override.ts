type BriefOverride = {
  text: string
  updatedAt: string
  source?: 'manual' | 'ui' | 'agent'
}

type DealReviewLike = Record<string, unknown> | null | undefined

function asObject(value: DealReviewLike): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function getManualBriefOverride(review: DealReviewLike): BriefOverride | null {
  const data = asObject(review).manualBriefOverride
  if (!isRecord(data)) return null

  const text = typeof data.text === 'string' ? data.text.trim() : ''
  const updatedAt = typeof data.updatedAt === 'string' ? data.updatedAt : null
  const source = typeof data.source === 'string' ? data.source : undefined

  if (!text || !updatedAt) return null

  return { text, updatedAt, source: source as BriefOverride['source'] | undefined }
}

export function setManualBriefOverride(
  review: DealReviewLike,
  text: string,
  source: BriefOverride['source'] = 'manual',
) {
  const next = asObject(review)
  next.manualBriefOverride = {
    text,
    updatedAt: new Date().toISOString(),
    source,
  } satisfies BriefOverride
  return next
}

export function clearManualBriefOverride(review: DealReviewLike) {
  const next = asObject(review)
  delete next.manualBriefOverride
  return Object.keys(next).length > 0 ? next : null
}
