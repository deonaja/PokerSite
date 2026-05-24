'use client'

import { useMemo, useState } from 'react'
import type { Player } from '@/lib/types'
import Button from './Button'

export default function IdentityPicker({ players }: { players: Player[] }) {
  const [selectedId, setSelectedId] = useState<string>(players[0]?.id ?? '')
  const [pin, setPin] = useState('')

  const selectedPlayer = useMemo(
    () => players.find((p) => p.id === selectedId) ?? null,
    [players, selectedId]
  )

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
        <form
          method="post"
          action="/api/identity"
          className="flex flex-col gap-3"
          onSubmit={() => {
            if (!selectedPlayer) return
            localStorage.setItem('playerId', selectedPlayer.id)
            localStorage.setItem('playerName', selectedPlayer.name)
          }}
        >
          <input type="hidden" name="playerId" value={selectedId} />

          <div className="flex flex-col gap-2">
            {players.map((p) => {
              const active = p.id === selectedId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className="w-full text-left px-4 py-3 rounded-lg border transition-colors duration-150"
                  style={{
                    background: active ? 'var(--accent-felt-dim)' : 'var(--bg-surface)',
                    borderColor: active ? 'var(--accent-felt)' : 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                    minHeight: '44px',
                  }}
                >
                  {p.name}
                </button>
              )
            })}
          </div>

          <input
            name="pin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN (4-6 digit)"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              outline: 'none',
            }}
          />

          <Button type="submit" fullWidth disabled={!selectedId || pin.length < 4}>
            Masuk
          </Button>
        </form>
      )}
    </div>
  )
}
