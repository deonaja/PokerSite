import Link from 'next/link'
import { sql } from '@/lib/db'
import type { Player } from '@/lib/types'
import SessionSetupForm from '@/components/SessionSetupForm'

async function getPlayers(): Promise<Player[]> {
  const rows = await sql`
    SELECT id, name, balance, created_at FROM players ORDER BY name ASC
  `
  return rows as Player[]
}

export default async function SessionSetupPage() {
  const players = await getPlayers()

  return (
    <div style={{ paddingBottom: '6rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <Link
          href="/"
          style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', lineHeight: 1, minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center' }}
        >
          ←
        </Link>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          Setup sesi
        </span>
      </div>

      <SessionSetupForm players={players} />
    </div>
  )
}
