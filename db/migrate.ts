import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env.local before importing @vercel/postgres (reads env at connect time)
for (const envFile of ['.env.local', '.env']) {
  const fullPath = resolve(process.cwd(), envFile)
  if (!existsSync(fullPath)) continue
  for (const line of readFileSync(fullPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!match) continue
    const key = match[1]
    const val = match[2].replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
  break
}

if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  console.error('Error: DATABASE_URL or POSTGRES_URL env var not set')
  console.error('Create .env.local with DATABASE_URL="your-connection-string"')
  process.exit(1)
}

async function migrate() {
  const { db } = await import('@vercel/postgres')
  const migrationSQL = readFileSync(
    resolve(process.cwd(), 'db/migrations/001_init.sql'),
    'utf-8'
  )
  const client = await db.connect()
  try {
    await client.query(migrationSQL)
    console.log('✓ Migration 001_init.sql applied')
  } finally {
    client.release()
  }
  await db.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
