import Link from 'next/link'
import type { Player } from '@/lib/types'
import BalanceDisplay from './BalanceDisplay'

interface Props {
  player: Player
}

export default function PlayerCard({ player }: Props) {
  return (
    <Link
      href={`/player/${player.id}`}
      className="flex min-h-11 items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-input"
    >
      <span className="text-sm text-foreground">{player.name}</span>
      <BalanceDisplay balance={player.balance} />
    </Link>
  )
}
