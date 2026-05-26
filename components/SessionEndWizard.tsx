'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { endSession } from '@/lib/actions/session'
import BalanceDisplay from './BalanceDisplay'
import Button from './Button'

interface Participant {
  player_id: string
  player_name: string
  is_dealer: boolean
  rebuy_count: number
  current_balance: number
}

interface Props {
  sessionId: string
  participants: Participant[]
  buyIn?: number
}

export default function SessionEndWizard({ sessionId, participants, buyIn = 100 }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [currentInput, setCurrentInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const totalSteps = participants.length
  const isRecap = step >= totalSteps
  const current = participants[step] ?? null

  useEffect(() => {
    if (isRecap || !current) return
    const saved = inputs[current.player_id] ?? ''
    const domValue = inputRef.current?.value ?? ''
    setCurrentInput(domValue || saved)
    inputRef.current?.focus()
  }, [current, inputs, isRecap])

  function handleNext() {
    if (!current) return
    const rawVal = currentInput
    const val = parseInt(rawVal, 10)
    if (rawVal === '' || isNaN(val) || val < 0) {
      setInputError('Input angka >= 0')
      return
    }

    setInputs((prev) => ({ ...prev, [current.player_id]: rawVal }))
    setInputError(null)
    setStep((s) => s + 1)
  }

  function handleJumpTo(idx: number) {
    setInputError(null)
    setStep(idx)
  }

  function handleBack() {
    setInputError(null)
    if (isRecap) {
      setStep(totalSteps - 1)
      return
    }
    if (step === 0) {
      router.push('/session')
      return
    }
    setStep((s) => s - 1)
  }

  const nonDealerCount = participants.filter((p) => !p.is_dealer).length
  const totalRebuy = participants.reduce((sum, p) => sum + p.rebuy_count, 0)
  const expectedTotal = (nonDealerCount + totalRebuy) * buyIn
  const inputTotal = Object.values(inputs).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0)
  const chipDiff = inputTotal - expectedTotal

  function handleConfirm() {
    setSubmitError(null)
    const actorPlayerId = localStorage.getItem('playerId') ?? ''
    const stacks = participants.map((p) => ({
      playerId: p.player_id,
      finalStack: parseInt(inputs[p.player_id] ?? '0', 10),
    }))

    startTransition(async () => {
      const result = await endSession({ sessionId, stacks, actorPlayerId })
      if ('error' in result) {
        setSubmitError(result.error)
        return
      }
      router.push('/')
    })
  }

  const stickyBottom: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '480px',
    padding: '0.75rem 1rem',
    paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
    borderTop: '1px solid var(--border-subtle)',
    background: 'var(--bg-base)',
  }

  if (isRecap) {
    return (
      <div style={{ paddingBottom: '6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            onClick={handleBack}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.125rem', cursor: 'pointer', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center' }}
          >
            ←
          </button>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Konfirmasi</span>
        </div>

        <div style={{ padding: '1.25rem 1rem 0' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
            RECAP
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
            {participants.map((p, idx) => {
              const stack = parseInt(inputs[p.player_id] ?? '0', 10)
              const newBalance = p.current_balance + stack

              return (
                <div key={p.player_id} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{p.player_name}</span>
                    {p.is_dealer && (
                      <span style={{ fontSize: '0.6875rem', padding: '1px 5px', borderRadius: '4px', background: 'var(--accent-felt)', color: 'var(--text-primary)' }}>★</span>
                    )}
                    <button
                      onClick={() => handleJumpTo(idx)}
                      style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border-strong)', borderRadius: '4px', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', padding: '2px 8px', minHeight: '28px', lineHeight: 1 }}
                    >
                      Edit
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem' }}>
                    <BalanceDisplay balance={p.current_balance} />
                    <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                    <BalanceDisplay balance={newBalance} />
                    <span style={{ color: stack >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      ({stack >= 0 ? '+' : ''}
                      {stack})
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ padding: '0.875rem 1rem', borderRadius: '8px', border: `1px solid ${chipDiff !== 0 ? 'var(--accent-warn)' : 'var(--border-subtle)'}`, background: 'var(--bg-surface)', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total chip seharusnya</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{expectedTotal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: chipDiff !== 0 ? '0.5rem' : 0 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total input</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{inputTotal}</span>
            </div>
            {chipDiff !== 0 && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--accent-warn)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', margin: 0 }}>
                ⚠ Selisih {chipDiff > 0 ? '+' : ''}
                {chipDiff}. Confirm tetap atau revisi?
              </p>
            )}
          </div>

          {submitError && (
            <p style={{ fontSize: '0.875rem', color: 'var(--accent-danger)', marginBottom: '1rem' }}>{submitError}</p>
          )}
        </div>

        <div style={{ ...stickyBottom, display: 'flex', gap: '0.75rem' }}>
          <Button variant="secondary" fullWidth disabled={isPending} onClick={handleBack}>Back</Button>
          <Button variant="primary" fullWidth disabled={isPending} onClick={handleConfirm}>
            {isPending ? 'Menyimpan...' : 'Confirm'}
          </Button>
        </div>
      </div>
    )
  }

  if (!current) return null

  const totalSpent = current.is_dealer ? current.rebuy_count * buyIn : buyIn + current.rebuy_count * buyIn

  return (
    <div style={{ paddingBottom: '6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleBack}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.125rem', cursor: 'pointer', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center' }}
          >
            ←
          </button>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>End sesi</span>
        </div>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
          {step + 1} / {totalSteps}
        </span>
      </div>

      <div style={{ padding: '2rem 1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
        <p style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{current.player_name}</p>
        {current.is_dealer && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', padding: '2px 8px', borderRadius: '4px', background: 'var(--accent-felt)', color: 'var(--text-primary)' }}>
            ★ DEALER
          </span>
        )}
      </div>

      <div style={{ padding: '1.25rem 1.5rem 0' }}>
        <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Buy-in</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: current.is_dealer ? 'var(--accent-success)' : 'var(--text-primary)' }}>
              {current.is_dealer ? 'gratis' : buyIn}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Rebuy ({current.rebuy_count}×)</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
              {current.rebuy_count * buyIn}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.375rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total dikeluarkan</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--text-primary)' }}>
              {totalSpent}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.5rem 0' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Stack akhir:</p>
        <input
          key={current.player_id}
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min="0"
          defaultValue={inputs[current.player_id] ?? ''}
          onChange={(e) => {
            setCurrentInput(e.target.value)
            setInputError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
          placeholder="0"
          style={{
            width: '100%',
            padding: '0.875rem 1rem',
            borderRadius: '8px',
            border: `1px solid ${inputError ? 'var(--accent-danger)' : 'var(--border-strong)'}`,
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: '2rem',
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'center',
            outline: 'none',
            appearance: 'textfield',
          }}
        />
        {inputError && <p style={{ fontSize: '0.8125rem', color: 'var(--accent-danger)', marginTop: '0.375rem' }}>{inputError}</p>}
      </div>

      <div style={stickyBottom}>
        <Button fullWidth disabled={currentInput === ''} onClick={handleNext}>
          {step === totalSteps - 1 ? 'Lihat recap' : 'Next →'}
        </Button>
      </div>
    </div>
  )
}
