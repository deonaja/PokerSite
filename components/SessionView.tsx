'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { rebuy, undoRebuy } from '@/lib/actions/session'
import { usePoll } from '@/lib/usePoll'
import Sheet from './Sheet'
import Button from './Button'
import { Badge } from './ui/badge'
import type { PollParticipant, PollResponse } from '@/lib/types'
import { getLocalStorageItem } from '@/lib/safeStorage'

interface Props {
  sessionId: string
  initial: PollResponse
  buyIn?: number
  currentPlayerId?: string | null
}

const initialOf = (name: string) => (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

export default function SessionView({ sessionId, initial, buyIn = 100, currentPlayerId = null }: Props) {
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
    const actorPlayerId = getLocalStorageItem('playerId') ?? ''
    startTransition(async () => {
      const result = await rebuy({ sessionId, playerId: rebuying.player_id, actorPlayerId })
      setRebuying(null)
      if ('error' in result) setError(result.error)
      else router.refresh()
    })
  }

  function handleUndo(p: PollParticipant) {
    if (isPending) return
    const actorPlayerId = getLocalStorageItem('playerId') ?? ''
    startTransition(async () => {
      const result = await undoRebuy({ sessionId, playerId: p.player_id, actorPlayerId })
      if ('error' in result) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex min-h-11 min-w-11 items-center justify-center text-lg text-muted-foreground">
            ←
          </Link>
          <span className="text-sm font-medium text-foreground">Sesi aktif</span>
        </div>
        <Link
          href="/session/end"
          className="flex min-h-9 items-center justify-center rounded-md bg-destructive px-3.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
        >
          End
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between bg-destructive px-4 py-3 text-sm text-destructive-foreground">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="cursor-pointer border-none bg-transparent px-1 text-base text-inherit"
          >
            ×
          </button>
        </div>
      )}

      {/* Participants */}
      <div className="flex flex-col gap-3 p-4">
        {participants.map((p) => {
          const isMe = currentPlayerId != null && p.player_id === currentPlayerId
          const lowBalance = p.balance < buyIn
          const noBalance = p.balance <= 0
          return (
            <div
              key={p.participant_id}
              className={
                'rounded-lg border px-4 py-3.5 ' +
                (p.is_dealer ? 'border-primary bg-accent ' : 'border-border bg-card ') +
                (p.no_gaji_dealer ? 'opacity-70' : '')
              }
            >
              {/* Avatar + name + role */}
              <div className="flex items-center gap-2.5">
                <span
                  className={
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card font-mono text-sm font-medium text-foreground ' +
                    (isMe ? 'border-2 border-primary ring-2 ring-primary/40' : 'border border-border')
                  }
                >
                  {initialOf(p.player_name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-foreground">
                  {p.player_name}
                </span>
                {isMe && (
                  <Badge variant="outline" className="border-primary text-primary">kamu</Badge>
                )}
                {p.is_dealer && <Badge>★ DEALER</Badge>}
                {p.no_gaji_dealer && (
                  <Badge variant="outline" className="border-input text-muted-foreground">BAGI KARTU</Badge>
                )}
              </div>

              {p.no_gaji_dealer ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-[var(--text-tertiary)]">Bagi kartu, tidak ikut taruhan</span>
                  <span className="font-mono text-[0.8125rem] text-muted-foreground">Saldo: {p.balance}</span>
                </div>
              ) : (
                <>
                  {/* Saldo + rebuy count */}
                  <div className="mt-2 mb-2.5 flex gap-3.5 font-mono text-[0.8125rem] text-muted-foreground">
                    <span className={lowBalance ? 'text-warn' : 'text-muted-foreground'}>Saldo: {p.balance}</span>
                    <span>Rebuy: {p.rebuy_count}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={!isHydrated || isPending || noBalance}
                      onClick={() => setRebuying(p)}
                      className="min-h-[38px] flex-1 text-[0.8125rem]"
                    >
                      {noBalance ? 'Saldo habis' : 'Rebuy'}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!isHydrated || isPending || p.rebuy_count === 0}
                      onClick={() => handleUndo(p)}
                      className="min-h-[38px] flex-1 text-[0.8125rem]"
                    >
                      Undo
                    </Button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Rebuy confirmation sheet */}
      <Sheet
        isOpen={rebuying !== null}
        onClose={() => !isPending && isHydrated && setRebuying(null)}
        title={`Rebuy ${rebuying?.player_name ?? ''}?`}
      >
        <p className="mb-5 text-sm text-muted-foreground">
          Balance kepotong {rebuying ? Math.min(buyIn, rebuying.balance) : buyIn}
          {rebuying && rebuying.balance < buyIn ? ' (sisa saldo)' : ''}.
        </p>
        <div className="flex gap-3">
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
