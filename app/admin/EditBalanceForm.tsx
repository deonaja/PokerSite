'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { editBalance } from '@/lib/actions/players'
import Button from '@/components/Button'
import type { Player } from '@/lib/types'

export default function EditBalanceForm({ players }: { players: Player[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '')
  const [newBalance, setNewBalance] = useState('')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const balanceRef = useRef<HTMLInputElement>(null)
  const reasonRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const b = balanceRef.current?.value ?? ''
    if (b) setNewBalance(b)
    const r = reasonRef.current?.value ?? ''
    if (r) setReason(r)
  }, [])

  function handleSubmit() {
    setMsg(null)
    const val = parseInt(newBalance, 10)
    if (isNaN(val)) { setMsg({ type: 'err', text: 'Balance harus angka' }); return }
    startTransition(async () => {
      const result = await editBalance({ playerId, newBalance: val, reason, actorPlayerId: '' })
      if ('error' in result) setMsg({ type: 'err', text: result.error })
      else {
        setMsg({ type: 'ok', text: 'Balance diupdate.' })
        setNewBalance('')
        setReason('')
        if (balanceRef.current) balanceRef.current.value = ''
        if (reasonRef.current) reasonRef.current.value = ''
        router.refresh()
      }
    })
  }

  const inputClass = 'w-full rounded-lg border border-input bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-foreground outline-none'

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4">
      <p className="text-[0.8125rem] font-medium text-muted-foreground">Edit balance manual</p>
      <select className={inputClass + ' [appearance:auto]'} value={playerId} onChange={e => setPlayerId(e.target.value)}>
        {players.map(p => <option key={p.id} value={p.id}>{p.name} (saat ini: {p.balance})</option>)}
      </select>
      <input ref={balanceRef} className={inputClass + ' font-mono'} type="number" placeholder="Balance baru (min 0)" defaultValue="" onChange={e => setNewBalance(e.target.value)} />
      <input ref={reasonRef} className={inputClass} placeholder="Alasan (wajib)" defaultValue="" onChange={e => setReason(e.target.value)} />
      {msg && <p className={'text-[0.8125rem] ' + (msg.type === 'ok' ? 'text-success' : 'text-destructive')}>{msg.text}</p>}
      <Button fullWidth variant="secondary" disabled={isPending || !reason.trim() || newBalance === ''} onClick={handleSubmit}>
        {isPending ? 'Menyimpan...' : 'Update balance'}
      </Button>
    </div>
  )
}
