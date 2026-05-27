import { readFileSync } from 'fs'
import { resolve } from 'path'
import { expect, type Page } from '@playwright/test'
import { neon } from '@neondatabase/serverless'
import { generateSessionToken, hashSessionToken } from '../lib/auth'
import type { TestData } from './global-setup'

export function getTestData(): TestData {
  return JSON.parse(readFileSync(resolve(process.cwd(), '.test-data.json'), 'utf-8')) as TestData
}

/**
 * Set player identity via cookie (for middleware) + localStorage (for client components).
 * Cookie must be set before page.goto() so middleware allows the request.
 */
export async function setIdentity(page: Page, player: { id: string; name: string }) {
  const token = generateSessionToken()
  const tokenHash = hashSessionToken(token)
  const sql = neon(process.env.DATABASE_URL!)
  await sql`
    INSERT INTO auth_sessions (player_id, token_hash, expires_at)
    VALUES (${player.id}, ${tokenHash}, now() + interval '7 days')
  `

  await page.context().addCookies([
    { name: 'auth_session', value: token, domain: 'localhost', path: '/' },
    { name: 'playerId', value: player.id, domain: 'localhost', path: '/' },
    { name: 'playerName', value: encodeURIComponent(player.name), domain: 'localhost', path: '/' },
  ])
  await page.addInitScript(({ id, name }: { id: string; name: string }) => {
    localStorage.setItem('playerId', id)
    localStorage.setItem('playerName', name)
  }, { id: player.id, name: player.name })
}

/** Clear identity so middleware redirects to /identity */
export async function clearIdentity(page: Page) {
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.clear())
}

/**
 * Click a checkbox/radio inside a <label> that contains the given text.
 * Works for both the player-select checkboxes and dealer radio buttons.
 */
export async function clickLabelFor(page: Page, text: string) {
  const label = page.locator('label', { hasText: text }).first()
  const input = label.locator('input').first()
  await input.waitFor({ state: 'visible' })
  await expect(input).toBeEnabled({ timeout: 10_000 })
  const inputType = await input.getAttribute('type')
  if (inputType === 'checkbox') {
    await input.click()
    return
  }
  await input.check()
}

/** Admin page URL (cookie auth — first call must include ?key=) */
export function adminUrl(adminKey: string, params = '') {
  return `/admin?key=${adminKey}${params ? `&${params}` : ''}`
}

/**
 * Clear dealer cooldown so a player can be the paid dealer again immediately.
 * Cooldown (Phase 1) blocks a player from dealing for 2 sessions after dealing.
 * Tests that start several sessions in a row with the same dealer need this.
 */
export async function resetCooldown(playerIds?: string[]) {
  const sql = neon(process.env.DATABASE_URL!)
  if (playerIds && playerIds.length > 0) {
    await sql`UPDATE players SET last_dealer_session_id = NULL WHERE id = ANY(${playerIds}::uuid[])`
  } else {
    await sql`UPDATE players SET last_dealer_session_id = NULL WHERE name LIKE '[T%'`
  }
}
