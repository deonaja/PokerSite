'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { rebuy, undoRebuy } from '@/lib/actions/session'
import { usePoll } from '@/lib/usePoll'
import Sheet from './Sheet'
import Button from './Button'
import type { PollParticipant, PollResponse } from '@/lib/types'

interface Props {
  sessionId: string
  initial: PollResponse
  buyIn?: number
}

export default function SessionView({ sessionId, initial, buyIn = 100 }: Props) {
  const router = useRouter()
  const { activeSession } = usePoll(initial)
  const participants: PollParticipant[] = activeSession?.participants ?? []

  const [isPending, startTransition] = useTransition()
  const [rebuying, setRebuying] = useState<PollParticipant | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  function confirmRebuy() {
    if (!rebuying || isPending) return
    const actorPlayerId = localStorage.getItem('playerId') ?? ''
    startTransition(async () => {
      const result = await rebuy({ sessionId, playerId: rebuying.player_id, actorPlayerId })
      setRebuying(null)
      if ('error' in result) setError(result.error)
      else router.refresh()
    })
  }

  function handleUndo(p: PollParticipant) {
    if (isPending) return
    const actorPlayerId = localStorage.getItem('playerId') ?? ''
    startTransition(async () => {
      const result = await undoRebuy({ sessionId, playerId: p.player_id, actorPlayerId })
      if ('error' in result) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <>
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.625rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-base)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '44px',
              minHeight: '44px',
              fontSize: '1.125rem',
              color: 'var(--text-secondary)',
            }}
          >
            ←
          </Link>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Sesi aktif
          </span>
        </div>
        <Link
          href="/session/end"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 0.875rem',
            minHeight: '36px',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            background: 'var(--accent-danger)',
            color: 'var(--text-primary)',
          }}
        >
          End
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: 'var(--accent-danger)',
            fontSize: '0.875rem',
            color: 'var(--text-primary)',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0.25rem', fontSize: '1rem' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Participants */}
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {participants.map((p) => (
          <div
            key={p.participant_id}
            style={{
              padding: '0.875rem 1rem',
              borderRadius: '8px',
              border: `1px solid ${p.is_dealer ? 'var(--accent-felt)' : 'var(--border-subtle)'}`,
              background: p.is_dealer ? 'var(--accent-felt-dim)' : 'var(--bg-surface)',
              opacity: p.no_gaji_dealer ? 0.7 : 1,
            }}
          >
            {/* Name + role badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: p.no_gaji_dealer ? 0 : '0.25rem' }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {p.player_name}
              </span>
              {p.is_dealer && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'var(--accent-felt)',
                    color: 'var(--text-primary)',
                  }}
                >
                  ★ DEALER
                </span>
              )}
              {p.no_gaji_dealer && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  BAGI KARTU
                </span>
              )}
            </div>

            {p.no_gaji_dealer ? (
              <>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0, marginBottom: '0.25rem' }}>
                  Bagi kartu, tidak ikut taruhan
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  Saldo: {p.balance}
                </p>
              </>
            ) : (
              <>
                {/* Saldo + Rebuy count */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.875rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.625rem',
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span style={{ color: p.balance < buyIn ? 'var(--accent-warn)' : 'var(--text-secondary)' }}>
                    Saldo: {p.balance}
                  </span>
                  <span>Rebuy: {p.rebuy_count}</span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="secondary"
                    disabled={!isHydrated || isPending || p.balance < buyIn}
                    onClick={() => setRebuying(p)}
                    style={{ flex: 1, fontSize: '0.8125rem', minHeight: '38px' }}
                  >
                    {p.balance < buyIn ? 'Saldo kurang' : 'Rebuy'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!isHydrated || isPending || p.rebuy_count === 0}
                    onClick={() => handleUndo(p)}
                    style={{ flex: 1, fontSize: '0.8125rem', minHeight: '38px' }}
                  >
                    Undo
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Rebuy confirmation sheet */}
      <Sheet
        isOpen={rebuying !== null}
        onClose={() => !isPending && isHydrated && setRebuying(null)}
        title={`Rebuy ${rebuying?.player_name ?? ''}?`}
      >
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Balance kepotong {buyIn}.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="secondary" fullWidth disabled={!isHydrated || isPending} onClick={() => setRebuying(null)}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth disabled={!isHydrated || isPending} onClick={confirmRebuy}>
            {isPending ? 'Loading...' : 'Rebuy'}
          </Button>
        </div>
      </Sheet>
    </>
  )
}
