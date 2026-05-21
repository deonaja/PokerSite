import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@vercel/postgres'

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL

if (!connectionString) {
  console.error('Error: DATABASE_URL or POSTGRES_URL env var not set')
  console.error('Create .env.local with DATABASE_URL="your-connection-string"')
  process.exit(1)
}

async function migrate() {
  const migrationSQL = readFileSync(
    resolve(process.cwd(), 'db/migrations/001_init.sql'),
    'utf-8'
  )
  // createClient accepts direct (non-pooled) connection strings
  const client = createClient({ connectionString })
  await client.connect()
  try {
    await client.query(migrationSQL)
    console.log('✓ Migration 001_init.sql applied')
  } finally {
    await client.end()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
