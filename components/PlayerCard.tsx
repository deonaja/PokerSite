import Link from 'next/link'
import type { Player } from '@/lib/types'
import BalanceDisplay from './BalanceDisplay'

interface Props {
  player: Player
  // When provided, a balance below the buy-in is flagged (gold) — these players
  // can only join a session as the dealer.
  buyIn?: number
}

export default function PlayerCard({ player, buyIn }: Props) {
  const lowBalance = buyIn != null && player.balance < buyIn
  return (
    <Link
      href={`/player/${player.id}`}
      className="flex min-h-11 items-center gap-3 rounded-lg border border-border border-l-[3px] border-l-primary bg-card px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)]"
    >
      <span className="flex-1 text-sm text-foreground">{player.name}</span>
      {lowBalance && (
        <span className="text-warn" aria-label="saldo di bawah buy-in" title="saldo di bawah buy-in">
          ⚠
        </span>
      )}
      <BalanceDisplay balance={player.balance} className={lowBalance ? 'text-warn' : undefined} />
    </Link>
  )
}
