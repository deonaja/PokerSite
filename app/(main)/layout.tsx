import { cookies } from 'next/headers'
import Link from 'next/link'

// Runs before React hydrates — syncs cookies to localStorage so client
// components can still read localStorage.getItem('playerId') as before.
const syncScript = `try{var c=document.cookie.split(';');for(var i=0;i<c.length;i++){var p=c[i].trim().split('=');if(p[0]==='playerId'||p[0]==='playerName')localStorage.setItem(p[0],decodeURIComponent(p.slice(1).join('=')||''));}}catch(e){}`

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const playerName = cookieStore.get('playerName')?.value ?? 'Pemain'

  return (
    <div className="flex flex-col min-h-dvh">
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script dangerouslySetInnerHTML={{ __html: syncScript }} />
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
          Hi,{' '}
          <span className="font-medium">{playerName}</span>
        </span>
        <Link
          href="/identity"
          className="text-xs transition-colors duration-150"
          style={{ color: 'var(--text-tertiary)' }}
        >
          ganti identitas
        </Link>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
