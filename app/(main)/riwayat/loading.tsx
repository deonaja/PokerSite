export default function Loading() {
  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <div className="h-6 w-6 rounded-sm bg-[var(--bg-elevated)]" />
        <div className="h-4 w-24 animate-pulse rounded-sm bg-[var(--bg-elevated)]" />
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lg bg-card"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
