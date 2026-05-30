'use client'

import Link from 'next/link'
import { usePoll } from '@/lib/usePoll'
import Button from './Button'
import BalanceDisplay from './BalanceDisplay'
import type { Player, PollResponse, Season } from '@/lib/types'

interface Props {
  initial: PollResponse
  season: Season | null
  currentPlayerId: string | null
}

const initialOf = (name: string) => (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

export default function DashboardClient({ initial, season, currentPlayerId }: Props) {
  const { players, activeSession } = usePoll(initial)
  // Standings: ranked by balance (desc). Copy first — never mutate poll state.
  const ranked = [...players].sort((a, b) => b.balance - a.balance)
  const top3 = ranked.slice(0, 3)
  const rest = ranked.slice(3)

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
          <Link href="/season/history" className="shrink-0 transition-colors hover:text-muted-foreground">
            Riwayat musim →
          </Link>
        </div>
      )}

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
                      <span className="text-warn" aria-label="saldo di bawah buy-in" title="saldo di bawah buy-in">
                        ⚠
                      </span>
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
            <span className="text-xs text-[var(--text-tertiary)]">tap untuk lanjut →</span>
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
    </div>
  )
}
