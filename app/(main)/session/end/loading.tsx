export default function Loading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <div className="h-9 w-20 animate-pulse rounded-md bg-[var(--bg-elevated)]" />
        <div className="h-4 w-12 animate-pulse rounded-sm bg-[var(--bg-elevated)]" />
      </div>

      {/* Content skeleton */}
      <div className="flex flex-col items-center gap-3 px-6 pt-8">
        <div className="h-6 w-32 animate-pulse rounded-sm bg-[var(--bg-elevated)]" />
        <div className="h-20 w-full animate-pulse rounded-lg bg-card" style={{ animationDelay: '100ms' }} />
        <div className="h-[72px] w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" style={{ animationDelay: '200ms' }} />
      </div>
    </div>
  )
}
