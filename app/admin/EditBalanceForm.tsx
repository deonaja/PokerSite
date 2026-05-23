'use client'

import { useState, useTransition } from 'react'
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

  function handleSubmit() {
    setMsg(null)
    const val = parseInt(newBalance, 10)
    if (isNaN(val)) { setMsg({ type: 'err', text: 'Balance harus angka' }); return }
    startTransition(async () => {
      const result = await editBalance({ playerId, newBalance: val, reason, actorPlayerId: '' })
      if ('error' in result) setMsg({ type: 'err', text: result.error })
      else { setMsg({ type: 'ok', text: 'Balance diupdate.' }); setNewBalance(''); setReason(''); router.refresh() }
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.75rem', borderRadius: '6px',
    border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)',
    color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
  }

  return (
    <div style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>Edit balance manual</p>
      <select style={{ ...inputStyle, appearance: 'auto' }} value={playerId} onChange={e => setPlayerId(e.target.value)}>
        {players.map(p => <option key={p.id} value={p.id}>{p.name} (saat ini: {p.balance})</option>)}
      </select>
      <input style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }} type="number" placeholder="Balance baru (boleh negatif)" value={newBalance} onChange={e => setNewBalance(e.target.value)} />
      <input style={inputStyle} placeholder="Alasan (wajib)" value={reason} onChange={e => setReason(e.target.value)} />
      {msg && <p style={{ fontSize: '0.8125rem', color: msg.type === 'ok' ? 'var(--accent-success)' : 'var(--accent-danger)', margin: 0 }}>{msg.text}</p>}
      <Button fullWidth variant="secondary" disabled={isPending || !reason.trim() || newBalance === ''} onClick={handleSubmit}>
        {isPending ? 'Menyimpan...' : 'Update balance'}
      </Button>
    </div>
  )
}
