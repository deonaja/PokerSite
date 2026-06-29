'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical } from 'lucide-react'
import Sheet from '@/components/Sheet'
import Button from '@/components/Button'
import { executeAdminRollback } from '@/lib/actions/rollback'

interface Props {
  snapshotId: string
  label: string // e.g. "session_start — Andi"
  timestamp: string // ISO timestamp string
}

/**
 * Kebab-menu trigger + 3-step destructive confirm modal:
 *   Step 1: warning + "Lanjut"
 *   Step 2: user must literally type ROLLBACK
 *   Step 3: final red "Eksekusi rollback" button
 * Submit disabled until input === "ROLLBACK". On success: toast + router.refresh.
 */
export default function RollbackButton({ snapshotId, label, timestamp }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [typed, setTyped] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setStep(1)
    setTyped('')
    setMsg(null)
  }

  function close() {
    setOpen(false)
    // Defer reset until after the close animation so the user doesn't see
    // step 1 flash in for 150ms.
    setTimeout(reset, 200)
  }

  function execute() {
    setMsg(null)
    startTransition(async () => {
      const result = await executeAdminRollback(snapshotId)
      if ('error' in result) {
        setMsg({ type: 'err', text: result.error })
      } else {
        setMsg({ type: 'ok', text: 'Rollback berhasil' })
        router.refresh()
        // Auto-close after a short delay so the user sees the success.
        setTimeout(close, 800)
      }
    })
  }

  const canExecute = typed === 'ROLLBACK'

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); reset() }}
        aria-label="Rollback ke titik ini"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      <Sheet isOpen={open} onClose={close} title="Rollback ke snapshot">
        <div className="flex flex-col gap-3">
          <p className="text-[0.8125rem] text-muted-foreground">
            Target: <span className="font-mono text-foreground">{label}</span>
          </p>
          <p className="text-[0.6875rem] text-[var(--text-tertiary)]">
            {new Date(timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
          </p>

          {msg && (
            <p className={'text-[0.8125rem] ' + (msg.type === 'ok' ? 'text-success' : 'text-destructive')}>
              {msg.text}
            </p>
          )}

          {step === 1 && (
            <>
              <div className="rounded-lg border border-warn bg-warn/10 px-3 py-2.5 text-[0.8125rem] text-warn">
                <strong>Hati-hati.</strong> Rollback mengembalikan balance pemain, sesi, dan loan ke titik ini. Semua aksi setelahnya hilang. Tidak bisa di-undo.
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" fullWidth onClick={close}>Batal</Button>
                <Button variant="primary" fullWidth onClick={() => setStep(2)}>Lanjut</Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-[0.8125rem] text-muted-foreground">
                Ketik <span className="font-mono font-semibold text-foreground">ROLLBACK</span> untuk konfirmasi:
              </p>
              <input
                type="text"
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="ROLLBACK"
                className="box-border w-full rounded-lg border border-input bg-[var(--bg-elevated)] px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-ring"
              />
              <div className="flex gap-2">
                <Button variant="secondary" fullWidth onClick={() => { setStep(1); setTyped('') }}>Kembali</Button>
                <Button variant="primary" fullWidth disabled={!canExecute} onClick={() => setStep(3)}>
                  Lanjut
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-[0.8125rem] text-destructive">
                <strong>Konfirmasi terakhir.</strong> Klik tombol di bawah untuk eksekusi rollback.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" fullWidth disabled={isPending} onClick={() => setStep(2)}>Kembali</Button>
                <Button variant="danger" fullWidth disabled={isPending || !canExecute} onClick={execute}>
                  {isPending ? '…' : 'Eksekusi rollback'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Sheet>
    </>
  )
}
