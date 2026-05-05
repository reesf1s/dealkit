/**
 * GET /api/global/model
 * Returns the active global prior model for Bayesian blending in workspace ML.
 * Authenticated endpoint with a short private cache.
 *
 * Returns { available: false } when pool is too small or no model trained yet.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getActiveGlobalModel } from '@/lib/global-pool'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const model = await getActiveGlobalModel()

    if (!model) {
      return NextResponse.json({ available: false })
    }

    return NextResponse.json({ available: true, model }, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch (err) {
    console.error('[GET /api/global/model]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 }
    )
  }
}
