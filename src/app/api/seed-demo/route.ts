import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { readFileSync } from 'fs'
import { join } from 'path'

// Temporary endpoint to seed demo data. DELETE AFTER USE.
export async function GET() {
  try {
    const sqlContent = readFileSync(
      join(process.cwd(), 'scripts', 'demo-data.sql'),
      'utf-8'
    )

    // Remove comment-only lines but keep everything else
    const lines = sqlContent.split('\n')
    const cleanedLines = lines.filter(line => !line.trim().startsWith('--'))
    const cleaned = cleanedLines.join('\n')

    // Smart split: only split on semicolons that are NOT inside single quotes
    const statements: string[] = []
    let current = ''
    let inString = false

    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i]

      if (ch === "'" && cleaned[i - 1] !== "'") {
        inString = !inString
      }

      if (ch === ';' && !inString) {
        const trimmed = current.trim()
        if (trimmed.length > 5 && trimmed !== 'BEGIN' && trimmed !== 'COMMIT') {
          statements.push(trimmed)
        }
        current = ''
      } else {
        current += ch
      }
    }

    // Don't forget the last statement
    const lastTrimmed = current.trim()
    if (lastTrimmed.length > 5 && lastTrimmed !== 'BEGIN' && lastTrimmed !== 'COMMIT') {
      statements.push(lastTrimmed)
    }

    let executed = 0
    const errors: string[] = []

    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt))
        executed++
      } catch (err: any) {
        if (err.message?.includes('duplicate key') || err.message?.includes('already exists')) {
          executed++
          continue
        }
        errors.push(`Stmt ${executed + 1}: ${err.message?.slice(0, 300)}`)
        if (errors.length > 10) break
      }
    }

    return NextResponse.json({
      status: errors.length === 0 ? 'OK' : 'PARTIAL',
      statementsExecuted: executed,
      totalStatements: statements.length,
      errors: errors.length > 0 ? errors : 'none',
    })
  } catch (err: any) {
    return NextResponse.json({ status: 'ERROR', message: err.message }, { status: 500 })
  }
}
