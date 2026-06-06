import { test, expect } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { getTestData, setIdentity } from './helpers'

const db = () => neon(process.env.DATABASE_URL!)
const { seasonId, players } = getTestData()
const alice = players[0]

async function setPhase(phase: 'bootstrap' | 'steady') {
  await db()`UPDATE seasons SET current_phase = ${phase} WHERE id = ${seasonId}`
}

test.describe('Dashboard — progress toward next phase', () => {
  // The active season is shared; always leave it in bootstrap for other specs.
  test.afterEach(async () => { await setPhase('bootstrap') })

  test('bootstrap shows estimated sessions to Phase 2 with a progress bar', async ({ page }) => {
    await setPhase('bootstrap')
    await setIdentity(page, alice)
    await page.goto('/')

    await expect(page.getByText(/sesi lagi ke Phase 2/)).toBeVisible()
    await expect(page.getByRole('progressbar')).toBeVisible()
  })

  test('steady shows sessions remaining to the end of the season', async ({ page }) => {
    await setPhase('steady')
    await setIdentity(page, alice)
    await page.goto('/')

    await expect(page.getByText(/sesi lagi ke akhir musim/)).toBeVisible()
    await expect(page.getByRole('progressbar')).toBeVisible()
  })
})

test.describe('Dashboard — phase change alert', () => {
  test.afterEach(async () => { await setPhase('bootstrap') })

  test('no alert on first visit (nothing seen yet)', async ({ page }) => {
    await setPhase('bootstrap')
    await setIdentity(page, alice)
    await page.goto('/')

    // Wait for the dashboard to mount (progress bar present), then assert the
    // phase alert never appeared.
    await expect(page.getByRole('progressbar')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Oke, ngerti' })).toHaveCount(0)
  })

  test('shows a one-time alert when the phase differs from last seen', async ({ page }) => {
    await setPhase('bootstrap')
    await setIdentity(page, alice)

    // First visit records the current phase, no alert.
    await page.goto('/')
    await expect(page.getByRole('progressbar')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Oke, ngerti' })).toHaveCount(0)

    // Pretend the last seen phase was different → next load alerts once.
    await page.evaluate(() => localStorage.setItem('phase_seen', 'steady'))
    await page.reload()
    const ack = page.getByRole('button', { name: 'Oke, ngerti' })
    await expect(ack).toBeVisible()
    await ack.click()

    // The notice was recorded; reloading does not re-show it.
    await page.reload()
    await expect(page.getByRole('progressbar')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Oke, ngerti' })).toHaveCount(0)
  })
})
