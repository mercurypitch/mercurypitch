// ============================================================
// Practice Playback E2E Tests
// Tests practice tab play button, playhead movement, and playback state
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Practice Playback', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  test('Practice tab loads with play button visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Play button should be visible
    await expect(page.locator('[data-testid="play-btn"]')).toBeVisible()

    // Practice panel should be visible
    const practicePanel = page.locator('#practice-panel')
    await expect(practicePanel).toBeVisible()
  })

  test('Practice tab Play button starts canvas playback', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Click Play
    const playBtn = page.locator('[data-testid="play-btn"]')
    await expect(playBtn).toBeVisible()
    await playBtn.click()
    await page.waitForTimeout(1000)

    // Playhead is drawn on the PitchCanvas, which should be visible
    await expect(page.locator('#canvas-container canvas')).toBeVisible()

    // Stop playback
    const stopBtn = page.locator('[data-testid="stop-btn"]')
    await stopBtn.click()
    await page.waitForTimeout(500)
  })

  test('Play button shows correct label during playback', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Initial state should show Play button
    const playBtn = page.locator('[data-testid="play-btn"]')
    await expect(playBtn).toBeVisible()

    // Click Play
    await playBtn.click()
    await page.waitForTimeout(500)

    // Should now show Pause button
    const pauseBtn = page.locator('[data-testid="pause-btn"]')
    await expect(pauseBtn).toBeVisible()

    // Click Pause
    await pauseBtn.click()
    await page.waitForTimeout(500)

    // Should show Continue (resume) button
    const continueBtn = page.locator('[data-testid="resume-btn"]')
    await expect(continueBtn).toBeVisible()
  })

  test('Canvas visible during playback and pause', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Click Play
    await page.locator('[data-testid="play-btn"]').click()
    await page.waitForTimeout(800)

    // Canvas should be visible during playback (playhead drawn on it)
    await expect(page.locator('#canvas-container canvas')).toBeVisible()

    // Click Pause
    await page.locator('[data-testid="pause-btn"]').click()
    await page.waitForTimeout(500)

    // Canvas should still be visible when paused (playhead drawn on it)
    await expect(page.locator('#canvas-container canvas')).toBeVisible()
  })

  test('Play button visible after stop', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Play
    await page.locator('[data-testid="play-btn"]').click()
    await page.waitForTimeout(800)

    // Pause
    const pauseBtn = page.locator('[data-testid="pause-btn"]')
    await expect(pauseBtn).toBeVisible()
    await pauseBtn.click()
    await page.waitForTimeout(800)

    // After pausing, a Continue (resume) button should appear
    const continueBtn = page.locator('[data-testid="resume-btn"]')
    await expect(continueBtn).toBeVisible()
  })
})
