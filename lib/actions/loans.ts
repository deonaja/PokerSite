'use server'

import { revalidatePath } from 'next/cache'
import { createDbClient, sql } from '@/lib/db'
import { getAuthenticatedPlayerId } from '@/lib/auth-server'
import { sendPushToPlayer } from '@/lib/push'

type Result = { success: true } | { error: string }

function revalidateLoanPaths() {
  revalidatePath('/')
  revalidatePath('/session')
}

// Best-effort name lookup for notification text (never throws).
async function playerName(id: string): Promise<string> {
  try {
    const rows = (await sql`SELECT name FROM players WHERE id = ${id}`) as unknown as {
      name: string
    }[]
    return rows[0]?.name ?? 'Seseorang'
  } catch {
    return 'Seseorang'
  }
}

/**
 * Borrower (the logged-in player) asks a lender for a loan.
 *
 * Rules enforced here (the DB also backstops the borrower's "one open loan"
 * rule via the `one_open_loan_per_borrower` partial unique index):
 *  - must be logged in
 *  - NOT during an active session (loans live outside sessions)
 *  - there must be an active season (loan is season-scoped)
 *  - gate: borrower's balance < buy_in (only the short-stacked may borrow)
 *  - amount in [buy_in, lender.balance]; lender must hold >= buy_in
 *  - anti-circular / one-open-loan: neither borrower nor lender may already be
 *    in a pending/active loan (in EITHER role)
 *
 * No chips move at request time — disbursement happens on approve.
 */
export async function requestLoan({
  lenderId,
  amount,
}: {
  lenderId: string
  amount: number
}): Promise<Result> {
  const borrowerId = await getAuthenticatedPlayerId()
  if (!borrowerId) return { error: 'Belum login' }
  if (lenderId === borrowerId) return { error: 'Tidak bisa pinjam ke diri sendiri' }
  if (!Number.isInteger(amount) || amount <= 0) return { error: 'Jumlah tidak valid' }

  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    // No loans while a session is live.
    const { rows: [active] } = await client.query<{ id: string }>(
      `SELECT id FROM sessions WHERE status = 'active' LIMIT 1`
    )
    if (active) { await client.query('ROLLBACK'); return { error: 'Tidak bisa pinjam saat sesi berjalan' } }

    const { rows: [season] } = await client.query<{ id: string; buy_in: number }>(
      `SELECT id, buy_in FROM seasons WHERE status = 'active' LIMIT 1`
    )
    if (!season) { await client.query('ROLLBACK'); return { error: 'Tidak ada season aktif' } }
    const buyIn = season.buy_in

    // Both parties must be members of the active season (server actions are
    // publicly invocable, so a non-member can't be trusted not to call this).
    const { rows: members } = await client.query<{ player_id: string }>(
      `SELECT player_id FROM season_players WHERE season_id = $1 AND player_id = ANY($2::uuid[])`,
      [season.id, [borrowerId, lenderId]]
    )
    if (members.length < 2) {
      await client.query('ROLLBACK')
      return { error: 'Kedua pemain harus anggota season aktif' }
    }

    // Lock both player rows in a deterministic (id) order to avoid deadlocks
    // with a concurrent approve/repay that touches the same pair.
    const { rows: lockedPlayers } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [[borrowerId, lenderId]]
    )
    const borrower = lockedPlayers.find((p) => p.id === borrowerId)
    const lender = lockedPlayers.find((p) => p.id === lenderId)
    if (!borrower || !lender) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

    if (borrower.balance >= buyIn) {
      await client.query('ROLLBACK')
      return { error: 'Saldo kamu cukup, tidak perlu pinjam' }
    }
    if (lender.balance < buyIn) {
      await client.query('ROLLBACK')
      return { error: 'Saldo pemberi pinjaman tidak cukup' }
    }
    if (amount < buyIn || amount > lender.balance) {
      await client.query('ROLLBACK')
      return { error: `Jumlah harus antara ${buyIn} dan ${lender.balance}` }
    }

    // One open loan per player, either role (prevents chains/circular loans).
    const { rows: [openLoan] } = await client.query<{ id: string }>(
      `SELECT id FROM loans
       WHERE status IN ('pending', 'active')
         AND (lender_id = ANY($1::uuid[]) OR borrower_id = ANY($1::uuid[]))
       LIMIT 1`,
      [[borrowerId, lenderId]]
    )
    if (openLoan) {
      await client.query('ROLLBACK')
      return { error: 'Masih ada pinjaman berjalan untuk salah satu pemain' }
    }

    await client.query(
      `INSERT INTO loans (season_id, lender_id, borrower_id, amount, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [season.id, lenderId, borrowerId, amount]
    )

    await client.query('COMMIT')
    revalidateLoanPaths()

    // Notify the lender there's a request waiting. Post-commit + self-contained
    // try/catch so a notification failure can never reach the outer ROLLBACK path.
    try {
      const borrowerName = await playerName(borrowerId)
      await sendPushToPlayer(lenderId, {
        title: 'Permintaan pinjaman',
        body: `${borrowerName} minta pinjam ${amount} chip`,
        url: '/',
        tag: 'loan-request',
      })
    } catch (e) {
      console.error('requestLoan notify failed:', e)
    }

    return { success: true }
  } catch (e: unknown) {
    await client.query('ROLLBACK')
    // 23505 = the partial unique index caught a double-borrow race.
    if ((e as { code?: string }).code === '23505') return { error: 'Masih ada pinjaman berjalan' }
    console.error('requestLoan error:', e)
    return { error: 'Gagal mengajukan pinjaman' }
  } finally {
    await client.end()
  }
}

/**
 * Lender approves a pending request → chips disbursed lender→borrower, loan
 * goes 'active'. Re-checks the lender's balance (it may have dropped since the
 * request) and that the lender isn't already committed to another open loan.
 */
export async function approveLoan({ loanId }: { loanId: string }): Promise<Result> {
  const callerId = await getAuthenticatedPlayerId()
  if (!callerId) return { error: 'Belum login' }

  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [active] } = await client.query<{ id: string }>(
      `SELECT id FROM sessions WHERE status = 'active' LIMIT 1`
    )
    if (active) { await client.query('ROLLBACK'); return { error: 'Tidak bisa saat sesi berjalan' } }

    const { rows: [loan] } = await client.query<{
      id: string; lender_id: string; borrower_id: string; amount: number; status: string
    }>(
      `SELECT id, lender_id, borrower_id, amount, status FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    )
    if (!loan) { await client.query('ROLLBACK'); return { error: 'Pinjaman tidak ditemukan' } }
    if (loan.status !== 'pending') { await client.query('ROLLBACK'); return { error: 'Pinjaman sudah diproses' } }
    if (loan.lender_id !== callerId) { await client.query('ROLLBACK'); return { error: 'Hanya pemberi pinjaman yang bisa menyetujui' } }

    const { rows: lockedPlayers } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [[loan.lender_id, loan.borrower_id]]
    )
    const lender = lockedPlayers.find((p) => p.id === loan.lender_id)
    const borrower = lockedPlayers.find((p) => p.id === loan.borrower_id)
    if (!lender || !borrower) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

    if (lender.balance < loan.amount) {
      await client.query('ROLLBACK')
      return { error: 'Saldo kamu tidak cukup untuk meminjamkan' }
    }

    // Lender must not be tied to another open loan (the borrower side is already
    // guaranteed single by the unique index + this loan being their only open one).
    const { rows: [otherOpen] } = await client.query<{ id: string }>(
      `SELECT id FROM loans
       WHERE id <> $1 AND status IN ('pending', 'active')
         AND (lender_id = $2 OR borrower_id = $2)
       LIMIT 1`,
      [loanId, loan.lender_id]
    )
    if (otherOpen) {
      await client.query('ROLLBACK')
      return { error: 'Kamu masih punya pinjaman berjalan lain' }
    }

    // Disburse: lender → borrower.
    await client.query(`UPDATE players SET balance = balance - $1 WHERE id = $2`, [loan.amount, loan.lender_id])
    await client.query(`UPDATE players SET balance = balance + $1 WHERE id = $2`, [loan.amount, loan.borrower_id])

    await client.query(
      `INSERT INTO edit_log (player_id, actor_player_id, action, balance_before, balance_after, metadata)
       VALUES ($1, $2, 'loan_out', $3, $4, $5)`,
      [loan.lender_id, callerId, lender.balance, lender.balance - loan.amount,
       JSON.stringify({ loan_id: loan.id, to: loan.borrower_id })]
    )
    await client.query(
      `INSERT INTO edit_log (player_id, actor_player_id, action, balance_before, balance_after, metadata)
       VALUES ($1, $2, 'loan_in', $3, $4, $5)`,
      [loan.borrower_id, callerId, borrower.balance, borrower.balance + loan.amount,
       JSON.stringify({ loan_id: loan.id, from: loan.lender_id })]
    )

    await client.query(
      `UPDATE loans SET status = 'active', approved_at = now() WHERE id = $1`,
      [loanId]
    )

    await client.query('COMMIT')
    revalidateLoanPaths()

    // Notify the borrower their loan was approved & disbursed (best-effort).
    try {
      const lenderName = await playerName(loan.lender_id)
      await sendPushToPlayer(loan.borrower_id, {
        title: 'Pinjaman disetujui',
        body: `${lenderName} setuju minjemin ${loan.amount} chip`,
        url: '/',
        tag: 'loan-approved',
      })
    } catch (e) {
      console.error('approveLoan notify failed:', e)
    }

    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('approveLoan error:', e)
    return { error: 'Gagal menyetujui pinjaman' }
  } finally {
    await client.end()
  }
}

/** Lender refuses a pending request (no chips move). */
export async function declineLoan({ loanId }: { loanId: string }): Promise<Result> {
  const callerId = await getAuthenticatedPlayerId()
  if (!callerId) return { error: 'Belum login' }
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')
    const { rows: [loan] } = await client.query<{ lender_id: string; borrower_id: string; status: string }>(
      `SELECT lender_id, borrower_id, status FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    )
    if (!loan) { await client.query('ROLLBACK'); return { error: 'Pinjaman tidak ditemukan' } }
    if (loan.status !== 'pending') { await client.query('ROLLBACK'); return { error: 'Pinjaman sudah diproses' } }
    if (loan.lender_id !== callerId) { await client.query('ROLLBACK'); return { error: 'Bukan pinjaman kamu' } }
    await client.query(`UPDATE loans SET status = 'declined' WHERE id = $1`, [loanId])
    await client.query('COMMIT')
    revalidateLoanPaths()

    // Notify the borrower their request was declined (best-effort).
    try {
      await sendPushToPlayer(loan.borrower_id, {
        title: 'Permintaan pinjaman ditolak',
        body: 'Pemberi pinjaman menolak permintaanmu.',
        url: '/',
        tag: 'loan-declined',
      })
    } catch (e) {
      console.error('declineLoan notify failed:', e)
    }

    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('declineLoan error:', e)
    return { error: 'Gagal menolak pinjaman' }
  } finally {
    await client.end()
  }
}

/** Borrower withdraws their own pending request (no chips move). */
export async function cancelLoan({ loanId }: { loanId: string }): Promise<Result> {
  const callerId = await getAuthenticatedPlayerId()
  if (!callerId) return { error: 'Belum login' }
  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')
    const { rows: [loan] } = await client.query<{ borrower_id: string; status: string }>(
      `SELECT borrower_id, status FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    )
    if (!loan) { await client.query('ROLLBACK'); return { error: 'Pinjaman tidak ditemukan' } }
    if (loan.status !== 'pending') { await client.query('ROLLBACK'); return { error: 'Pinjaman sudah diproses' } }
    if (loan.borrower_id !== callerId) { await client.query('ROLLBACK'); return { error: 'Bukan pinjaman kamu' } }
    await client.query(`UPDATE loans SET status = 'cancelled' WHERE id = $1`, [loanId])
    await client.query('COMMIT')
    revalidateLoanPaths()
    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('cancelLoan error:', e)
    return { error: 'Gagal membatalkan pinjaman' }
  } finally {
    await client.end()
  }
}

/**
 * Borrower repays an active loan IN FULL (chips returned borrower→lender).
 * Borrower must hold at least the full amount (no partial, no negative balance).
 */
export async function repayLoan({ loanId }: { loanId: string }): Promise<Result> {
  const callerId = await getAuthenticatedPlayerId()
  if (!callerId) return { error: 'Belum login' }

  const client = createDbClient()
  await client.connect()
  try {
    await client.query('BEGIN')

    const { rows: [active] } = await client.query<{ id: string }>(
      `SELECT id FROM sessions WHERE status = 'active' LIMIT 1`
    )
    if (active) { await client.query('ROLLBACK'); return { error: 'Tidak bisa saat sesi berjalan' } }

    const { rows: [loan] } = await client.query<{
      id: string; lender_id: string; borrower_id: string; amount: number; status: string
    }>(
      `SELECT id, lender_id, borrower_id, amount, status FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    )
    if (!loan) { await client.query('ROLLBACK'); return { error: 'Pinjaman tidak ditemukan' } }
    if (loan.status !== 'active') { await client.query('ROLLBACK'); return { error: 'Pinjaman tidak aktif' } }
    if (loan.borrower_id !== callerId) { await client.query('ROLLBACK'); return { error: 'Hanya peminjam yang bisa melunasi' } }

    const { rows: lockedPlayers } = await client.query<{ id: string; balance: number }>(
      `SELECT id, balance FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [[loan.lender_id, loan.borrower_id]]
    )
    const lender = lockedPlayers.find((p) => p.id === loan.lender_id)
    const borrower = lockedPlayers.find((p) => p.id === loan.borrower_id)
    if (!lender || !borrower) { await client.query('ROLLBACK'); return { error: 'Pemain tidak ditemukan' } }

    if (borrower.balance < loan.amount) {
      await client.query('ROLLBACK')
      return { error: 'Saldo belum cukup untuk melunasi' }
    }

    // Return chips: borrower → lender.
    await client.query(`UPDATE players SET balance = balance - $1 WHERE id = $2`, [loan.amount, loan.borrower_id])
    await client.query(`UPDATE players SET balance = balance + $1 WHERE id = $2`, [loan.amount, loan.lender_id])

    await client.query(
      `INSERT INTO edit_log (player_id, actor_player_id, action, balance_before, balance_after, metadata)
       VALUES ($1, $2, 'loan_repay', $3, $4, $5)`,
      [loan.borrower_id, callerId, borrower.balance, borrower.balance - loan.amount,
       JSON.stringify({ loan_id: loan.id, to: loan.lender_id })]
    )
    await client.query(
      `INSERT INTO edit_log (player_id, actor_player_id, action, balance_before, balance_after, metadata)
       VALUES ($1, $2, 'loan_repay', $3, $4, $5)`,
      [loan.lender_id, callerId, lender.balance, lender.balance + loan.amount,
       JSON.stringify({ loan_id: loan.id, from: loan.borrower_id })]
    )

    await client.query(
      `UPDATE loans SET status = 'repaid', settled_at = now() WHERE id = $1`,
      [loanId]
    )

    await client.query('COMMIT')
    revalidateLoanPaths()

    // Notify the lender they've been repaid (best-effort).
    try {
      const borrowerName = await playerName(loan.borrower_id)
      await sendPushToPlayer(loan.lender_id, {
        title: 'Pinjaman dilunasi',
        body: `${borrowerName} melunasi ${loan.amount} chip`,
        url: '/',
        tag: 'loan-repaid',
      })
    } catch (e) {
      console.error('repayLoan notify failed:', e)
    }

    return { success: true }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('repayLoan error:', e)
    return { error: 'Gagal melunasi pinjaman' }
  } finally {
    await client.end()
  }
}
