export default function Loading() {
  return (
    <div className="px-4 pt-6">
      <div className="mb-4 h-4 w-20 animate-pulse rounded-sm bg-[var(--bg-elevated)]" />
      <div className="flex flex-col gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[52px] animate-pulse rounded-lg bg-card"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
