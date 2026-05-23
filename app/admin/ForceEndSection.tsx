'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { forceEndSession } from '@/lib/actions/session'
import Button from '@/components/Button'

export default function ForceEndSection({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function handleForceEnd() {
    startTransition(async () => {
      const result = await forceEndSession({ sessionId, actorPlayerId: '' })
      if ('error' in result) setMsg(result.error)
      else { setMsg('Sesi di-force-end.'); setConfirm(false); router.refresh() }
    })
  }

  return (
    <div style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--accent-danger)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>
        Ada sesi aktif (ID: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{sessionId.slice(0, 8)}…</span>)
      </p>
      {msg && <p style={{ fontSize: '0.8125rem', color: 'var(--accent-success)', margin: 0 }}>{msg}</p>}
      {!confirm ? (
        <Button variant="danger" fullWidth onClick={() => setConfirm(true)}>Force-end sesi</Button>
      ) : (
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <Button variant="secondary" fullWidth disabled={isPending} onClick={() => setConfirm(false)}>Batal</Button>
          <Button variant="danger" fullWidth disabled={isPending} onClick={handleForceEnd}>
            {isPending ? 'Loading...' : 'Yakin force-end'}
          </Button>
        </div>
      )}
    </div>
  )
}
