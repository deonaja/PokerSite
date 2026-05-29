import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const testPlayers = await sql`SELECT id, name FROM players WHERE name LIKE '[T%'`
console.log('Test players ditemukan:', testPlayers.length)
if (testPlayers.length === 0) {
  console.log('DB sudah bersih.')
  process.exit(0)
}

const playerIds = testPlayers.map(p => p.id)

// Cari sessions yang melibatkan test players
const sessionRows = await sql`
  SELECT DISTINCT session_id FROM session_participants
  WHERE player_id = ANY(${playerIds}::uuid[])
`
const sessionIds = sessionRows.map(r => r.session_id)
console.log('Sessions terkait:', sessionIds.length)

if (sessionIds.length > 0) {
  await sql`DELETE FROM edit_log WHERE session_id = ANY(${sessionIds}::uuid[])`
  await sql`DELETE FROM session_participants WHERE session_id = ANY(${sessionIds}::uuid[])`
  await sql`DELETE FROM sessions WHERE id = ANY(${sessionIds}::uuid[])`
}

await sql`DELETE FROM edit_log WHERE player_id = ANY(${playerIds}::uuid[])`
const deleted = await sql`DELETE FROM players WHERE id = ANY(${playerIds}::uuid[]) RETURNING name`
console.log('Dihapus:', deleted.map(p => p.name).join(', '))

const remaining = await sql`SELECT name, balance FROM players ORDER BY created_at`
console.log('\nPlayer tersisa:')
remaining.forEach(p => console.log(` - ${p.name} | balance: ${p.balance}`))
