import { neon } from '@neondatabase/serverless'
import { createClient } from '@vercel/postgres'

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
if (!connectionString) throw new Error('Missing DATABASE_URL or POSTGRES_URL env var')

// HTTP-based SQL for reads (server components, polling)
export const sql = neon(connectionString)

// Direct client for transactions with SELECT FOR UPDATE (server actions)
export function createDbClient() {
  return createClient({ connectionString })
}
