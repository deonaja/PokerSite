import { test, expect } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { getTestData, setIdentity } from './helpers'

// Fitur LOAN (migration 008). Peer-to-peer debt between season members, handled
// outside sessions. These tests exercise the full request → approve → repay flow
// through the dashboard LoanWidget + /api/loans, and the borrow gate.
//
// NOTE: auto-settle at season end is verified separately (arithmetic) because
// ending the shared base season would reset every balance — unsafe here.

const db = () => neon(process.env.DATABASE_URL!)
const { players } = getTestData()
const alice = players[0]
const bob = players[1]

async function clearLoans() {
  const ids = players.map((p) => p.id)
  await db()`DELETE FROM loans WHERE lender_id = ANY(${ids}::uuid[]) OR borrower_id = ANY(${ids}::uuid[])`
}
async function setBalance(id: string, bal: number) {
  await db()`UPDATE players SET balance = ${bal} WHERE id = ${id}`
}
async function balanceOf(id: string): Promise<number> {
  const rows = (await db()`SELECT balance FROM players WHERE id = ${id}`) as { balance: number }[]
  return rows[0].balance
}
async function loanState(): Promise<{ status: string; amount: number } | null> {
  const rows = (await db()`
    SELECT status, amount FROM loans
    WHERE borrower_id = ${alice.id} AND lender_id = ${bob.id}
    ORDER BY created_at DESC LIMIT 1
  `) as { status: string; amount: number }[]
  return rows[0] ?? null
}

test.describe('Loans', () => {
  test.beforeEach(async () => {
    await clearLoans()
  })
  test.afterAll(async () => {
    await clearLoans()
  })

  test('request → approve → repay moves chips and closes the loan', async ({ browser }) => {
    // Alice is short-stacked (below buy-in 100); Bob can lend.
    await setBalance(alice.id, 50)
    await setBalance(bob.id, 500)

    const aliceCtx = await browser.newContext()
    const alicePage = await aliceCtx.newPage()
    await setIdentity(alicePage, alice)

    // Borrower: open the request sheet, pick Bob, request 100.
    await alicePage.goto('/')
    await alicePage.getByRole('button', { name: 'Minta pinjaman' }).click()
    await alicePage.locator('button', { hasText: bob.name }).click()
    await expect(alicePage.locator('#loan-amount')).toHaveValue('100')
    await alicePage.getByRole('button', { name: 'Ajukan pinjaman' }).click()

    await expect.poll(async () => (await loanState())?.status).toBe('pending')

    // Lender: approve the incoming request.
    const bobCtx = await browser.newContext()
    const bobPage = await bobCtx.newPage()
    await setIdentity(bobPage, bob)
    await bobPage.goto('/')
    await bobPage.getByRole('button', { name: 'Setujui' }).click()

    await expect.poll(async () => (await loanState())?.status).toBe('active')
    expect(await balanceOf(alice.id)).toBe(150) // 50 + 100
    expect(await balanceOf(bob.id)).toBe(400) // 500 - 100

    // Borrower: repay in full (now has 150 ≥ 100).
    await alicePage.goto('/')
    await alicePage.getByRole('button', { name: /Lunasi/ }).click()

    await expect.poll(async () => (await loanState())?.status).toBe('repaid')
    expect(await balanceOf(alice.id)).toBe(50) // 150 - 100
    expect(await balanceOf(bob.id)).toBe(500) // 400 + 100

    await aliceCtx.close()
    await bobCtx.close()
  })

  test('borrow gate: /api/loans canBorrow only when below buy-in', async ({ browser }) => {
    // Short-stacked borrower → canBorrow true, candidates present.
    await setBalance(alice.id, 50)
    const aliceCtx = await browser.newContext()
    const alicePage = await aliceCtx.newPage()
    await setIdentity(alicePage, alice)
    await alicePage.goto('/') // establish cookies on the context
    const aliceLoans = await (await alicePage.request.get('/api/loans')).json()
    expect(aliceLoans.canBorrow).toBe(true)
    expect(aliceLoans.candidates.length).toBeGreaterThan(0)
    expect(aliceLoans.myBorrow).toBeNull()
    await aliceCtx.close()

    // Player with enough balance → canBorrow false.
    await setBalance(bob.id, 500)
    const bobCtx = await browser.newContext()
    const bobPage = await bobCtx.newPage()
    await setIdentity(bobPage, bob)
    await bobPage.goto('/')
    const bobLoans = await (await bobPage.request.get('/api/loans')).json()
    expect(bobLoans.canBorrow).toBe(false)
    await bobCtx.close()
  })

  test('decline leaves balances untouched and clears the request', async ({ browser }) => {
    await setBalance(alice.id, 50)
    await setBalance(bob.id, 500)

    const aliceCtx = await browser.newContext()
    const alicePage = await aliceCtx.newPage()
    await setIdentity(alicePage, alice)
    await alicePage.goto('/')
    await alicePage.getByRole('button', { name: 'Minta pinjaman' }).click()
    await alicePage.locator('button', { hasText: bob.name }).click()
    await alicePage.getByRole('button', { name: 'Ajukan pinjaman' }).click()
    await expect.poll(async () => (await loanState())?.status).toBe('pending')

    const bobCtx = await browser.newContext()
    const bobPage = await bobCtx.newPage()
    await setIdentity(bobPage, bob)
    await bobPage.goto('/')
    await bobPage.getByRole('button', { name: 'Tolak' }).click()

    await expect.poll(async () => (await loanState())?.status).toBe('declined')
    expect(await balanceOf(alice.id)).toBe(50) // unchanged
    expect(await balanceOf(bob.id)).toBe(500) // unchanged

    await aliceCtx.close()
    await bobCtx.close()
  })
})
