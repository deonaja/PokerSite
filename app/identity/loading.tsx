export default function Loading() {
  return (
    <div className="px-4 pt-12 pb-8">
      <div className="mb-6 h-3.5 w-24 animate-pulse rounded-sm bg-[var(--bg-elevated)]" />
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-11 animate-pulse rounded-lg bg-card"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
