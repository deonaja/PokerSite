export default function Loading() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-12 pb-8">
      <div className="h-7 w-32 animate-pulse rounded bg-[var(--bg-elevated)]" />
      <div className="h-40 animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
    </div>
  )
}
