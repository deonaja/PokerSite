export default function Loading() {
  return (
    <div>
      {/* Sticky header skeleton */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="h-9 w-20 animate-pulse rounded-md bg-[var(--bg-elevated)]" />
        <div className="h-9 w-14 animate-pulse rounded-md bg-[var(--bg-elevated)]" />
      </div>

      {/* Participant card skeletons */}
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[104px] animate-pulse rounded-lg bg-card"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
