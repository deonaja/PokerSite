'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelSession } from '@/lib/actions/session'
import Button from '@/components/Button'

export default function ForceEndSection({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelSession({ sessionId })
      if ('error' in result) setMsg(result.error)
      else { setMsg('Sesi dibatalkan, balance dikembalikan.'); setConfirm(false); router.refresh() }
    })
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-destructive bg-card p-4">
      <p className="text-[0.8125rem] font-medium text-muted-foreground">
        Ada sesi aktif (ID: <span className="font-mono text-xs">{sessionId.slice(0, 8)}…</span>)
      </p>
      <p className="text-xs text-muted-foreground">
        Membatalkan akan mengembalikan semua buy-in &amp; rebuy ke balance pemain (kembali ke kondisi sebelum sesi).
      </p>
      {msg && <p className="text-[0.8125rem] text-success">{msg}</p>}
      {!confirm ? (
        <Button variant="danger" fullWidth onClick={() => setConfirm(true)}>Batalkan sesi</Button>
      ) : (
        <div className="flex gap-2.5">
          <Button variant="secondary" fullWidth disabled={isPending} onClick={() => setConfirm(false)}>Batal</Button>
          <Button variant="danger" fullWidth disabled={isPending} onClick={handleCancel}>
            {isPending ? 'Loading...' : 'Yakin batalkan'}
          </Button>
        </div>
      )}
    </div>
  )
}
