// ============================================================
// Practice Playback E2E Tests
// Tests practice tab play button, playhead movement, and playback state
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Practice Playback', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)

    // Enable showPlayhead so the playhead is visible during playback
    await page.evaluate(() => {
      localStorage.setItem('pitchperfect_show_playhead', 'true')
    })
    await page.reload()
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  test('Practice tab loads with play button visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Play button should be visible
    await expect(page.locator('.play-btn').first()).toBeVisible()

    // Practice panel should be visible
    const practicePanel = page.locator('#practice-panel')
    await expect(practicePanel).toBeVisible()
  })

  test('Practice tab Play button moves playhead', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Click Play
    const playBtn = page.locator('.play-btn').first()
    await expect(playBtn).toBeVisible()
    await playBtn.click()
    await page.waitForTimeout(1000)

    // Playhead should be visible (showPlayhead was enabled)
    const playhead = page.locator('#playhead')
    await expect(playhead).toBeVisible()

    // Stop playback
    const stopBtn = page.locator('.stop-btn').first()
    await stopBtn.click()
    await page.waitForTimeout(500)
  })

  test('Play button shows correct label during playback', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Initial state should show Play button
    const playBtn = page.locator('button:has-text("Play")').first()
    await expect(playBtn).toBeVisible()

    // Click Play
    await playBtn.click()
    await page.waitForTimeout(500)

    // Should now show Pause button
    const pauseBtn = page.locator('button:has-text("Pause")').first()
    await expect(pauseBtn).toBeVisible()

    // Click Pause
    await pauseBtn.click()
    await page.waitForTimeout(500)

    // Should show Continue button
    const continueBtn = page.locator('button:has-text("Continue")').first()
    await expect(continueBtn).toBeVisible()
  })

  test('Playhead visible during playback and pause', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Click Play
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(800)

    // Playhead should be visible during playback
    await expect(page.locator('#playhead')).toBeVisible()

    // Click Pause (the .stop-btn is actually the pause button)
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)

    // Playhead should still be visible when paused
    await expect(page.locator('#playhead')).toBeVisible()
  })

  test('Play button visible after stop', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Play
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(800)

    // Pause (the pause button has .stop-btn class)
    const pauseBtn = page.locator('.stop-btn').first()
    await expect(pauseBtn).toBeVisible()
    await pauseBtn.click()
    await page.waitForTimeout(800)

    // After pausing, a Continue button (also .play-btn) should appear
    const continueBtn = page.locator('.play-btn').first()
    await expect(continueBtn).toBeVisible()
  })
})
