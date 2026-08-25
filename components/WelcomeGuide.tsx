'use client'

import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { getLocalStorageItem, setLocalStorageItem } from '@/lib/safeStorage'
import { GUIDE_SEEN_KEY } from '@/lib/guide'
import { startTour } from '@/lib/tour'

// One-time first-run fork, shown on /identity (unauthenticated) the first
// time a device lands here. Forks two audiences: a porto visitor who wants
// the guided read-only walkthrough of the real app ("Tur Tamu"), and an
// actual player who just wants to log in. Defaults closed so SSR and the
// first client render match (no hydration mismatch), then opens from an
// effect once we can read localStorage and find no prior "seen" flag.
export default function WelcomeGuide() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (getLocalStorageItem(GUIDE_SEEN_KEY) == null) setOpen(true)
    // If the tour gets started elsewhere (the manual "Mulai tur" link), don't
    // pop this fork over it.
    const close = () => setOpen(false)
    window.addEventListener('guide-seen', close)
    return () => window.removeEventListener('guide-seen', close)
  }, [])

  function dismiss() {
    setLocalStorageItem(GUIDE_SEEN_KEY, '1')
    setOpen(false)
  }

  return (
    <Sheet isOpen={open} onClose={dismiss} title="Selamat datang">
      <p className="m-0 mb-4 text-sm leading-relaxed text-muted-foreground">
        Aplikasi ini buat ngatur chip &amp; saldo poker grup kamu. Baru pertama
        kali mampir? Ada tur singkat yang muter ke layar-layar aslinya —
        dashboard, sesi, sampe settle-nya.
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setLocalStorageItem(GUIDE_SEEN_KEY, '1')
            setOpen(false)
            startTour()
          }}
          className="flex min-h-12 items-center justify-center bg-[var(--tt-yellow)] text-base font-semibold uppercase tracking-wide text-black transition-colors hover:bg-[color-mix(in_srgb,var(--tt-yellow)_86%,#000)]"
        >
          Mulai tur
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 cursor-pointer bg-transparent text-sm text-muted-foreground"
        >
          Aku pemain, langsung masuk
        </button>
      </div>
    </Sheet>
  )
}
