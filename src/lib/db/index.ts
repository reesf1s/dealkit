import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Use a dummy URL if DATABASE_URL is not set — postgres is lazy and won't
// actually connect until a query is executed, so this prevents a crash at
// module load time. API routes catch the resulting query error and return 503.
const connectionString = (process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@placeholder/placeholder').trim()

const isSupabase = connectionString.includes('supabase.co') || connectionString.includes('pooler.supabase.com')

const client = postgres(connectionString, {
  // Allow up to 5 concurrent queries per serverless invocation so that
  // Promise.all([5 queries]) runs in parallel instead of serializing.
  // Each Vercel lambda instance has its own pool; 5 concurrent invocations
  // × 1 active connection each = 5 Supabase connections (within free tier).
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: isSupabase ? 'require' : false,
})
export const db = drizzle(client, { schema })

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL
}
