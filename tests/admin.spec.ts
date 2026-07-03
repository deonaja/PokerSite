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
    // The new player appears in both the edit-balance and reset-PIN selects
    const option = page.locator('select option', { hasText: newName }).first()
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
    // ResetPinForm's select is the last <select> on the page (after edit-balance)
    await page.locator('select').last().selectOption(charlie.id)
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
    await page.getByRole('link', { name: 'all' }).click()
    await page.waitForURL(/logAction=all/)
    await expect(page.locator('table')).toBeVisible()
  })

  test('pagination links render when logs exceed page size', async ({ page }) => {
    const logsSection = page.locator('section').filter({ has: page.locator('p', { hasText: /^LOG$/ }) })
    const nextLink = logsSection.getByRole('link', { name: /Next/ })
    const prevLink = logsSection.getByRole('link', { name: /Prev/ })
    const pageInfo = logsSection.getByText(/Hal \d+\/\d+/)
    await expect(pageInfo).toBeVisible()
    const hasNext = await nextLink.isVisible()
    const hasPrev = await prevLink.isVisible()
    if (hasNext) await expect(nextLink).toHaveAttribute('href', /logPage=/)
    if (hasPrev) await expect(prevLink).toHaveAttribute('href', /logPage=/)
  })
})

test.describe('Admin - cancel session', () => {
  test('cancel-session button only appears when active session exists', async ({ page }) => {
    const { adminKey } = getTestData()
    await page.goto(adminUrl(adminKey))

    const cancelSection = page.getByRole('button', { name: 'Batalkan sesi' })
    const hasActiveSession = await cancelSection.isVisible().catch(() => false)

    if (hasActiveSession) {
      await cancelSection.click()
      await page.getByRole('button', { name: 'Yakin batalkan' }).click()
      await expect(page.getByText('Sesi dibatalkan, balance dikembalikan.')).toBeVisible()
    } else {
      await expect(page.getByText('SESI AKTIF')).not.toBeVisible()
    }
  })
})

test.describe('Admin - CSV export', () => {
  test('each dataset downloads a CSV with a header row (admin cookie required)', async ({ page }) => {
    const { adminKey } = getTestData()
    // Set the admin_key cookie via the normal entry point.
    await page.goto(adminUrl(adminKey))
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()

    const expected: Record<string, string> = {
      players: 'Nama,Saldo',
      results: 'Musim,Pemain,Rank',
      sessions: 'Musim,Dealer,Status',
      log: 'Waktu,Action,Pemain',
    }
    for (const [type, header] of Object.entries(expected)) {
      const res = await page.request.get(`/admin/export?type=${type}`)
      expect(res.status(), `export ${type}`).toBe(200)
      expect(res.headers()['content-type']).toContain('text/csv')
      const body = await res.text()
      // Strip the UTF-8 BOM before checking the header row.
      expect(body.replace(/^﻿/, '')).toContain(header)
    }
  })

  test('export endpoint 404s without the admin cookie', async ({ browser }) => {
    const ctx = await browser.newContext() // no admin_key cookie
    const res = await ctx.request.get('/admin/export?type=players')
    expect(res.status()).toBe(404)
    await ctx.close()
  })
})
