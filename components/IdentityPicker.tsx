'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { PickerPlayer } from '@/lib/types'
import Button from './Button'
import RegisterForm from './RegisterForm'
import { setLocalStorageItem } from '@/lib/safeStorage'

interface Props {
  players: PickerPlayer[]
  error?: string
}

const initialOf = (name: string) => (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

export default function IdentityPicker({ players, error }: Props) {
  // players arrives members-first (active-season members, then everyone else).
  const [selectedId, setSelectedId] = useState<string>(players[0]?.id ?? '')
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const { members, others } = useMemo(() => {
    const members: PickerPlayer[] = []
    const others: PickerPlayer[] = []
    for (const p of players) (p.is_member ? members : others).push(p)
    return { members, others }
  }, [players])
  // Only label the groups when there's an actual distinction to draw.
  const showGroups = members.length > 0 && others.length > 0

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
    <div className="flex min-h-dvh flex-col">
      {/* Teletext status bar + page id */}
      <div className="flex items-center gap-2.5 border-b-2 border-[var(--tt-rule)] bg-black px-3 py-2">
        <span className="text-lg uppercase tracking-[0.12em] text-[var(--tt-yellow)]">PokerAja</span>
        <span className="ml-auto text-base uppercase tracking-wide text-[var(--text-tertiary)]">
          <span className="text-[var(--tt-magenta)]">P000</span> Identitas
        </span>
      </div>

      <div className="flex flex-1 flex-col px-3 pt-5 pb-8">
        {mode === 'register' ? (
          <>
            <h1 className="mb-5 text-2xl uppercase tracking-[0.06em] text-[var(--tt-yellow)]">Daftar Pemain Baru</h1>
            <RegisterForm onBack={() => setMode('login')} />
          </>
        ) : (
          <>
            <h1 className="mb-1 text-2xl uppercase tracking-[0.06em] text-[var(--tt-yellow)]">Kamu Siapa?</h1>
            <p className="mb-5 text-base uppercase tracking-wide text-[var(--text-secondary)]">Pilih nama kamu</p>

            {players.length === 0 ? (
              <p className="text-base uppercase tracking-wide text-[var(--text-tertiary)]">Belum ada pemain terdaftar.</p>
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

                {showGroups ? (
                  <>
                    <PlayerGroup code="100" label="Musim ini" players={members} selectedId={selectedId} onSelect={setSelectedId} />
                    <PlayerGroup code="200" label="Lainnya" players={others} selectedId={selectedId} onSelect={setSelectedId} />
                  </>
                ) : (
                  <PlayerGroup players={players} selectedId={selectedId} onSelect={setSelectedId} />
                )}

                <label className="mt-2 block text-sm uppercase tracking-[0.1em] text-[var(--text-secondary)]">PIN</label>
                <input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  minLength={4}
                  required
                  autoComplete="one-time-code"
                  placeholder="4-6 DIGIT"
                  className={
                    'w-full border bg-[var(--bg-elevated)] px-4 py-3 text-lg tracking-[0.3em] text-[var(--tt-cyan)] outline-none placeholder:tracking-wide placeholder:text-[var(--text-tertiary)] focus:border-[var(--tt-cyan)] ' +
                    (errorMessage ? 'border-[var(--tt-red)]' : 'border-[var(--tt-rule-strong)]')
                  }
                />

                {errorMessage && (
                  <p className="m-0 border border-[var(--tt-red)] bg-[color-mix(in_srgb,var(--tt-red)_16%,#000)] px-3 py-2 text-base uppercase tracking-wide text-[var(--tt-red)]">
                    {errorMessage}
                  </p>
                )}

                <Button type="submit" fullWidth disabled={!selectedId} className="h-12 bg-[var(--tt-yellow)] text-black">
                  Masuk
                </Button>
              </form>
            )}

            <button
              type="button"
              onClick={() => setMode('register')}
              className="mt-4 min-h-11 self-center text-base uppercase tracking-wide text-[var(--tt-cyan)] underline-offset-4 hover:underline"
            >
              + Daftar pemain baru
            </button>
          </>
        )}

        <div className="mt-auto flex flex-col items-center gap-2 pt-6">
          <Link href="/lihat" className="text-base uppercase tracking-wide text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--tt-cyan)] hover:underline">
            Lihat dulu (tanpa daftar)
          </Link>
          <Link href="/panduan" className="text-base uppercase tracking-wide text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--tt-cyan)] hover:underline">
            Baru di sini? Lihat panduan
          </Link>
        </div>
      </div>
    </div>
  )
}

function PlayerGroup({
  code,
  label,
  players,
  selectedId,
  onSelect,
}: {
  code?: string
  label?: string
  players: PickerPlayer[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  if (players.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p className="mt-1 px-0.5 text-sm uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          {code && <span className="text-[var(--tt-magenta)]">{code} </span>}
          {label}
        </p>
      )}
      {players.map((p) => {
        const active = p.id === selectedId
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            aria-pressed={active}
            className={
              'flex min-h-12 w-full items-center gap-3 border px-4 py-3 text-left transition-colors duration-150 ' +
              (active
                ? 'border-[var(--tt-cyan)] bg-[var(--tt-cyan-dim)]'
                : 'border-[var(--tt-rule)] bg-[#0a0a0a] hover:bg-[var(--bg-elevated)]')
            }
          >
            <span
              aria-hidden
              className={
                'flex h-9 w-9 shrink-0 items-center justify-center border text-base uppercase ' +
                (active
                  ? 'border-[var(--tt-cyan)] bg-black text-[var(--tt-cyan)]'
                  : 'border-[var(--tt-rule-strong)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]')
              }
            >
              {initialOf(p.name)}
            </span>
            <span className={'truncate text-lg uppercase tracking-wide ' + (active ? 'text-[var(--tt-white)]' : 'text-[var(--text-secondary)]')}>
              {p.name}
            </span>
            {active && <span className="ml-auto text-[var(--tt-cyan)]">◀</span>}
          </button>
        )
      })}
    </div>
  )
}
