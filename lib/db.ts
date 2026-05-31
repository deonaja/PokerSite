import { neon } from '@neondatabase/serverless'
import { createClient } from '@vercel/postgres'

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
if (!connectionString) throw new Error('Missing DATABASE_URL or POSTGRES_URL env var')

// @vercel/postgres createClient() only accepts a DIRECT (non-pooled) connection.
// Neon's pooled host carries a "-pooler" segment; strip it for the transactional
// client. No-op for an already-direct string (e.g. local dev / self-hosted PG).
const directConnectionString = connectionString.replace('-pooler.', '.')

// HTTP-based SQL for reads (server components, polling) — pooled is fine here.
export const sql = neon(connectionString)

// Direct client for transactions with SELECT FOR UPDATE (server actions)
export function createDbClient() {
  return createClient({ connectionString: directConnectionString })
}
