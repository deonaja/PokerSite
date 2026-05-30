'use client'

import Link from 'next/link'
import { usePoll } from '@/lib/usePoll'
import Button from './Button'
import BalanceDisplay from './BalanceDisplay'
import { Badge } from './ui/badge'
import type { PollResponse, Season } from '@/lib/types'

interface Props {
  initial: PollResponse
  season: Season | null
}

export default function DashboardClient({ initial, season }: Props) {
  const { players, activeSession } = usePoll(initial)
  // Standings: ranked by balance (desc). Copy first — never mutate poll state.
  const ranked = [...players].sort((a, b) => b.balance - a.balance)

  return (
    <div className="pb-24">
      {/* Season strip — airy header, not a dense card */}
      {season && (
        <div className="px-4 pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-medium text-foreground">Season {season.number}</span>
              <Badge variant={season.current_phase === 'steady' ? 'warn' : 'default'}>
                {season.current_phase === 'steady' ? 'STEADY' : 'BOOTSTRAP'}
              </Badge>
            </div>
            <Link
              href="/season/history"
              className="text-xs text-[var(--text-tertiary)] transition-colors hover:text-muted-foreground"
            >
              Riwayat musim →
            </Link>
          </div>
          <p className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">
            buy-in {season.buy_in} · BB {season.bb}/{season.sb}
          </p>
        </div>
      )}

      {/* Player standings — ranked by balance, flat aligned columns (no box) */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-3 px-1 pb-1">
          <span />
          <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">PEMAIN</p>
          <span className="text-right text-[0.625rem] uppercase tracking-wider text-[var(--text-tertiary)]">
            saldo
          </span>
        </div>

        {ranked.length === 0 ? (
          <p className="px-1 text-sm text-[var(--text-tertiary)]">Belum ada pemain terdaftar.</p>
        ) : (
          <div>
            {ranked.map((p, i) => {
              const lowBalance = season != null && p.balance < season.buy_in
              return (
                <Link
                  key={p.id}
                  href={`/player/${p.id}`}
                  className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-3 border-b border-border px-1 py-3 transition-colors last:border-0 hover:bg-[var(--bg-elevated)]"
                >
                  <span className="text-right font-mono text-xs tabular-nums text-[var(--text-tertiary)]">
                    {i + 1}
                  </span>
                  <span className="truncate text-sm text-foreground">{p.name}</span>
                  <span className="flex items-center justify-end gap-1.5">
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
      </div>

      {/* Active session card */}
      {activeSession && (
        <div className="px-4 pt-4">
          <Link
            href="/session"
            className="flex min-h-11 items-center rounded-lg border border-primary bg-accent px-4 py-3 transition-colors hover:bg-accent/80"
          >
            <span className="text-sm text-foreground">
              Sesi sedang berjalan — tap untuk lanjut
            </span>
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
