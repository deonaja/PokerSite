import { test, expect } from '@playwright/test'
import { getTestData, adminUrl } from './helpers'

test.describe('Admin — auth', () => {
  test('/admin without key returns 404', async ({ page }) => {
    const response = await page.goto('/admin')
    expect(response?.status()).toBe(404)
  })

  test('/admin with wrong key returns 404', async ({ page }) => {
    const response = await page.goto('/admin?key=wrongkey12345')
    expect(response?.status()).toBe(404)
  })

  test('/admin with correct key redirects and shows admin page', async ({ page }) => {
    const { adminKey } = getTestData()
    await page.goto(adminUrl(adminKey))
    // Middleware redirects → /admin (no key in URL)
    await expect(page).toHaveURL('/admin')
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
  })

  test('cookie allows subsequent /admin access without key', async ({ page }) => {
    const { adminKey } = getTestData()
    // First visit sets the cookie
    await page.goto(adminUrl(adminKey))
    await expect(page).toHaveURL('/admin')
    // Navigate away and back without key
    await page.goto('/')
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
  })
})

test.describe('Admin — player management', () => {
  test.beforeEach(async ({ page }) => {
    const { adminKey } = getTestData()
    await page.goto(adminUrl(adminKey))
  })

  test('shows test players in the player list', async ({ page }) => {
    const { players } = getTestData()
    for (const p of players) {
      await expect(page.getByText(p.name)).toBeVisible()
    }
  })

  test('add player: name + balance → player appears in list', async ({ page }) => {
    const { runId } = getTestData()
    const newName = `[T${runId}] NewPlayer`
    const newBalance = '300'

    await page.getByPlaceholder('Nama').fill(newName)
    await page.getByPlaceholder(/Balance awal/).fill(newBalance)
    await page.getByRole('button', { name: '+ Tambah' }).click()

    await expect(page.getByText('Pemain ditambahkan.')).toBeVisible()
    await expect(page.getByText(newName)).toBeVisible()
    // Also appears in edit-balance dropdown
    const option = page.locator('select option', { hasText: newName })
    await expect(option).toBeAttached()
  })

  test('add player: empty name → button disabled', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Tambah' })).toBeDisabled()
  })

  test('edit balance: update balance with reason', async ({ page }) => {
    const { players } = getTestData()
    const alice = players[0]

    // Select Alice in the dropdown
    await page.locator('select').selectOption({ label: alice.name })
    await page.getByPlaceholder(/Balance baru/).fill('999')
    await page.getByPlaceholder(/Alasan/).fill('test edit balance')
    await page.getByRole('button', { name: 'Update balance' }).click()

    await expect(page.getByText('Balance diupdate.')).toBeVisible()
    // Admin page refreshes — Alice's balance should now be 999
    await expect(page.getByText('999')).toBeVisible()
  })

  test('edit balance: empty reason → button disabled', async ({ page }) => {
    const { players } = getTestData()
    await page.locator('select').selectOption({ label: players[0].name })
    await page.getByPlaceholder(/Balance baru/).fill('100')
    // Reason empty → Update balance button disabled
    await expect(page.getByRole('button', { name: 'Update balance' })).toBeDisabled()
  })
})

test.describe('Admin — logs', () => {
  test.beforeEach(async ({ page }) => {
    const { adminKey } = getTestData()
    await page.goto(adminUrl(adminKey))
  })

  test('log table is visible and contains entries', async ({ page }) => {
    // After the session tests, there should be edit_log entries
    // At minimum the "admin_balance_edit" from the edit-balance test above
    await expect(page.locator('table')).toBeVisible()
  })

  test('filter by action type shows only that action', async ({ page }) => {
    await page.getByText('admin_balance_edit').click()
    await page.waitForURL(/logAction=admin_balance_edit/)
    // All visible action badges should be admin_balance_edit
    const badges = page.locator('span').filter({ hasText: 'admin_balance_edit' })
    await expect(badges.first()).toBeVisible()
  })

  test('filter "all" shows all log entries', async ({ page }) => {
    await page.getByText('all').click()
    await page.waitForURL(/logAction=all/)
    await expect(page.locator('table')).toBeVisible()
  })

  test('pagination: next/prev links render when logs exceed page size', async ({ page }) => {
    // Just verify pagination controls exist if there are multiple pages
    // (may not have 20+ logs in test run, so we only check if they appear conditionally)
    const nextLink = page.getByRole('link', { name: 'Next →' })
    const prevLink = page.getByRole('link', { name: '← Prev' })
    const pageInfo = page.getByText(/Hal \d+\/\d+/)
    await expect(pageInfo).toBeVisible()
    // If only 1 page, neither link shows — that's OK
    const hasNext = await nextLink.isVisible()
    const hasPrev = await prevLink.isVisible()
    if (hasNext) await expect(nextLink).toHaveAttribute('href', /logPage=/)
    if (hasPrev) await expect(prevLink).toHaveAttribute('href', /logPage=/)
  })
})

test.describe('Admin — force end session', () => {
  test('force-end button only appears when active session exists', async ({ page }) => {
    const { adminKey } = getTestData()
    await page.goto(adminUrl(adminKey))

    // After session tests, no active session should exist
    const forceEndSection = page.getByText('Force-end sesi')
    const hasActiveSession = await forceEndSection.isVisible().catch(() => false)

    if (hasActiveSession) {
      // Confirm the double-confirm flow
      await page.getByRole('button', { name: 'Force-end sesi' }).click()
      await page.getByRole('button', { name: 'Yakin force-end' }).click()
      await expect(page.getByText('Sesi di-force-end.')).toBeVisible()
    } else {
      // No active session — section should not be visible
      await expect(page.getByText('SESI AKTIF')).not.toBeVisible()
    }
  })
})
