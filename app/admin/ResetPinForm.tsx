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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  }

  return (
    <div style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>Set / reset PIN pemain</p>
      <select
        style={{ ...inputStyle, appearance: 'auto' }}
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
        style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
      />
      <input
        type={showPin ? 'text' : 'password'}
        inputMode="numeric"
        maxLength={6}
        value={pinConfirm}
        disabled={!isHydrated || isPending}
        onChange={(e) => setPinConfirm(e.target.value)}
        placeholder="Konfirmasi PIN baru"
        style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        <input
          type="checkbox"
          checked={showPin}
          disabled={!isHydrated || isPending}
          onChange={(e) => setShowPin(e.target.checked)}
        />
        Tampilkan PIN
      </label>
      <input
        ref={reasonRef}
        style={inputStyle}
        placeholder="Alasan reset PIN (wajib)"
        defaultValue=""
        disabled={!isHydrated || isPending}
        onChange={(e) => setReason(e.target.value)}
      />
      {msg && <p style={{ fontSize: '0.8125rem', color: msg.type === 'ok' ? 'var(--accent-success)' : 'var(--accent-danger)', margin: 0 }}>{msg.text}</p>}
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
