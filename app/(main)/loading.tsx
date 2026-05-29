export default function Loading() {
  return (
    <div className="px-4 pt-6">
      <div className="mb-3 h-4 w-16 animate-pulse rounded-sm bg-[var(--bg-elevated)]" />
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-11 animate-pulse rounded-lg bg-card"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
