import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool } from '@neondatabase/serverless'
import * as schema from './schema'

// Use a dummy URL if DATABASE_URL is not set — the Pool is lazy and won't
// actually connect until a query is executed, so this prevents a crash at
// module load time. API routes catch the resulting query error and return 503.
const connectionString = process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@placeholder/placeholder'

const pool = new Pool({ connectionString })
export const db = drizzle(pool, { schema })

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL
}
