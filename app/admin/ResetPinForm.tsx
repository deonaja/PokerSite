'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resetPlayerPin } from '@/lib/actions/players'
import Button from '@/components/Button'
import type { Player } from '@/lib/types'

export default function ResetPinForm({ players }: { players: Player[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isHydrated, setIsHydrated] = useState(false)
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [reason, setReason] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const reasonRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const r = reasonRef.current?.value ?? ''
    if (r) setReason(r)
  }, [])

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  function handleSubmit() {
    setMsg(null)
    startTransition(async () => {
      const result = await resetPlayerPin({
        playerId,
        pin,
        pinConfirm,
        reason,
        actorPlayerId: '',
      })
      if ('error' in result) {
        setMsg({ type: 'err', text: result.error })
        return
      }
      setMsg({ type: 'ok', text: 'PIN berhasil direset.' })
      setPin('')
      setPinConfirm('')
      setReason('')
      if (reasonRef.current) reasonRef.current.value = ''
      router.refresh()
    })
  }

  const inputClass = 'w-full rounded-lg border border-input bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-foreground outline-none'

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4">
      <p className="text-[0.8125rem] font-medium text-muted-foreground">Set / reset PIN pemain</p>
      <select
        className={inputClass + ' [appearance:auto]'}
        value={playerId}
        disabled={!isHydrated || isPending}
        onChange={e => setPlayerId(e.target.value)}
      >
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        type={showPin ? 'text' : 'password'}
        inputMode="numeric"
        maxLength={6}
        value={pin}
        disabled={!isHydrated || isPending}
        onChange={(e) => setPin(e.target.value)}
        placeholder="PIN baru (4-6 digit)"
        className={inputClass + ' font-mono'}
      />
      <input
        type={showPin ? 'text' : 'password'}
        inputMode="numeric"
        maxLength={6}
        value={pinConfirm}
        disabled={!isHydrated || isPending}
        onChange={(e) => setPinConfirm(e.target.value)}
        placeholder="Konfirmasi PIN baru"
        className={inputClass + ' font-mono'}
      />
      <label className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <input
          type="checkbox"
          checked={showPin}
          disabled={!isHydrated || isPending}
          onChange={(e) => setShowPin(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Tampilkan PIN
      </label>
      <input
        ref={reasonRef}
        className={inputClass}
        placeholder="Alasan reset PIN (wajib)"
        defaultValue=""
        disabled={!isHydrated || isPending}
        onChange={(e) => setReason(e.target.value)}
      />
      {msg && <p className={'text-[0.8125rem] ' + (msg.type === 'ok' ? 'text-success' : 'text-destructive')}>{msg.text}</p>}
      <Button
        fullWidth
        variant="secondary"
        disabled={!isHydrated || isPending || !reason.trim() || !pin || !pinConfirm}
        onClick={handleSubmit}
      >
        {isPending ? 'Menyimpan...' : 'Update PIN'}
      </Button>
    </div>
  )
}
