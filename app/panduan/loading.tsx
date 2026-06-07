export default function PanduanLoading() {
  return (
    <div className="mx-auto min-h-dvh max-w-[480px] bg-background pb-10">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <div className="h-6 w-6 animate-pulse rounded bg-[var(--bg-elevated)]" />
        <div className="h-4 w-20 animate-pulse rounded bg-[var(--bg-elevated)]" />
      </div>
      <div className="flex flex-col gap-4 px-4 pt-5">
        <div className="h-6 w-40 animate-pulse rounded bg-[var(--bg-elevated)]" />
        <div className="h-44 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        ))}
      </div>
    </div>
  )
}
