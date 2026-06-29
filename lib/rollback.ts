/**
 * Snapshot-based admin rollback.
 *
 * Whitelist of edit_log actions that GET a snapshot (and are thus rollback
 * targets): session_start, session_end, season_start, admin_balance_edit.
 *
 * Blacklist (NEVER snapshotted, NEVER a rollback target):
 *   - within-session microtransactions: rebuy, buy_in, buy_in_dealer_*,
 *     dealer_salary_*, rebuy_undo, session_end_settle
 *   - loans: loan_out / loan_in / loan_repay / loan_settle / loan_writeoff
 *   - pin_change, register_player, season_join
 *   - admin_session_cancel (irreversible by design — cancelSession() DELETEs
 *     the session and its log entries)
 *   - season_end (immutable boundary — rollback that crosses it is rejected)
 *
 * Snapshots are taken INSIDE the triggering action's transaction, AFTER the
 * edit_log INSERT, so the snapshot captures the world AS OF that log entry.
 * Edit_log remains append-only; rollback writes an `admin_rollback` audit
 * entry, never DELETEs.
 */

export const ROLLBACK_WHITELIST = [
  'session_start',
  'session_end',
  'season_start',
  'admin_balance_edit',
] as const

export type RollbackableAction = (typeof ROLLBACK_WHITELIST)[number]

export interface SnapshotData {
  players: Array<{ id: string; balance: number; last_dealer_session_id: string | null }>
  active_season: {
    id: string
    current_phase: 'bootstrap' | 'steady'
    max_sessions: number
    p1_sessions_actual: number | null
    p2_target_sessions: number | null
    p1_target_sessions: number | null
  } | null
  active_session: {
    id: string
    season_id: string | null
    status: string
    started_at: string
    ended_at: string | null
    dealer_id: string
    creator_player_id: string | null
  } | null
  session_participants: Array<{
    session_id: string
    player_id: string
    is_dealer: boolean
    dealer_plays: boolean
    no_gaji_dealer: boolean
    rebuy_count: number
    final_stack: number | null
  }>
  loans_open: Array<{
    id: string
    season_id: string
    lender_id: string
    borrower_id: string
    amount: number
    status: string
    created_at: string
    approved_at: string | null
  }>
}

interface DbClient {
  query: <T = unknown>(text: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount?: number | null }>
}

/**
 * Take a state snapshot. Must be called INSIDE a transaction, AFTER the
 * triggering edit_log row is inserted but BEFORE COMMIT, so the snapshot
 * captures the world as the action left it.
 *
 * The snapshot captures: every player's balance + cooldown anchor, the active
 * season's mutable fields, the active session (if any) + its participants,
 * and any OPEN loans (pending/active). Closed loans / ended sessions are not
 * captured — rollback is forward-deleting (it discards rows newer than the
 * snapshot's timestamp).
 */
export async function takeSnapshot(client: DbClient, editLogId: string): Promise<void> {
  const { rows: players } = await client.query<{
    id: string; balance: number; last_dealer_session_id: string | null
  }>(`SELECT id, balance, last_dealer_session_id FROM players ORDER BY id`)

  const { rows: seasonRows } = await client.query<{
    id: string
    current_phase: 'bootstrap' | 'steady'
    max_sessions: number
    p1_sessions_actual: number | null
    p2_target_sessions: number | null
    p1_target_sessions: number | null
  }>(`SELECT id, current_phase, max_sessions, p1_sessions_actual, p2_target_sessions, p1_target_sessions
      FROM seasons WHERE status = 'active' LIMIT 1`)

  const { rows: sessionRows } = await client.query<{
    id: string
    season_id: string | null
    status: string
    started_at: string
    ended_at: string | null
    dealer_id: string
    creator_player_id: string | null
  }>(`SELECT id, season_id, status, started_at, ended_at, dealer_id, creator_player_id
      FROM sessions WHERE status = 'active' LIMIT 1`)

  const activeSession = sessionRows[0] ?? null

  const { rows: participants } = activeSession
    ? await client.query<{
        session_id: string
        player_id: string
        is_dealer: boolean
        dealer_plays: boolean
        no_gaji_dealer: boolean
        rebuy_count: number
        final_stack: number | null
      }>(
        `SELECT session_id, player_id, is_dealer, dealer_plays, no_gaji_dealer, rebuy_count, final_stack
         FROM session_participants WHERE session_id = $1 ORDER BY player_id`,
        [activeSession.id]
      )
    : { rows: [] }

  const { rows: loans } = await client.query<{
    id: string
    season_id: string
    lender_id: string
    borrower_id: string
    amount: number
    status: string
    created_at: string
    approved_at: string | null
  }>(`SELECT id, season_id, lender_id, borrower_id, amount, status, created_at, approved_at
      FROM loans WHERE status IN ('pending', 'active') ORDER BY id`)

  const data: SnapshotData = {
    players,
    active_season: seasonRows[0] ?? null,
    active_session: activeSession,
    session_participants: participants,
    loans_open: loans,
  }

  await client.query(
    `INSERT INTO edit_log_snapshots (edit_log_id, snapshot_data) VALUES ($1, $2)`,
    [editLogId, JSON.stringify(data)]
  )
}

/**
 * Execute a rollback to the world AS CAPTURED by the given snapshot.
 *
 * Validations:
 *   - snapshot exists
 *   - no `season_end` log entry has been written since the snapshot was taken
 *     (immutability boundary)
 *
 * Restore order:
 *   1. Lock all affected players (FOR UPDATE) — serializes against concurrent
 *      rollback / mutation.
 *   2. UPDATE players.balance + last_dealer_session_id to snapshot values.
 *   3. Sessions/participants: DELETE every session whose started_at > snapshot
 *      ts (CASCADE removes their participants). For a session that was active
 *      at snapshot time but has since ended: revive it (status='active',
 *      ended_at=NULL, restore participants).
 *   4. Seasons: restore current_phase + max_sessions + p1_sessions_actual +
 *      p2_target_sessions + p1_target_sessions if there was an active season.
 *   5. Loans: any loan whose status changed (or any loan that was open at
 *      snapshot time but no longer exists / no longer open) is restored to
 *      snapshot state. Open loans created AFTER the snapshot are deleted.
 *   6. Insert admin_rollback audit entry.
 *
 * Edit_log itself is NEVER deleted — append-only contract holds.
 */
export async function executeRollback(
  client: DbClient,
  snapshotId: string,
  adminPlayerId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1. Load snapshot + its triggering edit_log entry's timestamp.
  const { rows: [snap] } = await client.query<{
    id: string
    edit_log_id: string
    snapshot_data: SnapshotData
    snapshot_created_at: string
    log_created_at: string
    log_action: string
  }>(
    `SELECT s.id, s.edit_log_id, s.snapshot_data, s.created_at AS snapshot_created_at,
            e.created_at AS log_created_at, e.action AS log_action
     FROM edit_log_snapshots s
     JOIN edit_log e ON e.id = s.edit_log_id
     WHERE s.id = $1`,
    [snapshotId]
  )
  if (!snap) return { ok: false, error: 'Snapshot tidak ditemukan' }

  // 2. Immutability boundary: refuse if a season_end happened between then and now.
  const { rows: [{ count: boundaryCount }] } = await client.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM edit_log
     WHERE action = 'season_end' AND created_at > $1`,
    [snap.snapshot_created_at]
  )
  if (boundaryCount > 0) {
    return { ok: false, error: 'Tidak bisa rollback melewati akhir musim' }
  }

  const data = snap.snapshot_data
  const snapTs = snap.snapshot_created_at

  // 3. Lock every player row so balance restores are serialized with concurrent
  //    rebuys / loan / session writes. (Lock first to avoid mid-rollback drift.)
  if (data.players.length > 0) {
    await client.query(
      `SELECT id FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [data.players.map((p) => p.id)]
    )
  }

  // Lock any session row that's involved (snapshot's active session OR any
  // session created after the snapshot — those are about to be deleted).
  await client.query(
    `SELECT id FROM sessions WHERE started_at > $1 OR id = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid) FOR UPDATE`,
    [snapTs, data.active_session?.id ?? null]
  )

  // 4. Sessions: drop everything newer than the snapshot. Any participants
  //    cascade-delete. The dealer-cooldown anchor on players may reference a
  //    session we're about to delete (FK is plain — no ON DELETE rule) — null
  //    those out first so the DELETE doesn't fail.
  const { rows: doomedSessions } = await client.query<{ id: string }>(
    `SELECT id FROM sessions WHERE started_at > $1`,
    [snapTs]
  )
  if (doomedSessions.length > 0) {
    await client.query(
      `UPDATE players SET last_dealer_session_id = NULL
       WHERE last_dealer_session_id = ANY($1::uuid[])`,
      [doomedSessions.map((r) => r.id)]
    )
    // Edit_log.session_id ON DELETE SET NULL — log rows survive (append-only).
    // session_participants ON DELETE CASCADE — handled automatically.
    await client.query(
      `DELETE FROM sessions WHERE id = ANY($1::uuid[])`,
      [doomedSessions.map((r) => r.id)]
    )
  }

  // 5. Revive the snapshot's active session if it has since ended/been deleted.
  if (data.active_session) {
    const snapSession = data.active_session
    const { rows: [existing] } = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM sessions WHERE id = $1`,
      [snapSession.id]
    )
    if (!existing) {
      // Session was deleted (e.g. via cancelSession). Re-INSERT it.
      await client.query(
        `INSERT INTO sessions (id, dealer_id, status, season_id, creator_player_id, started_at, ended_at)
         VALUES ($1, $2, 'active', $3, $4, $5, NULL)`,
        [snapSession.id, snapSession.dealer_id, snapSession.season_id,
         snapSession.creator_player_id, snapSession.started_at]
      )
    } else if (existing.status !== 'active') {
      // Session ended after the snapshot — flip back to active.
      await client.query(
        `UPDATE sessions SET status = 'active', ended_at = NULL WHERE id = $1`,
        [snapSession.id]
      )
    }
    // Wipe and rebuild participants to match snapshot exactly.
    await client.query(`DELETE FROM session_participants WHERE session_id = $1`, [snapSession.id])
    for (const p of data.session_participants) {
      await client.query(
        `INSERT INTO session_participants
           (session_id, player_id, is_dealer, dealer_plays, no_gaji_dealer, rebuy_count, final_stack)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.session_id, p.player_id, p.is_dealer, p.dealer_plays, p.no_gaji_dealer, p.rebuy_count, p.final_stack]
      )
    }
  }

  // 6. Players: restore balance + cooldown anchor (anchors that pointed at a
  //    now-deleted session were nulled above; the snapshot's anchor is valid
  //    by construction since we revived the active session and didn't touch
  //    older ended ones).
  for (const p of data.players) {
    await client.query(
      `UPDATE players SET balance = $1, last_dealer_session_id = $2 WHERE id = $3`,
      [p.balance, p.last_dealer_session_id, p.id]
    )
  }

  // 7. Seasons: restore mutable fields on the snapshot's active season (if any).
  if (data.active_season) {
    const s = data.active_season
    await client.query(
      `UPDATE seasons
       SET current_phase = $2,
           max_sessions = $3,
           p1_sessions_actual = $4,
           p2_target_sessions = $5,
           p1_target_sessions = $6
       WHERE id = $1`,
      [s.id, s.current_phase, s.max_sessions, s.p1_sessions_actual, s.p2_target_sessions, s.p1_target_sessions]
    )
  }

  // 8. Loans: restore open-loan state.
  //    a) Any loan ID in snapshot.loans_open: UPSERT to snapshot state.
  //    b) Any loan currently open but NOT in snapshot.loans_open AND created
  //       after the snapshot ts: delete (it was created after the rollback target).
  const snapLoanIds = new Set(data.loans_open.map((l) => l.id))
  for (const l of data.loans_open) {
    const { rows: [existing] } = await client.query<{ id: string }>(
      `SELECT id FROM loans WHERE id = $1 FOR UPDATE`,
      [l.id]
    )
    if (existing) {
      await client.query(
        `UPDATE loans SET status = $2, amount = $3, approved_at = $4, settled_at = NULL WHERE id = $1`,
        [l.id, l.status, l.amount, l.approved_at]
      )
    } else {
      await client.query(
        `INSERT INTO loans (id, season_id, lender_id, borrower_id, amount, status, created_at, approved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [l.id, l.season_id, l.lender_id, l.borrower_id, l.amount, l.status, l.created_at, l.approved_at]
      )
    }
  }
  // Delete brand-new loans (created after snapshot) so the open-loan unique
  // constraint stays clean. Loans whose status changed AFTER snapshot but were
  // ALREADY closed at snapshot time aren't in loans_open and we leave them be.
  const { rows: postSnapLoans } = await client.query<{ id: string }>(
    `SELECT id FROM loans WHERE created_at > $1`,
    [snapTs]
  )
  const toDelete = postSnapLoans.filter((r) => !snapLoanIds.has(r.id)).map((r) => r.id)
  if (toDelete.length > 0) {
    await client.query(`DELETE FROM loans WHERE id = ANY($1::uuid[])`, [toDelete])
  }

  // 9. Append-only audit entry. Never DELETE log rows; this is how rollback
  //    becomes visible in the log and remains itself auditable.
  await client.query(
    `INSERT INTO edit_log (actor_player_id, action, metadata)
     VALUES ($1, 'admin_rollback', $2)`,
    [adminPlayerId, JSON.stringify({
      snapshot_id: snapshotId,
      restored_to_log_id: snap.edit_log_id,
      restored_to_action: snap.log_action,
      restored_to_log_created_at: snap.log_created_at,
    })]
  )

  return { ok: true }
}
