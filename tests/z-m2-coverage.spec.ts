import { test, expect } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { hashPin } from '../lib/auth'
import { getTestData, setIdentity, clickLabelFor, resetTestPlayers } from './helpers'

const db = () => neon(process.env.DATABASE_URL!)

async function forceEndAllSessions() {
  await db()`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
}

async function setSeasonBase(
  seasonId: string,
  {
    phase = 'bootstrap',
    buyIn = 100,
    maxPool = 100_000_000,
    rakeRate = 10,
  }: {
    phase?: 'bootstrap' | 'steady'
    buyIn?: number
    maxPool?: number
    rakeRate?: number
  } = {}
) {
  await db()`
    UPDATE seasons
    SET current_phase = ${phase},
        buy_in = ${buyIn},
        max_pool = ${maxPool},
        rake_rate = ${rakeRate}
    WHERE id = ${seasonId}
  `
}

async function startSessionFromSetup({
  page,
  actor,
  selectedNames,
  dealerId,
}: {
  page: import('@playwright/test').Page
  actor: { id: string; name: string }
  selectedNames: string[]
  dealerId: string
}) {
  await setIdentity(page, actor)
  await page.goto('/session/setup')
  for (const name of selectedNames) {
    await clickLabelFor(page, name)
  }
  await page.locator(`input[name="dealer"][value="${dealerId}"]`).check()
  await page.getByRole('button', { name: 'Mulai' }).click()
  await page.waitForURL('**/session')
}

async function getActiveSessionId() {
  const [row] = await db()`SELECT id FROM sessions WHERE status = 'active' LIMIT 1` as { id: string }[]
  return row?.id ?? null
}

test.describe('M2 coverage: change PIN validations', () => {
  const { players } = getTestData()
  const alice = players[0]

  test.beforeEach(async () => {
    const defaultHash = await hashPin('1234')
    await db()`UPDATE players SET pin_hash = ${defaultHash} WHERE id = ${alice.id}`
  })

  test('rejects new PIN that is not 4-6 numeric digits', async ({ page }) => {
    await setIdentity(page, alice)
    await page.goto('/settings/pin')

    const inputs = page.locator('input[type="password"]')
    await inputs.nth(0).fill('1234')
    await inputs.nth(1).fill('12ab')
    await inputs.nth(2).fill('12ab')
    await page.getByRole('button', { name: 'Simpan PIN' }).click()

    await expect(page.getByText('PIN baru harus 4-6 digit angka')).toBeVisible()
  })

  test('rejects when new PIN confirmation does not match', async ({ page }) => {
    await setIdentity(page, alice)
    await page.goto('/settings/pin')

    const inputs = page.locator('input[type="password"]')
    await inputs.nth(0).fill('1234')
    await inputs.nth(1).fill('5555')
    await inputs.nth(2).fill('5556')
    await page.getByRole('button', { name: 'Simpan PIN' }).click()

    await expect(page.getByText('Konfirmasi PIN tidak sama')).toBeVisible()
  })
})

test.describe('M2 coverage: dealer/cooldown matrix', () => {
  const { players, seasonId } = getTestData()
  const alice = players[0]
  const bob = players[1]
  const charlie = players[2]

  test.beforeEach(async () => {
    await forceEndAllSessions()
    await resetTestPlayers(500)
    await setSeasonBase(seasonId, { phase: 'bootstrap', buyIn: 100, maxPool: 100_000_000 })
  })

  test.afterEach(async () => {
    await forceEndAllSessions()
    await resetTestPlayers(500)
    await setSeasonBase(seasonId, { phase: 'bootstrap', buyIn: 100, maxPool: 100_000_000, rakeRate: 10 })
  })

  test('Phase 1 + no cooldown + dealer can afford: plays free (no buy-in) + gets salary chips + cooldown anchor set', async ({ page }) => {
    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, bob.name],
      dealerId: alice.id,
    })

    const sessionId = await getActiveSessionId()
    expect(sessionId).toBeTruthy()

    const [aliceBalance] = await db()`SELECT balance, last_dealer_session_id FROM players WHERE id = ${alice.id}` as {
      balance: number
      last_dealer_session_id: string | null
    }[]
    // Free-entry dealer pays no buy-in → balance stays at the 500 starting value.
    expect(Number(aliceBalance.balance)).toBe(500)
    expect(aliceBalance.last_dealer_session_id).toBe(sessionId)

    const [participant] = await db()`
      SELECT no_gaji_dealer
      FROM session_participants
      WHERE session_id = ${sessionId} AND player_id = ${alice.id}
    ` as { no_gaji_dealer: boolean }[]
    expect(participant.no_gaji_dealer).toBe(false)

    const logs = await db()`
      SELECT action
      FROM edit_log
      WHERE session_id = ${sessionId} AND player_id = ${alice.id}
    ` as { action: string }[]
    const actions = new Set(logs.map((l) => l.action))
    expect(actions.has('buy_in_dealer_free')).toBe(true)
    expect(actions.has('dealer_salary_chips')).toBe(true)
  })

  test('Phase 1 + cooldown + dealer can afford: pays buy-in, no salary, cooldown anchor unchanged', async ({ page }) => {
    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, bob.name],
      dealerId: alice.id,
    })

    const session1Id = await getActiveSessionId()
    expect(session1Id).toBeTruthy()
    await forceEndAllSessions()
    await db()`
      UPDATE players
      SET balance = CASE
        WHEN id = ${alice.id} THEN 500
        WHEN id = ${charlie.id} THEN 500
        ELSE balance
      END
      WHERE id IN (${alice.id}, ${charlie.id})
    `

    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, charlie.name],
      dealerId: alice.id,
    })

    const session2Id = await getActiveSessionId()
    expect(session2Id).toBeTruthy()
    expect(session2Id).not.toBe(session1Id)

    const [aliceRow] = await db()`SELECT balance, last_dealer_session_id FROM players WHERE id = ${alice.id}` as {
      balance: number
      last_dealer_session_id: string | null
    }[]
    expect(Number(aliceRow.balance)).toBe(400)
    expect(aliceRow.last_dealer_session_id).toBe(session1Id)

    const [salaryLog] = await db()`
      SELECT COUNT(*)::int AS cnt
      FROM edit_log
      WHERE session_id = ${session2Id}
        AND player_id = ${alice.id}
        AND action = 'dealer_salary_chips'
    ` as { cnt: number }[]
    expect(Number(salaryLog.cnt)).toBe(0)
  })

  test('Phase 1 + cooldown + broke dealer: deals only (no_gaji), no salary, anchor unchanged', async ({ page }) => {
    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, bob.name],
      dealerId: alice.id,
    })
    const session1Id = await getActiveSessionId()
    expect(session1Id).toBeTruthy()
    await forceEndAllSessions()

    await db()`
      UPDATE players
      SET balance = CASE
        WHEN id = ${alice.id} THEN 0
        WHEN id = ${charlie.id} THEN 500
        ELSE balance
      END
      WHERE id IN (${alice.id}, ${charlie.id})
    `

    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, charlie.name],
      dealerId: alice.id,
    })

    const session2Id = await getActiveSessionId()
    expect(session2Id).toBeTruthy()

    const [aliceRow] = await db()`SELECT balance, last_dealer_session_id FROM players WHERE id = ${alice.id}` as {
      balance: number
      last_dealer_session_id: string | null
    }[]
    expect(Number(aliceRow.balance)).toBe(0)
    expect(aliceRow.last_dealer_session_id).toBe(session1Id)

    const [participant] = await db()`
      SELECT no_gaji_dealer
      FROM session_participants
      WHERE session_id = ${session2Id} AND player_id = ${alice.id}
    ` as { no_gaji_dealer: boolean }[]
    expect(participant.no_gaji_dealer).toBe(true)

    const [buyInAction] = await db()`
      SELECT action
      FROM edit_log
      WHERE session_id = ${session2Id} AND player_id = ${alice.id}
      ORDER BY created_at ASC
      LIMIT 1
    ` as { action: string }[]
    expect(buyInAction.action).toBe('buy_in_no_gaji_dealer')
  })

  test('low-balance non-dealer is rejected server-side', async ({ page }) => {
    await setIdentity(page, alice)
    await page.goto('/session/setup')
    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    await page.locator(`input[name="dealer"][value="${alice.id}"]`).check()
    await expect(page.getByRole('button', { name: 'Mulai' })).toBeEnabled()

    // Setup page is not polled: make Bob broke after the form is valid so
    // only the server-side validation can catch it.
    await db()`UPDATE players SET balance = 50 WHERE id = ${bob.id}`
    await page.getByRole('button', { name: 'Mulai' }).click()

    await expect(page.getByText('Pemain balance kurang harus jadi dealer atau jangan dipilih')).toBeVisible()
    await expect(page).toHaveURL(/\/session\/setup/)
    const [activeCount] = await db()`SELECT COUNT(*)::int AS cnt FROM sessions WHERE status = 'active'` as { cnt: number }[]
    expect(Number(activeCount.cnt)).toBe(0)
  })

  test('dealer recommendation prefers lowest-balance non-cooldown player', async ({ page }) => {
    await db()`
      UPDATE players
      SET balance = CASE
        WHEN id = ${alice.id} THEN 500
        WHEN id = ${bob.id} THEN 50
        WHEN id = ${charlie.id} THEN 100
        ELSE balance
      END
      WHERE id IN (${alice.id}, ${bob.id}, ${charlie.id})
    `

    // Make Bob the most recent paid dealer so he's in cooldown.
    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, bob.name],
      dealerId: bob.id,
    })
    await forceEndAllSessions()

    await page.goto('/session/setup')
    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    await clickLabelFor(page, charlie.name)

    await expect(page.locator('label', { hasText: bob.name }).getByText(/cooldown/)).toBeVisible()
    const charlieRadio = page.locator(`input[name="dealer"][value="${charlie.id}"]`)
    await expect(charlieRadio).toBeChecked()
  })
})

test.describe('M2 coverage: session-active + end-session details', () => {
  const { players, seasonId } = getTestData()
  const alice = players[0]
  const bob = players[1]

  test.beforeEach(async () => {
    await forceEndAllSessions()
    await resetTestPlayers(500)
    await setSeasonBase(seasonId, { phase: 'bootstrap', buyIn: 100, maxPool: 100_000_000, rakeRate: 10 })
  })

  test.afterEach(async () => {
    await forceEndAllSessions()
    await resetTestPlayers(500)
    await setSeasonBase(seasonId, { phase: 'bootstrap', buyIn: 100, maxPool: 100_000_000, rakeRate: 10 })
  })

  test('rebuy server hard-rejects insufficient balance even if sheet is already open', async ({ page }) => {
    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, bob.name],
      dealerId: alice.id,
    })
    const sessionId = await getActiveSessionId()
    expect(sessionId).toBeTruthy()

    await page.goto('/session')
    const bobCard = page.locator('div').filter({
      has: page.locator('p, span', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()

    await bobCard.getByRole('button', { name: 'Rebuy' }).click()
    await expect(page.getByText(`Rebuy ${bob.name}?`)).toBeVisible()

    await db()`UPDATE players SET balance = 0 WHERE id = ${bob.id}`
    await page.getByRole('button', { name: 'Rebuy' }).last().click()

    await expect(page.getByText('Saldo tidak cukup untuk rebuy')).toBeVisible()

    const [row] = await db()`
      SELECT p.balance, sp.rebuy_count
      FROM players p
      JOIN session_participants sp ON sp.player_id = p.id
      WHERE p.id = ${bob.id} AND sp.session_id = ${sessionId}
    ` as { balance: number; rebuy_count: number }[]
    expect(Number(row.balance)).toBe(0)
    expect(Number(row.rebuy_count)).toBe(0)
  })

  test('Phase 2 low-balance dealer shows BAGI KARTU badge without rebuy controls', async ({ page }) => {
    await setSeasonBase(seasonId, { phase: 'steady', buyIn: 100, maxPool: 100 })
    await db()`UPDATE players SET balance = 0 WHERE id = ${bob.id}`

    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, bob.name],
      dealerId: bob.id,
    })

    await expect(page.getByText('BAGI KARTU', { exact: true })).toBeVisible()
    await expect(page.getByText(/Bagi kartu/)).toBeVisible()
    // Only Alice should have controls. Bob (deals-only) has none.
    await expect(page.getByRole('button', { name: 'Rebuy' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(1)
  })

  test('recap uses original pre-session balance, edit returns to recap, and localStorage clears after confirm', async ({ page }) => {
    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, bob.name],
      dealerId: alice.id,
    })
    const sessionId = await getActiveSessionId()
    expect(sessionId).toBeTruthy()

    await page.goto('/session')
    const bobCard = page.locator('div').filter({
      has: page.locator('p, span', { hasText: /^Rebuy: \d+$/ }),
    }).filter({ hasText: bob.name }).last()
    await bobCard.getByRole('button', { name: 'Rebuy' }).click()
    await page.getByRole('button', { name: 'Rebuy' }).last().click()
    await expect(bobCard.getByText('Rebuy: 1')).toBeVisible({ timeout: 5000 })

    await page.goto('/session/end')
    await page.locator('input[type="number"]').fill('250')
    await page.getByRole('button', { name: 'Next →' }).click()
    await page.locator('input[type="number"]').fill('150')
    await page.getByRole('button', { name: /Lihat recap/ }).click()

    await expect(page.getByText('RECAP')).toBeVisible()
    // Alice is the Phase 1 free-entry dealer: balance not deducted (stays 500),
    // plays on 100 salary chips, ends with 250 → 500 + 250 = 750 (+250).
    await expect(page.getByText(/500\s*→\s*750\s*\(\+250\)/)).toBeVisible()
    // Bob paid buy-in 100 + 1 rebuy 100 (balance 300), stack 150 → 450 (-50).
    await expect(page.getByText(/500\s*→\s*450\s*\(-50\)/)).toBeVisible()

    await page.getByRole('button', { name: 'Edit' }).nth(1).click()
    await expect(page.getByRole('button', { name: 'Simpan' })).toBeVisible()
    await page.locator('input[type="number"]').fill('140')
    await page.getByRole('button', { name: 'Simpan' }).click()

    await expect(page.getByText('RECAP')).toBeVisible()
    // expected total = 100 (Alice salary chips) + 200 (Bob buy-in+rebuy) = 300.
    // input = 250 (Alice) + 140 (Bob edited) = 390 → Selisih +90.
    await expect(page.getByText(/Selisih \+90/)).toBeVisible()

    await page.getByRole('button', { name: 'Confirm' }).click()
    await page.waitForURL('/')

    const localStorageValue = await page.evaluate((key) => window.localStorage.getItem(key), `endSession:${sessionId}`)
    expect(localStorageValue).toBeNull()
  })
})

test.describe('M2 coverage: rake calculator and Approach C', () => {
  const { players, seasonId } = getTestData()
  const alice = players[0]
  const bob = players[1]

  test.beforeEach(async () => {
    await forceEndAllSessions()
    await resetTestPlayers(500)
    await setSeasonBase(seasonId, { phase: 'steady', buyIn: 95, maxPool: 100, rakeRate: 10 })
  })

  test.afterEach(async () => {
    await forceEndAllSessions()
    await resetTestPlayers(500)
    await setSeasonBase(seasonId, { phase: 'bootstrap', buyIn: 100, maxPool: 100_000_000, rakeRate: 10 })
  })

  test('shows rake calculator (rounded to nearest 5) and does not auto-credit dealer rake', async ({ page }) => {
    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, bob.name],
      dealerId: alice.id,
    })

    await page.goto('/session/end')
    await expect(page.getByText('KALKULATOR RAKE')).toBeVisible()
    await expect(page.getByText('190')).toBeVisible()
    await expect(page.getByText('10%')).toBeVisible()
    await expect(page.getByText('20 chip')).toBeVisible()

    await page.locator('input[type="number"]').fill('95')
    await page.getByRole('button', { name: 'Next →' }).click()
    await page.locator('input[type="number"]').fill('95')
    await page.getByRole('button', { name: /Lihat recap/ }).click()
    await page.getByRole('button', { name: 'Confirm' }).click()
    await page.waitForURL('/')

    const [aliceRow] = await db()`SELECT balance FROM players WHERE id = ${alice.id}` as { balance: number }[]
    const [bobRow] = await db()`SELECT balance FROM players WHERE id = ${bob.id}` as { balance: number }[]
    expect(Number(aliceRow.balance)).toBe(500)
    expect(Number(bobRow.balance)).toBe(500)
  })

  test('hides rake calculator in bootstrap phase', async ({ page }) => {
    await setSeasonBase(seasonId, { phase: 'bootstrap', buyIn: 95, maxPool: 100_000_000, rakeRate: 10 })

    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, bob.name],
      dealerId: alice.id,
    })

    await page.goto('/session/end')
    await expect(page.getByText('KALKULATOR RAKE')).not.toBeVisible()
  })

  test('shows rake calculator only on dealer step in steady phase', async ({ page }) => {
    await setSeasonBase(seasonId, { phase: 'steady', buyIn: 95, maxPool: 100, rakeRate: 10 })

    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, bob.name],
      dealerId: alice.id,
    })

    await page.goto('/session/end')
    await expect(page.getByText('KALKULATOR RAKE')).toBeVisible()

    await page.locator('input[type="number"]').fill('95')
    await page.getByRole('button', { name: /^Next/ }).click()
    await expect(page.getByText('KALKULATOR RAKE')).not.toBeVisible()
  })

  test('rounds estimated rake to nearest 5 (down case)', async ({ page }) => {
    // total_chip = 170, rake 10% = 17 -> nearest 5 = 15
    await setSeasonBase(seasonId, { phase: 'steady', buyIn: 85, maxPool: 100, rakeRate: 10 })

    await startSessionFromSetup({
      page,
      actor: alice,
      selectedNames: [alice.name, bob.name],
      dealerId: alice.id,
    })

    await page.goto('/session/end')
    await expect(page.getByText('KALKULATOR RAKE')).toBeVisible()
    await expect(page.getByText('170')).toBeVisible()
    await expect(page.getByText('15 chip')).toBeVisible()
  })
})

test.describe('M2 coverage: season setup custom values + default PIN for new players', () => {
  const { seasonId, runId } = getTestData()
  const playerA = `[T${runId}] M2C0`

  test.beforeAll(async () => {
    await forceEndAllSessions()
    await db()`UPDATE seasons SET status = 'ended', ended_at = now() WHERE id = ${seasonId}`
  })

  test.afterAll(async () => {
    await forceEndAllSessions()

    const straySeasons = await db()`
      SELECT id
      FROM seasons
      WHERE status = 'active' AND id != ${seasonId}
    ` as { id: string }[]
    for (const season of straySeasons) {
      await db()`DELETE FROM edit_log WHERE action = 'season_start' AND metadata->>'season_id' = ${season.id}`
      await db()`DELETE FROM seasons WHERE id = ${season.id}`
    }

    await db()`
      UPDATE seasons
      SET status = 'active',
          ended_at = NULL,
          current_phase = 'bootstrap',
          buy_in = 100,
          max_pool = 100000000,
          rake_rate = 10
      WHERE id = ${seasonId}
    `
    await resetTestPlayers(500)
  })

  test('creates custom season, saves computed buy-in/BB/SB, and new players can login with PIN 1234', async ({ page }) => {
    await page.goto('/season/new')
    await expect(page.getByText('Siapa yang main?')).toBeVisible()

    const names = [playerA, `[T${runId}] M2C1`, `[T${runId}] M2C2`]
    const inputs = page.getByPlaceholder(/Nama kamu|Pemain/)
    const inputCount = await inputs.count()
    for (let i = 0; i < inputCount; i++) {
      await inputs.nth(i).fill(names[i] ?? `[T${runId}] M2C${i}`)
    }
    await page.getByRole('button', { name: /Lanjut/ }).click()

    await expect(page.getByText('Modal & blind')).toBeVisible()
    await page.getByPlaceholder('cth. 200').fill('350')
    await page.getByRole('button', { name: /Lanjut/ }).click()

    await expect(page.getByText('Durasi season')).toBeVisible()
    await page.getByRole('button', { name: 'Custom' }).click()
    await page.getByPlaceholder('cth. 3500').fill('4444')
    await page.getByPlaceholder('cth. 40').fill('12')
    await page.getByPlaceholder('cth. 10').fill('13')
    await page.getByRole('button', { name: /Lanjut/ }).click()

    await expect(page.getByRole('button', { name: 'Mulai Season' })).toBeVisible()
    await page.getByRole('button', { name: 'Mulai Season' }).click()
    await page.waitForURL('**/identity')

    const [season] = await db()`
      SELECT starting_balance, buy_in, bb, sb, max_pool, max_sessions, rake_rate, preset_name
      FROM seasons
      WHERE status = 'active'
      ORDER BY started_at DESC
      LIMIT 1
    ` as {
      starting_balance: number
      buy_in: number
      bb: number
      sb: number
      max_pool: number
      max_sessions: number
      rake_rate: number
      preset_name: string | null
    }[]
    expect(Number(season.starting_balance)).toBe(350)
    expect(Number(season.buy_in)).toBe(175)
    expect(Number(season.bb)).toBe(18)
    expect(Number(season.sb)).toBe(9)
    expect(Number(season.max_pool)).toBe(4444)
    expect(Number(season.max_sessions)).toBe(12)
    expect(Number(season.rake_rate)).toBe(13)
    expect(season.preset_name).toBe('custom')

    await page.getByRole('button', { name: playerA }).click()
    await page.getByPlaceholder('PIN (4-6 digit)').fill('1234')
    await page.getByRole('button', { name: 'Masuk' }).click()
    await page.waitForURL('/')
  })
})
