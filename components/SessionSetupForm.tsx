'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Player } from '@/lib/types'
import Button from './Button'
import { startSession } from '@/lib/actions/session'

interface PlayerWithMeta extends Player {
  cooldown_remaining: number
}

interface Props {
  players: PlayerWithMeta[]
  buyIn: number
  currentPhase: 'bootstrap' | 'steady'
}

export default function SessionSetupForm({ players, buyIn, currentPhase }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dealerId, setDealerId] = useState<string | null>(null)
  const [dealerManuallySet, setDealerManuallySet] = useState(false)
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
  const canStart = selectedIds.size >= 2 && dealerId !== null

  // Recommend the lowest-balance player who isn't in cooldown (they'll actually
  // get the salary). Fall back to lowest balance overall if everyone's cooling down.
  const notCooling = selectedPlayers.filter((p) => p.cooldown_remaining === 0)
  const recoPool = notCooling.length > 0 ? notCooling : selectedPlayers
  const recommendedDealerId = recoPool.length > 0
    ? [...recoPool].sort((a, b) => a.balance - b.balance)[0]?.id ?? null
    : null

  useEffect(() => {
    if (selectedPlayers.length < 2) {
      setDealerId(null)
      setDealerManuallySet(false)
      return
    }
    const stillValid = !!dealerId && selectedIds.has(dealerId)
    if (!dealerManuallySet || !stillValid) {
      setDealerId(recommendedDealerId)
      if (!stillValid) setDealerManuallySet(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds])

  // What will the chosen dealer actually do this session?
  const dealer = players.find((p) => p.id === dealerId)
  let dealerHint = ''
  if (dealer) {
    const canAfford = dealer.balance >= buyIn
    const p1NoCooldown = currentPhase === 'bootstrap' && dealer.cooldown_remaining === 0
    if (canAfford) {
      if (p1NoCooldown) dealerHint = `${dealer.name}: bayar buy-in + dapet gaji dealer (+${buyIn} chip di meja).`
      else if (currentPhase === 'steady') dealerHint = `${dealer.name}: main + ambil rake.`
      else dealerHint = `${dealer.name}: bayar buy-in — cooldown, gak dapat gaji.`
    } else {
      // Broke
      if (p1NoCooldown) dealerHint = `${dealer.name}: main pake gaji dealer (+${buyIn} chip, gak bayar buy-in).`
      else if (currentPhase === 'steady') dealerHint = `${dealer.name}: bagi kartu + ambil rake (gak ikut main).`
      else dealerHint = `${dealer.name}: cuma bagi kartu — cooldown, gak dapat gaji.`
    }
  }

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

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em',
    color: 'var(--text-tertiary)', marginBottom: '0.75rem',
  }

  return (
    <div style={{ padding: '1.5rem 1rem 0' }}>
      {/* Player checkboxes — everyone selectable */}
      <p style={sectionLabel}>PILIH PEMAIN</p>

      {players.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Belum ada pemain terdaftar.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {players.map((p) => {
            const lowBalance = p.balance < buyIn
            return (
              <label key={p.id} style={rowStyle(selectedIds.has(p.id))}>
                <input
                  type="checkbox"
                  data-player-id={p.id}
                  checked={selectedIds.has(p.id)}
                  disabled={!isHydrated || isPending}
                  onChange={() => togglePlayer(p.id)}
                  style={{ accentColor: 'var(--accent-felt)', width: '16px', height: '16px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ fontSize: '0.8125rem', color: lowBalance ? 'var(--accent-warn)' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {p.balance}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {/* Single dealer choice from the selected players */}
      {selectedPlayers.length > 0 && (
        <>
          <p style={sectionLabel}>SIAPA YANG BAGI KARTU?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {selectedPlayers.map((p) => (
              <label key={p.id} style={rowStyle(dealerId === p.id)}>
                <input
                  type="radio"
                  name="dealer"
                  value={p.id}
                  checked={dealerId === p.id}
                  disabled={!isHydrated || isPending}
                  onChange={() => { setDealerId(p.id); setDealerManuallySet(true) }}
                  style={{ accentColor: 'var(--accent-felt)', width: '16px', height: '16px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', marginLeft: '0.25rem' }}>
                  {p.balance}
                </span>
                {p.cooldown_remaining > 0 && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--accent-warn)', flexShrink: 0 }}>
                    cooldown {p.cooldown_remaining} sesi
                  </span>
                )}
                {p.id === recommendedDealerId && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '0.625rem', fontWeight: 500, letterSpacing: '0.05em',
                    color: 'var(--accent-felt)', border: '1px solid var(--accent-felt)', borderRadius: '4px',
                    padding: '1px 5px', flexShrink: 0,
                  }}>
                    REKOMENDASI
                  </span>
                )}
              </label>
            ))}
          </div>

          {dealerHint && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {dealerHint}
            </p>
          )}
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
