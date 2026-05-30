'use client'

import Link from 'next/link'
import { usePoll } from '@/lib/usePoll'
import PlayerCard from './PlayerCard'
import Button from './Button'
import { Badge } from './ui/badge'
import type { PollResponse, Season } from '@/lib/types'

interface Props {
  initial: PollResponse
  season: Season | null
}

export default function DashboardClient({ initial, season }: Props) {
  const { players, activeSession } = usePoll(initial)

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

      {/* Player list */}
      <div className="px-4 pt-4">
        <p className="mb-3 text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">
          PEMAIN
        </p>

        {players.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">Belum ada pemain terdaftar.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {players.map((p) => (
              <PlayerCard key={p.id} player={p} buyIn={season?.buy_in} />
            ))}
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
