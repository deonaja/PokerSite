'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { usePoll } from '@/lib/usePoll'
import Button from './Button'
import Sheet from './Sheet'
import LoanWidget from './LoanWidget'
import JoinSeasonPrompt from './JoinSeasonPrompt'
import { getLocalStorageItem, setLocalStorageItem } from '@/lib/safeStorage'
import type { PollResponse, Season } from '@/lib/types'

interface Props {
  initial: PollResponse
  season: Season | null
  sessionsPlayed: number
  currentPlayerId: string | null
}

// localStorage key: the season phase this device last acknowledged.
const PHASE_SEEN_KEY = 'phase_seen'

const PHASE_NOTICE: Record<Season['current_phase'], { title: string; body: string }> = {
  steady: {
    title: 'Naik ke Phase 2 — STEADY',
    body: 'Pool chip udah penuh, musim masuk fase STEADY. Mulai sekarang dealer bayar buy-in seperti pemain lain (ga ada lagi main gratis) dan ngambil rake dari permainan.',
  },
  bootstrap: {
    title: 'Phase 1 — BOOTSTRAP',
    body: 'Musim ada di fase BOOTSTRAP. Dealer main gratis: ga kepotong buy-in dan dapet 1× buy-in chip gaji di meja.',
  },
}

// Teletext chip-stack: four block-mosaic bars, lit cyan in proportion to balance.
function ChipMosaic({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.max(0, value) / max : 0
  const lit = Math.min(4, Math.max(value > 0 ? 1 : 0, Math.round(ratio * 4)))
  const heights = [9, 13, 17, 22]
  return (
    <span className="flex h-[22px] w-[26px] shrink-0 items-end gap-[2px]" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[5px]"
          style={{ height: h, background: i < lit ? 'var(--tt-cyan)' : 'var(--tt-rule)' }}
        />
      ))}
    </span>
  )
}

// A single teletext page tab (>=44px touch cell).
function PageTab({ code, label, href, active }: { code: string; label: string; href?: string; active?: boolean }) {
  const cls =
    'flex h-12 flex-1 items-center justify-center gap-1.5 border-r border-[var(--tt-rule)] text-base uppercase tracking-wide last:border-r-0 ' +
    (active
      ? 'bg-[var(--tt-cyan)] text-black'
      : 'text-[var(--tt-white)] transition-colors hover:bg-[var(--bg-elevated)]')
  const inner = (
    <>
      <span className={active ? 'text-black/70' : 'text-[var(--tt-magenta)]'}>{code}</span>
      {label}
    </>
  )
  if (active || !href) return <span className={cls} aria-current={active ? 'page' : undefined}>{inner}</span>
  return <Link href={href} className={cls}>{inner}</Link>
}

export default function DashboardClient({ initial, season, sessionsPlayed, currentPlayerId }: Props) {
  const { players, activeSession } = usePoll(initial)

  const [phaseNotice, setPhaseNotice] = useState<Season['current_phase'] | null>(null)
  useEffect(() => {
    if (!season) return
    const current = season.current_phase
    const seen = getLocalStorageItem(PHASE_SEEN_KEY)
    if (seen && seen !== current) setPhaseNotice(current)
    setLocalStorageItem(PHASE_SEEN_KEY, current)
  }, [season])

  const isMember = currentPlayerId != null && players.some((p) => p.id === currentPlayerId)
  const showJoinPrompt = currentPlayerId != null && season != null && !isMember

  // Standings: ranked by balance (desc). Copy first — never mutate poll state.
  const ranked = [...players].sort((a, b) => b.balance - a.balance)
  const maxBalance = ranked.reduce((m, p) => Math.max(m, p.balance), 0)

  // Progress toward the next phase (logic unchanged; rendered as a block bar).
  let phaseProgress: { pct: number; label: string } | null = null
  if (season) {
    if (season.current_phase === 'steady') {
      const p1Actual = season.p1_sessions_actual
      const p2Target = season.p2_target_sessions
      if (p1Actual != null && p2Target != null) {
        const p2Done = Math.max(0, sessionsPlayed - p1Actual)
        const left = Math.max(0, p2Target - p2Done)
        const pct = p2Target > 0 ? Math.min(100, Math.round((p2Done / p2Target) * 100)) : 0
        phaseProgress = {
          pct,
          label: left > 0
            ? `SESI ${p2Done}/${p2Target} · ${left} LAGI KE AKHIR MUSIM`
            : 'MUSIM SIAP DIAKHIRI',
        }
      } else {
        const left = Math.max(0, season.max_sessions - sessionsPlayed)
        const pct = season.max_sessions > 0
          ? Math.min(100, Math.round((sessionsPlayed / season.max_sessions) * 100))
          : 0
        phaseProgress = { pct, label: left > 0 ? `${left} SESI LAGI KE AKHIR MUSIM` : 'MUSIM SIAP DIAKHIRI' }
      }
    } else {
      const pool = players.reduce((s, p) => s + p.balance, 0)
      const pct = season.max_pool > 0 ? Math.min(100, Math.round((pool / season.max_pool) * 100)) : 0
      phaseProgress = {
        pct,
        label: pool < season.max_pool
          ? `POOL ${pool.toLocaleString('id-ID')}/${season.max_pool.toLocaleString('id-ID')}`
          : 'SIAP MASUK PHASE 2',
      }
    }
  }

  return (
    <div className="pb-28">
      {/* Page tabs — teletext magazine navigation */}
      <div className="flex border-b-2 border-[var(--tt-rule)]">
        <PageTab code="100" label="Saldo" active />
        <PageTab code="200" label="Sesi" href={activeSession ? '/session' : '/session/setup'} />
        <PageTab code="300" label="Riwayat" href="/riwayat" />
      </div>

      {/* Double-height yellow header + season line */}
      <div className="px-3 pt-3">
        <h1 className="text-3xl uppercase leading-none tracking-[0.06em] text-[var(--tt-yellow)]">
          Papan Saldo
        </h1>
        {season && (
          <p className="mt-1 text-base uppercase tracking-wide text-[var(--tt-green)]">
            Season {season.number} ·{' '}
            <span className={season.current_phase === 'steady' ? 'text-[var(--tt-cyan)]' : 'text-[var(--tt-white)]'}>
              {season.current_phase === 'steady' ? 'Steady' : 'Bootstrap'}
            </span>
          </p>
        )}
      </div>

      {/* Phase progress — block-mosaic bar */}
      {phaseProgress && (
        <div className="px-3 pt-2.5">
          <div className="mb-1 flex items-center justify-between text-sm uppercase tracking-wide text-[var(--text-secondary)]">
            <span className="truncate">{phaseProgress.label}</span>
            <span className="ml-2 shrink-0 tabular-nums text-[var(--tt-cyan)]">{phaseProgress.pct}%</span>
          </div>
          <div
            className="grid h-3 w-full gap-[2px]"
            style={{ gridTemplateColumns: 'repeat(20, 1fr)' }}
            role="progressbar"
            aria-valuenow={phaseProgress.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={phaseProgress.label}
          >
            {Array.from({ length: 20 }, (_, i) => (
              <span
                key={i}
                style={{
                  background: i < Math.round(phaseProgress.pct / 5) ? 'var(--tt-cyan)' : 'var(--tt-rule)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mid-season join prompt for a logged-in non-member */}
      {showJoinPrompt && season && (
        <div className="pt-3">
          <JoinSeasonPrompt phase={season.current_phase} />
        </div>
      )}

      {/* Peer-to-peer loans */}
      <LoanWidget />

      {/* Standings — teletext results table */}
      {ranked.length > 0 ? (
        <div className="mt-4">
          <div className="flex items-center justify-between border-y border-[var(--tt-rule)] bg-[#0a0a0a] px-3 py-1.5 text-sm uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            <span>Peringkat</span>
            <span className="text-[var(--tt-cyan)]">Saldo</span>
          </div>
          <ol>
            {ranked.map((p, i) => {
              const rank = i + 1
              const isTop3 = rank <= 3
              const isMe = p.id === currentPlayerId
              const lowBalance = season != null && p.balance < season.buy_in
              return (
                <li key={p.id}>
                  <Link
                    href={`/player/${p.id}`}
                    className={
                      'flex min-h-[52px] items-center gap-3 border-b border-[var(--tt-rule)] px-3 py-2 transition-colors hover:bg-[var(--bg-elevated)] ' +
                      (isMe ? 'bg-[var(--tt-cyan-dim)]' : '')
                    }
                  >
                    <span
                      className={
                        'w-6 shrink-0 text-right text-xl tabular-nums ' +
                        (isTop3 ? 'text-[var(--tt-magenta)]' : 'text-[var(--text-tertiary)]')
                      }
                    >
                      {rank}
                    </span>
                    <ChipMosaic value={p.balance} max={maxBalance} />
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-lg uppercase tracking-wide text-[var(--tt-white)]">
                        {p.name}
                      </span>
                      {isMe && (
                        <span className="shrink-0 bg-[var(--tt-cyan)] px-1 text-xs uppercase tracking-wide text-black">
                          kamu
                        </span>
                      )}
                    </span>
                    {lowBalance && (
                      <TriangleAlert aria-label="saldo di bawah buy-in" className="size-4 shrink-0 text-[var(--tt-yellow)]" />
                    )}
                    <span
                      className={
                        'min-w-[3.75rem] text-right text-2xl tabular-nums ' +
                        (p.balance < 0 ? 'text-[var(--tt-red)]' : 'text-[var(--tt-cyan)]')
                      }
                    >
                      {p.balance}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      ) : (
        <p className="px-3 pt-6 text-base uppercase tracking-wide text-[var(--text-tertiary)]">
          Belum ada pemain terdaftar.
        </p>
      )}

      {/* Active session alert — red broadcast band */}
      {activeSession && (
        <Link
          href="/session"
          className="mt-4 flex min-h-[52px] items-center justify-between gap-2 border-y-2 border-[var(--tt-red)] bg-[color-mix(in_srgb,var(--tt-red)_18%,#000)] px-3 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--tt-red)_28%,#000)]"
        >
          <span className="flex items-center gap-2 text-lg uppercase tracking-wide text-[var(--tt-red)]">
            <span className="inline-block h-2.5 w-2.5 shrink-0 bg-[var(--tt-red)]" style={{ animation: 'pulse 1.4s steps(2) infinite' }} />
            Sesi Berjalan
          </span>
          <span className="text-base uppercase tracking-wide text-[var(--tt-white)]">Tap untuk lanjut ›</span>
        </Link>
      )}

      {/* Teletext page footer — reachable pages */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-3 text-sm uppercase tracking-wide text-[var(--text-tertiary)]">
        <Link href="/riwayat" className="transition-colors hover:text-[var(--tt-cyan)]">
          <span className="text-[var(--tt-magenta)]">300</span> Riwayat Sesi
        </Link>
        <Link href="/season/history" className="transition-colors hover:text-[var(--tt-cyan)]">
          <span className="text-[var(--tt-magenta)]">400</span> Riwayat Musim
        </Link>
      </div>

      {/* Sticky CTA — yellow broadcast action */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 border-t-2 border-[var(--tt-rule)] bg-black px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {activeSession ? (
          <Button fullWidth disabled className="h-14 bg-[var(--tt-yellow)] text-xl text-black">
            Mulai Sesi
          </Button>
        ) : (
          <Link href="/session/setup" className="block">
            <Button fullWidth className="h-14 bg-[var(--tt-yellow)] text-xl text-black hover:bg-[color-mix(in_srgb,var(--tt-yellow)_86%,#000)]">
              Mulai Sesi
            </Button>
          </Link>
        )}
      </div>

      {/* One-time phase-change alert */}
      <Sheet
        isOpen={phaseNotice !== null}
        onClose={() => setPhaseNotice(null)}
        title={phaseNotice ? PHASE_NOTICE[phaseNotice].title : ''}
      >
        <p className="font-read mb-5 text-sm leading-relaxed text-muted-foreground">
          {phaseNotice ? PHASE_NOTICE[phaseNotice].body : ''}
        </p>
        <Button fullWidth onClick={() => setPhaseNotice(null)}>
          Oke, ngerti
        </Button>
      </Sheet>
    </div>
  )
}
