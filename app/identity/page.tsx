import { redirect } from 'next/navigation'
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
  // No season has started yet → there's nothing to identify into.
  // Force everyone (except admin) to create the first season.
  const activeSeason = await sql`SELECT id FROM seasons WHERE status = 'active' LIMIT 1`
  if (activeSeason.length === 0) redirect('/season/new')

  const [players, params] = await Promise.all([getPlayers(), searchParams])
  return <IdentityPicker players={players} error={params.error} />
}
