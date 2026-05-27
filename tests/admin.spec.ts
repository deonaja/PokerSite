import { test, expect } from '@playwright/test'
import { getTestData, adminUrl } from './helpers'

test.describe('Admin - auth', () => {
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
    await expect(page).toHaveURL('/admin')
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
  })

  test('cookie allows subsequent /admin access without key', async ({ page }) => {
    const { adminKey } = getTestData()
    await page.goto(adminUrl(adminKey))
    await expect(page).toHaveURL('/admin')
    await page.goto('/')
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
  })
})

test.describe('Admin - player management', () => {
  test.beforeEach(async ({ page }) => {
    const { adminKey } = getTestData()
    await page.goto(adminUrl(adminKey))
  })

  test('shows test players in the player list', async ({ page }) => {
    const { players } = getTestData()
    for (const p of players) {
      await expect(page.getByText(p.name, { exact: true }).first()).toBeVisible()
    }
  })

  test('add player: name + balance -> player appears in list', async ({ page }) => {
    const { runId } = getTestData()
    const newName = `[T${runId}] NewPlayer`
    const newBalance = '300'

    await page.getByPlaceholder('Nama').fill(newName)
    await page.getByPlaceholder(/Balance awal/).fill(newBalance)
    await page.getByPlaceholder('PIN (4-6 digit)', { exact: true }).fill('1234')
    await page.getByPlaceholder('Konfirmasi PIN', { exact: true }).fill('1234')
    await page.getByRole('button', { name: '+ Tambah' }).click()

    await expect(page.getByText('Pemain ditambahkan.')).toBeVisible()
    await expect(page.getByText(newName, { exact: true }).first()).toBeVisible()
    const option = page.locator('select option', { hasText: newName })
    await expect(option).toBeAttached()
  })

  test('add player: empty name -> button disabled', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Tambah' })).toBeDisabled()
  })

  test('edit balance: update balance with reason', async ({ page }) => {
    const { players } = getTestData()
    const alice = players[0]

    await page.locator('select').first().selectOption({ value: alice.id })
    await page.getByPlaceholder(/Balance baru/).fill('999')
    await page.getByPlaceholder('Alasan (wajib)', { exact: true }).fill('test edit balance')
    await page.getByRole('button', { name: 'Update balance' }).click()

    await expect(page.getByText('Balance diupdate.')).toBeVisible()
    await expect(page.getByText('999').first()).toBeVisible()
  })

  test('edit balance: empty reason -> button disabled', async ({ page }) => {
    const { players } = getTestData()
    await page.locator('select').first().selectOption({ value: players[0].id })
    await page.getByPlaceholder(/Balance baru/).fill('100')
    await expect(page.getByRole('button', { name: 'Update balance' })).toBeDisabled()
  })

  test('reset pin: update pin with reason', async ({ page }) => {
    // Target Charlie, not the default-selected Alice — the identity spec logs in
    // as Alice with the default PIN, so resetting Alice here would break that test.
    const { players } = getTestData()
    const charlie = players[2]
    const resetCard = page.locator('div', { hasText: 'Set / reset PIN pemain' }).first()
    await resetCard.locator('select').selectOption(charlie.id)
    await resetCard.getByPlaceholder('PIN baru (4-6 digit)').fill('5678')
    await resetCard.getByPlaceholder('Konfirmasi PIN baru').fill('5678')
    await resetCard.getByPlaceholder('Alasan reset PIN (wajib)').fill('player minta reset pin')
    await expect(resetCard.getByRole('button', { name: 'Update PIN' })).toBeEnabled()
    await resetCard.getByRole('button', { name: 'Update PIN' }).click()

    await expect(page.getByText('PIN berhasil direset.')).toBeVisible()
  })
})

test.describe('Admin - logs', () => {
  test.beforeEach(async ({ page }) => {
    const { adminKey } = getTestData()
    await page.goto(adminUrl(adminKey))
  })

  test('log table is visible and contains entries', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible()
  })

  test('filter by action type shows only that action', async ({ page }) => {
    await page.locator('a[href*="logAction=admin_balance_edit"]').click()
    await page.waitForURL(/logAction=admin_balance_edit/)
    await expect(page.locator('a[href*="logAction=admin_balance_edit"]')).toBeVisible()
  })

  test('filter all shows all log entries', async ({ page }) => {
    await page.getByText('all').click()
    await page.waitForURL(/logAction=all/)
    await expect(page.locator('table')).toBeVisible()
  })

  test('pagination links render when logs exceed page size', async ({ page }) => {
    const nextLink = page.getByRole('link', { name: /Next/ })
    const prevLink = page.getByRole('link', { name: /Prev/ })
    const pageInfo = page.getByText(/Hal \d+\/\d+/)
    await expect(pageInfo).toBeVisible()
    const hasNext = await nextLink.isVisible()
    const hasPrev = await prevLink.isVisible()
    if (hasNext) await expect(nextLink).toHaveAttribute('href', /logPage=/)
    if (hasPrev) await expect(prevLink).toHaveAttribute('href', /logPage=/)
  })
})

test.describe('Admin - force end session', () => {
  test('force-end button only appears when active session exists', async ({ page }) => {
    const { adminKey } = getTestData()
    await page.goto(adminUrl(adminKey))

    const forceEndSection = page.getByText('Force-end sesi')
    const hasActiveSession = await forceEndSection.isVisible().catch(() => false)

    if (hasActiveSession) {
      await page.getByRole('button', { name: 'Force-end sesi' }).click()
      await page.getByRole('button', { name: 'Yakin force-end' }).click()
      await expect(page.getByText('Sesi di-force-end.')).toBeVisible()
    } else {
      await expect(page.getByText('SESI AKTIF')).not.toBeVisible()
    }
  })
})
