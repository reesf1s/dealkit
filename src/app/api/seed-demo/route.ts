import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { readFileSync } from 'fs'
import { join } from 'path'

// Temporary endpoint to seed demo data. DELETE AFTER USE.
export async function GET() {
  try {
    // Read the SQL file
    const sqlContent = readFileSync(
      join(process.cwd(), 'scripts', 'demo-data.sql'),
      'utf-8'
    )

    // Remove comments and split by semicolons for individual execution
    const statements = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s !== 'BEGIN' && s !== 'COMMIT')

    let executed = 0
    let errors: string[] = []

    for (const stmt of statements) {
      if (!stmt || stmt.length < 5) continue
      try {
        await db.execute(sql.raw(stmt))
        executed++
      } catch (err: any) {
        // Skip duplicate key errors (ON CONFLICT DO NOTHING should handle, but just in case)
        if (err.message?.includes('duplicate key') || err.message?.includes('already exists')) {
          executed++
          continue
        }
        errors.push(`Statement ${executed}: ${err.message?.slice(0, 200)}`)
        if (errors.length > 5) break // Stop after 5 errors
      }
    }

    return NextResponse.json({
      status: 'OK',
      statementsExecuted: executed,
      totalStatements: statements.length,
      errors: errors.length > 0 ? errors : 'none',
    })
  } catch (err: any) {
    return NextResponse.json({
      status: 'ERROR',
      message: err.message,
    }, { status: 500 })
  }
}
