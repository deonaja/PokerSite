'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('playerId')
    if (!id) {
      router.replace('/identity')
      return
    }
    setPlayerName(localStorage.getItem('playerName') ?? 'Pemain')
    setReady(true)
  }, [router])

  if (!ready) {
    return <div className="min-h-dvh" style={{ background: 'var(--bg-base)' }} />
  }

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
