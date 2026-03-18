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
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  // Kill long-running queries after 30 seconds to prevent connection starvation
  connection: { statement_timeout: '30000' },
  ssl: isSupabase ? 'require' : false,
  // pgBouncer in transaction mode doesn't support prepared statements
  prepare: !isPooler,
})
export const db = drizzle(client, { schema })

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL
}
