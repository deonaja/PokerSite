'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { endSession } from '@/lib/actions/session'
import BalanceDisplay from './BalanceDisplay'
import Button from './Button'
import PixelIcon from './PixelIcon'
import Avatar from './Avatar'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from '@/lib/safeStorage'
import { useElapsedSeconds } from '@/lib/useElapsed'
import { formatDurationShort } from '@/lib/duration'

interface Participant {
  player_id: string
  player_name: string
  is_dealer: boolean
  // true = deals only, doesn't play (broke fallback OR a chosen neutral dealer).
  // Only a non-playing dealer collects the rake.
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
  startedAt: string
}

const STORAGE_KEY = (sessionId: string) => `endSession:${sessionId}`

// Sticky bottom CTA bar — matches the dashboard pattern (safe-area aware).
const STICKY_BOTTOM =
  'fixed bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'

export default function SessionEndWizard({ sessionId, participants, expectedTotal, rakeInfo, startedAt }: Props) {
  const router = useRouter()
  const elapsed = useElapsedSeconds(startedAt)
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
      className="flex min-h-11 min-w-11 items-center bg-transparent text-muted-foreground"
    >
      <ArrowLeft aria-label="Kembali" className="h-5 w-5" />
    </button>
  )

  if (isRecap) {
    return (
      <div className="pb-24">
        <div className="flex items-center gap-2 border-b-2 border-[var(--tt-rule)] bg-black px-3 py-2.5">
          {backButton}
          <span className="flex items-center gap-2 text-lg uppercase tracking-wide text-[var(--tt-yellow)]">
            <PixelIcon name="flag" size={16} className="text-[var(--tt-cyan)]" /> Konfirmasi
          </span>
        </div>

        <div className="px-3 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-base uppercase tracking-[0.1em] text-[var(--text-secondary)]">Recap</p>
            {elapsed != null && (
              <p className="text-base tabular-nums text-[var(--text-secondary)]">
                Durasi {formatDurationShort(elapsed)}
              </p>
            )}
          </div>

          <div className="mb-5 flex flex-col gap-2.5">
            {participants.map((p, idx) => {
              const stack = parseInt(inputs[p.player_id] ?? '0', 10)
              const newBalance = p.current_balance + stack
              const delta = newBalance - p.original_balance

              return (
                <Card key={p.player_id} className="px-4 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Avatar name={p.player_name} size={32} />
                    <span className="min-w-0 truncate text-lg uppercase tracking-wide text-[var(--tt-white)]">{p.player_name}</span>
                    {p.is_dealer && <Badge className="px-1.5 py-0.5"><PixelIcon name="star" size={11} /></Badge>}
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
              <p className="m-0 flex items-start gap-1.5 border-t border-border pt-2 text-[0.8125rem] text-warn">
                <PixelIcon name="warn" size={13} className="mt-px shrink-0" />
                <span>Selisih {chipDiff > 0 ? '+' : ''}
                {chipDiff}. Confirm tetap atau revisi?</span>
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
            className="h-12 bg-[var(--tt-yellow)] text-black hover:bg-[color-mix(in_srgb,var(--tt-yellow)_86%,#000)]"
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
      <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--tt-rule)] bg-black px-3 py-2.5">
        <div className="flex items-center gap-2">
          {backButton}
          <span className="flex items-center gap-2 text-lg uppercase tracking-wide text-[var(--tt-yellow)]">
            <PixelIcon name="flag" size={16} className="text-[var(--tt-cyan)]" /> End Sesi
          </span>
        </div>
        <span className="text-lg tabular-nums text-[var(--tt-cyan)]">
          {step + 1}/{totalSteps}
        </span>
      </div>

      {/* Numbered step strip — the current step lit gold, done cyan, upcoming dim */}
      <div className="flex gap-1 px-3 pt-3" aria-hidden>
        {participants.map((_, i) => (
          <span
            key={i}
            className="h-2 flex-1"
            style={{ background: i < step ? 'var(--tt-cyan)' : i === step ? 'var(--tt-yellow)' : 'var(--tt-rule)' }}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-1.5 px-6 pt-7">
        <Avatar name={current.player_name} size={64} className="mb-1" />
        <p className="m-0 text-2xl uppercase tracking-wide text-[var(--tt-white)]">{current.player_name}</p>
        {current.is_dealer && (
          <Badge className="inline-flex items-center gap-1 px-2 py-0.5 text-sm uppercase tracking-wider">
            <PixelIcon name="star" size={11} />
            DEALER{current.no_gaji_dealer ? ' · BAGI KARTU' : ''}
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

      {rakeInfo && current.is_dealer && current.no_gaji_dealer && (
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
        <p className="mb-2 text-base uppercase tracking-[0.1em] text-[var(--text-secondary)]">Stack akhir</p>
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
            'w-full border bg-[var(--bg-elevated)] px-4 py-4 text-center text-5xl tabular-nums text-[var(--tt-cyan)] outline-none [appearance:textfield] placeholder:text-[var(--text-tertiary)] focus:border-[var(--tt-cyan)] ' +
            (inputError ? 'border-[var(--tt-red)]' : 'border-[var(--tt-rule-strong)]')
          }
        />
        {inputError && <p className="mt-1.5 text-base uppercase tracking-wide text-[var(--tt-red)]">{inputError}</p>}
      </div>

      <div className={STICKY_BOTTOM}>
        <Button fullWidth disabled={currentInput === ''} onClick={handleNext}>
          {editingFromRecap ? 'Simpan' : step === totalSteps - 1 ? 'Lihat recap' : (
            <span className="inline-flex items-center gap-1.5">Next <ArrowRight className="h-4 w-4" /></span>
          )}
        </Button>
      </div>
    </div>
  )
}
