'use client'

import { useEffect, useState, useTransition } from 'react'
import { createSeason } from '@/lib/actions/season'
import Button from './Button'
import { Card } from './ui/card'

const PRESETS = [
  { name: 'sprint',   label: 'Sprint',   desc: '~1 minggu',  maxPool: 1500, maxSessions: 15, rakeRate: 15 },
  { name: 'quick',    label: 'Quick',    desc: '~2 minggu',  maxPool: 2500, maxSessions: 25, rakeRate: 10 },
  { name: 'standard', label: 'Standard', desc: '~3 minggu',  maxPool: 3500, maxSessions: 40, rakeRate: 10 },
  { name: 'marathon', label: 'Marathon', desc: '~1 bulan',   maxPool: 5000, maxSessions: 60, rakeRate:  8 },
  { name: 'custom',   label: 'Custom',   desc: 'manual',     maxPool:    0, maxSessions:  0, rakeRate:  0 },
] as const

type PresetName = typeof PRESETS[number]['name']

function recommendBbSb(startingBalance: number): { bb: number; sb: number } {
  const bb = Math.max(1, Math.round(startingBalance / 20))
  const sb = Math.max(1, Math.round(bb / 2))
  return { bb, sb }
}

// Keep only digits and drop leading zeros (so an empty field stays empty and
// typing into "0" gives "400", not "0400"). A lone "0" is preserved.
function digitsOnly(v: string): string {
  return v.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
}

interface Props {
  seasonNumber: number
  existingPlayers: { id: string; name: string }[]
}

export default function SeasonSetup({ seasonNumber, existingPlayers }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [playerNames, setPlayerNames] = useState<string[]>(
    existingPlayers.length > 0 ? existingPlayers.map((p) => p.name) : ['', '']
  )
  const [startingBalance, setStartingBalance] = useState(200)
  const [preset, setPreset] = useState<PresetName>('standard')
  const [custom, setCustom] = useState({ maxPool: '3500', maxSessions: '40', rakeRate: '10' })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const { bb, sb } = recommendBbSb(startingBalance)
  const buyIn = Math.floor(startingBalance / 2)
  const activePreset = PRESETS.find((p) => p.name === preset)!
  const maxPool = preset === 'custom' ? (parseInt(custom.maxPool, 10) || 0) : activePreset.maxPool
  const maxSessions = preset === 'custom' ? (parseInt(custom.maxSessions, 10) || 0) : activePreset.maxSessions
  const rakeRate = preset === 'custom' ? (parseInt(custom.rakeRate, 10) || 0) : activePreset.rakeRate

  const filledNames = playerNames.map((n) => n.trim()).filter(Boolean)
  const step1Valid = filledNames.length >= 2 && new Set(filledNames.map((n) => n.toLowerCase())).size === filledNames.length
  const step2Valid = startingBalance >= 10
  const step3Valid = preset !== 'custom' || (maxPool > 0 && maxSessions > 0 && rakeRate >= 0)

  function addPlayer() {
    if (!isHydrated || isPending) return
    setPlayerNames((prev) => [...prev, ''])
  }

  function removePlayer(i: number) {
    if (!isHydrated || isPending) return
    setPlayerNames((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateName(i: number, val: string) {
    if (!isHydrated || isPending) return
    setPlayerNames((prev) => prev.map((n, idx) => (idx === i ? val : n)))
  }

  function handleSubmit() {
    if (!isHydrated || isPending) return
    setError(null)
    startTransition(async () => {
      const result = await createSeason({
        playerNames: filledNames,
        startingBalance,
        bb,
        sb,
        maxPool,
        maxSessions,
        rakeRate,
        presetName: preset,
      })
      if (result && 'error' in result) setError(result.error)
    })
  }

  const inputClass =
    'w-full rounded-lg border border-input bg-[var(--bg-elevated)] px-4 py-3 text-sm text-foreground outline-none'

  const labelClass =
    'mb-2 text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground'

  return (
    <div className="flex flex-col px-4 pt-12 pb-8 gap-6">
      {/* Header */}
      <div>
        <p className="mb-1 text-xs text-[var(--text-tertiary)]">
          Season {seasonNumber}
        </p>
        <h1 className="m-0 text-lg font-medium text-foreground">
          {step === 1 && 'Siapa yang main?'}
          {step === 2 && 'Modal & blind'}
          {step === 3 && 'Durasi season'}
          {step === 4 && 'Konfirmasi'}
        </h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={
              'h-[3px] flex-1 rounded-sm transition-colors ' +
              (s <= step ? 'bg-primary' : 'bg-border')
            }
          />
        ))}
      </div>

      {/* Step 1: Players */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          {seasonNumber > 1 && existingPlayers.length > 0 ? (
            <p className="m-0 text-[0.8125rem] text-muted-foreground">
              Pemain dari musim sebelumnya — edit atau hapus sesuka kamu. PIN default pemain baru: <strong className="font-mono text-foreground">1234</strong>
            </p>
          ) : (
            <p className="m-0 text-[0.8125rem] text-muted-foreground">
              Pemain pertama = pembuat season. PIN default semua: <strong className="font-mono text-foreground">1234</strong>
            </p>
          )}
          <div className="flex flex-col gap-2">
            {playerNames.map((name, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={name}
                  disabled={!isHydrated || isPending}
                  onChange={(e) => updateName(i, e.target.value)}
                  placeholder={i === 0 ? 'Nama kamu (pembuat)' : `Pemain ${i + 1}`}
                  maxLength={50}
                  className={inputClass + ' flex-1'}
                />
                {playerNames.length > 2 && (
                  <button
                    type="button"
                    disabled={!isHydrated || isPending}
                    onClick={() => removePlayer(i)}
                    className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-base text-[var(--text-tertiary)]"
                    aria-label="Hapus pemain"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {playerNames.length < 8 && (
            <button
              type="button"
              disabled={!isHydrated || isPending}
              onClick={addPlayer}
              className="min-h-11 cursor-pointer rounded-lg border border-dashed border-input bg-transparent text-sm text-muted-foreground"
            >
              + Tambah pemain
            </button>
          )}

          {filledNames.length >= 2 && new Set(filledNames.map((n) => n.toLowerCase())).size < filledNames.length && (
            <p className="m-0 text-[0.8125rem] text-destructive">
              Nama pemain harus unik.
            </p>
          )}

          <Button
            type="button"
            fullWidth
            disabled={!isHydrated || !step1Valid || isPending}
            onClick={() => setStep(2)}
            className="h-12 text-base font-semibold uppercase tracking-wide"
          >
            Lanjut →
          </Button>
        </div>
      )}

      {/* Step 2: Balance */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className={labelClass}>Modal awal tiap pemain</p>
            <input
              type="number"
              inputMode="numeric"
              value={startingBalance || ''}
              disabled={!isHydrated || isPending}
              onChange={(e) => setStartingBalance(Math.max(0, parseInt(e.target.value, 10) || 0))}
              min={10}
              max={100000}
              placeholder="cth. 200"
              className={inputClass + ' font-mono text-xl'}
            />
          </div>

          <Card className="flex flex-col gap-2.5 p-4">
            <Row label="Buy-in / dealer salary" value={buyIn} mono />
            <Row label="Big blind (BB)" value={bb} mono />
            <Row label="Small blind (SB)" value={sb} mono />
          </Card>

          <p className="m-0 text-xs text-[var(--text-tertiary)]">
            BB/SB adalah rekomendasi. Bisa disesuaikan pas main.
          </p>

          <div className="flex gap-2">
            <Button type="button" onClick={() => setStep(1)} disabled={!isHydrated || isPending} className="flex-1">
              ← Kembali
            </Button>
            <Button type="button" fullWidth disabled={!isHydrated || !step2Valid || isPending} onClick={() => setStep(3)} className="flex-[2] h-12 text-base font-semibold uppercase tracking-wide">
              Lanjut →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preset */}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[0.8125rem] text-muted-foreground">
            Estimasi untuk {filledNames.length} pemain, 2–3x seminggu.
          </p>

          <div className="flex flex-col gap-2">
            {PRESETS.map((p) => {
              const active = preset === p.name
              return (
                <button
                  key={p.name}
                  type="button"
                  disabled={!isHydrated || isPending}
                  onClick={() => setPreset(p.name)}
                  className={
                    'min-h-11 cursor-pointer rounded-lg border px-4 py-3.5 text-left transition-colors ' +
                    (active ? 'border-primary bg-accent' : 'border-border bg-card')
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {p.label}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">{p.desc}</span>
                  </div>
                  {p.name !== 'custom' && (
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      Max pool {p.maxPool} · {p.maxSessions} sesi · rake {p.rakeRate}%
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {preset === 'custom' && (
            <div className="mt-2 flex flex-col gap-3">
              <div>
                <p className={labelClass}>Max pool chip di sistem</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={custom.maxPool}
                  disabled={!isHydrated || isPending}
                  onChange={(e) => setCustom((c) => ({ ...c, maxPool: digitsOnly(e.target.value) }))}
                  min={100}
                  className={inputClass + ' font-mono'}
                  placeholder="cth. 3500"
                />
              </div>
              <div>
                <p className={labelClass}>Max sesi</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={custom.maxSessions}
                  disabled={!isHydrated || isPending}
                  onChange={(e) => setCustom((c) => ({ ...c, maxSessions: digitsOnly(e.target.value) }))}
                  min={1}
                  className={inputClass + ' font-mono'}
                  placeholder="cth. 40"
                />
              </div>
              <div>
                <p className={labelClass}>Rake rate (%)</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={custom.rakeRate}
                  disabled={!isHydrated || isPending}
                  onChange={(e) => setCustom((c) => ({ ...c, rakeRate: digitsOnly(e.target.value) }))}
                  min={0}
                  max={50}
                  className={inputClass + ' font-mono'}
                  placeholder="cth. 10"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" onClick={() => setStep(2)} disabled={!isHydrated || isPending} className="flex-1">
              ← Kembali
            </Button>
            <Button type="button" fullWidth disabled={!isHydrated || !step3Valid || isPending} onClick={() => setStep(4)} className="flex-[2] h-12 text-base font-semibold uppercase tracking-wide">
              Lanjut →
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-4">
            <Section title="Pemain">
              {filledNames.map((name, i) => (
                <div key={i} className="py-0.5 text-sm text-foreground">
                  {name}
                  {i === 0 && (
                    <span className="ml-2 text-xs text-[var(--text-tertiary)]">
                      (pembuat)
                    </span>
                  )}
                </div>
              ))}
            </Section>

            <div className="h-px bg-border" />

            <Section title="Ekonomi">
              <Row label="Modal awal" value={startingBalance} mono />
              <Row label="Buy-in" value={buyIn} mono />
              <Row label="BB / SB" value={`${bb} / ${sb}`} />
            </Section>

            <div className="h-px bg-border" />

            <Section title={`Preset: ${activePreset.label}`}>
              <Row label="Max pool" value={maxPool} mono />
              <Row label="Max sesi" value={maxSessions} />
              <Row label="Rake rate" value={`${rakeRate}%`} />
            </Section>
          </Card>

          <p className="m-0 text-xs text-[var(--text-tertiary)]">
            Semua pemain baru mendapat PIN default <span className="font-mono text-muted-foreground">1234</span>. Ganti dari dashboard setelah login.
          </p>

          {error && (
            <p className="m-0 text-[0.8125rem] text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="button" onClick={() => setStep(3)} disabled={!isHydrated || isPending} className="flex-1">
              ← Kembali
            </Button>
            <Button
              type="button"
              fullWidth
              disabled={!isHydrated || isPending}
              onClick={handleSubmit}
              className="flex-[2] h-12 text-base font-semibold uppercase tracking-wide"
            >
              {isPending ? 'Membuat…' : 'Mulai Season'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.8125rem] text-muted-foreground">{label}</span>
      <span className={'text-sm text-foreground' + (mono ? ' font-mono' : '')}>
        {value}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-[var(--text-tertiary)]">
        {title}
      </p>
      {children}
    </div>
  )
}
