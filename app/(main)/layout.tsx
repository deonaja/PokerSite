import Link from 'next/link'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { getAuthenticatedPlayer } from '@/lib/auth-server'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [activeSeason, authPlayer] = await Promise.all([
    sql`SELECT id FROM seasons WHERE status = 'active' LIMIT 1`,
    getAuthenticatedPlayer(),
  ])
  if (activeSeason.length === 0) redirect('/season/new')
  if (!authPlayer) redirect('/identity')

  return (
    <div className="flex flex-col min-h-dvh">
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
          Hi,{' '}
          <span className="font-medium">{authPlayer.name}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Link
            href="/settings/pin"
            className="text-xs transition-colors duration-150"
            style={{ color: 'var(--text-tertiary)', minHeight: '44px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            ganti PIN
          </Link>
          <form method="post" action="/api/identity/logout">
            <button
              type="submit"
              className="text-xs transition-colors duration-150"
              style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', minHeight: '44px', padding: '0 0.25rem' }}
            >
              ganti identitas
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
