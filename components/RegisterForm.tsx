'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Button from './Button'
import { registerPlayer } from '@/lib/actions/invite'
import { setLocalStorageItem } from '@/lib/safeStorage'

// New-player self-registration: name + own PIN + the active season's invite code.
// On success the server auto-joins the season + logs the player in (cookie); we
// mirror identity into localStorage (like the picker) and go to the dashboard.
export default function RegisterForm({ onBack }: { onBack: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const inputClass =
    'w-full rounded-lg border border-input bg-[var(--bg-elevated)] px-4 py-3 text-sm text-foreground outline-none focus:border-primary'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (isPending) return
    startTransition(async () => {
      setError(null)
      const r = await registerPlayer({ name, pin, code })
      if ('error' in r) { setError(r.error); return }
      setLocalStorageItem('playerId', r.playerId)
      setLocalStorageItem('playerName', r.name)
      router.push('/')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        required
        placeholder="Nama kamu"
        className={inputClass}
      />
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        type="password"
        inputMode="numeric"
        maxLength={6}
        minLength={4}
        required
        autoComplete="new-password"
        placeholder="Buat PIN (4-6 digit)"
        className={inputClass + ' font-mono'}
      />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        maxLength={12}
        required
        autoCapitalize="characters"
        placeholder="Kode undangan"
        className={inputClass + ' font-mono tracking-[0.15em]'}
      />

      {error && <p className="m-0 text-[0.8125rem] text-destructive">{error}</p>}

      <Button
        type="submit"
        fullWidth
        disabled={isPending || !name.trim() || pin.length < 4 || !code.trim()}
        className="h-12 text-base font-semibold uppercase tracking-wide"
      >
        {isPending ? 'Mendaftar...' : 'Daftar'}
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-1 self-center text-[0.8125rem] text-muted-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke pilih nama
      </button>
    </form>
  )
}
