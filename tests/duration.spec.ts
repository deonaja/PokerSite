import { test, expect } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { hashPin } from '../lib/auth'
import { getTestData, setIdentity, clickLabelFor, resetTestPlayers } from './helpers'

const db = () => neon(process.env.DATABASE_URL!)

test.describe('Session duration', () => {
  const { players, seasonId, runId } = getTestData()
  const alice = players[0]
  const bob = players[1]

  test.beforeEach(async () => {
    await db()`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
    await resetTestPlayers()
  })
  test.afterEach(async () => {
    await db()`UPDATE sessions SET status = 'ended', ended_at = now() WHERE status = 'active'`
  })

  async function startSession(page: import('@playwright/test').Page) {
    await setIdentity(page, alice)
    await page.goto('/session/setup')
    await clickLabelFor(page, alice.name)
    await clickLabelFor(page, bob.name)
    await page.locator(`input[name="dealer"][value="${alice.id}"]`).check()
    await page.getByRole('button', { name: 'Mulai' }).click()
    await page.waitForURL('**/session')
  }

  test('active session shows a running duration timer', async ({ page }) => {
    await startSession(page)
    await expect(page.getByLabel('Durasi sesi')).toBeVisible()
  })

  test('end-session recap shows the session duration', async ({ page }) => {
    await startSession(page)
    await page.getByRole('link', { name: 'End' }).click()
    await page.waitForURL('**/session/end')

    const totalSteps = await page.getByText(/\d+ \/ \d+/).innerText()
    const count = parseInt(totalSteps.split('/')[1].trim(), 10)
    for (let i = 0; i < count; i++) {
      await page.locator('input[type="number"]').fill('200')
      const isLast = i === count - 1
      await page.getByRole('button', { name: isLast ? 'Lihat recap' : 'Next →' }).click()
    }

    await expect(page.getByText('RECAP')).toBeVisible()
    await expect(page.getByText(/Durasi/)).toBeVisible()
  })

  test('player stats show total + average play time from ended sessions', async ({ page }) => {
    // Dedicated player with exactly one 90-minute ended session, so the totals
    // are deterministic regardless of other specs mutating the shared DB.
    const pinHash = await hashPin('1234')
    const [statPlayer] = (await db()`
      INSERT INTO players (name, balance, pin_hash)
      VALUES (${`[T${runId}] DurStat`}, 200, ${pinHash})
      RETURNING id
    `) as { id: string }[]
    const [sess] = (await db()`
      INSERT INTO sessions (dealer_id, status, season_id, started_at, ended_at)
      VALUES (${statPlayer.id}, 'ended', ${seasonId}, now() - interval '90 minutes', now())
      RETURNING id
    `) as { id: string }[]
    await db()`
      INSERT INTO session_participants (session_id, player_id, is_dealer, no_gaji_dealer)
      VALUES (${sess.id}, ${statPlayer.id}, true, false)
    `

    try {
      await setIdentity(page, alice)
      await page.goto(`/player/${statPlayer.id}`)

      await expect(page.getByText('Total waktu main')).toBeVisible()
      await expect(page.getByText('Rata-rata/sesi')).toBeVisible()
      // 90 min → "1j 30m" for both total and average (one session).
      await expect(page.getByText('1j 30m').first()).toBeVisible()
    } finally {
      await db()`DELETE FROM session_participants WHERE session_id = ${sess.id}`
      await db()`DELETE FROM sessions WHERE id = ${sess.id}`
      await db()`DELETE FROM players WHERE id = ${statPlayer.id}`
    }
  })
})
