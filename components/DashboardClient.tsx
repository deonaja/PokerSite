'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TriangleAlert, ChevronRight } from 'lucide-react'
import { usePoll } from '@/lib/usePoll'
import Button from './Button'
import BalanceDisplay from './BalanceDisplay'
import Sheet from './Sheet'
import LoanWidget from './LoanWidget'
import JoinSeasonPrompt from './JoinSeasonPrompt'
import { getLocalStorageItem, setLocalStorageItem } from '@/lib/safeStorage'
import type { Player, PollResponse, Season } from '@/lib/types'

interface Props {
  initial: PollResponse
  season: Season | null
  sessionsPlayed: number
  currentPlayerId: string | null
}

const initialOf = (name: string) => (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

// localStorage key: the season phase this device last acknowledged.
const PHASE_SEEN_KEY = 'phase_seen'

const PHASE_NOTICE: Record<Season['current_phase'], { title: string; body: string }> = {
  steady: {
    title: 'Naik ke Phase 2 — STEADY',
    body: 'Pool chip udah penuh, musim masuk fase STEADY. Mulai sekarang dealer bayar buy-in seperti pemain lain (ga ada lagi main gratis) dan ngambil rake dari permainan.',
  },
  bootstrap: {
    title: 'Phase 1 — BOOTSTRAP',
    body: 'Musim ada di fase BOOTSTRAP. Dealer main gratis: ga kepotong buy-in dan dapet 1× buy-in chip gaji di meja.',
  },
}

export default function DashboardClient({ initial, season, sessionsPlayed, currentPlayerId }: Props) {
  const { players, activeSession } = usePoll(initial)

  // One-time alert when the season phase changed since this device last looked.
  // Decoupled from who started the session — anyone opening the dashboard after a
  // flip gets notified once. null = no alert showing.
  const [phaseNotice, setPhaseNotice] = useState<Season['current_phase'] | null>(null)
  useEffect(() => {
    if (!season) return
    const current = season.current_phase
    const seen = getLocalStorageItem(PHASE_SEEN_KEY)
    if (seen && seen !== current) setPhaseNotice(current)
    setLocalStorageItem(PHASE_SEEN_KEY, current)
  }, [season])

  // A logged-in player who isn't on the active season roster can join mid-season.
  const isMember = currentPlayerId != null && players.some((p) => p.id === currentPlayerId)
  const showJoinPrompt = currentPlayerId != null && season != null && !isMember

  // Standings: ranked by balance (desc). Copy first — never mutate poll state.
  const ranked = [...players].sort((a, b) => b.balance - a.balance)
  const top3 = ranked.slice(0, 3)
  const rest = ranked.slice(3)

  // Progress toward the next phase.
  //  - Phase 2 (steady): real session count → max_sessions (exact). For new seasons
  //    (migration 012b) the P2 progress uses p1_sessions_actual as the offset so
  //    P2 = M / p2_target is shown directly. Legacy seasons fall back to the
  //    raw sessions_played / max_sessions display.
  //  - Phase 1 (bootstrap): transition is pool-based (SUM(balance) ≥ max_pool),
  //    so show the pool bar DIRECTLY (pool / max_pool) instead of estimating
  //    sessions — honest and immune to the cooldown/no-injection undershoot.
  let phaseProgress: { pct: number; label: string } | null = null
  if (season) {
    if (season.current_phase === 'steady') {
      const p1Actual = season.p1_sessions_actual
      const p2Target = season.p2_target_sessions
      if (p1Actual != null && p2Target != null) {
        // New-schema path: explicit P2 progress.
        const p2Done = Math.max(0, sessionsPlayed - p1Actual)
        const left = Math.max(0, p2Target - p2Done)
        const pct = p2Target > 0 ? Math.min(100, Math.round((p2Done / p2Target) * 100)) : 0
        phaseProgress = {
          pct,
          label: left > 0
            ? `Sesi ${p2Done} / ${p2Target} (P2) · ${left} lagi ke akhir musim`
            : 'Musim siap diakhiri',
        }
      } else {
        // Legacy fallback: pre-012b seasons.
        const left = Math.max(0, season.max_sessions - sessionsPlayed)
        const pct = season.max_sessions > 0
          ? Math.min(100, Math.round((sessionsPlayed / season.max_sessions) * 100))
          : 0
        phaseProgress = { pct, label: left > 0 ? `${left} sesi lagi ke akhir musim` : 'Musim siap diakhiri' }
      }
    } else {
      const pool = players.reduce((s, p) => s + p.balance, 0)
      const pct = season.max_pool > 0
        ? Math.min(100, Math.round((pool / season.max_pool) * 100))
        : 0
      phaseProgress = {
        pct,
        label: pool < season.max_pool
          ? `Pool ${pool.toLocaleString('id-ID')} / ${season.max_pool.toLocaleString('id-ID')}`
          : 'Siap masuk Phase 2',
      }
    }
  }

  // One podium column. Rank 1 is tallest/centre; current player gets a felt ring.
  function PodiumCol({ player, rank }: { player: Player; rank: number }) {
    const isMe = player.id === currentPlayerId
    const blockH = rank === 1 ? 'h-20' : rank === 2 ? 'h-14' : 'h-10'
    const blockBg = rank === 1 ? 'bg-primary' : 'bg-accent'
    const avatarSize = rank === 1 ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm'
    return (
      <Link href={`/player/${player.id}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
        <span
          className={
            'flex shrink-0 items-center justify-center rounded-full bg-card font-mono font-medium text-foreground ' +
            avatarSize +
            (isMe ? ' border-2 border-primary ring-2 ring-primary/40' : ' border border-border')
          }
        >
          {initialOf(player.name)}
        </span>
        <span className="max-w-full truncate px-1 text-xs text-foreground">{player.name}</span>
        <BalanceDisplay balance={player.balance} className="text-xs" />
        <div className={'flex w-full items-start justify-center rounded-t-md pt-1.5 ' + blockH + ' ' + blockBg}>
          <span className={'font-mono text-lg font-semibold ' + (rank === 1 ? 'text-warn' : 'text-foreground')}>
            {rank}
          </span>
        </div>
      </Link>
    )
  }

  return (
    <div className="pb-24">
      {/* Season context line */}
      {season && (
        <div className="flex items-center justify-between gap-3 px-4 pt-4 text-xs text-[var(--text-tertiary)]">
          <span className="truncate">
            Season {season.number}{' · '}
            <span className="text-primary">{season.current_phase === 'steady' ? 'STEADY' : 'BOOTSTRAP'}</span>
          </span>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
            <Link href="/riwayat" className="inline-flex items-center gap-0.5 transition-colors hover:text-muted-foreground">
              Riwayat sesi <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/season/history" className="inline-flex items-center gap-0.5 transition-colors hover:text-muted-foreground">
              Riwayat musim <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Progress toward the next phase */}
      {phaseProgress && (
        <div className="px-4 pt-2.5">
          <div className="mb-1 flex items-center justify-between text-[0.6875rem] text-[var(--text-tertiary)]">
            <span className="truncate">{phaseProgress.label}</span>
            <span className="shrink-0 font-mono tabular-nums">{phaseProgress.pct}%</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]"
            role="progressbar"
            aria-valuenow={phaseProgress.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={phaseProgress.label}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${phaseProgress.pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Mid-season join prompt for a logged-in non-member */}
      {showJoinPrompt && season && <JoinSeasonPrompt phase={season.current_phase} />}

      {/* Peer-to-peer loans (requests, repay, indicators) */}
      <LoanWidget />

      {/* Podium — top 3 (visual order: #2, #1, #3) */}
      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-2 px-4 pt-6">
          {top3[1] && <PodiumCol player={top3[1]} rank={2} />}
          {top3[0] && <PodiumCol player={top3[0]} rank={1} />}
          {top3[2] && <PodiumCol player={top3[2]} rank={3} />}
        </div>
      )}

      {/* The rest of the standings */}
      {rest.length > 0 && (
        <div className="px-4 pt-7">
          <p className="mb-2 text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">
            PERINGKAT LAINNYA
          </p>
          <div>
            {rest.map((p, i) => {
              const lowBalance = season != null && p.balance < season.buy_in
              const isMe = p.id === currentPlayerId
              return (
                <Link
                  key={p.id}
                  href={`/player/${p.id}`}
                  className={
                    'flex items-center gap-3 border-b border-border px-2 py-3 transition-colors last:border-0 hover:bg-[var(--bg-elevated)] ' +
                    (isMe ? 'rounded-md bg-[color-mix(in_srgb,var(--accent-felt)_14%,var(--bg-base))]' : '')
                  }
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--text-tertiary)]">
                    {i + 4}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className={'truncate text-sm ' + (isMe ? 'font-medium text-foreground' : 'text-foreground')}>
                      {p.name}
                    </span>
                    {isMe && (
                      <span className="shrink-0 rounded-sm border border-primary px-1 text-[0.5625rem] uppercase tracking-wide text-primary">
                        kamu
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center justify-end gap-1.5">
                    {lowBalance && (
                      <TriangleAlert aria-label="saldo di bawah buy-in" className="h-3.5 w-3.5 shrink-0 text-warn" />
                    )}
                    <BalanceDisplay
                      balance={p.balance}
                      className={'min-w-[3.5rem] text-right' + (lowBalance ? ' text-warn' : '')}
                    />
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {players.length === 0 && (
        <p className="px-4 pt-6 text-sm text-[var(--text-tertiary)]">Belum ada pemain terdaftar.</p>
      )}

      {/* Active session callout */}
      {activeSession && (
        <div className="px-4 pt-6">
          <Link
            href="/session"
            className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-primary bg-accent px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <span className="text-sm text-foreground">Sesi sedang berjalan</span>
            <span className="inline-flex items-center gap-0.5 text-xs text-[var(--text-tertiary)]">tap untuk lanjut <ChevronRight className="h-3.5 w-3.5" /></span>
          </Link>
        </div>
      )}

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {activeSession ? (
          <Button fullWidth disabled className="h-12 text-base font-semibold uppercase tracking-wide">
            Mulai sesi
          </Button>
        ) : (
          <Link href="/session/setup" className="block">
            <Button fullWidth className="h-12 text-base font-semibold uppercase tracking-wide">
              Mulai sesi
            </Button>
          </Link>
        )}
      </div>

      {/* One-time phase-change alert */}
      <Sheet
        isOpen={phaseNotice !== null}
        onClose={() => setPhaseNotice(null)}
        title={phaseNotice ? PHASE_NOTICE[phaseNotice].title : ''}
      >
        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
          {phaseNotice ? PHASE_NOTICE[phaseNotice].body : ''}
        </p>
        <Button fullWidth onClick={() => setPhaseNotice(null)}>
          Oke, ngerti
        </Button>
      </Sheet>
    </div>
  )
}
