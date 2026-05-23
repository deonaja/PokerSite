'use client'

import { useRouter } from 'next/navigation'
import type { Player } from '@/lib/types'

export default function IdentityPicker({ players }: { players: Player[] }) {
  const router = useRouter()

  function pick(player: Player) {
    localStorage.setItem('playerId', player.id)
    localStorage.setItem('playerName', player.name)
    router.push('/')
  }

  return (
    <div className="flex flex-col px-4 pt-12 pb-8">
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Pilih nama kamu
      </p>

      {players.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Belum ada pemain terdaftar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p)}
              className="w-full text-left px-4 rounded-lg border transition-colors duration-150"
              style={{
                minHeight: '44px',
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
