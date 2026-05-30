'use client'

import { useState } from 'react'
import Link from 'next/link'
import { KeyRound, LogOut, ChevronDown } from 'lucide-react'
import Sheet from './Sheet'

// Minimal header: avatar (initial) + greeting. Tapping it opens an account
// bottom-sheet with the actions, so the bar itself stays uncluttered.
export default function HeaderMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false)
  const initial = (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

  return (
    <header className="flex items-center border-b border-border px-4 py-2.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Akun"
        className="flex min-w-0 items-center gap-2.5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary bg-accent font-mono text-sm font-medium text-foreground">
          {initial}
        </span>
        <span className="truncate text-sm text-foreground">
          Hi, <span className="font-medium">{name}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-[var(--text-tertiary)]" />
      </button>

      <Sheet isOpen={open} onClose={() => setOpen(false)} title="Akun">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary bg-accent font-mono text-lg font-medium text-foreground">
            {initial}
          </span>
          <span className="truncate text-base font-medium text-foreground">{name}</span>
        </div>

        <div className="flex flex-col gap-1">
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
