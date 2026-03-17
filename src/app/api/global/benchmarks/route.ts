/**
 * GET /api/global/benchmarks
 * Cross-workspace benchmark aggregates — win rates, stage velocity, risk themes.
 * 24-hour cached in global_benchmark_cache.
 *
 * Returns null when pool is too small to be meaningful.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getGlobalBenchmarks } from '@/lib/global-model'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const benchmarks = await getGlobalBenchmarks()

  if (!benchmarks) {
    return NextResponse.json({ available: false })
  }

  return NextResponse.json({ available: true, benchmarks })
}
