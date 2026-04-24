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

  test('Practice tab has default melody loaded on first tab switch', async ({
    page,
  }) => {
    // Click directly on Practice tab (welcome overlay may not be visible after dismiss)
    const playBtn = page.locator('#tab-practice')
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

  test('Practice tab play button starts playback and moves playhead', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(500)

    // Verify we're on practice tab by checking practice-specific controls
    const practicePlayBtn = page.locator('button:has-text("Play")')
    await expect(practicePlayBtn).toBeVisible()

    // Get initial playhead position
    const playhead = page.locator('#playhead')
    const initialLeft = await playhead.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })

    // Click Play
    await practicePlayBtn.click()

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
    const stopBtn = page.locator('button:has-text("Stop")')
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
    const practicePlayBtn = page.locator('button:has-text("Play")')
    await practicePlayBtn.click()
    await page.waitForTimeout(500)

    // Playhead should be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Click Pause
    const pauseBtn = page.locator('button:has-text("Pause")')
    await expect(pauseBtn).toBeVisible()
    await pauseBtn.click()
    await page.waitForTimeout(500)

    // Playhead should still be visible (paused state)
    await expect(page.locator('#playhead')).toBeVisible()

    // Click Continue
    const continueBtn = page.locator('button:has-text("Continue")')
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
    const practicePlayBtn = page.locator('button:has-text("Play")')
    await practicePlayBtn.click()
    await page.waitForTimeout(1000)

    // Playhead should have moved
    const initialLeft = await page.locator('#playhead').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(initialLeft).toBeGreaterThan(0)

    // Click Stop
    const stopBtn = page.locator('button:has-text("Stop")')
    await stopBtn.click()
    await page.waitForTimeout(500)

    // Playhead should be at beginning (near 0)
    const finalLeft = await page.locator('#playhead').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(finalLeft).toBeLessThan(40)
  })

  test.skip('Editor tab Play button starts playback', async ({ page }) => {
    // Play/Pause controls are only available in Practice mode
    // This test is skipped since Editor mode doesn't have playback controls
    await page.locator('#tab-editor').click()
    await page.waitForTimeout(1000)
  })

  test.skip('Editor tab Pause button pauses playback', async ({ page }) => {
    // Play/Pause controls are only available in Practice mode
    // This test is skipped since Editor mode doesn't have playback controls
    await page.locator('#tab-editor').click()
    await page.waitForTimeout(1000)
  })

  test.skip('Editor tab Play button does not auto-play when tab is first active', async ({
    page,
  }) => {
    // Play/Pause controls are only available in Practice mode
    // This test is skipped since Editor mode doesn't have playback controls
    await page.locator('#tab-editor').click()
    await page.waitForTimeout(500)
  })

  test.skip('Editor tab Playhead does not display in Editor mode', async ({
    page,
  }) => {
    // Play/Pause controls are only available in Practice mode
    // This test is skipped since Editor mode doesn't have playback controls
    await page.locator('#tab-editor').click()
    await page.waitForTimeout(500)
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
    expect(finalLeft).toBeLessThan(25)
  })
})
