import type { Player } from '@/lib/types'
import BalanceDisplay from './BalanceDisplay'

interface Props {
  player: Player
}

export default function PlayerCard({ player }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        minHeight: '44px',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
        {player.name}
      </span>
      <BalanceDisplay balance={player.balance} />
    </div>
  )
}
