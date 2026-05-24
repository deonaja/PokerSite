'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Player } from '@/lib/types'
import Button from './Button'
import { startSession } from '@/lib/actions/session'

export default function SessionSetupForm({ players }: { players: Player[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dealerId, setDealerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    setDealerId((prev) => (prev === id ? null : prev))
  }

  const selectedPlayers = players.filter((p) => selectedIds.has(p.id))
  const canStart = selectedIds.size >= 2 && dealerId !== null

  const recommendedDealerId = selectedPlayers.length >= 2
    ? [...selectedPlayers].sort((a, b) => a.balance - b.balance)[0]?.id ?? null
    : null

  useEffect(() => {
    if (selectedPlayers.length < 2) {
      setDealerId(null)
      return
    }
    if (!dealerId || !selectedIds.has(dealerId)) {
      const recommended = [...selectedPlayers].sort((a, b) => a.balance - b.balance)[0]?.id ?? null
      setDealerId(recommended)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds])

  function handleSubmit() {
    if (!canStart || isPending) return
    setError(null)

    const actorPlayerId = localStorage.getItem('playerId') ?? ''

    startTransition(async () => {
      const result = await startSession({
        playerIds: Array.from(selectedIds),
        dealerId: dealerId!,
        actorPlayerId,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push('/session')
      }
    })
  }

  const rowStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: `1px solid ${active ? 'var(--accent-felt)' : 'var(--border-subtle)'}`,
    background: active ? 'var(--accent-felt-dim)' : 'var(--bg-surface)',
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'border-color 150ms ease, background 150ms ease',
  })

  return (
    <div style={{ padding: '1.5rem 1rem 0' }}>
      {/* Player checkboxes */}
      <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
        PILIH PEMAIN
      </p>

      {players.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Belum ada pemain terdaftar.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {players.map((p) => (
            <label key={p.id} style={rowStyle(selectedIds.has(p.id))}>
              {/* Always uncontrolled — React won't reset on hydration.
                  useEffect syncs pre-hydration clicks; onChange handles post-hydration. */}
              <input
                type="checkbox"
                data-player-id={p.id}
                checked={selectedIds.has(p.id)}
                disabled={!isHydrated || isPending}
                onChange={() => togglePlayer(p.id)}
                style={{ accentColor: 'var(--accent-felt)', width: '16px', height: '16px', flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</span>
            </label>
          ))}
        </div>
      )}

      {/* Dealer radios — only for checked players */}
      {selectedPlayers.length > 0 && (
        <>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
            PILIH DEALER
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {selectedPlayers.map((p) => (
              <label key={p.id} style={rowStyle(dealerId === p.id)}>
                <input
                  type="radio"
                  name="dealer"
                  value={p.id}
                  checked={dealerId === p.id}
                  disabled={!isHydrated || isPending}
                  onChange={() => setDealerId(p.id)}
                  style={{ accentColor: 'var(--accent-felt)', width: '16px', height: '16px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', marginLeft: '0.25rem' }}>
                  {p.balance}
                </span>
                {p.id === recommendedDealerId && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '0.625rem',
                    fontWeight: 500,
                    letterSpacing: '0.05em',
                    color: 'var(--accent-felt)',
                    border: '1px solid var(--accent-felt)',
                    borderRadius: '4px',
                    padding: '1px 5px',
                    flexShrink: 0,
                  }}>
                    REKOMENDASI
                  </span>
                )}
              </label>
            ))}
          </div>
        </>
      )}

      {error && (
        <p style={{ fontSize: '0.875rem', color: 'var(--accent-danger)', marginBottom: '1rem' }}>
          {error}
        </p>
      )}

      {/* Sticky CTA */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '480px',
          padding: '0.75rem 1rem',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-base)',
        }}
      >
        <Button fullWidth disabled={!isHydrated || !canStart || isPending} onClick={handleSubmit}>
          {isPending ? 'Memulai...' : 'Mulai'}
        </Button>
      </div>
    </div>
  )
}
