interface Props {
  balance: number
  className?: string
}

export default function BalanceDisplay({ balance, className }: Props) {
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: '0.875rem',
        color: balance < 0 ? 'var(--accent-danger)' : 'var(--text-primary)',
      }}
    >
      {balance}
    </span>
  )
}
