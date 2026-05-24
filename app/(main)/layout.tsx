import { cookies } from 'next/headers'
import MainIdentityGate from '@/components/MainIdentityGate'
import { getAuthenticatedPlayer } from '@/lib/auth-server'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const cookieName = cookieStore.get('playerName')?.value
  const authPlayer = await getAuthenticatedPlayer()
  const playerName = authPlayer?.name ?? (cookieName ? decodeURIComponent(cookieName) : 'Pemain')

  return (
    <div className="flex flex-col min-h-dvh">
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
          Hi,{' '}
          <span className="font-medium">{playerName}</span>
        </span>
        <form method="post" action="/api/identity/logout">
          <button
            type="submit"
            className="text-xs transition-colors duration-150"
            style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', minHeight: '44px', padding: '0 0.25rem' }}
          >
            ganti identitas
          </button>
        </form>
      </header>

      <MainIdentityGate>
        <main className="flex-1">
          {children}
        </main>
      </MainIdentityGate>
    </div>
  )
}
