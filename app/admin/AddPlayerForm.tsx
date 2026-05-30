'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addPlayer } from '@/lib/actions/players'
import Button from '@/components/Button'

export default function AddPlayerForm({ defaultBalance = 200 }: { defaultBalance?: number }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [balance, setBalance] = useState(String(defaultBalance))
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
        balance: parseInt(balance, 10) || defaultBalance,
        pin,
        pinConfirm,
        actorPlayerId: '',
      })
      if ('error' in result) setMsg({ type: 'err', text: result.error })
      else {
        setMsg({ type: 'ok', text: 'Pemain ditambahkan.' })
        setName('')
        setBalance(String(defaultBalance))
        setPin('')
        setPinConfirm('')
        if (nameRef.current) nameRef.current.value = ''
        if (balanceRef.current) balanceRef.current.value = String(defaultBalance)
        if (pinRef.current) pinRef.current.value = ''
        if (pinConfirmRef.current) pinConfirmRef.current.value = ''
        router.refresh()
      }
    })
  }

  const inputClass = 'w-full rounded-lg border border-input bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-foreground outline-none'

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4">
      <p className="text-[0.8125rem] font-medium text-muted-foreground">Tambah pemain</p>
      <input ref={nameRef} className={inputClass} placeholder="Nama" defaultValue="" onChange={e => setName(e.target.value)} />
      <input ref={balanceRef} className={inputClass + ' font-mono'} type="number" placeholder={`Balance awal (default ${defaultBalance})`} defaultValue={String(defaultBalance)} onChange={e => setBalance(e.target.value)} />
      <input
        ref={pinRef}
        className={inputClass + ' font-mono'}
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="PIN (4-6 digit)"
        defaultValue=""
        onChange={e => setPin(e.target.value)}
      />
      <input
        ref={pinConfirmRef}
        className={inputClass + ' font-mono'}
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="Konfirmasi PIN"
        defaultValue=""
        onChange={e => setPinConfirm(e.target.value)}
      />
      {msg && <p className={'text-[0.8125rem] ' + (msg.type === 'ok' ? 'text-success' : 'text-destructive')}>{msg.text}</p>}
      <Button fullWidth disabled={isPending || !name.trim() || !pin || !pinConfirm} onClick={handleSubmit}>
        {isPending ? 'Menyimpan...' : '+ Tambah'}
      </Button>
    </div>
  )
}
