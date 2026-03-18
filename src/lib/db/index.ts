import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Use a dummy URL if DATABASE_URL is not set — postgres is lazy and won't
// actually connect until a query is executed, so this prevents a crash at
// module load time. API routes catch the resulting query error and return 503.
const connectionString = (process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@placeholder/placeholder').trim()

const isSupabase = connectionString.includes('supabase.co') || connectionString.includes('pooler.supabase.com')
// Supabase pgBouncer pooler (port 6543) doesn't support prepared statements
const isPooler = connectionString.includes('pooler.supabase.com') || connectionString.includes(':6543/')

const client = postgres(connectionString, {
  // Serverless: pool size balanced for concurrency vs connection limits.
  // pgBouncer (pooler) multiplexes to Postgres — 5 app connections is fine.
  // Direct connections count against Supabase's limit — 10 is safe on pro.
  max: isPooler ? 5 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  // Kill runaway queries after 55 seconds — prevents connection starvation
  // (55s to stay within Vercel's 60s serverless function limit)
  connection: {
    statement_timeout: 55000,
  },
  ssl: isSupabase ? 'require' : false,
  // pgBouncer in transaction mode doesn't support prepared statements
  prepare: !isPooler,
})
export const db = drizzle(client, { schema })

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL
}
