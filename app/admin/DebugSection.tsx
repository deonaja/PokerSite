'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/Button'
import {
  adminForceEndSeason,
  debugResetSeason,
  debugSetPhase,
  debugResetBalances,
  debugClearCooldowns,
  debugNukeAll,
} from '@/lib/actions/debug'

type Result = { success: true; message: string } | { error: string }

export default function DebugSection() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [armed, setArmed] = useState<string | null>(null) // which destructive action is awaiting confirm
  const [balanceAmount, setBalanceAmount] = useState('')

  function run(label: string, fn: () => Promise<Result>) {
    setMsg(null)
    startTransition(async () => {
      const result = await fn()
      if ('error' in result) setMsg({ type: 'err', text: `${label}: ${result.error}` })
      else {
        setMsg({ type: 'ok', text: result.message })
        setArmed(null)
        router.refresh()
      }
    })
  }

  const cardClass = 'flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3.5'
  const rowLabelClass = 'text-[0.8125rem] text-muted-foreground'
  const inputClass = 'min-w-0 flex-1 box-border rounded-lg border border-input bg-[var(--bg-elevated)] px-3 py-2 text-sm font-mono text-foreground outline-none'

  return (
    <section className="flex flex-col gap-2.5">
      <p className="text-xs font-medium tracking-[0.08em] text-warn">
        DEBUG
      </p>

      {msg && (
        <p className={'text-[0.8125rem] ' + (msg.type === 'ok' ? 'text-success' : 'text-destructive')}>
          {msg.text}
        </p>
      )}

      {/* Force end season (with snapshot) */}
      <div className={cardClass + ' border-warn'}>
        <p className={rowLabelClass}>
          <strong className="text-warn">Akhiri season (proper)</strong> — snapshot hasil, reset balance, tutup season. Beda dengan debug reset yang hapus data.
        </p>
        {armed !== 'forceEnd' ? (
          <Button variant="secondary" fullWidth disabled={isPending} onClick={() => { setArmed('forceEnd'); setMsg(null) }}>
            Force end season
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth disabled={isPending} onClick={() => setArmed(null)}>Batal</Button>
            <Button variant="danger" fullWidth disabled={isPending} onClick={() => run('Force end season', adminForceEndSeason)}>
              {isPending ? '…' : 'Yakin'}
            </Button>
          </div>
        )}
      </div>

      {/* Reset season */}
      <div className={cardClass}>
        <p className={rowLabelClass}>Reset season — hapus semua season & sesi, numbering balik ke #1 (pemain & balance tetap)</p>
        {armed !== 'season' ? (
          <Button variant="secondary" fullWidth disabled={isPending} onClick={() => { setArmed('season'); setMsg(null) }}>
            Reset season
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth disabled={isPending} onClick={() => setArmed(null)}>Batal</Button>
            <Button variant="danger" fullWidth disabled={isPending} onClick={() => run('Reset season', debugResetSeason)}>
              {isPending ? '…' : 'Yakin'}
            </Button>
          </div>
        )}
      </div>

      {/* Set phase */}
      <div className={cardClass}>
        <p className={rowLabelClass}>Set phase season aktif</p>
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth disabled={isPending} onClick={() => run('Set phase', () => debugSetPhase('bootstrap'))}>
            Bootstrap
          </Button>
          <Button variant="secondary" fullWidth disabled={isPending} onClick={() => run('Set phase', () => debugSetPhase('steady'))}>
            Steady
          </Button>
        </div>
      </div>

      {/* Reset balances */}
      <div className={cardClass}>
        <p className={rowLabelClass}>Reset semua balance (kosong = starting_balance season)</p>
        <div className="flex gap-2">
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            placeholder="starting_balance"
            value={balanceAmount}
            onChange={(e) => setBalanceAmount(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={isPending}
            className="shrink-0"
            onClick={() => run('Reset balance', () => debugResetBalances(balanceAmount === '' ? undefined : parseInt(balanceAmount, 10)))}
          >
            Set
          </Button>
        </div>
      </div>

      {/* Clear cooldowns */}
      <div className={cardClass}>
        <p className={rowLabelClass}>Reset cooldown dealer semua pemain</p>
        <Button variant="secondary" fullWidth disabled={isPending} onClick={() => run('Clear cooldown', debugClearCooldowns)}>
          Clear cooldown
        </Button>
      </div>

      {/* Nuke */}
      <div className={cardClass + ' border-destructive'}>
        <p className={rowLabelClass}>
          <strong className="text-destructive">Nuke semua data</strong> — hapus pemain, sesi, season, log. Balik ke fresh install.
        </p>
        {armed !== 'nuke' ? (
          <Button variant="danger" fullWidth disabled={isPending} onClick={() => { setArmed('nuke'); setMsg(null) }}>
            Nuke semua data
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth disabled={isPending} onClick={() => setArmed(null)}>Batal</Button>
            <Button variant="danger" fullWidth disabled={isPending} onClick={() => run('Nuke', debugNukeAll)}>
              {isPending ? '…' : 'HAPUS SEMUA'}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
