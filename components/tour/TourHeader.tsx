'use client'

import { useRouter } from 'next/navigation'
import { endTour } from '@/lib/tour'

// Minimal header for the unauthenticated /tur/* demo routes — no account, no
// avatar, just the brand mark and a one-tap way out of the tour.
export default function TourHeader() {
  const router = useRouter()

  function handleExit() {
    endTour()
    router.push('/identity')
  }

  return (
    <header className="flex items-center gap-2.5 border-b-2 border-[var(--tt-rule)] bg-black px-3 py-2">
      <span className="shrink-0 select-none text-lg uppercase tracking-[0.12em] text-[var(--tt-yellow)]">
        PokerAja
      </span>
      <span className="ml-auto flex items-center gap-2 text-sm uppercase tracking-wide text-[var(--tt-cyan)]">
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 bg-[var(--tt-cyan)]"
          style={{ animation: 'pulse 1.4s steps(2) infinite' }}
        />
        Mode Tur
      </span>
      <button
        type="button"
        onClick={handleExit}
        className="flex h-9 shrink-0 items-center justify-center border border-[var(--tt-rule-strong)] px-3 text-sm uppercase tracking-wide text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
      >
        Keluar
      </button>
    </header>
  )
}
