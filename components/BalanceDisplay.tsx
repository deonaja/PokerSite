import { cn } from '@/lib/utils'

interface Props {
  balance: number
  className?: string
}

export default function BalanceDisplay({ balance, className }: Props) {
  return (
    <span
      className={cn(
        'font-mono text-sm',
        balance < 0 ? 'text-destructive' : 'text-foreground',
        className
      )}
    >
      {balance}
    </span>
  )
}
