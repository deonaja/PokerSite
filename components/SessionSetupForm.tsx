'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Player } from '@/lib/types'
import Button from './Button'
import { startSession } from '@/lib/actions/session'

interface PlayerWithMeta extends Player {
  in_cooldown: boolean
}

interface Props {
  players: PlayerWithMeta[]
  buyIn: number
  currentPhase: 'bootstrap' | 'steady'
}

export default function SessionSetupForm({ players, buyIn, currentPhase }: Props) {
  // Cooldown only matters in Phase 1 (bootstrap) where dealer salary is printed
  const cooldownActive = currentPhase === 'bootstrap'
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dealerId, setDealerId] = useState<string | null>(null)
  const [dealerManuallySet, setDealerManuallySet] = useState(false)
  const [noGajiDealerId, setNoGajiDealerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  function canAffordBuyIn(p: PlayerWithMeta) {
    return p.balance >= buyIn
  }

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        if (dealerId === id) {
          setDealerId(null)
          setDealerManuallySet(false)
        }
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectedPlayers = players.filter((p) => selectedIds.has(p.id))
  // Eligible for paid dealer: can afford buy_in AND not in cooldown (Phase 1 only)
  const isDealerEligible = (p: PlayerWithMeta) => canAffordBuyIn(p) && !(cooldownActive && p.in_cooldown)
  const dealerEligible = selectedPlayers.filter(isDealerEligible)
  // Players who can be no-gaji dealer: not already in the regular game
  const noGajiEligible = players.filter((p) => !selectedIds.has(p.id))

  const canStart = selectedIds.size >= 2 && dealerId !== null
  const recommendedDealerId = dealerEligible.length > 0
    ? [...dealerEligible].sort((a, b) => a.balance - b.balance)[0]?.id ?? null
    : null

  useEffect(() => {
    if (selectedPlayers.length < 2) {
      setDealerId(null)
      setDealerManuallySet(false)
      return
    }
    const currentDealer = players.find((p) => p.id === dealerId)
    const dealerStillValid = !!dealerId && selectedIds.has(dealerId) && !!currentDealer && isDealerEligible(currentDealer)
    // Auto-recommend the lowest-balance eligible player unless the user picked one
    // manually and that pick is still valid.
    if (!dealerManuallySet || !dealerStillValid) {
      setDealerId(recommendedDealerId)
      if (!dealerStillValid) setDealerManuallySet(false)
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
        noGajiDealerId: noGajiDealerId ?? undefined,
        actorPlayerId,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push('/session')
      }
    })
  }

  const rowStyle = (active: boolean, disabled?: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: `1px solid ${active ? 'var(--accent-felt)' : 'var(--border-subtle)'}`,
    background: active ? 'var(--accent-felt-dim)' : 'var(--bg-surface)',
    cursor: disabled ? 'default' : 'pointer',
    minHeight: '44px',
    opacity: disabled ? 0.5 : 1,
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
          {players.map((p) => {
            const lowBalance = !canAffordBuyIn(p)
            return (
              <label key={p.id} style={rowStyle(selectedIds.has(p.id), lowBalance)}>
                <input
                  type="checkbox"
                  data-player-id={p.id}
                  checked={selectedIds.has(p.id)}
                  disabled={!isHydrated || isPending || lowBalance}
                  onChange={() => !lowBalance && togglePlayer(p.id)}
                  style={{ accentColor: 'var(--accent-felt)', width: '16px', height: '16px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {p.balance}
                </span>
                {lowBalance && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--accent-warn)', flexShrink: 0 }}>
                    kurang balance
                  </span>
                )}
              </label>
            )
          })}
        </div>
      )}

      {/* Dealer radios — only eligible players (balance >= buy_in, not in cooldown) */}
      {selectedPlayers.length > 0 && (
        <>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
            PILIH DEALER
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {selectedPlayers.map((p) => {
              const eligible = isDealerEligible(p)
              const showCooldown = cooldownActive && p.in_cooldown
              return (
                <label key={p.id} style={rowStyle(dealerId === p.id, !eligible)}>
                  <input
                    type="radio"
                    name="dealer"
                    value={p.id}
                    checked={dealerId === p.id}
                    disabled={!isHydrated || isPending || !eligible}
                    onChange={() => { if (eligible) { setDealerId(p.id); setDealerManuallySet(true) } }}
                    style={{ accentColor: 'var(--accent-felt)', width: '16px', height: '16px', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', marginLeft: '0.25rem' }}>
                    {p.balance}
                  </span>
                  {showCooldown && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--accent-warn)', flexShrink: 0 }}>
                      cooldown
                    </span>
                  )}
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
              )
            })}
          </div>
        </>
      )}

      {/* No-gaji dealer: optional, for players not in the regular game */}
      {noGajiEligible.length > 0 && (
        <>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
            DEALER TANPA GAJI (opsional)
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.625rem' }}>
            Bagi kartu saja — tidak bayar, tidak dapat apa-apa.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {noGajiEligible.map((p) => (
              <label key={p.id} style={rowStyle(noGajiDealerId === p.id)}>
                <input
                  type="radio"
                  name="no-gaji-dealer"
                  value={p.id}
                  checked={noGajiDealerId === p.id}
                  disabled={!isHydrated || isPending}
                  onChange={() => setNoGajiDealerId(noGajiDealerId === p.id ? null : p.id)}
                  onClick={() => { if (noGajiDealerId === p.id) setNoGajiDealerId(null) }}
                  style={{ accentColor: 'var(--accent-felt)', width: '16px', height: '16px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {p.balance}
                </span>
                {p.balance < buyIn && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--accent-warn)', flexShrink: 0 }}>
                    kurang balance
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
