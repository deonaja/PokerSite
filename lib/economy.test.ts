// Unit tests for the pure dealer/buy-in matrix. Run with `pnpm test:unit`
// (node:test + tsx — no new dependency, no DB). These guard the money-sensitive
// rules in lib/economy.ts that startSession relies on.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveParticipantTreatment, type ParticipantTreatment } from './economy'

const BUY_IN = 100

// Helper: derive with sensible defaults, override per case.
function derive(over: Partial<Parameters<typeof deriveParticipantTreatment>[0]>): ParticipantTreatment {
  return deriveParticipantTreatment({
    isDealer: false,
    dealerPlays: true,
    dealerFreeEntry: false,
    balance: 500,
    buyIn: BUY_IN,
    ...over,
  })
}

test('non-dealer who can afford pays the full buy-in', () => {
  assert.deepEqual(derive({ isDealer: false, balance: 500 }), {
    deduction: 100,
    action: 'buy_in',
    noGaji: false,
    salaryChips: false,
    salaryBankroll: false,
  })
})

test('non-dealer deduction is capped at balance (never negative)', () => {
  assert.equal(derive({ isDealer: false, balance: 40 }).deduction, 40)
  assert.equal(derive({ isDealer: false, balance: 0 }).deduction, 0)
})

test('Phase 1 playing free dealer: 0 ante + flat 1× salary (table chips only, no bankroll)', () => {
  // Post-flip 2026-06-29: playing dealer no longer gets the bankroll half.
  assert.deepEqual(derive({ isDealer: true, dealerPlays: true, dealerFreeEntry: true }), {
    deduction: 0,
    action: 'buy_in_dealer_free',
    noGaji: false,
    salaryChips: true,
    salaryBankroll: false,
  })
})

test('Phase 1 playing free dealer stays free even when broke', () => {
  const t = derive({ isDealer: true, dealerPlays: true, dealerFreeEntry: true, balance: 0 })
  assert.equal(t.deduction, 0)
  assert.equal(t.salaryChips, true)
  assert.equal(t.salaryBankroll, false)
})

test('Phase 2 / cooldown playing dealer who can afford pays the buy-in', () => {
  assert.deepEqual(derive({ isDealer: true, dealerPlays: true, dealerFreeEntry: false, balance: 500 }), {
    deduction: 100,
    action: 'buy_in_dealer_phase2',
    noGaji: false,
    salaryChips: false,
    salaryBankroll: false,
  })
})

test('Phase 2 / cooldown playing dealer who is broke deals only (no ante, no salary)', () => {
  assert.deepEqual(derive({ isDealer: true, dealerPlays: true, dealerFreeEntry: false, balance: 50 }), {
    deduction: 0,
    action: 'buy_in_no_gaji_dealer',
    noGaji: true,
    salaryChips: false,
    salaryBankroll: false,
  })
})

test('Phase 1 neutral dealer: 2× buy_in credited directly to bankroll, no play', () => {
  assert.deepEqual(derive({ isDealer: true, dealerPlays: false, dealerFreeEntry: true }), {
    deduction: 0,
    action: 'buy_in_dealer_free',
    noGaji: true,
    salaryChips: false,
    salaryBankroll: true,
  })
})

test('Phase 2 neutral dealer: deals only, no salary (collects rake in play)', () => {
  assert.deepEqual(derive({ isDealer: true, dealerPlays: false, dealerFreeEntry: false }), {
    deduction: 0,
    action: 'buy_in_no_gaji_dealer',
    noGaji: true,
    salaryChips: false,
    salaryBankroll: false,
  })
})

test('neutral dealer always sits out (noGaji) and never pays ante; playing dealer never gets bankroll bonus', () => {
  // Post-flip 2026-06-29: the bankroll bonus belongs to the NEUTRAL free dealer.
  // PLAYING dealers never get it (regardless of free entry / balance).
  for (const dealerFreeEntry of [true, false]) {
    for (const balance of [0, 50, 500]) {
      const neutral = derive({ isDealer: true, dealerPlays: false, dealerFreeEntry, balance })
      assert.equal(neutral.noGaji, true, `neutral noGaji (free=${dealerFreeEntry}, bal=${balance})`)
      assert.equal(neutral.deduction, 0, `neutral never pays ante (free=${dealerFreeEntry}, bal=${balance})`)

      const playing = derive({ isDealer: true, dealerPlays: true, dealerFreeEntry, balance })
      assert.equal(playing.salaryBankroll, false, `playing no bankroll (free=${dealerFreeEntry}, bal=${balance})`)
    }
  }
})

test('invariant: playing dealers never get bankroll salary', () => {
  const combos = [true, false]
  for (const dealerFreeEntry of combos) {
    for (const balance of [0, 50, 100, 500]) {
      const t = derive({ isDealer: true, dealerPlays: true, dealerFreeEntry, balance })
      assert.equal(t.salaryBankroll, false, 'playing dealer gets no bankroll salary')
    }
  }
})
