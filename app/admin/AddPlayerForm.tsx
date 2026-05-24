'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addPlayer } from '@/lib/actions/players'
import Button from '@/components/Button'

export default function AddPlayerForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('200')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const balanceRef = useRef<HTMLInputElement>(null)
  const pinRef = useRef<HTMLInputElement>(null)
  const pinConfirmRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const n = nameRef.current?.value ?? ''
    if (n) setName(n)
    const b = balanceRef.current?.value ?? ''
    if (b) setBalance(b)
    const p = pinRef.current?.value ?? ''
    if (p) setPin(p)
    const pc = pinConfirmRef.current?.value ?? ''
    if (pc) setPinConfirm(pc)
  }, [])

  function handleSubmit() {
    setMsg(null)
    startTransition(async () => {
      const result = await addPlayer({
        name,
        balance: parseInt(balance, 10) || 200,
        pin,
        pinConfirm,
        actorPlayerId: '',
      })
      if ('error' in result) setMsg({ type: 'err', text: result.error })
      else {
        setMsg({ type: 'ok', text: 'Pemain ditambahkan.' })
        setName('')
        setBalance('200')
        setPin('')
        setPinConfirm('')
        if (nameRef.current) nameRef.current.value = ''
        if (balanceRef.current) balanceRef.current.value = '200'
        if (pinRef.current) pinRef.current.value = ''
        if (pinConfirmRef.current) pinConfirmRef.current.value = ''
        router.refresh()
      }
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.75rem', borderRadius: '6px',
    border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)',
    color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
  }

  return (
    <div style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>Tambah pemain</p>
      <input ref={nameRef} style={inputStyle} placeholder="Nama" defaultValue="" onChange={e => setName(e.target.value)} />
      <input ref={balanceRef} style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }} type="number" placeholder="Balance awal (default 200)" defaultValue="200" onChange={e => setBalance(e.target.value)} />
      <input
        ref={pinRef}
        style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="PIN (4-6 digit)"
        defaultValue=""
        onChange={e => setPin(e.target.value)}
      />
      <input
        ref={pinConfirmRef}
        style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="Konfirmasi PIN"
        defaultValue=""
        onChange={e => setPinConfirm(e.target.value)}
      />
      {msg && <p style={{ fontSize: '0.8125rem', color: msg.type === 'ok' ? 'var(--accent-success)' : 'var(--accent-danger)', margin: 0 }}>{msg.text}</p>}
      <Button fullWidth disabled={isPending || !name.trim() || !pin || !pinConfirm} onClick={handleSubmit}>
        {isPending ? 'Menyimpan...' : '+ Tambah'}
      </Button>
    </div>
  )
}
