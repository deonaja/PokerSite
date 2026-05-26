import { sql } from '@/lib/db'
import type { Player } from '@/lib/types'
import IdentityPicker from '@/components/IdentityPicker'

async function getPlayers(): Promise<Player[]> {
  const rows = await sql`
    SELECT id, name, balance, created_at
    FROM players
    ORDER BY name ASC
  `
  return rows as Player[]
}

export default async function IdentityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [players, params] = await Promise.all([getPlayers(), searchParams])
  return <IdentityPicker players={players} error={params.error} />
}
