// Pure economy helpers — no DB, no I/O — so the money-sensitive rules can be
// unit-tested deterministically (see lib/economy.test.ts). Keep these in sync
// with the SQL paths that consume them; the logic here is the single source of
// truth for the dealer/buy-in matrix used by startSession.
//
// Matrix flipped 2026-06-29 (owner): the NEUTRAL dealer (deals only) now gets
// the 2× split (1× chips on the table + 1× bankroll bonus) because they're
// actively working (dealing) without playing. The PLAYING dealer gets just
// the 1× table chip — they already get the upside of playing + winning, so
// 1× is enough. WAS: playing 2× / neutral 1×.

export type ParticipantAction =
  | 'buy_in' // normal player (or playing dealer who pays) — ante deducted
  | 'buy_in_dealer_free' // free-entry dealer salary (Phase 1, not cooled down)
  | 'buy_in_no_gaji_dealer' // deals only — no ante, no salary
  | 'buy_in_dealer_phase2' // playing dealer who pays the ante (Phase 2 / cooldown)

export interface ParticipantTreatment {
  /** Chips deducted from the player's balance at session start. */
  deduction: number
  /** edit_log action recorded for this seat. */
  action: ParticipantAction
  /** True = deals only, shown as "BAGI KARTU" with no rebuy controls. */
  noGaji: boolean
  /** Dealer receives 1× buy_in salary as chips on the table. */
  salaryChips: boolean
  /** Free neutral dealer additionally gets 1× buy_in credited to bankroll
   *  (the 2× split, post-flip 2026-06-29). Playing dealers never get this. */
  salaryBankroll: boolean
}

/**
 * Derive how a seat is treated at session start. Mirrors the dealer/buy-in
 * matrix in lib/actions/session.ts (startSession). Pure: same inputs → same
 * output, regardless of DB state.
 *
 * `dealerFreeEntry` is precomputed by the caller as `Phase 1 && !cooldown`.
 */
export function deriveParticipantTreatment(opts: {
  isDealer: boolean
  dealerPlays: boolean
  dealerFreeEntry: boolean
  balance: number
  buyIn: number
}): ParticipantTreatment {
  const { isDealer, dealerPlays, dealerFreeEntry, balance, buyIn } = opts

  // Non-dealer: pays the buy-in (capped at balance so it can't go negative;
  // in practice broke non-dealers are rejected before this, leaving min = buyIn).
  if (!isDealer) {
    return {
      deduction: Math.min(balance, buyIn),
      action: 'buy_in',
      noGaji: false,
      salaryChips: false,
      salaryBankroll: false,
    }
  }

  // NEUTRAL dealer: deals only, never sits in — always flagged no_gaji.
  if (!dealerPlays) {
    if (dealerFreeEntry) {
      // Phase 1 neutral → 2× buy_in credited straight to bankroll (0 table chips since they don't play).
      // Post-flip 2026-06-29: neutral "works" (deals) for no play upside, so
      // gets the bigger payout.
      return { deduction: 0, action: 'buy_in_dealer_free', noGaji: true, salaryChips: false, salaryBankroll: true }
    }
    // Phase 2 (or cooldown) neutral → no salary, 0 chips; collects rake in play.
    return { deduction: 0, action: 'buy_in_no_gaji_dealer', noGaji: true, salaryChips: false, salaryBankroll: false }
  }

  // PLAYING dealer.
  if (dealerFreeEntry) {
    // Phase 1, not cooled down → free entry + flat 1× table chips (no bankroll
    // bonus). Post-flip 2026-06-29: playing dealer already gets the upside of
    // playing + winning, so the salary is just the table half.
    return { deduction: 0, action: 'buy_in_dealer_free', noGaji: false, salaryChips: true, salaryBankroll: false }
  }
  if (balance < buyIn) {
    // Phase 2 / cooldown + can't afford → deals only (no ante, no salary).
    return { deduction: 0, action: 'buy_in_no_gaji_dealer', noGaji: true, salaryChips: false, salaryBankroll: false }
  }
  // Phase 2 / cooldown, can afford → pays the buy-in and plays.
  return { deduction: buyIn, action: 'buy_in_dealer_phase2', noGaji: false, salaryChips: false, salaryBankroll: false }
}
