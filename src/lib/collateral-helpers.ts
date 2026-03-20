/**
 * Shared helpers for collateral deduplication.
 *
 * Every code path that creates collateral should call `upsertCollateral()`
 * instead of raw `db.insert(collateral)` to prevent duplicate rows for the
 * same (workspace, type, sourceCompetitorId, sourceCaseStudyId) tuple.
 */

import { and, eq, isNull, ne, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral } from '@/lib/db/schema'
import type { CollateralType, CollateralStatus } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface UpsertCollateralOpts {
  workspaceId: string
  userId: string
  type: CollateralType
  title: string
  status?: CollateralStatus
  sourceCompetitorId?: string | null
  sourceCaseStudyId?: string | null
  sourceDealLogId?: string | null
  content?: unknown | null
  rawResponse?: unknown | null
  generatedAt?: Date | null
  customTypeName?: string | null
  generationSource?: string | null
}

/**
 * Insert-or-update collateral, keyed on (workspace, type, competitorId, caseStudyId).
 *
 * For non-custom types that have a natural key (e.g. battlecard + competitorId),
 * this will find the most recent existing row with the same key and update it
 * instead of inserting a duplicate.
 *
 * For `custom` type collateral there is no natural dedup key, so we always insert.
 *
 * Returns the collateral record's `{ id }`.
 */
export async function upsertCollateral(opts: UpsertCollateralOpts): Promise<{ id: string }> {
  const now = new Date()
  const competitorId = opts.sourceCompetitorId ?? null
  const caseStudyId = opts.sourceCaseStudyId ?? null

  // Custom collateral has no natural key — always create a new row
  if (opts.type === 'custom') {
    const [inserted] = await db.insert(collateral).values({
      workspaceId: opts.workspaceId,
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      status: opts.status ?? 'generating',
      sourceCompetitorId: competitorId,
      sourceCaseStudyId: caseStudyId,
      sourceDealLogId: opts.sourceDealLogId ?? null,
      content: opts.content ?? null,
      rawResponse: opts.rawResponse ?? null,
      generatedAt: opts.generatedAt ?? null,
      customTypeName: opts.customTypeName ?? null,
      generationSource: opts.generationSource ?? null,
      createdAt: now,
      updatedAt: now,
    }).returning({ id: collateral.id })
    return inserted
  }

  // For typed collateral, look for an existing row with the same natural key
  // (any status — including 'ready' — to prevent true duplicates)
  const competitorMatch = competitorId
    ? eq(collateral.sourceCompetitorId, competitorId)
    : isNull(collateral.sourceCompetitorId)
  const caseStudyMatch = caseStudyId
    ? eq(collateral.sourceCaseStudyId, caseStudyId)
    : isNull(collateral.sourceCaseStudyId)

  const [existing] = await db
    .select({ id: collateral.id })
    .from(collateral)
    .where(
      and(
        eq(collateral.workspaceId, opts.workspaceId),
        eq(collateral.type, opts.type),
        competitorMatch,
        caseStudyMatch,
        ne(collateral.status, 'archived'),
      ),
    )
    .orderBy(desc(collateral.updatedAt))
    .limit(1)

  if (existing) {
    // Update the existing row in-place
    const [updated] = await db
      .update(collateral)
      .set({
        userId: opts.userId,
        title: opts.title,
        status: opts.status ?? 'generating',
        content: opts.content ?? null,
        rawResponse: opts.rawResponse ?? null,
        generatedAt: opts.generatedAt ?? null,
        sourceDealLogId: opts.sourceDealLogId ?? null,
        generationSource: opts.generationSource ?? null,
        updatedAt: now,
      })
      .where(eq(collateral.id, existing.id))
      .returning({ id: collateral.id })
    return updated
  }

  // No existing row — insert fresh
  const [inserted] = await db.insert(collateral).values({
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    status: opts.status ?? 'generating',
    sourceCompetitorId: competitorId,
    sourceCaseStudyId: caseStudyId,
    sourceDealLogId: opts.sourceDealLogId ?? null,
    content: opts.content ?? null,
    rawResponse: opts.rawResponse ?? null,
    generatedAt: opts.generatedAt ?? null,
    customTypeName: opts.customTypeName ?? null,
    generationSource: opts.generationSource ?? null,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: collateral.id })
  return inserted
}

/**
 * Archive duplicate collateral rows within a workspace.
 *
 * Groups by (workspace_id, type, source_competitor_id, source_case_study_id).
 * For groups with more than one non-archived row, keeps the most recently
 * updated one and sets the rest to 'archived'.
 *
 * Returns the number of rows archived.
 */
export async function archiveDuplicateCollateral(workspaceId?: string): Promise<number> {
  const wsFilter = workspaceId ? `AND c.workspace_id = '${workspaceId}'` : ''

  const dupeRows = await db.execute<{ id: string }>(sql.raw(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY workspace_id, type,
            COALESCE(source_competitor_id::text, ''),
            COALESCE(source_case_study_id::text, '')
          ORDER BY updated_at DESC
        ) AS rn
      FROM collateral c
      WHERE c.status != 'archived'
        AND c.type != 'custom'
        ${wsFilter}
    )
    SELECT id FROM ranked WHERE rn > 1
  `))

  const rows: { id: string }[] = Array.isArray(dupeRows) ? dupeRows : (dupeRows as any).rows ?? []
  if (rows.length === 0) return 0

  const ids = rows.map(r => r.id)

  // Archive in batches of 100
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    await db.execute(sql.raw(
      `UPDATE collateral SET status = 'archived', updated_at = NOW() WHERE id IN (${batch.map(id => `'${id}'`).join(',')})`
    ))
  }

  return ids.length
}
