'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { endSession } from '@/lib/actions/session'
import BalanceDisplay from './BalanceDisplay'
import Button from './Button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from '@/lib/safeStorage'

interface Participant {
  player_id: string
  player_name: string
  is_dealer: boolean
  no_gaji_dealer: boolean
  rebuy_count: number
  current_balance: number
  // Balance the player had BEFORE this session touched them. Drives the recap
  // delta so the +/- reflects net session result (not just the end-stack input).
  original_balance: number
  // Chips this player actually put into the table (buy-in + rebuys − undos +
  // any printed dealer salary chips). Used for chip total reconciliation.
  contributed: number
}

interface Props {
  sessionId: string
  participants: Participant[]
  // Total chips on the table, summed from actual buy-in/rebuy deductions.
  expectedTotal: number
  // Present only in Phase 2 (steady). Used to show the rake calculator on the dealer's step.
  rakeInfo: { rakeRate: number } | null
}

const STORAGE_KEY = (sessionId: string) => `endSession:${sessionId}`

// Sticky bottom CTA bar — matches the dashboard pattern (safe-area aware).
const STICKY_BOTTOM =
  'fixed bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'

const initialOf = (name: string) => (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

export default function SessionEndWizard({ sessionId, participants, expectedTotal, rakeInfo }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [currentInput, setCurrentInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // True when the user clicked Edit on the recap — Next then returns to the
  // recap (instead of advancing to the next player).
  const [editingFromRecap, setEditingFromRecap] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const totalSteps = participants.length
  const isRecap = step >= totalSteps
  const current = participants[step] ?? null

  // Restore inputs from localStorage. If every participant has a value, jump
  // straight to the recap so the user can keep editing instead of restarting.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = getLocalStorageItem(STORAGE_KEY(sessionId))
    if (!saved) return
    try {
      const parsed = JSON.parse(saved) as Record<string, string>
      if (parsed && typeof parsed === 'object') {
        setInputs(parsed)
        const allFilled = participants.every((p) => typeof parsed[p.player_id] === 'string' && parsed[p.player_id] !== '')
        if (allFilled) setStep(participants.length)
      }
    } catch { /* ignore corrupt storage */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Persist whenever we enter the recap (or inputs change while on it).
  useEffect(() => {
    if (!isRecap || typeof window === 'undefined') return
    setLocalStorageItem(STORAGE_KEY(sessionId), JSON.stringify(inputs))
  }, [isRecap, inputs, sessionId])

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
    if (editingFromRecap) {
      setEditingFromRecap(false)
      setStep(totalSteps) // back to the recap
    } else {
      setStep((s) => s + 1)
    }
  }

  function handleJumpTo(idx: number) {
    setInputError(null)
    setEditingFromRecap(true)
    setStep(idx)
  }

  function handleBack() {
    setInputError(null)
    if (isRecap) {
      // Back from the confirmation page goes to the active session. Inputs are
      // already persisted to localStorage, so coming back lands here again.
      router.push('/session')
      return
    }
    if (editingFromRecap) {
      // Cancel edit, return to recap without saving the change
      setEditingFromRecap(false)
      setStep(totalSteps)
      return
    }
    if (step === 0) {
      router.push('/session')
      return
    }
    setStep((s) => s - 1)
  }

  const inputTotal = Object.values(inputs).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0)
  const chipDiff = inputTotal - expectedTotal

  function handleConfirm() {
    setSubmitError(null)
    const actorPlayerId = getLocalStorageItem('playerId') ?? ''
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
      if (typeof window !== 'undefined') {
        removeLocalStorageItem(STORAGE_KEY(sessionId))
      }
      if (result.seasonOver && result.seasonId) {
        router.push(`/season/end?id=${result.seasonId}`)
      } else {
        router.push('/')
      }
    })
  }

  const backButton = (
    <button
      onClick={handleBack}
      className="flex min-h-11 min-w-11 items-center bg-transparent text-lg text-muted-foreground"
    >
      ←
    </button>
  )

  if (isRecap) {
    return (
      <div className="pb-24">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          {backButton}
          <span className="text-sm font-medium text-foreground">Konfirmasi</span>
        </div>

        <div className="px-4 pt-5">
          <p className="mb-3 text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">RECAP</p>

          <div className="mb-5 flex flex-col gap-2.5">
            {participants.map((p, idx) => {
              const stack = parseInt(inputs[p.player_id] ?? '0', 10)
              const newBalance = p.current_balance + stack
              const delta = newBalance - p.original_balance

              return (
                <Card key={p.player_id} className="px-4 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-[var(--bg-elevated)] font-mono text-xs font-medium text-foreground">
                      {initialOf(p.player_name)}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">{p.player_name}</span>
                    {p.is_dealer && <Badge className="px-1.5 py-0.5">★</Badge>}
                    {p.no_gaji_dealer && (
                      <span className="text-[0.625rem] text-[var(--text-tertiary)]">bagi kartu</span>
                    )}
                    <button
                      onClick={() => handleJumpTo(idx)}
                      className="ml-auto min-h-7 rounded-sm border border-input px-2 py-0.5 text-xs leading-none text-muted-foreground"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-sm">
                    <BalanceDisplay balance={p.original_balance} />
                    <span className="text-[var(--text-tertiary)]">→</span>
                    <BalanceDisplay balance={newBalance} />
                    <span className={delta >= 0 ? 'text-success' : 'text-destructive'}>
                      ({delta >= 0 ? '+' : ''}
                      {delta})
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>

          <Card className={'mb-4 px-4 py-3.5' + (chipDiff !== 0 ? ' border-warn' : '')}>
            <div className="mb-1 flex justify-between text-[0.8125rem]">
              <span className="text-muted-foreground">Total chip seharusnya</span>
              <span className="font-mono text-foreground">{expectedTotal}</span>
            </div>
            <div className={'flex justify-between text-[0.8125rem]' + (chipDiff !== 0 ? ' mb-2' : '')}>
              <span className="text-muted-foreground">Total input</span>
              <span className="font-mono text-foreground">{inputTotal}</span>
            </div>
            {chipDiff !== 0 && (
              <p className="m-0 border-t border-border pt-2 text-[0.8125rem] text-warn">
                ⚠ Selisih {chipDiff > 0 ? '+' : ''}
                {chipDiff}. Confirm tetap atau revisi?
              </p>
            )}
          </Card>

          {submitError && <p className="mb-4 text-sm text-destructive">{submitError}</p>}
        </div>

        <div className={STICKY_BOTTOM + ' flex gap-3'}>
          <Button variant="secondary" fullWidth disabled={isPending} onClick={handleBack}>Back</Button>
          <Button
            variant="primary"
            fullWidth
            disabled={isPending}
            onClick={handleConfirm}
            className="h-12 font-semibold uppercase tracking-wide"
          >
            {isPending ? 'Menyimpan...' : 'Confirm'}
          </Button>
        </div>
      </div>
    )
  }

  if (!current) return null

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <div className="flex items-center gap-3">
          {backButton}
          <span className="text-sm font-medium text-foreground">End sesi</span>
        </div>
        <span className="font-mono text-sm text-[var(--text-tertiary)]">
          {step + 1} / {totalSteps}
        </span>
      </div>

      <div className="flex flex-col items-center gap-1.5 px-6 pt-8">
        <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-[var(--bg-elevated)] font-mono text-xl font-medium text-foreground">
          {initialOf(current.player_name)}
        </span>
        <p className="m-0 text-xl font-medium text-foreground">{current.player_name}</p>
        {current.is_dealer && (
          <Badge className="px-2 py-0.5 text-xs tracking-wider">
            ★ DEALER{current.no_gaji_dealer ? ' (BAGI KARTU)' : ''}
          </Badge>
        )}
      </div>

      <div className="px-6 pt-5">
        <Card className="flex flex-col gap-[0.3rem] px-4 py-3">
          {current.no_gaji_dealer ? (
            <div className="flex justify-between text-[0.8125rem]">
              <span className="text-muted-foreground">Bagi kartu (gak ante)</span>
              <span className="font-mono text-[var(--text-tertiary)]">rake/tip</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-muted-foreground">Chip masuk (buy-in + rebuy)</span>
                <span className="font-mono text-foreground">{current.contributed}</span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-muted-foreground">Rebuy</span>
                <span className="font-mono text-foreground">{current.rebuy_count}×</span>
              </div>
            </>
          )}
        </Card>
      </div>

      {rakeInfo && current.is_dealer && (
        <div className="px-6 pt-4">
          <Card className="border-[var(--accent-felt-dim)] px-4 py-3">
            <p className="mb-2 text-[0.6875rem] font-medium tracking-[0.08em] text-primary">KALKULATOR RAKE</p>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-muted-foreground">Total chip di meja</span>
                <span className="font-mono text-foreground">{expectedTotal}</span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-muted-foreground">Rake rate</span>
                <span className="font-mono text-foreground">{rakeInfo.rakeRate}%</span>
              </div>
              <div className="mt-0.5 flex justify-between border-t border-border pt-1.5 text-[0.8125rem]">
                <span className="text-muted-foreground">Perkiraan rake</span>
                <span className="font-mono font-medium text-primary">
                  {Math.round(expectedTotal * rakeInfo.rakeRate / 100 / 5) * 5} chip
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="px-6 pt-5">
        <p className="mb-2 text-[0.8125rem] text-muted-foreground">Stack akhir:</p>
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
          className={
            'w-full rounded-lg border bg-[var(--bg-elevated)] px-4 py-3.5 text-center font-mono text-[2rem] text-foreground outline-none [appearance:textfield] ' +
            (inputError ? 'border-destructive' : 'border-input')
          }
        />
        {inputError && <p className="mt-1.5 text-[0.8125rem] text-destructive">{inputError}</p>}
      </div>

      <div className={STICKY_BOTTOM}>
        <Button fullWidth disabled={currentInput === ''} onClick={handleNext}>
          {editingFromRecap ? 'Simpan' : (step === totalSteps - 1 ? 'Lihat recap' : 'Next →')}
        </Button>
      </div>
    </div>
  )
}
