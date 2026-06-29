'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Player } from '@/lib/types'
import Button from './Button'
import { startSession } from '@/lib/actions/session'
import { getLocalStorageItem } from '@/lib/safeStorage'

interface PlayerWithMeta extends Player {
  cooldown_remaining: number
}

const initialOf = (name: string) => (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-[var(--bg-elevated)] font-mono text-xs font-medium text-foreground">
      {initialOf(name)}
    </span>
  )
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
  const [dealerPlays, setDealerPlays] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // On slower mobile devices, users can tap checkboxes before React hydration
  // fully attaches handlers. Sync any already-checked DOM inputs into state so
  // setup logic (dealer radios/start button) stays consistent.
  useEffect(() => {
    const preHydrationChecked = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[data-player-id]:checked')
    )
      .map((el) => el.dataset.playerId)
      .filter((id): id is string => !!id)

    if (preHydrationChecked.length > 0) {
      setSelectedIds(new Set(preHydrationChecked))
    }
  }, [])

  // Keep state in sync with native checkbox state for a short window after mount.
  // This prevents a "checked but no dealer options" edge case on slower phones
  // where taps can happen around hydration timing.
  useEffect(() => {
    const readCheckedIds = () => {
      const ids = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-player-id]:checked'))
        .map((el) => el.dataset.playerId)
        .filter((id): id is string => !!id)
      const next = new Set(ids)
      setSelectedIds((prev) => {
        if (prev.size === next.size && [...prev].every((id) => next.has(id))) return prev
        return next
      })
    }

    readCheckedIds()
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      readCheckedIds()
      if (Date.now() - startedAt >= 10_000) {
        window.clearInterval(timer)
      }
    }, 200)

    return () => window.clearInterval(timer)
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
  // A neutral dealer (deals only, doesn't play) needs 4+ players so 3 still play.
  const canBeNeutral = selectedIds.size >= 4
  const effectiveDealerPlays = canBeNeutral ? dealerPlays : true
  // A low-balance player can only join as the dealer. Selecting them as a
  // non-dealer is blocked — they have nothing to ante.
  const brokeNonDealers = selectedPlayers.filter((p) => p.id !== dealerId && p.balance < buyIn)
  const canStart = selectedIds.size >= 2 && dealerId !== null && brokeNonDealers.length === 0

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
  // Post-flip 2026-06-29: playing free dealer = 1× chip on table; neutral free
  // dealer = 2× split (1× chip + 1× saldo). Cooldown only matters in Phase 1.
  const dealer = players.find((p) => p.id === dealerId)
  let dealerHint = ''
  if (dealer && !effectiveDealerPlays) {
    // Neutral dealer: deals only, doesn't play.
    if (currentPhase === 'steady') {
      // P2: no upfront salary, no cooldown — collects rake during play instead.
      dealerHint = `${dealer.name}: bagi kartu doang (ga main), ambil rake (10% chip, dibulatin ke 5, cap 20).`
    } else if (dealer.cooldown_remaining === 0) {
      // Phase 1, not cooling down → 2× split salary (post-flip).
      dealerHint = `${dealer.name}: bagi kartu doang (ga main) — gaji 2× buy-in: +${buyIn} chip di meja + ${buyIn} ke saldo (cadangan).`
    } else {
      // Phase 1 but cooling down → NO salary (matches startSession's
      // dealerFreeEntry = !isPhase2 && !cooldown → buy_in_no_gaji_dealer).
      dealerHint = `${dealer.name}: bagi kartu doang (ga main) — cooldown, gak dapat gaji.`
    }
  } else if (dealer) {
    const canAfford = dealer.balance >= buyIn
    const p1NoCooldown = currentPhase === 'bootstrap' && dealer.cooldown_remaining === 0
    if (currentPhase === 'steady') {
      // P2: dealer pays buy-in like everyone else and takes rake during play.
      if (canAfford) {
        dealerHint = `${dealer.name}: bayar buy-in normal + main biasa, ambil rake (10% chip, dibulatin ke 5, cap 20).`
      } else {
        // Broke in P2 → forced to deals-only (no ante, no salary), takes rake.
        dealerHint = `${dealer.name}: saldo kurang — jadi bagi kartu doang, ambil rake (10% chip, dibulatin ke 5, cap 20).`
      }
    } else if (p1NoCooldown) {
      // Phase 1, not cooling down → plays FREE on a 1× buy-in salary stack
      // (no buy-in deduction, no bankroll bonus). Same whether or not they
      // can afford it.
      dealerHint = `${dealer.name}: main gratis pake gaji dealer (+${buyIn} chip di meja, gak bayar buy-in).`
    } else if (canAfford) {
      // P1 + cooldown: pay buy-in, no salary.
      dealerHint = `${dealer.name}: bayar buy-in — cooldown, gak dapat gaji.`
    } else {
      // P1 + cooldown + broke: deals only.
      dealerHint = `${dealer.name}: cuma bagi kartu — cooldown, gak dapat gaji.`
    }
  }

  function handleSubmit() {
    if (!canStart || isPending) return
    setError(null)

    const actorPlayerId = getLocalStorageItem('playerId') ?? ''

    startTransition(async () => {
      const result = await startSession({
        playerIds: Array.from(selectedIds),
        dealerId: dealerId!,
        dealerPlays: effectiveDealerPlays,
        actorPlayerId,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push('/session')
      }
    })
  }

  // Row style: felt-green active state, neutral surface otherwise. Min 44px tap
  // target. transition-colors keeps the 150ms ease without a custom rule.
  const rowClass = (active: boolean) =>
    'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors [touch-action:manipulation] ' +
    (active ? 'border-primary bg-accent' : 'border-border bg-card')

  const sectionLabel = 'mb-3 text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]'

  return (
    <div className="px-4 pt-6">
      {/* Player checkboxes — everyone selectable */}
      <p className={sectionLabel}>PILIH PEMAIN</p>

      {players.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">Belum ada pemain terdaftar.</p>
      ) : (
        <div className="mb-6 flex flex-col gap-2">
          {players.map((p) => {
            const lowBalance = p.balance < buyIn
            return (
              <label key={p.id} className={rowClass(selectedIds.has(p.id))}>
                <input
                  type="checkbox"
                  data-player-id={p.id}
                  checked={selectedIds.has(p.id)}
                  disabled={isPending}
                  onChange={() => togglePlayer(p.id)}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <Avatar name={p.name} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.name}</span>
                <span className={'font-mono text-[0.8125rem] ' + (lowBalance ? 'text-warn' : 'text-[var(--text-tertiary)]')}>
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
          <p className={sectionLabel}>SIAPA YANG BAGI KARTU?</p>
          <div className="mb-3 flex flex-col gap-2">
            {selectedPlayers.map((p) => (
              <label key={p.id} className={rowClass(dealerId === p.id)}>
                <input
                  type="radio"
                  name="dealer"
                  value={p.id}
                  checked={dealerId === p.id}
                  disabled={isPending}
                  onChange={() => { setDealerId(p.id); setDealerManuallySet(true) }}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <Avatar name={p.name} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.name}</span>
                <span className="shrink-0 font-mono text-[0.8125rem] text-[var(--text-tertiary)]">{p.balance}</span>
                {p.cooldown_remaining > 0 && currentPhase === 'bootstrap' && (
                  <span className="shrink-0 text-[0.6875rem] text-warn">
                    cooldown {p.cooldown_remaining} sesi
                  </span>
                )}
                {p.id === recommendedDealerId && (
                  <span className="shrink-0 rounded-sm border border-primary px-1.5 py-px text-[0.625rem] font-medium tracking-[0.05em] text-primary">
                    REKOMENDASI
                  </span>
                )}
              </label>
            ))}
          </div>

          {/* Dealer mode — only when 4+ players (a neutral dealer needs 3 others to play) */}
          {canBeNeutral && (
            <div className="mb-3">
              <p className={sectionLabel}>DEALER IKUT MAIN?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setDealerPlays(true)}
                  className={rowClass(dealerPlays) + ' flex-1 justify-center text-sm font-medium'}
                >
                  Ikut main
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setDealerPlays(false)}
                  className={rowClass(!dealerPlays) + ' flex-1 justify-center text-sm font-medium'}
                >
                  Cuma bagi kartu
                </button>
              </div>
            </div>
          )}

          {dealerHint && (
            <p className={'text-[0.8125rem] text-muted-foreground ' + (brokeNonDealers.length > 0 ? 'mb-2' : 'mb-6')}>
              {dealerHint}
            </p>
          )}

          {brokeNonDealers.length > 0 && (
            <p className="mb-6 text-[0.8125rem] text-warn">
              {brokeNonDealers.map((p) => p.name).join(', ')} balance kurang — harus jadi dealer atau batalin pilihannya.
            </p>
          )}
        </>
      )}

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button
          fullWidth
          disabled={!canStart || isPending}
          onClick={handleSubmit}
          className="h-12 text-base font-semibold uppercase tracking-wide"
        >
          {isPending ? 'Memulai...' : 'Mulai'}
        </Button>
      </div>
    </div>
  )
}
