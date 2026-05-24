import { resolve } from 'path'
import { writeFileSync } from 'fs'
import { config as loadDotenv } from 'dotenv'
import { neon } from '@neondatabase/serverless'

loadDotenv({ path: resolve(process.cwd(), '.env.local') })

export interface TestData {
  runId: number
  adminKey: string
  players: { id: string; name: string; balance: number }[]
}

async function globalSetup() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL not set — check .env.local')
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) throw new Error('ADMIN_KEY not set — check .env.local')

  const sql = neon(dbUrl)
  const runId = Date.now()

  const names = ['Alice', 'Bob', 'Charlie']
  const players: TestData['players'] = []

  for (const shortName of names) {
    const fullName = `[T${runId}] ${shortName}`
    const rows = await sql`
      INSERT INTO players (name, balance) VALUES (${fullName}, 500)
      RETURNING id, name, balance
    ` as { id: string; name: string; balance: number }[]
    players.push(rows[0])
  }

  const data: TestData = { runId, adminKey, players }
  writeFileSync(resolve(process.cwd(), '.test-data.json'), JSON.stringify(data, null, 2))
  console.log(`\n[setup] Created ${players.length} test players (runId: ${runId})`)
}

export default globalSetup
