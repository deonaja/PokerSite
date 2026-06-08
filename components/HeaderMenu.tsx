'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound, LogOut, ChevronDown, Sparkles, HelpCircle } from 'lucide-react'
import Sheet from './Sheet'
import { Badge } from './ui/badge'
import { getLocalStorageItem } from '@/lib/safeStorage'
import { LATEST_VERSION, CHANGELOG_SEEN_KEY } from '@/lib/changelog'

// Minimal header: avatar (initial) + greeting. Tapping it opens an account
// bottom-sheet with the actions, so the bar itself stays uncluttered.
export default function HeaderMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false)
  // Defaults to false so SSR/first client render match (no hydration mismatch);
  // the effect flips it on once we can read localStorage.
  const [hasNew, setHasNew] = useState(false)
  const initial = (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

  useEffect(() => {
    setHasNew(getLocalStorageItem(CHANGELOG_SEEN_KEY) !== LATEST_VERSION)
    const clear = () => setHasNew(false)
    window.addEventListener('changelog-seen', clear)
    return () => window.removeEventListener('changelog-seen', clear)
  }, [])

  return (
    <header className="flex items-center border-b border-border px-4 py-2.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Akun"
        className="flex min-w-0 items-center gap-2.5"
      >
        <span className="relative shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary bg-accent font-mono text-sm font-medium text-foreground">
            {initial}
          </span>
          {hasNew && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#2fb074] ring-2 ring-[#9fe8c4] ring-offset-1 ring-offset-background"
            />
          )}
        </span>
        <span className="truncate text-sm text-foreground">
          Hi, <span className="font-medium">{name}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-[var(--text-tertiary)]" />
      </button>

      <Link
        href="/panduan"
        aria-label="Panduan"
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--bg-elevated)]"
      >
        <HelpCircle className="size-5" />
      </Link>

      <Sheet isOpen={open} onClose={() => setOpen(false)} title="Akun">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary bg-accent font-mono text-lg font-medium text-foreground">
            {initial}
          </span>
          <span className="truncate text-base font-medium text-foreground">{name}</span>
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
            href="/settings/pin"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <KeyRound className="size-4 text-muted-foreground" />
            Ganti PIN
          </Link>
          <form method="post" action="/api/identity/logout">
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
