'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Player } from '@/lib/types'
import Button from './Button'
import { setLocalStorageItem } from '@/lib/safeStorage'

interface Props {
  players: Player[]
  error?: string
}

const initialOf = (name: string) => (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

export default function IdentityPicker({ players, error }: Props) {
  const [selectedId, setSelectedId] = useState<string>(players[0]?.id ?? '')

  const selectedPlayer = useMemo(
    () => players.find((p) => p.id === selectedId) ?? null,
    [players, selectedId]
  )

  const errorMessage =
    error === 'invalid' ? 'PIN salah.' :
    error === 'missing' ? 'Pilih pemain dan masukkan PIN.' :
    error === 'locked' ? 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' :
    null

  return (
    <div className="flex flex-col px-4 pt-12 pb-8">
      <p className="mb-6 text-sm text-muted-foreground">Pilih nama kamu</p>

      {players.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">Belum ada pemain terdaftar.</p>
      ) : (
        <form
          method="post"
          action="/api/identity"
          className="flex flex-col gap-3"
          onSubmit={() => {
            if (!selectedPlayer) return
            setLocalStorageItem('playerId', selectedPlayer.id)
            setLocalStorageItem('playerName', selectedPlayer.name)
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
                  className={
                    'flex min-h-11 w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-150 ' +
                    (active ? 'border-primary bg-accent' : 'border-border bg-card')
                  }
                >
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-[var(--bg-elevated)] font-mono text-xs font-medium text-foreground"
                  >
                    {initialOf(p.name)}
                  </span>
                  <span className="truncate text-foreground">{p.name}</span>
                </button>
              )
            })}
          </div>

          <input
            name="pin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            minLength={4}
            required
            autoComplete="one-time-code"
            placeholder="PIN (4-6 digit)"
            className={
              'w-full rounded-lg border bg-[var(--bg-elevated)] px-4 py-3 font-mono text-sm text-foreground outline-none ' +
              (errorMessage ? 'border-destructive' : 'border-input')
            }
          />

          {errorMessage && <p className="m-0 text-[0.8125rem] text-destructive">{errorMessage}</p>}

          <Button type="submit" fullWidth disabled={!selectedId} className="h-12 text-base font-semibold uppercase tracking-wide">
            Masuk
          </Button>
        </form>
      )}

      <Link
        href="/panduan"
        className="mt-6 self-center text-[0.8125rem] text-muted-foreground underline-offset-4 hover:underline"
      >
        Baru di sini? Lihat panduan
      </Link>
    </div>
  )
}
