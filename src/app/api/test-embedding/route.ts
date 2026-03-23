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

    // Step 1: Test OpenAI API call
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'test embedding generation for SellSight deal intelligence',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ status: 'OPENAI_FAILED', error, keyPresent, keyPrefix })
    }

    const data = await response.json()
    const dims = data.data[0].embedding.length
    const embedding = data.data[0].embedding

    // Step 2: Test writing vector to Postgres
    const vectorStr = `[${embedding.join(',')}]`
    let dbWrite = 'not attempted'
    try {
      await db.execute(sql`
        UPDATE deal_logs
        SET deal_embedding = ${vectorStr}::vector
        WHERE id = (SELECT id FROM deal_logs LIMIT 1)
      `)
      dbWrite = 'success'
    } catch (dbErr: any) {
      dbWrite = `failed: ${dbErr.message}`
    }

    // Step 3: Verify the write
    let dbVerify = 'not checked'
    try {
      const check = await db.execute(sql`
        SELECT id, deal_name, deal_embedding IS NOT NULL as has_embedding
        FROM deal_logs
        WHERE id = (SELECT id FROM deal_logs LIMIT 1)
      `)
      const rows = Array.isArray(check) ? check : (check as any).rows ?? []
      dbVerify = JSON.stringify(rows[0] || 'no rows')
    } catch (vErr: any) {
      dbVerify = `failed: ${vErr.message}`
    }

    return NextResponse.json({
      status: 'OK',
      openai: { dimensions: dims, model: 'text-embedding-3-small' },
      keyPrefix,
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
