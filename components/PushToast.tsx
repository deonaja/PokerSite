'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X } from 'lucide-react'

interface Toast {
  id: number
  title: string
  body: string
  url: string
}

// On Android Chrome, native push banners DON'T pop up while the app is in the
// foreground (the OS assumes you can already see the app). The service worker
// broadcasts every push to the client; this component shows an in-app toast
// so foreground pushes are still visible. Background pushes fire the native
// banner as usual — the toast just won't be on screen since the app is hidden.
export default function PushToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; payload?: { title?: string; body?: string; url?: string } } | undefined
      if (data?.type !== 'push') return
      const p = data.payload ?? {}
      const id = Date.now() + Math.random()
      const toast: Toast = {
        id,
        title: p.title || 'PokerAja',
        body: p.body || '',
        url: p.url || '/',
      }
      setToasts((prev) => [...prev, toast])
      // Auto-dismiss after 5s.
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 5000)
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  function open(toast: Toast) {
    dismiss(toast.id)
    router.push(toast.url)
  }

  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border border-primary/40 bg-[var(--bg-elevated)] p-3 shadow-lg animate-in slide-in-from-top-3 fade-in"
        >
          <button
            type="button"
            onClick={() => open(t)}
            className="flex flex-1 items-start gap-3 text-left"
          >
            <Bell className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              {t.body && (
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{t.body}</p>
              )}
            </div>
          </button>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Tutup notifikasi"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
