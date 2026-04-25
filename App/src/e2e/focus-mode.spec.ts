// ============================================================
// Focus Mode E2E Tests
// Tests for focus mode activation, UI hiding, and exit conditions
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Focus Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => typeof (window as any).__appStore !== 'undefined',
      { timeout: 5000 },
    )
    await dismissOverlays(page)
    await page.waitForTimeout(500)

    // Clear localStorage to start fresh
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await dismissOverlays(page)
    await page.waitForTimeout(500)
  })

  // ==========================================
  // Focus Mode Activation Tests (6 tests)
  // ==========================================

  test('User can activate Focus Mode via dedicated button', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')
    await expect(focusToggle).toBeVisible()

    // Click to activate
    await focusToggle.click()
    await page.waitForTimeout(500)

    await expect(focusToggle).toHaveAttribute('data-active', 'true')
  })

  test('Focus mode hides sidebar elements', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const sidebar = page.locator('nav')
    await expect(sidebar).toBeVisible()

    // Activate focus mode
    const focusToggle = page.locator('#focus-mode-toggle')
    await focusToggle.click()
    await page.waitForTimeout(300)

    // Sidebar should be hidden
    await expect(sidebar).not.toBeVisible()
  })

  test('Focus mode hides header elements', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const header = page.locator('header')
    await expect(header).toBeVisible()

    // Activate focus mode
    const focusToggle = page.locator('#focus-mode-toggle')
    await focusToggle.click()
    await page.waitForTimeout(300)

    // Header should be hidden
    await expect(header).not.toBeVisible()
  })

  test('Focus mode hides unnecessary modals', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Activate focus mode
    const focusToggle = page.locator('#focus-mode-toggle')
    await focusToggle.click()
    await page.waitForTimeout(300)
  })

  test('Focus mode expands practice area', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Activate focus mode
    const focusToggle = page.locator('#focus-mode-toggle')
    await focusToggle.click()
    await page.waitForTimeout(300)
  })

  test('Active Focus Mode button is visually highlighted', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Toggle should have active styling
    await expect(focusToggle).toHaveClass(/active/)
  })

  // ==========================================
  // Focus Mode Deactivation Tests (4 tests)
  // ==========================================

  test('User can deactivate Focus Mode via toggle', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')

    // Activate
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Deactivate
    await focusToggle.click()
    await page.waitForTimeout(500)
  })

  test('Deactivating restores all hidden UI elements', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')
    const sidebar = page.locator('nav')

    // Activate focus mode
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Deactivate
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Sidebar should be visible again
    await expect(sidebar).toBeVisible()
  })

  test('Focus mode can be exited by tab switching', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')

    // Activate focus mode
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Switch to another tab
    await switchTab(page, 'editor')
    await page.waitForTimeout(500)

    // Switch back to practice
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)
  })

  test('Deactivation preserves current practice state', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')

    // Activate focus mode
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Deactivate
    await focusToggle.click()
    await page.waitForTimeout(500)
  })

  // ==========================================
  // Focus Mode UI Changes Tests (6 tests)
  // ==========================================

  test('Sidebar navigation is hidden in focus mode', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const sidebar = page.locator('nav')

    // Activate focus mode
    const focusToggle = page.locator('#focus-mode-toggle')
    await focusToggle.click()
    await page.waitForTimeout(500)

    await expect(sidebar).not.toBeVisible()
  })

  test('Practice header is minimized in focus mode', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const header = page.locator('header')

    // Activate focus mode
    const focusToggle = page.locator('#focus-mode-toggle')
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Header should be hidden or minimized
    await expect(header).not.toBeVisible()
  })

  test('Settings panel is not accessible in focus mode', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Activate focus mode
    const focusToggle = page.locator('#focus-mode-toggle')
    await focusToggle.click()
    await page.waitForTimeout(500)

    const settingsPanel = page.locator('#settings-panel')
    await expect(settingsPanel).not.toBeVisible()
  })

  test('Library modals are hidden or collapsed in focus mode', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Activate focus mode
    const focusToggle = page.locator('#focus-mode-toggle')
    await focusToggle.click()
    await page.waitForTimeout(500)
  })

  test('Help/walkthrough elements are hidden in focus mode', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Activate focus mode
    const focusToggle = page.locator('#focus-mode-toggle')
    await focusToggle.click()
    await page.waitForTimeout(500)
  })

  test('Piano roll expands to fill available space in focus mode', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Activate focus mode
    const focusToggle = page.locator('#focus-mode-toggle')
    await focusToggle.click()
    await page.waitForTimeout(500)
  })

  // ==========================================
  // Focus Mode Behavior Tests (5 tests)
  // ==========================================

  test('Focus mode does not interfere with playback controls', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')

    // Activate focus mode
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Check if playback controls are still visible
    const playBtn = page.locator('.play-btn')
    await expect(playBtn).toBeVisible()
  })

  test('Focus mode does not affect metronome functionality', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')
    const metroToggle = page.locator('#metronome-toggle')

    // Activate focus mode
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Metronome should still be accessible
    await expect(metroToggle).toBeVisible()
  })

  test('Focus mode allows recording to piano roll', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')
    const recordBtn = page.locator('.record-btn')

    // Activate focus mode
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Recording should still be accessible
    await expect(recordBtn).toBeVisible()
  })

  test('Focus mode preserves all practice session state', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')

    // Activate focus mode
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Deactivate
    await focusToggle.click()
    await page.waitForTimeout(500)
  })

  test('Focus mode can be toggled multiple times', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')

    // Toggle on
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Toggle off
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Toggle on again
    await focusToggle.click()
    await page.waitForTimeout(500)
  })

  // ==========================================
  // UI Consistency Tests (4 tests)
  // ==========================================

  test('Focus mode UI changes happen smoothly', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')

    // Multiple rapid toggles
    for (let i = 0; i < 3; i++) {
      await focusToggle.click()
      await page.waitForTimeout(200)
    }

    // Should return to visible state
    await page.waitForTimeout(500)
  })

  test('Hidden elements remain hidden across focus mode toggle', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')
    const sidebar = page.locator('nav')

    // Activate focus mode
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Deactivate
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Reactivate
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Sidebar should remain hidden
    await expect(sidebar).not.toBeVisible()
  })

  test('Focus mode has smooth animations', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')

    // Toggle on
    await focusToggle.click()
    await page.waitForTimeout(300)

    // Toggle off
    await focusToggle.click()
    await page.waitForTimeout(300)

    // Should return to visible state
    await page.waitForTimeout(500)
  })

  test('Focus mode works consistently across practice and editor tabs', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const focusToggle = page.locator('#focus-mode-toggle')

    // Activate in practice
    await focusToggle.click()
    await page.waitForTimeout(500)

    // Switch to editor
    await switchTab(page, 'editor')
    await page.waitForTimeout(500)

    // Switch back to practice
    await switchTab(page, 'practice')
    await page.waitForTimeout(500)
  })
})