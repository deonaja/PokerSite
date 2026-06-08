// Public read-only spectator view (Fase E4 / item 9 guest mode). No identity,
// no PIN, no actions — just the active season's standings + a CTA to register.
// Lives outside (main) so the identity guard doesn't apply.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { sql } from '@/lib/db'

const initialOf = (name: string) => (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

export default async function SpectatorPage() {
  const [seasonRows, memberRows] = await Promise.all([
    sql`SELECT number, current_phase FROM seasons WHERE status = 'active' LIMIT 1`,
    sql`
      SELECT p.name, p.balance
      FROM players p
      JOIN season_players mp ON mp.player_id = p.id
      JOIN seasons s ON s.id = mp.season_id AND s.status = 'active'
      ORDER BY p.balance DESC, p.name ASC`,
  ])
  const season = (seasonRows as unknown as { number: number; current_phase: string }[])[0] ?? null
  const members = memberRows as unknown as { name: string; balance: number }[]

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col px-4 pt-12 pb-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Papan skor</p>
        {season && (
          <span className="text-xs text-[var(--text-tertiary)]">
            Season {season.number}
            {' · '}
            <span className="text-primary">{season.current_phase === 'steady' ? 'STEADY' : 'BOOTSTRAP'}</span>
          </span>
        )}
      </div>

      {!season ? (
        <p className="text-sm text-[var(--text-tertiary)]">Belum ada musim berjalan.</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">Belum ada pemain di musim ini.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {members.map((m, i) => (
            <div
              key={m.name}
              className={'flex items-center gap-3 bg-card px-4 py-3 ' + (i < members.length - 1 ? 'border-b border-border' : '')}
            >
              <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--text-tertiary)]">
                {i + 1}
              </span>
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-[var(--bg-elevated)] font-mono text-xs font-medium text-foreground"
              >
                {initialOf(m.name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{m.name}</span>
              <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                {m.balance.toLocaleString('id-ID')}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-[var(--text-tertiary)]">Cuma nonton. Mau ikut main?</p>
      <Link
        href="/identity"
        className="mt-3 flex min-h-12 items-center justify-center rounded-lg bg-primary text-base font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Daftar / Masuk
      </Link>
      <Link
        href="/panduan"
        className="mt-4 self-center text-[0.8125rem] text-muted-foreground underline-offset-4 hover:underline"
      >
        Lihat panduan
      </Link>
    </div>
  )
}
