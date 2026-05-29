'use client'

import { useEffect, useState, useTransition } from 'react'
import { createSeason } from '@/lib/actions/season'
import Button from './Button'

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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.5rem',
  }

  return (
    <div className="flex flex-col px-4 pt-12 pb-8 gap-6">
      {/* Header */}
      <div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
          Season {seasonNumber}
        </p>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
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
            style={{
              flex: 1,
              height: '3px',
              borderRadius: '2px',
              background: s <= step ? 'var(--accent-felt)' : 'var(--border-subtle)',
              transition: 'background 200ms',
            }}
          />
        ))}
      </div>

      {/* Step 1: Players */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          {seasonNumber > 1 && existingPlayers.length > 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              Pemain dari musim sebelumnya — edit atau hapus sesuka kamu. PIN default pemain baru: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>1234</strong>
            </p>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              Pemain pertama = pembuat season. PIN default semua: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>1234</strong>
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
                  style={{ ...inputStyle, flex: 1 }}
                />
                {playerNames.length > 2 && (
                  <button
                    type="button"
                    disabled={!isHydrated || isPending}
                    onClick={() => removePlayer(i)}
                    style={{
                      minWidth: '44px',
                      minHeight: '44px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
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
              style={{
                minHeight: '44px',
                background: 'none',
                border: `1px dashed var(--border-strong)`,
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              + Tambah pemain
            </button>
          )}

          {filledNames.length >= 2 && new Set(filledNames.map((n) => n.toLowerCase())).size < filledNames.length && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--accent-danger)', margin: 0 }}>
              Nama pemain harus unik.
            </p>
          )}

          <Button
            type="button"
            fullWidth
            disabled={!isHydrated || !step1Valid || isPending}
            onClick={() => setStep(2)}
          >
            Lanjut →
          </Button>
        </div>
      )}

      {/* Step 2: Balance */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <p style={labelStyle}>Modal awal tiap pemain</p>
            <input
              type="number"
              inputMode="numeric"
              value={startingBalance || ''}
              disabled={!isHydrated || isPending}
              onChange={(e) => setStartingBalance(Math.max(0, parseInt(e.target.value, 10) || 0))}
              min={10}
              max={100000}
              placeholder="cth. 200"
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '1.25rem' }}
            />
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.625rem',
            }}
          >
            <Row label="Buy-in / dealer salary" value={buyIn} mono />
            <Row label="Big blind (BB)" value={bb} mono />
            <Row label="Small blind (SB)" value={sb} mono />
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>
            BB/SB adalah rekomendasi. Bisa disesuaikan pas main.
          </p>

          <div className="flex gap-2">
            <Button type="button" onClick={() => setStep(1)} disabled={!isHydrated || isPending} style={{ flex: 1 }}>
              ← Kembali
            </Button>
            <Button type="button" fullWidth disabled={!isHydrated || !step2Valid || isPending} onClick={() => setStep(3)} style={{ flex: 2 }}>
              Lanjut →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preset */}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
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
                  style={{
                    textAlign: 'left',
                    padding: '0.875rem 1rem',
                    borderRadius: '8px',
                    border: `1px solid ${active ? 'var(--accent-felt)' : 'var(--border-subtle)'}`,
                    background: active ? 'var(--accent-felt-dim)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                      {p.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{p.desc}</span>
                  </div>
                  {p.name !== 'custom' && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Max pool {p.maxPool} · {p.maxSessions} sesi · rake {p.rakeRate}%
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {preset === 'custom' && (
            <div className="flex flex-col gap-3" style={{ marginTop: '0.5rem' }}>
              <div>
                <p style={labelStyle}>Max pool chip di sistem</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={custom.maxPool}
                  disabled={!isHydrated || isPending}
                  onChange={(e) => setCustom((c) => ({ ...c, maxPool: digitsOnly(e.target.value) }))}
                  min={100}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                  placeholder="cth. 3500"
                />
              </div>
              <div>
                <p style={labelStyle}>Max sesi</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={custom.maxSessions}
                  disabled={!isHydrated || isPending}
                  onChange={(e) => setCustom((c) => ({ ...c, maxSessions: digitsOnly(e.target.value) }))}
                  min={1}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                  placeholder="cth. 40"
                />
              </div>
              <div>
                <p style={labelStyle}>Rake rate (%)</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={custom.rakeRate}
                  disabled={!isHydrated || isPending}
                  onChange={(e) => setCustom((c) => ({ ...c, rakeRate: digitsOnly(e.target.value) }))}
                  min={0}
                  max={50}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                  placeholder="cth. 10"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" onClick={() => setStep(2)} disabled={!isHydrated || isPending} style={{ flex: 1 }}>
              ← Kembali
            </Button>
            <Button type="button" fullWidth disabled={!isHydrated || !step3Valid || isPending} onClick={() => setStep(4)} style={{ flex: 2 }}>
              Lanjut →
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <Section title="Pemain">
              {filledNames.map((name, i) => (
                <div key={i} style={{ fontSize: '0.875rem', color: 'var(--text-primary)', padding: '0.125rem 0' }}>
                  {name}
                  {i === 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>
                      (pembuat)
                    </span>
                  )}
                </div>
              ))}
            </Section>

            <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

            <Section title="Ekonomi">
              <Row label="Modal awal" value={startingBalance} mono />
              <Row label="Buy-in" value={buyIn} mono />
              <Row label="BB / SB" value={`${bb} / ${sb}`} />
            </Section>

            <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

            <Section title={`Preset: ${activePreset.label}`}>
              <Row label="Max pool" value={maxPool} mono />
              <Row label="Max sesi" value={maxSessions} />
              <Row label="Rake rate" value={`${rakeRate}%`} />
            </Section>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>
            Semua pemain baru mendapat PIN default <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>1234</span>. Ganti dari dashboard setelah login.
          </p>

          {error && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--accent-danger)', margin: 0 }}>{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="button" onClick={() => setStep(3)} disabled={!isHydrated || isPending} style={{ flex: 1 }}>
              ← Kembali
            </Button>
            <Button
              type="button"
              fullWidth
              disabled={!isHydrated || isPending}
              onClick={handleSubmit}
              style={{ flex: 2 }}
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{label}</span>
      <span
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          fontVariantNumeric: mono ? 'tabular-nums' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, fontWeight: 500 }}>
        {title}
      </p>
      {children}
    </div>
  )
}
