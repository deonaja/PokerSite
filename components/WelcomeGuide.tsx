'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from './Sheet'
import Button from './Button'
import { getLocalStorageItem, setLocalStorageItem } from '@/lib/safeStorage'
import { GUIDE_SEEN_KEY } from '@/lib/guide'

// One-time welcome sheet, shown on the first (main) page load per device.
// Mirrors the changelog/phase-notice "seen" pattern: defaults closed so SSR and
// the first client render match (no hydration mismatch), then opens from an
// effect once we can read localStorage and find no prior "seen" flag.
export default function WelcomeGuide() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (getLocalStorageItem(GUIDE_SEEN_KEY) == null) setOpen(true)
    // If the guide gets opened elsewhere (the "?" link), don't pop here.
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
        Aplikasi ini buat ngatur chip & saldo poker grup kamu — pilih identitas,
        mulai sesi, main, lalu tutup sesi buat rekap. Baru pertama kali? Ada
        panduan singkat.
      </p>
      <div className="flex flex-col gap-2">
        <Button
          fullWidth
          onClick={() => {
            setLocalStorageItem(GUIDE_SEEN_KEY, '1')
            setOpen(false)
            router.push('/panduan')
          }}
          className="h-12 text-base font-semibold uppercase tracking-wide"
        >
          Lihat panduan
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 cursor-pointer rounded-lg bg-transparent text-sm text-muted-foreground"
        >
          Nanti aja
        </button>
      </div>
    </Sheet>
  )
}
