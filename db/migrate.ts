import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@vercel/postgres'

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL

if (!connectionString) {
  console.error('Error: DATABASE_URL or POSTGRES_URL env var not set')
  console.error('Create .env.local with DATABASE_URL="your-connection-string"')
  process.exit(1)
}

async function migrate() {
  const migrationsDir = resolve(process.cwd(), 'db/migrations')
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  const client = createClient({ connectionString })
  await client.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    for (const file of migrationFiles) {
      const { rowCount } = await client.query(
        `SELECT 1 FROM schema_migrations WHERE name = $1 LIMIT 1`,
        [file]
      )

      if (rowCount) {
        console.log(`- Skip ${file} (already applied)`)
        continue
      }

      // Existing projects may already have 001 tables before schema_migrations existed.
      if (file === '001_init.sql') {
        const { rows: [playersTable] } = await client.query<{ exists: string | null }>(
          `SELECT to_regclass('public.players') AS exists`
        )
        if (playersTable?.exists) {
          await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file])
          console.log(`- Mark ${file} as applied (baseline existing schema)`)
          continue
        }
      }

      const migrationSQL = readFileSync(resolve(migrationsDir, file), 'utf-8')
      await client.query('BEGIN')
      try {
        await client.query(migrationSQL)
        await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file])
        await client.query('COMMIT')
        console.log(`OK Migration ${file} applied`)
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    }
  } finally {
    await client.end()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
