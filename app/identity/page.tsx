import { sql } from '@/lib/db'
import type { Player } from '@/lib/types'
import IdentityPicker from '@/components/IdentityPicker'

async function getPlayers(): Promise<Player[]> {
  const { rows } = await sql<Player>`
    SELECT id, name, balance, created_at
    FROM players
    ORDER BY name ASC
  `
  return rows
}

export default async function IdentityPage() {
  const players = await getPlayers()
  return <IdentityPicker players={players} />
}
