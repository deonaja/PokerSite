'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { rotateInviteCode } from '@/lib/actions/invite'
import Button from '@/components/Button'

export default function InviteCodeSection({
  code,
  uses,
  maxUses,
}: {
  code: string | null
  uses: number
  maxUses: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function handleRotate() {
    startTransition(async () => {
      const result = await rotateInviteCode()
      if ('error' in result) setMsg(result.error)
      else { setMsg(`Kode baru: ${result.code}`); setConfirm(false); router.refresh() }
    })
  }

  return (
    <section className="flex flex-col gap-2.5">
      <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">KODE UNDANGAN</p>
      <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-lg font-semibold tracking-[0.15em] text-foreground">
            {code ?? '—'}
          </span>
          <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--text-tertiary)]">
            {uses}/{maxUses} dipakai
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Pemain baru daftar pakai kode ini. Setelah {maxUses} pendaftaran, kode berputar otomatis.
        </p>
        {msg && <p className="text-[0.8125rem] text-success">{msg}</p>}
        {!confirm ? (
          <Button variant="secondary" fullWidth onClick={() => setConfirm(true)}>Putar kode sekarang</Button>
        ) : (
          <div className="flex gap-2.5">
            <Button variant="secondary" fullWidth disabled={isPending} onClick={() => setConfirm(false)}>Batal</Button>
            <Button variant="primary" fullWidth disabled={isPending} onClick={handleRotate}>
              {isPending ? 'Loading...' : 'Yakin putar'}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
