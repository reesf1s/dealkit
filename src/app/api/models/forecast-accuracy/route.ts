export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'

// ── Ensure the deal_prediction_log table exists (idempotent) ──────────────────
let tableEnsured = false
async function ensurePredictionLogTable() {
  if (tableEnsured) return
  tableEnsured = true
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deal_prediction_log (
        id SERIAL PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        deal_id TEXT NOT NULL,
        predicted_score INTEGER NOT NULL,
        predicted_outcome TEXT,
        actual_outcome TEXT,
        predicted_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        deal_value NUMERIC
      )
    `)
    // Index for workspace-scoped queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_deal_prediction_log_workspace
      ON deal_prediction_log (workspace_id, resolved_at DESC)
    `)
  } catch { /* already exists */ }
}

interface BucketRow { bucket: string; predicted: number; wonRate: number }
interface CalibrationRow { month: string; predicted: number; actual: number; count: number }

export interface ForecastAccuracy {
  totalPredictions: number
  correctPredictions: number
  accuracy: number
  byScoreBucket: BucketRow[]
  recentCalibration: CalibrationRow[]
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    await ensurePredictionLogTable()

    // ── Totals ────────────────────────────────────────────────────────────────
    const totals = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN predicted_outcome = actual_outcome THEN 1 ELSE 0 END)::int AS correct
      FROM deal_prediction_log
      WHERE workspace_id = ${workspaceId}
        AND actual_outcome IS NOT NULL
    `)
    const totalRow = (totals as unknown as { total: number; correct: number }[])[0]
    const totalPredictions = totalRow?.total ?? 0
    const correctPredictions = totalRow?.correct ?? 0
    const accuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0

    // ── By score bucket ───────────────────────────────────────────────────────
    const bucketRows = await db.execute(sql`
      SELECT
        CASE
          WHEN predicted_score BETWEEN 0  AND 20  THEN '0-20'
          WHEN predicted_score BETWEEN 21 AND 40  THEN '21-40'
          WHEN predicted_score BETWEEN 41 AND 60  THEN '41-60'
          WHEN predicted_score BETWEEN 61 AND 80  THEN '61-80'
          ELSE '81-100'
        END AS bucket,
        COUNT(*)::int AS predicted,
        ROUND(
          SUM(CASE WHEN actual_outcome = 'won' THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(*), 0), 4
        )::float AS won_rate
      FROM deal_prediction_log
      WHERE workspace_id = ${workspaceId}
        AND actual_outcome IS NOT NULL
      GROUP BY bucket
      ORDER BY bucket
    `)

    const BUCKET_ORDER = ['0-20', '21-40', '41-60', '61-80', '81-100']
    const bucketMap = new Map<string, BucketRow>()
    for (const r of bucketRows as unknown as { bucket: string; predicted: number; won_rate: number }[]) {
      bucketMap.set(r.bucket, { bucket: r.bucket, predicted: r.predicted, wonRate: r.won_rate ?? 0 })
    }
    const byScoreBucket: BucketRow[] = BUCKET_ORDER.map(b =>
      bucketMap.get(b) ?? { bucket: b, predicted: 0, wonRate: 0 }
    )

    // ── Monthly calibration (last 12 months) ──────────────────────────────────
    const monthRows = await db.execute(sql`
      SELECT
        TO_CHAR(resolved_at, 'Mon YYYY') AS month,
        ROUND(AVG(predicted_score)::numeric, 1)::float AS predicted,
        ROUND(
          SUM(CASE WHEN actual_outcome = 'won' THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(*), 0) * 100, 1
        )::float AS actual,
        COUNT(*)::int AS count
      FROM deal_prediction_log
      WHERE workspace_id = ${workspaceId}
        AND actual_outcome IS NOT NULL
        AND resolved_at >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(resolved_at, 'Mon YYYY'), DATE_TRUNC('month', resolved_at)
      ORDER BY DATE_TRUNC('month', resolved_at) ASC
    `)

    const recentCalibration: CalibrationRow[] = (
      monthRows as unknown as { month: string; predicted: number; actual: number; count: number }[]
    ).map(r => ({ month: r.month, predicted: r.predicted ?? 0, actual: r.actual ?? 0, count: r.count }))

    const result: ForecastAccuracy = {
      totalPredictions,
      correctPredictions,
      accuracy,
      byScoreBucket,
      recentCalibration,
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    return dbErrResponse(err)
  }
}
