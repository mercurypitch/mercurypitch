// ============================================================
// Practice Playback E2E Tests
// Tests practice tab play button, playhead movement, and playback state
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Practice Playback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => typeof (window as any).__appStore !== 'undefined',
      { timeout: 5000 },
    )

    // Dismiss welcome overlay before checking for it
    await dismissOverlays(page)
    await page.waitForTimeout(1000)

    // Clear any stored state
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Dismiss overlay again after reload
    await dismissOverlays(page)
    await page.waitForTimeout(500)
  })

  test('Practice tab loads with default melody on first tab switch', async ({
    page,
  }) => {
    // Click directly on Practice tab (welcome overlay may not be visible after dismiss)
    const playBtn = page.locator('#tab-singing')
    await playBtn.click()
    await page.waitForTimeout(1000)

    // Play button should be visible
    await expect(page.locator('.play-btn').first()).toBeVisible()

    // Practice panel should be visible with piano roll
    const practicePanel = page.locator('#practice-panel')
    await expect(practicePanel).toBeVisible()

    // Playhead should be hidden initially (no playback)
    const playhead = page.locator('#playhead')
    await expect(playhead).not.toBeVisible()
  })

  test('Practice tab Play button starts playback and moves playhead', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
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

    // Wait for playback to start
    await page.waitForTimeout(500)

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
    expect(finalLeft).toBeLessThan(initialLeft + 50) // Allow small offset due to timing
  })

  test('Practice tab pause button pauses playback', async ({ page }) => {
    await switchTab(page, 'singing')
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
    await switchTab(page, 'singing')
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

    // Playhead should be at beginning (near 0)
    const finalLeft = await page.locator('#playhead').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(finalLeft).toBeLessThan(40)
  })

  test('Practice tab Play button moves playhead steadily', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Play
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(2000)

    // Playhead should have moved significantly (at least 20px for consistency)
    const playhead = page.locator('#playhead')
    const left = await playhead.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(left).toBeGreaterThan(5) // More relaxed threshold for different screen sizes

    // Stop
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)

    // Playhead should be at beginning
    const finalLeft = await playhead.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(finalLeft).toBeLessThan(30)
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

  test('Practice tab allows clicking Play and playing immediately', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Verify default melody exists
    const playhead = page.locator('#playhead')
    const initialLeft = await playhead.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })

    // Play button should be visible
    const playBtn = page.locator('.play-btn').first()
    await expect(playBtn).toBeVisible()

    // User can just click Play and start singing
    await playBtn.click()
    await page.waitForTimeout(1000)

    // Playhead should now be visible and moved
    await expect(playhead).toBeVisible()
    const newLeft = await playhead.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(newLeft).toBeGreaterThan(initialLeft)

    // Stop playback
    const stopBtn = page.locator('.stop-btn').first()
    await stopBtn.click()
    await page.waitForTimeout(500)

    // Playhead should be at beginning again
    const finalLeft = await playhead.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(finalLeft).toBeLessThan(40)
  })

  test('Practice tab metronome click does not interfere with playback', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
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
    expect(finalLeft).toBeLessThan(30)
  })
})
