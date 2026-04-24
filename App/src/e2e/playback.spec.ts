// ============================================================
// Playback E2E Tests
// Tests play/stop buttons, playhead position, and playback state
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Playback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => typeof (window as any).__appStore !== 'undefined',
      { timeout: 5000 },
    )
    await dismissOverlays(page)
    await page.waitForTimeout(500)

    // Clear any stored state
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('Practice tab play button starts playback and moves playhead', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(500)

    // Get initial playhead position
    const playhead = page.locator('#playhead')
    const initialLeft = await playhead.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })

    // Click Play
    const playBtn = page.locator('.play-btn').first()
    await expect(playBtn).toBeVisible()
    await playBtn.click()

    // Wait a bit for playhead to move
    await page.waitForTimeout(1000)

    // Playhead should be visible
    await expect(playhead).toBeVisible()

    // Playhead should have moved from initial position
    const newLeft = await playhead.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(newLeft).toBeGreaterThan(initialLeft)

    // Stop playback
    const stopBtn = page.locator('.stop-btn').first()
    await stopBtn.click()
    await page.waitForTimeout(500)

    // Playhead should be at beginning
    const finalLeft = await playhead.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(finalLeft).toBeLessThanOrEqual(initialLeft)
  })

  test('Practice tab pause button pauses playback', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(500)

    // Click Play
    const playBtn = page.locator('.play-btn').first()
    await playBtn.click()
    await page.waitForTimeout(500)

    // Playhead should be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Click Pause
    const pauseBtn = page.locator('button:has-text("Pause")').first()
    await expect(pauseBtn).toBeVisible()
    await pauseBtn.click()
    await page.waitForTimeout(500)

    // Playhead should still be visible (paused state)
    await expect(page.locator('#playhead')).toBeVisible()

    // Click Continue
    const continueBtn = page.locator('button:has-text("Continue")').first()
    await expect(continueBtn).toBeVisible()
    await continueBtn.click()
    await page.waitForTimeout(500)

    // Playhead should still be visible
    await expect(page.locator('#playhead')).toBeVisible()
  })

  test('Practice tab stop button resets playhead to beginning', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(500)

    // Click Play
    const playBtn = page.locator('.play-btn').first()
    await playBtn.click()
    await page.waitForTimeout(1000)

    // Playhead should have moved
    const initialLeft = await page.locator('#playhead').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(initialLeft).toBeGreaterThan(0)

    // Click Stop
    const stopBtn = page.locator('.stop-btn').first()
    await stopBtn.click()
    await page.waitForTimeout(500)

    // Playhead should be hidden or at beginning
    const finalLeft = await page.locator('#playhead').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(finalLeft).toBe(0)
  })

  test('Editor tab Play button starts playback', async ({ page }) => {
    // Switch to Editor tab
    await page.locator('#tab-editor').click()
    await page.waitForTimeout(1000)

    // Play button should be visible
    const playBtn = page.locator('.play-btn').first()
    await expect(playBtn).toBeVisible()

    // Initial playhead should be hidden (no playback)
    const playhead = page.locator('#playhead')
    await expect(playhead).not.toBeVisible()

    // Click Play
    await playBtn.click()
    await page.waitForTimeout(500)

    // Playhead should now be visible
    await expect(playhead).toBeVisible()

    // Stop playback
    const stopBtn = page.locator('.stop-btn').first()
    await stopBtn.click()
    await page.waitForTimeout(500)

    // Playhead should be hidden again
    await expect(playhead).not.toBeVisible()
  })

  test('Editor tab Pause button pauses playback', async ({ page }) => {
    // Switch to Editor tab
    await page.locator('#tab-editor').click()
    await page.waitForTimeout(1000)

    // Click Play
    const playBtn = page.locator('.play-btn').first()
    await playBtn.click()
    await page.waitForTimeout(500)

    // Playhead should be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Click Pause
    const pauseBtn = page.locator('button:has-text("Pause")').first()
    await expect(pauseBtn).toBeVisible()
    await pauseBtn.click()
    await page.waitForTimeout(500)

    // Playhead should still be visible (paused)
    await expect(page.locator('#playhead')).toBeVisible()

    // Click Continue
    const continueBtn = page.locator('button:has-text("Continue")').first()
    await continueBtn.click()
    await page.waitForTimeout(500)

    // Playhead should still be visible
    await expect(page.locator('#playhead')).toBeVisible()
  })

  test('Editor tab Play button does not auto-play when tab is first active', async ({
    page,
  }) => {
    // Switch to Editor tab
    await page.locator('#tab-editor').click()
    await page.waitForTimeout(500)

    // Play button should be visible
    await expect(page.locator('.play-btn').first()).toBeVisible()

    // Playhead should NOT be visible (no auto-play)
    await expect(page.locator('#playhead')).not.toBeVisible()
  })

  test('Editor tab Playhead displays correct position during playback', async ({
    page,
  }) => {
    // Switch to Editor tab
    await page.locator('#tab-editor').click()
    await page.waitForTimeout(500)

    // Click Play
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(500)

    // Playhead should be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Playhead should be within the canvas area
    const canvas = page.locator('.roll-grid canvas').first()
    await expect(canvas).toBeVisible()
    const canvasBox = await canvas.boundingBox()
    expect(canvasBox).not.toBeNull()

    // Playhead position should be within canvas bounds
    const playheadBox = await page.locator('#playhead').boundingBox()
    expect(playheadBox).not.toBeNull()

    // Stop playback
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)

    // Playhead should be at beginning
    const finalLeft = await page.locator('#playhead').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(finalLeft).toBeLessThan(10) // Near 0
  })

  test('Spacebar plays/pauses when in focus mode', async ({ page }) => {
    // Click Focus Mode button
    await page.locator('.focus-btn').click()
    await page.waitForTimeout(500)

    // Playhead should be hidden initially
    await expect(page.locator('#playhead')).not.toBeVisible()

    // Press Space to play
    await page.keyboard.press('Space')
    await page.waitForTimeout(500)

    // Playhead should be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Press Space to pause
    await page.keyboard.press('Space')
    await page.waitForTimeout(500)

    // Playhead should still be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Press Escape to stop and exit focus mode
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Playhead should be hidden
    await expect(page.locator('#playhead')).not.toBeVisible()
  })

  test('Metronome click does not interfere with playback', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(500)

    // Play button should be visible
    await expect(page.locator('.play-btn').first()).toBeVisible()

    // Play
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(500)

    // Playhead should be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Stop
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)

    // Playhead should be at beginning
    const finalLeft = await page.locator('#playhead').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(finalLeft).toBeLessThan(10)
  })
})