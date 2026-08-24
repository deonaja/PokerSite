'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound, LogOut, Sparkles, HelpCircle, Bell } from 'lucide-react'
import Sheet from './Sheet'
import Avatar from './Avatar'
import PixelIcon from './PixelIcon'
import { Badge } from './ui/badge'
import { getLocalStorageItem } from '@/lib/safeStorage'
import { LATEST_VERSION, CHANGELOG_SEEN_KEY } from '@/lib/changelog'
import { deletePushSubscription } from '@/lib/actions/push'

// Minimal header: avatar (initial) + greeting. Tapping it opens an account
// bottom-sheet with the actions, so the bar itself stays uncluttered.
export default function HeaderMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false)
  // Defaults to false so SSR/first client render match (no hydration mismatch);
  // the effect flips it on once we can read localStorage.
  const [hasNew, setHasNew] = useState(false)

  useEffect(() => {
    setHasNew(getLocalStorageItem(CHANGELOG_SEEN_KEY) !== LATEST_VERSION)
    const clear = () => setHasNew(false)
    window.addEventListener('changelog-seen', clear)
    return () => window.removeEventListener('changelog-seen', clear)
  }, [])

  // On "ganti identitas" / logout, drop THIS device's push subscription first so
  // the next person on a shared device doesn't keep receiving the old player's
  // notifications. Best-effort — never blocks logout. (Still logged in here, so
  // deletePushSubscription authorizes.) form.submit() bypasses this handler.
  async function handleLogout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = await reg?.pushManager.getSubscription()
        if (sub) {
          const endpoint = sub.endpoint
          await sub.unsubscribe().catch(() => {})
          await deletePushSubscription({ endpoint }).catch(() => {})
        }
      }
    } catch {
      // ignore — logout must proceed regardless
    }
    form.submit()
  }

  return (
    <header className="flex items-center gap-2.5 border-b-2 border-[var(--tt-rule)] bg-black px-3 py-2">
      <span className="shrink-0 select-none text-lg uppercase tracking-[0.12em] text-[var(--tt-yellow)]">
        PokerAja
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Akun"
        className="ml-auto flex min-w-0 items-center gap-2 border border-[var(--tt-rule-strong)] px-2 py-1 transition-colors hover:bg-[var(--bg-elevated)]"
      >
        <span className="relative shrink-0">
          <Avatar name={name} size={30} />
          {hasNew && (
            <span
              aria-hidden
              className="absolute -right-1 -top-1 h-2.5 w-2.5 bg-[var(--tt-green)]"
            />
          )}
        </span>
        <span className="truncate text-base uppercase tracking-wide text-[var(--tt-white)]">
          {name}
        </span>
        <PixelIcon name="chevronDown" size={14} className="shrink-0 text-[var(--tt-cyan)]" />
      </button>

      <Link
        href="/panduan"
        aria-label="Panduan"
        className="flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--tt-rule-strong)] text-[var(--tt-cyan)] transition-colors hover:bg-[var(--bg-elevated)]"
      >
        <HelpCircle className="size-5" />
      </Link>

      <Sheet isOpen={open} onClose={() => setOpen(false)} title="Akun">
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={name} size={48} />
          <span className="truncate text-lg uppercase tracking-wide text-foreground">{name}</span>
        </div>

        <div className="flex flex-col gap-1">
          <Link
            href="/changelog"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <Sparkles className="size-4 text-muted-foreground" />
            Apa yang baru
            {hasNew && <Badge className="ml-auto">Baru</Badge>}
          </Link>
          <Link
            href="/settings/notifications"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <Bell className="size-4 text-muted-foreground" />
            Notifikasi
          </Link>
          <Link
            href="/settings/pin"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <KeyRound className="size-4 text-muted-foreground" />
            Ganti PIN
          </Link>
          <form method="post" action="/api/identity/logout" onSubmit={handleLogout}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-lg bg-transparent px-3 text-sm text-foreground transition-colors hover:bg-[var(--bg-elevated)]"
            >
              <LogOut className="size-4 text-muted-foreground" />
              Ganti identitas
            </button>
          </form>
        </div>
      </Sheet>
    </header>
  )
}
