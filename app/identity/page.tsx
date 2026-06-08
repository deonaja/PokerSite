// Reads live DB state (active season + player list) on every request — must never
// be statically prerendered, or the build-time empty DB bakes a permanent
// redirect to /season/new (redirect fires before searchParams is awaited).
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import type { PickerPlayer } from '@/lib/types'
import IdentityPicker from '@/components/IdentityPicker'

// Stays GLOBAL by design (identity ≠ membership): an old non-member must be able to
// log in here before they can "Gabung musim". We only ANNOTATE each row with whether
// they're a member of the active season so the picker can sort members first — never
// hide anyone, or non-members could never log in to rejoin.
async function getPlayers(seasonId: string): Promise<PickerPlayer[]> {
  const rows = await sql`
    SELECT p.id, p.name, p.balance, p.created_at,
           (mp.player_id IS NOT NULL) AS is_member
    FROM players p
    LEFT JOIN season_players mp
      ON mp.player_id = p.id AND mp.season_id = ${seasonId}
    ORDER BY (mp.player_id IS NOT NULL) DESC, p.name ASC
  `
  return rows as PickerPlayer[]
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

  const [players, params] = await Promise.all([
    getPlayers((activeSeason[0] as { id: string }).id),
    searchParams,
  ])
  return <IdentityPicker players={players} error={params.error} />
}
