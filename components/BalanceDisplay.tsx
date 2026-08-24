import { cn } from '@/lib/utils'

interface Props {
  balance: number
  className?: string
}

export default function BalanceDisplay({ balance, className }: Props) {
  return (
    <span
      className={cn(
        // Teletext live figure: cyan when up, red when negative.
        'font-mono text-sm tabular-nums',
        balance < 0 ? 'text-[var(--tt-red)]' : 'text-[var(--tt-cyan)]',
        className
      )}
    >
      {balance}
    </span>
  )
}
