import { sql } from '@/lib/db'
import type { Player } from '@/lib/types'
import BalanceDisplay from '@/components/BalanceDisplay'
import AddPlayerForm from './AddPlayerForm'
import EditBalanceForm from './EditBalanceForm'
import ForceEndSection from './ForceEndSection'
import ResetPinForm from './ResetPinForm'
import DebugSection from './DebugSection'

const PAGE_SIZE = 20

const initialOf = (name: string) => (name.match(/[a-zA-Z0-9]/)?.[0] ?? '?').toUpperCase()

const ACTION_COLORS: Record<string, string> = {
  buy_in: 'var(--accent-felt)',
  buy_in_dealer_free: 'var(--accent-success)',
  buy_in_dealer_phase2: 'var(--accent-felt)',
  buy_in_no_gaji_dealer: 'var(--text-tertiary)',
  dealer_salary_chips: 'var(--accent-success)',
  rebuy: 'var(--accent-warn)',
  rebuy_undo: 'var(--text-tertiary)',
  session_end: '#4a7ab5',
  season_start: 'var(--accent-felt)',
  season_end: '#4a7ab5',
  pin_change: '#5f4ab5',
  admin_balance_edit: 'var(--accent-danger)',
  admin_pin_reset: '#5f4ab5',
  admin_player_add: '#7a4ab5',
  admin_session_force_end: 'var(--accent-danger)',
  admin_session_cancel: 'var(--accent-danger)',
}

const ACTION_TYPES = [
  'all',
  'buy_in', 'buy_in_dealer_free', 'buy_in_dealer_phase2', 'buy_in_no_gaji_dealer',
  'dealer_salary_chips',
  'rebuy', 'rebuy_undo',
  'session_end',
  'season_start', 'season_end',
  'pin_change',
  'admin_balance_edit', 'admin_pin_reset', 'admin_player_add', 'admin_session_force_end',
  'admin_session_cancel',
]

interface SearchParams {
  logPage?: string
  logAction?: string
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  // Auth is handled by middleware — page renders only when cookie is valid

  const rawPage = Math.max(1, parseInt(params.logPage ?? '1', 10))
  const rawAction = params.logAction ?? 'all'
  const logAction = ACTION_TYPES.includes(rawAction) && rawAction !== 'all' ? rawAction : null
  const offset = (rawPage - 1) * PAGE_SIZE

  const [players, sessions, season, logs, logCount] = await Promise.all([
    sql`SELECT id, name, balance FROM players ORDER BY name ASC`,
    sql`SELECT id FROM sessions WHERE status = 'active' LIMIT 1`,
    sql`SELECT starting_balance FROM seasons WHERE status = 'active' LIMIT 1`,
    logAction
      ? sql`
          SELECT el.id, el.action, el.balance_before, el.balance_after, el.voided, el.created_at, el.metadata,
                 p.name AS player_name, a.name AS actor_name
          FROM edit_log el
          LEFT JOIN players p ON p.id = el.player_id
          LEFT JOIN players a ON a.id = el.actor_player_id
          WHERE el.action = ${logAction}
          ORDER BY el.created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}
        `
      : sql`
          SELECT el.id, el.action, el.balance_before, el.balance_after, el.voided, el.created_at, el.metadata,
                 p.name AS player_name, a.name AS actor_name
          FROM edit_log el
          LEFT JOIN players p ON p.id = el.player_id
          LEFT JOIN players a ON a.id = el.actor_player_id
          ORDER BY el.created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}
        `,
    logAction
      ? sql`SELECT COUNT(*)::int AS cnt FROM edit_log WHERE action = ${logAction}`
      : sql`SELECT COUNT(*)::int AS cnt FROM edit_log`,
  ])

  const playerList = players as unknown as Player[]
  const activeSessionId = (sessions as unknown as { id: string }[])[0]?.id ?? null
  const startingBalance = (season as unknown as { starting_balance: number }[])[0]?.starting_balance ?? 200
  const totalLogs = (logCount as unknown as { cnt: number }[])[0]?.cnt ?? 0
  const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE))
  const logPage = Math.min(rawPage, totalPages)

  const baseUrl = '/admin'

  const cellClass = 'border-b border-border px-3 py-2.5 align-top text-xs text-muted-foreground'

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col gap-6 bg-background p-4">
      <h1 className="text-base font-medium text-foreground">Admin</h1>

      {/* Players */}
      <section className="flex flex-col gap-2.5">
        <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">PEMAIN</p>
        {playerList.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">Belum ada pemain.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {playerList.map((p, i) => (
              <div key={p.id} className={'flex items-center gap-3 bg-card px-4 py-3 ' + (i < players.length - 1 ? 'border-b border-border' : '')}>
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-[var(--bg-elevated)] font-mono text-xs font-medium text-foreground">
                  {initialOf(p.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.name}</span>
                <BalanceDisplay balance={p.balance} />
              </div>
            ))}
          </div>
        )}
        <AddPlayerForm defaultBalance={startingBalance} />
        {playerList.length > 0 && <EditBalanceForm players={players as Player[]} />}
        {playerList.length > 0 && <ResetPinForm players={players as Player[]} />}
      </section>

      {/* Active session */}
      {activeSessionId && (
        <section className="flex flex-col gap-2.5">
          <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">SESI AKTIF</p>
          <ForceEndSection sessionId={activeSessionId} />
        </section>
      )}

      {/* Debug */}
      <DebugSection />

      {/* Export */}
      <section className="flex flex-col gap-2.5">
        <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">EXPORT CSV</p>
        <div className="flex flex-wrap gap-2">
          {[
            { type: 'results', label: 'Hasil musim' },
            { type: 'log', label: 'Edit log' },
            { type: 'players', label: 'Pemain' },
            { type: 'sessions', label: 'Sesi' },
          ].map((x) => (
            <a
              key={x.type}
              href={`/admin/export?type=${x.type}`}
              className="rounded-md border border-input bg-[var(--bg-elevated)] px-3 py-2 text-[0.8125rem] text-foreground no-underline transition-colors hover:bg-secondary"
            >
              ↓ {x.label}
            </a>
          ))}
        </div>
      </section>

      {/* Logs */}
      <section className="flex flex-col gap-2.5">
        <p className="text-xs font-medium tracking-[0.08em] text-[var(--text-tertiary)]">LOG</p>

        {/* Filter */}
        <div className="flex flex-wrap gap-1.5">
          {ACTION_TYPES.map((a) => {
            const active = (rawAction) === a
            return (
              <a key={a} href={`${baseUrl}?logAction=${a}&logPage=1`} className={'rounded-sm border border-border px-2 py-[3px] text-[0.6875rem] no-underline ' + (active ? 'bg-primary font-semibold text-primary-foreground' : 'bg-[var(--bg-elevated)] text-muted-foreground')}>
                {a}
              </a>
            )
          })}
        </div>

        {/* Log table */}
        <div className="overflow-hidden rounded-lg border border-border">
          {(logs as unknown as Record<string, unknown>[]).length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-tertiary)]">Belum ada log.</p>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {(logs as unknown as Record<string, unknown>[]).map((log) => {
                  const meta = log.metadata as Record<string, unknown> | null
                  return (
                    <tr key={log.id as string} className={log.voided ? 'opacity-45' : ''}>
                      <td className={cellClass}>
                        <span className="mb-1 inline-block rounded-sm px-1.5 py-px text-[0.6875rem] font-semibold text-foreground" style={{ background: ACTION_COLORS[log.action as string] ?? 'var(--bg-elevated)' }}>
                          {log.action as string}
                        </span>
                        {!!log.voided && <span className="ml-1.5 text-[0.625rem] text-[var(--text-tertiary)]">voided</span>}
                        <div className="text-foreground">{(log.player_name as string) ?? '—'}</div>
                        {meta?.reason ? <div className="italic text-[var(--text-tertiary)]">{meta.reason as string}</div> : null}
                      </td>
                      <td className={cellClass + ' whitespace-nowrap text-right font-mono'}>
                        {log.balance_before != null ? (
                          <span>
                            <span className="text-muted-foreground">{log.balance_before as number}</span>
                            <span className="text-[var(--text-tertiary)]"> → </span>
                            <span className="text-foreground">{log.balance_after as number}</span>
                          </span>
                        ) : '—'}
                        <div className="mt-1 text-[0.625rem] text-[var(--text-tertiary)]">
                          {new Date(log.created_at as string).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-[0.8125rem]">
          <span className="text-[var(--text-tertiary)]">Hal {logPage}/{totalPages}</span>
          <div className="flex gap-2">
            {logPage > 1 && (
              <a href={`${baseUrl}?logAction=${rawAction}&logPage=${logPage - 1}`} className="rounded-sm border border-border px-2 py-1 text-muted-foreground no-underline">← Prev</a>
            )}
            {logPage < totalPages && (
              <a href={`${baseUrl}?logAction=${rawAction}&logPage=${logPage + 1}`} className="rounded-sm border border-border px-2 py-1 text-muted-foreground no-underline">Next →</a>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
