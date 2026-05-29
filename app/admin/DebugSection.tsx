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

  const card: React.CSSProperties = {
    padding: '0.875rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-surface)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  }
  const rowLabel: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }
  const inputStyle: React.CSSProperties = {
    flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '0.5rem 0.75rem', borderRadius: '6px',
    border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)',
    color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none',
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--accent-warn)', margin: 0 }}>
        DEBUG
      </p>

      {msg && (
        <p style={{ fontSize: '0.8125rem', color: msg.type === 'ok' ? 'var(--accent-success)' : 'var(--accent-danger)', margin: 0 }}>
          {msg.text}
        </p>
      )}

      {/* Force end season (with snapshot) */}
      <div style={{ ...card, border: '1px solid var(--accent-warn)' }}>
        <p style={rowLabel}>
          <strong style={{ color: 'var(--accent-warn)' }}>Akhiri season (proper)</strong> — snapshot hasil, reset balance, tutup season. Beda dengan debug reset yang hapus data.
        </p>
        {armed !== 'forceEnd' ? (
          <Button variant="secondary" fullWidth disabled={isPending} onClick={() => { setArmed('forceEnd'); setMsg(null) }}>
            Force end season
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" fullWidth disabled={isPending} onClick={() => setArmed(null)}>Batal</Button>
            <Button variant="danger" fullWidth disabled={isPending} onClick={() => run('Force end season', adminForceEndSeason)}>
              {isPending ? '…' : 'Yakin'}
            </Button>
          </div>
        )}
      </div>

      {/* Reset season */}
      <div style={card}>
        <p style={rowLabel}>Reset season — hapus semua season & sesi, numbering balik ke #1 (pemain & balance tetap)</p>
        {armed !== 'season' ? (
          <Button variant="secondary" fullWidth disabled={isPending} onClick={() => { setArmed('season'); setMsg(null) }}>
            Reset season
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" fullWidth disabled={isPending} onClick={() => setArmed(null)}>Batal</Button>
            <Button variant="danger" fullWidth disabled={isPending} onClick={() => run('Reset season', debugResetSeason)}>
              {isPending ? '…' : 'Yakin'}
            </Button>
          </div>
        )}
      </div>

      {/* Set phase */}
      <div style={card}>
        <p style={rowLabel}>Set phase season aktif</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="secondary" fullWidth disabled={isPending} onClick={() => run('Set phase', () => debugSetPhase('bootstrap'))}>
            → Bootstrap
          </Button>
          <Button variant="secondary" fullWidth disabled={isPending} onClick={() => run('Set phase', () => debugSetPhase('steady'))}>
            → Steady
          </Button>
        </div>
      </div>

      {/* Reset balances */}
      <div style={card}>
        <p style={rowLabel}>Reset semua balance (kosong = starting_balance season)</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            style={inputStyle}
            type="number"
            inputMode="numeric"
            placeholder="starting_balance"
            value={balanceAmount}
            onChange={(e) => setBalanceAmount(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={isPending}
            style={{ flexShrink: 0 }}
            onClick={() => run('Reset balance', () => debugResetBalances(balanceAmount === '' ? undefined : parseInt(balanceAmount, 10)))}
          >
            Set
          </Button>
        </div>
      </div>

      {/* Clear cooldowns */}
      <div style={card}>
        <p style={rowLabel}>Reset cooldown dealer semua pemain</p>
        <Button variant="secondary" fullWidth disabled={isPending} onClick={() => run('Clear cooldown', debugClearCooldowns)}>
          Clear cooldown
        </Button>
      </div>

      {/* Nuke */}
      <div style={{ ...card, border: '1px solid var(--accent-danger)' }}>
        <p style={rowLabel}>
          <strong style={{ color: 'var(--accent-danger)' }}>Nuke semua data</strong> — hapus pemain, sesi, season, log. Balik ke fresh install.
        </p>
        {armed !== 'nuke' ? (
          <Button variant="danger" fullWidth disabled={isPending} onClick={() => { setArmed('nuke'); setMsg(null) }}>
            Nuke semua data
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
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
