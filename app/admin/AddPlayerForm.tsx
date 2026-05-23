'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addPlayer } from '@/lib/actions/players'
import Button from '@/components/Button'

export default function AddPlayerForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('200')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleSubmit() {
    setMsg(null)
    startTransition(async () => {
      const result = await addPlayer({
        name,
        balance: parseInt(balance, 10) || 200,
        actorPlayerId: '',
      })
      if ('error' in result) setMsg({ type: 'err', text: result.error })
      else { setMsg({ type: 'ok', text: 'Pemain ditambahkan.' }); setName(''); setBalance('200'); router.refresh() }
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
      <input style={inputStyle} placeholder="Nama" value={name} onChange={e => setName(e.target.value)} />
      <input style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }} type="number" placeholder="Balance awal (default 200)" value={balance} onChange={e => setBalance(e.target.value)} />
      {msg && <p style={{ fontSize: '0.8125rem', color: msg.type === 'ok' ? 'var(--accent-success)' : 'var(--accent-danger)', margin: 0 }}>{msg.text}</p>}
      <Button fullWidth disabled={isPending || !name.trim()} onClick={handleSubmit}>
        {isPending ? 'Menyimpan...' : '+ Tambah'}
      </Button>
    </div>
  )
}
