'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { rebuy, undoRebuy, joinSession, cancelSession } from '@/lib/actions/session'
import { usePoll } from '@/lib/usePoll'
import { useElapsedSeconds } from '@/lib/useElapsed'
import { formatClock } from '@/lib/duration'
import Sheet from './Sheet'
import Button from './Button'
import PixelIcon from './PixelIcon'
import Avatar from './Avatar'
import { Badge } from './ui/badge'
import type { PollParticipant, PollResponse } from '@/lib/types'
import { getLocalStorageItem } from '@/lib/safeStorage'

interface Props {
  sessionId: string
  initial: PollResponse
  buyIn?: number
  startedAt?: string | null
  currentPlayerId?: string | null
  creatorPlayerId?: string | null
}

export default function SessionView({ sessionId, initial, buyIn = 100, startedAt = null, currentPlayerId = null, creatorPlayerId = null }: Props) {
  const router = useRouter()
  const { players, activeSession } = usePoll(initial)
  const participants: PollParticipant[] = activeSession?.participants ?? []
  const elapsed = useElapsedSeconds(startedAt)

  const isCreator = creatorPlayerId != null && currentPlayerId != null && creatorPlayerId === currentPlayerId

  const [isPending, startTransition] = useTransition()
  const [rebuying, setRebuying] = useState<PollParticipant | null>(null)
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinSelectedId, setJoinSelectedId] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Late-join candidates: active-season members not already seated who can afford
  // the full buy-in (low-balance players can only enter as the dealer, set at start).
  const participantIds = new Set(participants.map((p) => p.player_id))
  const joinCandidates = players.filter((p) => !participantIds.has(p.id) && p.balance >= buyIn)

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

  function closeJoin() {
    if (isPending || !isHydrated) return
    setJoinOpen(false)
    setJoinSelectedId(null)
  }

  function confirmJoin() {
    if (!joinSelectedId || isPending) return
    startTransition(async () => {
      const result = await joinSession({ sessionId, playerId: joinSelectedId })
      setJoinOpen(false)
      setJoinSelectedId(null)
      if ('error' in result) setError(result.error)
      else router.refresh()
    })
  }

  function confirmCancel() {
    if (isPending) return
    startTransition(async () => {
      const result = await cancelSession({ sessionId })
      setCancelOpen(false)
      if ('error' in result) setError(result.error)
      else router.replace('/')
    })
  }

  return (
    <>
      {/* Sticky teletext header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b-2 border-[var(--tt-rule)] bg-black px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Link href="/" className="flex min-h-11 min-w-11 items-center justify-center text-[var(--tt-cyan)]">
            <ArrowLeft aria-label="Kembali" className="h-5 w-5" />
          </Link>
          <div className="flex flex-col leading-tight">
            <span className="flex items-center gap-2 text-lg uppercase tracking-wide text-[var(--tt-yellow)]">
              <PixelIcon name="cards" size={16} className="text-[var(--tt-cyan)]" /> Sesi Aktif
            </span>
            <span className="flex items-center gap-2 text-sm uppercase tracking-wide text-[var(--text-secondary)]">
              {elapsed != null && (
                <span className="tabular-nums text-[var(--tt-cyan)]" aria-label="Durasi sesi">{formatClock(elapsed)}</span>
              )}
              {isCreator && <span>· Kamu yang mulai</span>}
            </span>
          </div>
        </div>
        <Link
          href="/session/end"
          className="flex min-h-10 items-center justify-center border-2 border-[var(--tt-red)] bg-[color-mix(in_srgb,var(--tt-red)_20%,#000)] px-4 text-base uppercase tracking-[0.1em] text-[var(--tt-red)] transition-colors hover:bg-[color-mix(in_srgb,var(--tt-red)_32%,#000)]"
        >
          End
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between border-b-2 border-[var(--tt-red)] bg-[color-mix(in_srgb,var(--tt-red)_18%,#000)] px-4 py-3 text-base uppercase tracking-wide text-[var(--tt-red)]">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="cursor-pointer border-none bg-transparent px-1 text-xl text-inherit"
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
                <Avatar name={p.player_name} color={p.avatar_color} size={36} className={isMe ? 'ring-2 ring-[var(--tt-cyan)]' : ''} />
                <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-foreground">
                  {p.player_name}
                </span>
                {isMe && (
                  <Badge variant="outline" className="border-primary text-primary">kamu</Badge>
                )}
                {p.is_dealer && <Badge className="inline-flex items-center gap-1"><PixelIcon name="star" size={11} />DEALER</Badge>}
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
                  <div className="mt-2 mb-2.5 flex items-baseline gap-4 text-base uppercase tracking-wide">
                    <span className="text-[var(--text-secondary)]">
                      Saldo{' '}
                      <span className={'tabular-nums ' + (lowBalance ? 'text-[var(--tt-yellow)]' : 'text-[var(--tt-cyan)]')}>{p.balance}</span>
                    </span>
                    <span className="text-[var(--text-secondary)]">
                      Rebuy <span className="tabular-nums text-[var(--tt-white)]">{p.rebuy_count}</span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      disabled={!isHydrated || isPending || noBalance}
                      onClick={() => setRebuying(p)}
                      className="min-h-11 flex-1 text-base"
                    >
                      {noBalance ? 'Saldo habis' : 'Rebuy'}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!isHydrated || isPending || p.rebuy_count === 0}
                      onClick={() => handleUndo(p)}
                      className="min-h-11 flex-1 text-base"
                    >
                      Undo
                    </Button>
                  </div>
                </>
              )}
            </div>
          )
        })}

        {/* Late join — add a member who arrived after the session started */}
        <Button
          variant="secondary"
          disabled={!isHydrated || isPending}
          onClick={() => setJoinOpen(true)}
          className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 text-[0.8125rem]"
        >
          <UserPlus aria-hidden className="h-4 w-4" />
          Tambah pemain
        </Button>

        {/* Cancel session — only the player who started the session can do this
            from here (admin still has the same action in /admin). */}
        {isCreator && (
          <Button
            variant="danger"
            disabled={!isHydrated || isPending}
            onClick={() => setCancelOpen(true)}
            className="mt-1 inline-flex min-h-11 items-center justify-center text-[0.8125rem]"
          >
            Batalkan sesi
          </Button>
        )}
      </div>

      {/* Late-join sheet */}
      <Sheet isOpen={joinOpen} onClose={closeJoin} title="Tambah pemain ke sesi">
        {joinCandidates.length === 0 ? (
          <p className="mb-5 text-sm text-muted-foreground">
            Tidak ada anggota lain yang bisa gabung — semua sudah ikut atau saldonya kurang dari {buyIn}.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Pemain yang gabung bayar buy-in {buyIn} dan main sebagai pemain biasa.
            </p>
            <div className="mb-5 flex flex-col gap-2">
              {joinCandidates.map((p) => {
                const active = p.id === joinSelectedId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setJoinSelectedId(p.id)}
                    className={
                      'flex min-h-11 w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-150 ' +
                      (active ? 'border-primary bg-accent' : 'border-border bg-card')
                    }
                  >
                    <Avatar name={p.name} color={p.avatar_color} size={32} />
                    <span className="min-w-0 flex-1 truncate text-foreground">{p.name}</span>
                    <span className="font-mono text-[0.8125rem] tabular-nums text-muted-foreground">Saldo: {p.balance}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth disabled={!isHydrated || isPending} onClick={closeJoin}>
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                disabled={!isHydrated || isPending || !joinSelectedId}
                onClick={confirmJoin}
              >
                {isPending ? 'Loading...' : 'Gabungkan'}
              </Button>
            </div>
          </>
        )}
      </Sheet>

      {/* Cancel-session confirmation sheet */}
      <Sheet
        isOpen={cancelOpen}
        onClose={() => !isPending && isHydrated && setCancelOpen(false)}
        title="Batalkan sesi?"
      >
        <p className="mb-5 text-sm text-muted-foreground">
          Yakin batalkan sesi? Buy-in akan dikembalikan ke pemain dan sesi dihapus.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth disabled={!isHydrated || isPending} onClick={() => setCancelOpen(false)}>
            Tidak
          </Button>
          <Button variant="danger" fullWidth disabled={!isHydrated || isPending} onClick={confirmCancel}>
            {isPending ? 'Loading...' : 'Yakin batalkan'}
          </Button>
        </div>
      </Sheet>

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
