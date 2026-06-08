'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from './Button'
import { joinActiveSeason } from '@/lib/actions/invite'

// Shown on the dashboard when a logged-in player is NOT a member of the active
// season (e.g. they were left off the new-season checklist). Lets them join
// mid-season without an invite code — their PIN login already vouches for them.
export default function JoinSeasonPrompt({ phase }: { phase: 'bootstrap' | 'steady' }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function join() {
    if (isPending) return
    startTransition(async () => {
      setError(null)
      const r = await joinActiveSeason()
      if ('error' in r) setError(r.error)
      else router.refresh()
    })
  }

  return (
    <div className="mx-4 mt-4 rounded-lg border border-primary bg-accent p-3">
      <p className="text-sm text-foreground">Kamu belum ikut musim ini.</p>
      <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
        {phase === 'bootstrap'
          ? 'Gabung sekarang dapet modal awal penuh.'
          : 'Musim sudah fase STEADY — gabung mulai dari saldo 0.'}
      </p>
      {error && <p className="mt-1.5 text-[0.8125rem] text-destructive">{error}</p>}
      <div className="mt-2.5">
        <Button fullWidth disabled={isPending} onClick={join}>
          {isPending ? 'Gabung...' : 'Gabung musim'}
        </Button>
      </div>
    </div>
  )
}
