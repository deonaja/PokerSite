import { test, expect } from '@playwright/test'
import { getTestData, setIdentity } from './helpers'
import { LATEST_VERSION, CHANGELOG } from '../lib/changelog'

test.describe('Changelog', () => {
  const { players } = getTestData()
  const alice = players[0]

  test('changelog page renders the latest version and its changes', async ({ page }) => {
    await setIdentity(page, alice)
    await page.goto('/changelog')

    await expect(page.getByText(`v${LATEST_VERSION}`)).toBeVisible()
    await expect(page.getByText(CHANGELOG[0].changes[0])).toBeVisible()
  })

  test('"Baru" badge shows when the latest version is unseen, then clears after visiting', async ({ page }) => {
    await setIdentity(page, alice)
    await page.goto('/')

    // Account actions live in a bottom sheet behind the avatar. The trigger
    // hydrates client-side, so retry opening until the link is up.
    const apaYangBaru = page.getByRole('link', { name: /Apa yang baru/ })
    await expect(async () => {
      if (!(await apaYangBaru.isVisible())) {
        await page.getByRole('button', { name: 'Akun' }).click()
      }
      await expect(apaYangBaru).toBeVisible()
    }).toPass({ timeout: 8000 })

    // Fresh context → version unseen → "Baru" badge present (exact, so it doesn't
    // match the "Apa yang baru" link text).
    await expect(page.getByText('Baru', { exact: true })).toBeVisible()

    // Visiting /changelog marks the version seen.
    await apaYangBaru.click()
    await page.waitForURL('**/changelog')

    // Back on the dashboard, reopen the sheet — the badge is gone.
    await page.goto('/')
    await expect(async () => {
      if (!(await apaYangBaru.isVisible())) {
        await page.getByRole('button', { name: 'Akun' }).click()
      }
      await expect(apaYangBaru).toBeVisible()
    }).toPass({ timeout: 8000 })
    await expect(page.getByText('Baru', { exact: true })).toHaveCount(0)
  })
})
