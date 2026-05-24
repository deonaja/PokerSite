import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { Page } from '@playwright/test'
import type { TestData } from './global-setup'

export function getTestData(): TestData {
  return JSON.parse(readFileSync(resolve(process.cwd(), '.test-data.json'), 'utf-8')) as TestData
}

/**
 * Set player identity in localStorage (avoids the /identity redirect).
 * Uses addInitScript so it runs before the next page.goto() — safe to call
 * before any navigation.
 */
export async function setIdentity(page: Page, player: { id: string; name: string }) {
  await page.addInitScript(({ id, name }: { id: string; name: string }) => {
    localStorage.setItem('playerId', id)
    localStorage.setItem('playerName', name)
  }, { id: player.id, name: player.name })
}

/** Clear identity so the layout redirects to /identity */
export async function clearIdentity(page: Page) {
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
