import { sql } from '@/lib/db'
import Link from 'next/link'
import { ArrowLeft, Clock, Star } from 'lucide-react'
import { getAuthenticatedPlayerId } from '@/lib/auth-server'
import { formatDurationShort } from '@/lib/duration'

export const dynamic = 'force-dynamic'

interface SessionRow {
  session_id: string
  started_at: string
  ended_at: string | null
  dealer_id: string | null
  dealer_name: string | null
}

interface ResultRow {
  session_id: string
  player_id: string
  player_name: string
  is_dealer: boolean
  delta: number
  rebuys: number
}

async function getData() {
  const [sessions, results] = await Promise.all([
    sql`
      SELECT s.id AS session_id, s.started_at, s.ended_at, s.dealer_id,
             dp.name AS dealer_name
      FROM sessions s
      JOIN seasons se ON se.id = s.season_id AND se.status = 'active'
      LEFT JOIN players dp ON dp.id = s.dealer_id
      WHERE s.status = 'ended'
      ORDER BY s.ended_at DESC NULLS LAST, s.started_at DESC
    ` as unknown as Promise<SessionRow[]>,
    // Net balance change per player per session telescopes to (last.after −
    // first.before), so SUM(after − before) is correct and ordering-independent
    // (a rebuy and its undo cancel out). Mirrors the end-wizard recap delta.
    sql`
      SELECT el.session_id, el.player_id, p.name AS player_name,
             COALESCE(sp.is_dealer, false) AS is_dealer,
             SUM(el.balance_after - el.balance_before)::int AS delta,
             COUNT(*) FILTER (WHERE el.action = 'rebuy' AND NOT el.voided)::int AS rebuys
      FROM edit_log el
      JOIN players p ON p.id = el.player_id
      JOIN sessions s ON s.id = el.session_id
      JOIN seasons se ON se.id = s.season_id AND se.status = 'active'
      LEFT JOIN session_participants sp
        ON sp.session_id = el.session_id AND sp.player_id = el.player_id
      WHERE s.status = 'ended'
      GROUP BY el.session_id, el.player_id, p.name, sp.is_dealer
    ` as unknown as Promise<ResultRow[]>,
  ])

  const s = await sessions
  const r = await results
  const bySession = new Map<string, ResultRow[]>()
  for (const row of r) {
    if (!bySession.has(row.session_id)) bySession.set(row.session_id, [])
    bySession.get(row.session_id)!.push(row)
  }
  // Sort each session's players by net result (winners first).
  for (const list of bySession.values()) list.sort((a, b) => b.delta - a.delta)

  return s.map((sess) => ({ ...sess, players: bySession.get(sess.session_id) ?? [] }))
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))

function durationSeconds(start: string, end: string | null) {
  if (!end) return null
  return (new Date(end).getTime() - new Date(start).getTime()) / 1000
}

function deltaClass(d: number) {
  if (d > 0) return 'text-[var(--accent-success)]'
  if (d < 0) return 'text-[var(--accent-danger)]'
  return 'text-muted-foreground'
}
const fmtDelta = (d: number) => (d > 0 ? `+${d}` : `${d}`)

export default async function RiwayatSesiPage() {
  const [sessions, currentPlayerId] = await Promise.all([getData(), getAuthenticatedPlayerId()])
  const total = sessions.length

  return (
    <div className="pb-8">
      <div className="flex items-center gap-2 border-b-2 border-[var(--tt-rule)] bg-black px-3 py-3">
        <Link href="/" className="flex min-h-11 min-w-11 items-center text-[var(--tt-cyan)] no-underline">
          <ArrowLeft aria-label="Kembali" className="h-5 w-5" />
        </Link>
        <span className="text-lg uppercase tracking-wide text-[var(--tt-yellow)]">
          <span className="text-[var(--tt-magenta)]">P300</span> Riwayat Sesi
        </span>
      </div>

      {total === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
          Belum ada sesi yang selesai di musim ini.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5 p-4">
          {sessions.map((sess, i) => {
            const num = total - i
            const dur = durationSeconds(sess.started_at, sess.ended_at)
            const winner = sess.players[0]
            return (
              <div key={sess.session_id} className="rounded-lg border border-border bg-card">
                {/* header */}
                <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">Sesi #{num}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">{fmtDate(sess.started_at)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    {dur !== null && (
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDurationShort(dur)}
                      </span>
                    )}
                    {sess.dealer_name && (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                        <Star className="h-3 w-3 text-primary" />
                        {sess.dealer_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* players */}
                <div className="flex flex-col">
                  {sess.players.map((p) => {
                    const isMe = p.player_id === currentPlayerId
                    return (
                      <div
                        key={p.player_id}
                        className={`flex items-center gap-2.5 px-3.5 py-2 ${isMe ? 'bg-[var(--accent-felt-dim)]' : ''}`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-xs font-semibold text-muted-foreground">
                          {p.player_name.charAt(0).toUpperCase()}
                        </span>
                        <span className="flex-1 truncate text-sm text-foreground">
                          {p.player_name}
                          {p.is_dealer && <Star className="ml-1 inline h-3 w-3 text-primary" aria-label="Dealer" />}
                          {isMe && <span className="ml-1.5 text-[10px] font-semibold text-primary">KAMU</span>}
                          {p.rebuys > 0 && (
                            <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">{p.rebuys}× rebuy</span>
                          )}
                        </span>
                        <span className={`font-mono text-sm font-semibold tabular-nums ${deltaClass(p.delta)}`}>
                          {fmtDelta(p.delta)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* footer */}
                {winner && winner.delta > 0 && (
                  <div className="border-t border-border px-3.5 py-2 text-xs text-[var(--text-tertiary)]">
                    Menang terbanyak: <span className="text-foreground">{winner.player_name}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
