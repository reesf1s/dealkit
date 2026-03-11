import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Use a dummy URL if DATABASE_URL is not set — postgres is lazy and won't
// actually connect until a query is executed, so this prevents a crash at
// module load time. API routes catch the resulting query error and return 503.
const connectionString = process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@placeholder/placeholder'

const client = postgres(connectionString, {
  max: 1,
  ssl: connectionString.includes('supabase.co') ? 'require' : false,
})
export const db = drizzle(client, { schema })

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL
}
