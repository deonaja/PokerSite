'use client'

import Link from 'next/link'
import { usePoll } from '@/lib/usePoll'
import Button from './Button'
import BalanceDisplay from './BalanceDisplay'
import type { PollResponse, Season } from '@/lib/types'

interface Props {
  initial: PollResponse
  season: Season | null
  currentPlayerId: string | null
}

export default function DashboardClient({ initial, season, currentPlayerId }: Props) {
  const { players, activeSession } = usePoll(initial)

  // Standings: ranked by balance (desc). Copy first — never mutate poll state.
  const ranked = [...players].sort((a, b) => b.balance - a.balance)
  const me = players.find((p) => p.id === currentPlayerId) ?? null
  const myRank = me ? ranked.findIndex((p) => p.id === me.id) + 1 : null
  const myDelta = me && season ? me.balance - season.starting_balance : null

  return (
    <div className="pb-24">
      {/* Hero — the logged-in player's own stack */}
      {me && (
        <section className="px-4 pt-7">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Saldo kamu
          </p>
          <div className="mt-1 flex items-end gap-3">
            <span className="font-mono text-[2.75rem] font-medium leading-none tabular-nums text-foreground">
              {me.balance}
            </span>
            {myDelta !== null && myDelta !== 0 && (
              <span
                className={
                  'mb-1 font-mono text-sm tabular-nums ' +
                  (myDelta > 0 ? 'text-success' : 'text-destructive')
                }
              >
                {myDelta > 0 ? '▲ +' : '▼ '}
                {myDelta}
              </span>
            )}
          </div>
          <div className="mt-2.5 space-y-0.5 text-xs text-muted-foreground">
            {myRank && (
              <p>
                peringkat <span className="font-mono text-foreground">#{myRank}</span> dari {players.length}
              </p>
            )}
            {season && (
              <p>
                Season {season.number}{' · '}
                <span className="text-primary">
                  {season.current_phase === 'steady' ? 'STEADY' : 'BOOTSTRAP'}
                </span>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Active session callout */}
      {activeSession && (
        <div className="px-4 pt-5">
          <Link
            href="/session"
            className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-primary bg-accent px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <span className="text-sm text-foreground">Sesi sedang berjalan</span>
            <span className="text-xs text-[var(--text-tertiary)]">tap untuk lanjut →</span>
          </Link>
        </div>
      )}

      {/* Standings */}
      <section className="px-4 pt-7">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">KLASEMEN</p>
          {season && (
            <Link
              href="/season/history"
              className="text-xs text-[var(--text-tertiary)] transition-colors hover:text-muted-foreground"
            >
              Riwayat musim →
            </Link>
          )}
        </div>

        {ranked.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">Belum ada pemain terdaftar.</p>
        ) : (
          <div>
            {ranked.map((p, i) => {
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
                    {i + 1}
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
        )}
      </section>

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
