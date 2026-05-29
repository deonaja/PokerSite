import Link from 'next/link'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { getAuthenticatedPlayer } from '@/lib/auth-server'
import LocalStorageSync from '@/components/LocalStorageSync'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [activeSeason, authPlayer] = await Promise.all([
    sql`SELECT id FROM seasons WHERE status = 'active' LIMIT 1`,
    getAuthenticatedPlayer(),
  ])
  if (activeSeason.length === 0) redirect('/season/new')
  if (!authPlayer) redirect('/identity')

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm text-foreground">
          Hi,{' '}
          <span className="font-medium">{authPlayer.name}</span>
        </span>
        <div className="flex items-center gap-1">
          <Link
            href="/settings/pin"
            className="flex min-h-11 items-center px-2 text-xs text-[var(--text-tertiary)] transition-colors duration-150 hover:text-muted-foreground"
          >
            ganti PIN
          </Link>
          <form method="post" action="/api/identity/logout">
            <button
              type="submit"
              className="flex min-h-11 cursor-pointer items-center bg-transparent px-1 text-xs text-[var(--text-tertiary)] transition-colors duration-150 hover:text-muted-foreground"
            >
              ganti identitas
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1">
        <LocalStorageSync playerId={authPlayer.id} playerName={authPlayer.name} />
        {children}
      </main>
    </div>
  )
}
