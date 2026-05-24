import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { Page } from '@playwright/test'
import type { TestData } from './global-setup'

export function getTestData(): TestData {
  return JSON.parse(readFileSync(resolve(process.cwd(), '.test-data.json'), 'utf-8')) as TestData
}

/**
 * Set player identity via cookie (for middleware) + localStorage (for client components).
 * Cookie must be set before page.goto() so middleware allows the request.
 */
export async function setIdentity(page: Page, player: { id: string; name: string }) {
  await page.context().addCookies([
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
  await page.locator('label', { hasText: text }).first().click()
}

/** Admin page URL (cookie auth — first call must include ?key=) */
export function adminUrl(adminKey: string, params = '') {
  return `/admin?key=${adminKey}${params ? `&${params}` : ''}`
}
