import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const keyPresent = !!process.env.OPENAI_API_KEY
    const keyPrefix = process.env.OPENAI_API_KEY?.slice(0, 8) || 'NOT SET'

    if (!keyPresent) {
      return NextResponse.json({ status: 'FAILED', error: 'OPENAI_API_KEY not set', keyPresent, keyPrefix })
    }

    // Step 0: Check if pgvector extension exists and column type
    let pgvectorStatus = 'unknown'
    let columnType = 'unknown'
    try {
      const extCheck = await db.execute(sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`)
      const extRows = Array.isArray(extCheck) ? extCheck : (extCheck as any).rows ?? []
      pgvectorStatus = extRows.length > 0 ? 'installed' : 'NOT INSTALLED'
    } catch (e: any) {
      pgvectorStatus = `error: ${e.message}`
    }

    try {
      const colCheck = await db.execute(sql`
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'deal_logs' AND column_name = 'deal_embedding'
      `)
      const colRows = Array.isArray(colCheck) ? colCheck : (colCheck as any).rows ?? []
      columnType = colRows.length > 0 ? JSON.stringify(colRows[0]) : 'COLUMN NOT FOUND'
    } catch (e: any) {
      columnType = `error: ${e.message}`
    }

    // Step 1: Test OpenAI API call
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'test embedding generation for Halvex deal intelligence',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ status: 'OPENAI_FAILED', error, keyPresent, keyPrefix, pgvectorStatus, columnType })
    }

    const data = await response.json()
    const dims = data.data[0].embedding.length
    const embedding: number[] = data.data[0].embedding

    // Step 2: Get the target deal ID
    const idResult = await db.execute(sql`SELECT id FROM deal_logs LIMIT 1`)
    const idRows = Array.isArray(idResult) ? idResult : (idResult as any).rows ?? []
    const targetId = (idRows[0] as any)?.id
    if (!targetId) {
      return NextResponse.json({ status: 'NO_DEALS', pgvectorStatus, columnType })
    }

    // Step 3: Write vector using sql.raw to avoid parameter escaping issues
    let dbWrite = 'not attempted'
    const vectorLiteral = `'[${embedding.join(',')}]'::vector`
    try {
      await db.execute(sql.raw(
        `UPDATE deal_logs SET deal_embedding = ${vectorLiteral} WHERE id = '${targetId}'`
      ))
      dbWrite = 'success'
    } catch (dbErr: any) {
      dbWrite = `failed: ${dbErr.message}`
    }

    // Step 4: Verify the write
    let dbVerify = 'not checked'
    try {
      const check = await db.execute(sql`
        SELECT id, deal_name, deal_embedding IS NOT NULL as has_embedding,
               CASE WHEN deal_embedding IS NOT NULL THEN array_length(deal_embedding::real[], 1) ELSE 0 END as vec_dims
        FROM deal_logs
        WHERE id = ${targetId}
      `)
      const rows = Array.isArray(check) ? check : (check as any).rows ?? []
      dbVerify = JSON.stringify(rows[0] || 'no rows')
    } catch (vErr: any) {
      dbVerify = `failed: ${vErr.message}`
    }

    return NextResponse.json({
      status: 'OK',
      pgvectorStatus,
      columnType,
      openai: { dimensions: dims, model: 'text-embedding-3-small' },
      keyPrefix,
      targetDealId: targetId,
      dbWrite,
      dbVerify,
    })
  } catch (e: any) {
    return NextResponse.json({
      status: 'ERROR',
      message: e.message,
      keyPresent: !!process.env.OPENAI_API_KEY,
      keyPrefix: process.env.OPENAI_API_KEY?.slice(0, 8) || 'NOT SET',
    })
  }
}
