/**
 * GET /api/global/model
 * Returns the active global prior model for Bayesian blending in workspace ML.
 * CDN-cacheable for 1 hour — the model changes at most once per day.
 *
 * Returns { available: false } when pool is too small or no model trained yet.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getActiveGlobalModel } from '@/lib/global-pool'

export const revalidate = 3600  // 1-hour CDN cache

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const model = await getActiveGlobalModel()

  if (!model) {
    return NextResponse.json({ available: false })
  }

  return NextResponse.json({ available: true, model }, {
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  })
}
