import { sql } from '@/lib/db'
import type { Player } from '@/lib/types'
import BalanceDisplay from '@/components/BalanceDisplay'
import AddPlayerForm from './AddPlayerForm'
import EditBalanceForm from './EditBalanceForm'
import ForceEndSection from './ForceEndSection'

const PAGE_SIZE = 20

const ACTION_COLORS: Record<string, string> = {
  buy_in: 'var(--accent-felt)',
  buy_in_dealer_free: 'var(--accent-success)',
  rebuy: 'var(--accent-warn)',
  rebuy_undo: 'var(--text-tertiary)',
  session_end: '#4a7ab5',
  admin_balance_edit: 'var(--accent-danger)',
  admin_player_add: '#7a4ab5',
  admin_session_force_end: 'var(--accent-danger)',
}

const ACTION_TYPES = ['all', 'buy_in', 'buy_in_dealer_free', 'rebuy', 'rebuy_undo', 'session_end', 'admin_balance_edit', 'admin_player_add', 'admin_session_force_end']

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

  const [players, sessions, logs, logCount] = await Promise.all([
    sql`SELECT id, name, balance FROM players ORDER BY name ASC`,
    sql`SELECT id FROM sessions WHERE status = 'active' LIMIT 1`,
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
  const totalLogs = (logCount as unknown as { cnt: number }[])[0]?.cnt ?? 0
  const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE))
  const logPage = Math.min(rawPage, totalPages)

  const baseUrl = '/admin'

  const cell: React.CSSProperties = { padding: '0.625rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-base)', minHeight: '100dvh' }}>
      <h1 style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Admin</h1>

      {/* Players */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-tertiary)', margin: 0 }}>PEMAIN</p>
        {playerList.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Belum ada pemain.</p>
        ) : (
          <div style={{ borderRadius: '8px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            {playerList.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: i < players.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: 'var(--bg-surface)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.name}</span>
                <BalanceDisplay balance={p.balance} />
              </div>
            ))}
          </div>
        )}
        <AddPlayerForm />
        {playerList.length > 0 && <EditBalanceForm players={players as Player[]} />}
      </section>

      {/* Active session */}
      {activeSessionId && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-tertiary)', margin: 0 }}>SESI AKTIF</p>
          <ForceEndSection sessionId={activeSessionId} />
        </section>
      )}

      {/* Logs */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-tertiary)', margin: 0 }}>LOG</p>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {ACTION_TYPES.map((a) => {
            const active = (rawAction) === a
            return (
              <a key={a} href={`${baseUrl}?logAction=${a}&logPage=1`} style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: active ? 600 : 400, background: active ? 'var(--accent-felt)' : 'var(--bg-elevated)', color: active ? 'var(--text-primary)' : 'var(--text-secondary)', border: '1px solid var(--border-subtle)', textDecoration: 'none' }}>
                {a}
              </a>
            )
          })}
        </div>

        {/* Log table */}
        <div style={{ borderRadius: '8px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          {(logs as unknown as Record<string, unknown>[]).length === 0 ? (
            <p style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-tertiary)', margin: 0 }}>Belum ada log.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {(logs as unknown as Record<string, unknown>[]).map((log) => {
                  const meta = log.metadata as Record<string, unknown> | null
                  return (
                    <tr key={log.id as string} style={{ opacity: log.voided ? 0.45 : 1 }}>
                      <td style={cell}>
                        <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, background: ACTION_COLORS[log.action as string] ?? 'var(--bg-elevated)', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {log.action as string}
                        </span>
                        {!!log.voided && <span style={{ marginLeft: '0.375rem', fontSize: '0.625rem', color: 'var(--text-tertiary)' }}>voided</span>}
                        <div style={{ color: 'var(--text-primary)' }}>{(log.player_name as string) ?? '—'}</div>
                        {meta?.reason ? <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{meta.reason as string}</div> : null}
                      </td>
                      <td style={{ ...cell, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {log.balance_before != null ? (
                          <span>
                            <span style={{ color: 'var(--text-secondary)' }}>{log.balance_before as number}</span>
                            <span style={{ color: 'var(--text-tertiary)' }}> → </span>
                            <span style={{ color: 'var(--text-primary)' }}>{log.balance_after as number}</span>
                          </span>
                        ) : '—'}
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.625rem', marginTop: '0.25rem' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Hal {logPage}/{totalPages}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {logPage > 1 && (
              <a href={`${baseUrl}?logAction=${rawAction}&logPage=${logPage - 1}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', padding: '0.25rem 0.5rem', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>← Prev</a>
            )}
            {logPage < totalPages && (
              <a href={`${baseUrl}?logAction=${rawAction}&logPage=${logPage + 1}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', padding: '0.25rem 0.5rem', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>Next →</a>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
