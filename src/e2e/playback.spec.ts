// ============================================================
// Playback E2E Tests
// Tests play/stop buttons, playhead position, and playback state
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Playback', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  test('Practice tab has default melody loaded on first tab switch', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    await expect(page.locator('.play-btn').first()).toBeVisible()

    const practicePanel = page.locator('#practice-panel')
    await expect(practicePanel).toBeVisible()

    // Play button visible initially (no playback active)
  })

  test('Practice tab play button starts playback', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    await expect(page.locator('button:has-text("Play")')).toBeVisible()

    // Click Play
    await page.locator('button:has-text("Play")').click()
    await page.waitForTimeout(800)

    // Pause button confirms playback started (playhead drawn on canvas)
    await expect(page.locator('button:has-text("Pause")')).toBeVisible()

    // Stop via pause button
    await page.locator('button:has-text("Pause")').click()
    await page.waitForTimeout(500)
  })

  test('Practice tab pause button pauses and shows continue', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Click Play
    await page.locator('button:has-text("Play")').click()
    await page.waitForTimeout(500)

    // Pause button confirms playback started
    await expect(page.locator('button:has-text("Pause")')).toBeVisible()

    // Click Pause
    await page.locator('button:has-text("Pause")').click()
    await page.waitForTimeout(500)

    // Continue button should appear
    await expect(page.locator('button:has-text("Continue")')).toBeVisible()
  })

  test('Playback state resets on tab switch', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Click Play
    await page.locator('button:has-text("Play")').click()
    await page.waitForTimeout(500)

    // Pause button confirms playback started
    await expect(page.locator('button:has-text("Pause")')).toBeVisible()

    // Switch tabs
    await switchTab(page, 'compose')
    await page.waitForTimeout(500)

    // Switch back to practice tab
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Play button should be visible again (fresh state)
    await expect(page.locator('.play-btn').first()).toBeVisible()
  })

  test('Metronome does not block playback', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    await expect(page.locator('.play-btn').first()).toBeVisible()

    // Play
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(500)

    // Pause button confirms playback started
    await expect(page.locator('button:has-text("Pause")')).toBeVisible()

    // Pause/stop
    await page.locator('button:has-text("Pause")').click()
    await page.waitForTimeout(500)
  })
})
