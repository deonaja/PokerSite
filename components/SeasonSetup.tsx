'use client'

import { useEffect, useState, useTransition } from 'react'
import { createSeason } from '@/lib/actions/season'
import Button from './Button'
import { Card } from './ui/card'

// Preset = durasi (jumlah sesi) + rake. Label hari ngira-ngira di pace ~3 sesi/hari.
// max_pool TIDAK lagi di preset — diturunin dari tempo (Opsi A) di bawah.
const PRESETS = [
  { name: 'sprint',   label: 'Sprint',   desc: '~3 hari',     maxSessions: 10, rakeRate: 15 },
  { name: 'quick',    label: 'Quick',    desc: '~5 hari',     maxSessions: 15, rakeRate: 10 },
  { name: 'standard', label: 'Standard', desc: '~1 minggu',   maxSessions: 24, rakeRate: 10 },
  { name: 'marathon', label: 'Marathon', desc: '~1.5 minggu', maxSessions: 36, rakeRate:  8 },
  { name: 'custom',   label: 'Custom',   desc: 'manual',      maxSessions:  0, rakeRate:  0 },
] as const

type PresetName = typeof PRESETS[number]['name']

// Tempo = preferensi panjang Phase 1 (bootstrap) sebagai fraksi total sesi.
// max_pool = modal_awal_total + (target_P1_sesi × gaji_dealer), gaji_dealer = 2×buy_in.
const TEMPOS = [
  { name: 'serius',    label: '🔥 Langsung serius',   desc: 'Bootstrap singkat, ekonomi cepat serius', p1Frac: 0.25 },
  { name: 'seimbang',  label: '⚖️ Seimbang',          desc: 'Pemanasan & serius rata',                 p1Frac: 0.40 },
  { name: 'pemanasan', label: '🐢 Pemanasan panjang', desc: 'Dealer lama main gratis',                 p1Frac: 0.60 },
] as const

type TempoName = typeof TEMPOS[number]['name']

// BB/SB diturunin dari buy_in (= stack yang dibawa tiap duduk di meja), BUKAN
// dari starting_balance. Sejak modal awal = buy_in × nyawa, basis ke
// starting_balance bikin stack-in-BB ngaco pas nyawa > 2.
function recommendBbSb(buyIn: number): { bb: number; sb: number } {
  const bb = Math.max(1, Math.round(buyIn / 10))
  const sb = Math.max(1, Math.round(bb / 2))
  return { bb, sb }
}

// Modal awal tiap pemain = buy_in × nyawa. Nyawa = berapa kali bisa "isi ulang"
// stack penuh sebelum bener-bener habis.
const NYAWA_OPTIONS = [3, 4, 5] as const

// Keep only digits and drop leading zeros (so an empty field stays empty and
// typing into "0" gives "400", not "0400"). A lone "0" is preserved.
function digitsOnly(v: string): string {
  return v.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
}

interface Props {
  seasonNumber: number
  allPlayers: { id: string; name: string; inLastSeason: boolean }[]
}

export default function SeasonSetup({ seasonNumber, allPlayers }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  // Membership (item 3): existing players are a checklist (default UNCHECK all —
  // explicit opt-in), brand-new players are typed below. The season roster =
  // checked existing + filled new names.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [newNames, setNewNames] = useState<string[]>(allPlayers.length === 0 ? ['', ''] : [])
  const [buyIn, setBuyIn] = useState(100)
  const [nyawa, setNyawa] = useState<number>(5)
  const [preset, setPreset] = useState<PresetName>('standard')
  const [tempo, setTempo] = useState<TempoName>('serius')
  const [custom, setCustom] = useState({ maxSessions: '24', rakeRate: '10' })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const startingBalance = buyIn * nyawa
  const { bb, sb } = recommendBbSb(buyIn)
  const activePreset = PRESETS.find((p) => p.name === preset)!
  const activeTempo = TEMPOS.find((t) => t.name === tempo)!
  const maxSessions = preset === 'custom' ? (parseInt(custom.maxSessions, 10) || 0) : activePreset.maxSessions
  const rakeRate = preset === 'custom' ? (parseInt(custom.rakeRate, 10) || 0) : activePreset.rakeRate

  // Roster = checked existing players (in display order) + filled new names.
  // First entry = creator (season/new is unauthenticated, so the creator is
  // derived from list order, same as before).
  const selectedNames = allPlayers.filter((p) => selectedIds.has(p.id)).map((p) => p.name)
  const newFilled = newNames.map((n) => n.trim()).filter(Boolean)
  const filledNames = [...selectedNames, ...newFilled]

  // Opsi A: max_pool diturunin (bukan diinput). gaji_dealer = 2×buy_in (item 6).
  // target_P1 = fraksi tempo × total sesi (sesi bootstrap yang diharapkan).
  const nPlayers = Math.max(filledNames.length, 2)
  const gajiDealer = 2 * buyIn
  const targetP1 = maxSessions > 0 ? Math.max(1, Math.round(activeTempo.p1Frac * maxSessions)) : 0
  const phase2Sessions = Math.max(0, maxSessions - targetP1)
  const maxPool = nPlayers * startingBalance + targetP1 * gajiDealer

  const step1Valid = filledNames.length >= 2 && new Set(filledNames.map((n) => n.toLowerCase())).size === filledNames.length
  const step2Valid = buyIn >= 10 && NYAWA_OPTIONS.includes(nyawa as 3 | 4 | 5)
  const step3Valid = (preset !== 'custom' || (maxSessions > 0 && rakeRate >= 0)) && maxPool >= 100

  function toggleSelect(id: string) {
    if (!isHydrated || isPending) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addNewPlayer() {
    if (!isHydrated || isPending) return
    setNewNames((prev) => [...prev, ''])
  }

  function removeNewPlayer(i: number) {
    if (!isHydrated || isPending) return
    setNewNames((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateNewName(i: number, val: string) {
    if (!isHydrated || isPending) return
    setNewNames((prev) => prev.map((n, idx) => (idx === i ? val : n)))
  }

  function handleSubmit() {
    if (!isHydrated || isPending) return
    setError(null)
    startTransition(async () => {
      const result = await createSeason({
        playerNames: filledNames,
        buyIn,
        nyawa,
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
          {step === 2 && 'Buy-in & nyawa'}
          {step === 3 && 'Durasi & tempo'}
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

      {/* Step 1: Players — membership checklist + brand-new players */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-[0.8125rem] text-muted-foreground">
            Pilih siapa yang ikut musim ini. PIN default pemain baru: <strong className="font-mono text-foreground">1234</strong>
          </p>

          {allPlayers.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className={labelClass}>Pemain terdaftar</p>
              {allPlayers.map((p) => {
                const checked = selectedIds.has(p.id)
                return (
                  <label
                    key={p.id}
                    className={
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors ' +
                      (checked ? 'border-primary bg-accent' : 'border-border bg-card')
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!isHydrated || isPending}
                      onChange={() => toggleSelect(p.id)}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="flex-1 text-sm font-medium text-foreground">{p.name}</span>
                    {p.inLastSeason && (
                      <span className="text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--text-tertiary)]">
                        musim lalu
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className={labelClass}>{allPlayers.length > 0 ? 'Tambah pemain baru' : 'Pemain'}</p>
            {newNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={name}
                  disabled={!isHydrated || isPending}
                  onChange={(e) => updateNewName(i, e.target.value)}
                  placeholder={`Pemain baru ${i + 1}`}
                  maxLength={50}
                  className={inputClass + ' flex-1'}
                />
                <button
                  type="button"
                  disabled={!isHydrated || isPending}
                  onClick={() => removeNewPlayer(i)}
                  className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-base text-[var(--text-tertiary)]"
                  aria-label="Hapus pemain"
                >
                  ✕
                </button>
              </div>
            ))}
            {filledNames.length < 8 && (
              <button
                type="button"
                disabled={!isHydrated || isPending}
                onClick={addNewPlayer}
                className="min-h-11 cursor-pointer rounded-lg border border-dashed border-input bg-transparent text-sm text-muted-foreground"
              >
                + Tambah pemain baru
              </button>
            )}
          </div>

          {filledNames.length >= 2 && new Set(filledNames.map((n) => n.toLowerCase())).size < filledNames.length && (
            <p className="m-0 text-[0.8125rem] text-destructive">
              Nama pemain harus unik.
            </p>
          )}

          <p className="m-0 text-xs text-[var(--text-tertiary)]">
            {filledNames.length} pemain dipilih
            {filledNames.length > 0 ? ` · ${filledNames[0]} = pembuat` : ''}. Minimal 2.
          </p>

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

      {/* Step 2: Buy-in & nyawa */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className={labelClass}>Buy-in (1 stack di meja)</p>
            <input
              type="number"
              inputMode="numeric"
              value={buyIn || ''}
              disabled={!isHydrated || isPending}
              onChange={(e) => setBuyIn(Math.max(0, parseInt(e.target.value, 10) || 0))}
              min={10}
              max={100000}
              placeholder="cth. 100"
              className={inputClass + ' font-mono text-xl'}
            />
          </div>

          <div>
            <p className={labelClass}>Nyawa (isi ulang sebelum habis)</p>
            <div className="flex gap-2">
              {NYAWA_OPTIONS.map((n) => {
                const active = nyawa === n
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={!isHydrated || isPending}
                    onClick={() => setNyawa(n)}
                    className={
                      'min-h-11 flex-1 cursor-pointer rounded-lg border font-mono text-base transition-colors ' +
                      (active ? 'border-primary bg-accent text-foreground' : 'border-border bg-card text-muted-foreground')
                    }
                  >
                    {n}×
                  </button>
                )
              })}
            </div>
          </div>

          <Card className="flex flex-col gap-2.5 p-4">
            <Row label="Modal awal tiap pemain" value={startingBalance} mono />
            <Row label="Big blind (BB)" value={bb} mono />
            <Row label="Small blind (SB)" value={sb} mono />
            <div className="h-px bg-border" />
            <p className="m-0 text-xs text-[var(--text-tertiary)]">
              Stack meja = 1 buy-in = {bb > 0 ? Math.round(buyIn / bb) : 0} BB
            </p>
          </Card>

          <p className="m-0 text-xs text-[var(--text-tertiary)]">
            Modal awal = buy-in × nyawa. Tiap pemain mulai {nyawa} nyawa (bisa rebuy {nyawa - 1}× sebelum habis). BB/SB rekomendasi, bisa disesuaikan pas main.
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
            Durasi (jumlah sesi) untuk {filledNames.length} pemain. Label hari kira-kira di pace ~3 sesi/hari.
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
                      {p.maxSessions} sesi · rake {p.rakeRate}%
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {preset === 'custom' && (
            <div className="mt-2 flex flex-col gap-3">
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

          {/* Tempo ekonomi = preferensi panjang Phase 1 */}
          <p className={labelClass + ' mt-2'}>Tempo ekonomi</p>
          <div className="flex flex-col gap-2">
            {TEMPOS.map((t) => {
              const active = tempo === t.name
              return (
                <button
                  key={t.name}
                  type="button"
                  disabled={!isHydrated || isPending}
                  onClick={() => setTempo(t.name)}
                  className={
                    'min-h-11 cursor-pointer rounded-lg border px-4 py-3 text-left transition-colors ' +
                    (active ? 'border-primary bg-accent' : 'border-border bg-card')
                  }
                >
                  <span className="text-sm font-medium text-foreground">{t.label}</span>
                  <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">{t.desc}</div>
                </button>
              )
            })}
          </div>

          <Card className="flex flex-col gap-2.5 p-4">
            <Row label="Bootstrap (Phase 1)" value={`≈ ${targetP1} sesi`} />
            <Row label="Steady (Phase 2)" value={`≈ ${phase2Sessions} sesi`} />
            <Row label="Max pool" value={maxPool} mono />
          </Card>

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
              <Row label="Buy-in" value={buyIn} mono />
              <Row label="Nyawa" value={`${nyawa}× (modal ${startingBalance})`} />
              <Row label="BB / SB" value={`${bb} / ${sb}`} />
            </Section>

            <div className="h-px bg-border" />

            <Section title={`Preset: ${activePreset.label} · ${activeTempo.label}`}>
              <Row label="Max sesi" value={maxSessions} />
              <Row label="Bootstrap / Steady" value={`≈ ${targetP1} / ${phase2Sessions} sesi`} />
              <Row label="Max pool" value={maxPool} mono />
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
