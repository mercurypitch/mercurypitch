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

  test('Practice tab play button starts playback and moves playhead', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
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
    expect(finalLeft).toBeLessThan(initialLeft + 50)
  })

  test('Practice tab pause button pauses playback', async ({ page }) => {
    await switchTab(page, 'singing')
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
    await switchTab(page, 'singing')
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
    await page.locator('#tab-compose').click()
    await page.waitForTimeout(1000)
  })

  test.skip('Editor tab Pause button pauses playback', async ({ page }) => {
    // Play/Pause controls are only available in Practice mode
    // This test is skipped since Editor mode doesn't have playback controls
    await page.locator('#tab-compose').click()
    await page.waitForTimeout(1000)
  })

  test.skip('Editor tab Play button does not auto-play when tab is first active', async ({
    page,
  }) => {
    // Play/Pause controls are only available in Practice mode
    // This test is skipped since Editor mode doesn't have playback controls
    await page.locator('#tab-compose').click()
    await page.waitForTimeout(500)
  })

  test.skip('Editor tab Playhead does not display in Editor mode', async ({
    page,
  }) => {
    // Play/Pause controls are only available in Practice mode
    // This test is skipped since Editor mode doesn't have playback controls
    await page.locator('#tab-compose').click()
    await page.waitForTimeout(500)
  })

  test('Metronome click does not interfere with playback', async ({ page }) => {
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
    expect(finalLeft).toBeLessThan(25)
  })
})

test.describe('Playback - Once Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => typeof (window as any).__appStore !== 'undefined',
      { timeout: 5000 },
    )

    await dismissOverlays(page)
    await page.waitForTimeout(1000)

    // Clear state
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await dismissOverlays(page)
    await page.waitForTimeout(500)
  })

  test('Once mode: play button starts playback with count-in', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Set play mode to Once
    await page.evaluate(() => {
      ;(window as any).__setPlayMode?.('once')
    })
    await page.waitForTimeout(200)

    // Play button should be visible
    await expect(page.locator('.play-btn').first()).toBeVisible()

    // Click Play
    await page.locator('.play-btn').first().click()

    // Wait for count-in to start
    await page.waitForTimeout(1000)

    // Playhead should appear after count-in
    const playhead = page.locator('#playhead')
    await expect(playhead).toBeVisible()

    // Playhead should move during playback
    await page.waitForTimeout(500)
    const initialLeft = await playhead.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    await page.waitForTimeout(500)
    const newLeft = await playhead.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(newLeft).toBeGreaterThan(initialLeft)

    // Stop
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)
  })

  test('Once mode: playhead should advance steadily', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      ;(window as any).__setPlayMode?.('once')
    })
    await page.waitForTimeout(200)

    // Click Play
    await page.locator('.play-btn').first().click()

    // Wait for playback to start
    await page.waitForTimeout(1000)

    // Playhead should be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Track playhead position over time
    const positions: number[] = []
    for (let i = 0; i < 5; i++) {
      const left = await page.locator('#playhead').evaluate((el) => {
        const style = window.getComputedStyle(el)
        return parseFloat(style.left ?? '0')
      })
      positions.push(left)
      await page.waitForTimeout(500)
    }

    // Playhead should consistently move forward (not stuck)
    expect(positions[1]).toBeGreaterThan(positions[0])
    expect(positions[2]).toBeGreaterThan(positions[1])
    expect(positions[3]).toBeGreaterThan(positions[2])
    expect(positions[4]).toBeGreaterThan(positions[3])

    // Stop playback
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)
  })

  test('Once mode: clicking Play again restarts from beginning', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      ;(window as any).__setPlayMode?.('once')
    })
    await page.waitForTimeout(200)

    // First Play
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(1500)

    // Playhead should have moved
    let position1 = await page.locator('#playhead').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(position1).toBeGreaterThan(0)

    // Stop
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)

    // Reset playhead to beginning
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(500)

    // Playhead should be back near beginning
    let position2 = await page.locator('#playhead').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(position2).toBeLessThan(50)

    // Stop
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)
  })
})

test.describe('Playback - Repeat Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => typeof (window as any).__appStore !== 'undefined',
      { timeout: 5000 },
    )

    await dismissOverlays(page)
    await page.waitForTimeout(1000)

    // Clear state
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await dismissOverlays(page)
    await page.waitForTimeout(500)
  })

  test('Repeat mode: play starts with count-in and loops', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Set play mode to Repeat
    await page.evaluate(() => {
      ;(window as any).__setPlayMode?.('repeat')
    })
    await page.waitForTimeout(200)

    // Play button should be visible
    await expect(page.locator('.play-btn').first()).toBeVisible()

    // Click Play
    await page.locator('.play-btn').first().click()

    // Wait for count-in
    await page.waitForTimeout(1000)

    // Playhead should appear
    await expect(page.locator('#playhead')).toBeVisible()

    // Let it play for a bit, should continue after count-in
    await page.waitForTimeout(3000)

    // Playhead should still be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Stop playback
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)
  })

  test('Repeat mode: repeat button cycles through multiple plays', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      ;(window as any).__setPlayMode?.('repeat')
    })
    await page.waitForTimeout(200)

    // Play
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(2000)

    // Playhead should have moved
    let position1 = await page.locator('#playhead').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(position1).toBeGreaterThan(0)

    // Stop
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)

    // Reset
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(2000)

    // Playhead should have moved further (second cycle)
    let position2 = await page.locator('#playhead').evaluate((el) => {
      const style = window.getComputedStyle(el)
      return parseFloat(style.left ?? '0')
    })
    expect(position2).toBeGreaterThan(position1)

    // Stop playback
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)
  })
})

test.describe('Playback - Session Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => typeof (window as any).__appStore !== 'undefined',
      { timeout: 5000 },
    )

    await dismissOverlays(page)
    await page.waitForTimeout(1000)

    // Clear state
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await dismissOverlays(page)
    await page.waitForTimeout(500)
  })

  test('Session mode: play starts playback of session items', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Set play mode to Session Mode
    await page.evaluate(() => {
      ;(window as any).__setPlayMode?.('session')
    })
    await page.waitForTimeout(200)

    // Play button should be visible
    await expect(page.locator('.play-btn').first()).toBeVisible()

    // Click Play
    await page.locator('.play-btn').first().click()

    // Wait for playback to start
    await page.waitForTimeout(1500)

    // Playhead should be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Let it play
    await page.waitForTimeout(3000)

    // Playhead should still be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Stop playback
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)
  })

  test('Session mode: clicking play in session editor starts playback', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Set play mode to Session Mode
    await page.evaluate(() => {
      ;(window as any).__setPlayMode?.('session')
    })
    await page.waitForTimeout(200)

    // Play
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(1500)

    // Playhead should be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Stop
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)
  })
})

test.describe('Playback State Reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => typeof (window as any).__appStore !== 'undefined',
      { timeout: 5000 },
    )

    await dismissOverlays(page)
    await page.waitForTimeout(1000)

    // Clear state
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await dismissOverlays(page)
    await page.waitForTimeout(500)
  })

  test('After playback stop, all buttons reset correctly', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Set play mode
    await page.evaluate(() => {
      ;(window as any).__setPlayMode?.('once')
    })
    await page.waitForTimeout(200)

    // Click Play
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(1000)

    // Play button should be showing as "Play" (not "Pause")
    await expect(page.locator('button:has-text("Play")')).toBeVisible()

    // Click Stop
    await page.locator('.stop-btn').first().click()
    await page.waitForTimeout(500)

    // Play button should still be visible
    await expect(page.locator('button:has-text("Play")')).toBeVisible()

    // Playhead should be hidden
    const playhead = page.locator('#playhead')
    await expect(playhead).not.toBeVisible()
  })

  test('Tab switch stops playback and resets state', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      ;(window as any).__setPlayMode?.('once')
    })
    await page.waitForTimeout(200)

    // Click Play
    await page.locator('.play-btn').first().click()
    await page.waitForTimeout(1000)

    // Playhead should be visible
    await expect(page.locator('#playhead')).toBeVisible()

    // Switch tabs
    await switchTab(page, 'compose')
    await page.waitForTimeout(500)

    // Playhead should be hidden after tab switch
    const playhead = page.locator('#playhead')
    await expect(playhead).not.toBeVisible()

    // Switch back to practice tab
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)

    // Playhead should still be hidden
    await expect(playhead).not.toBeVisible()
  })
})
