// ============================================================
// Focus Mode E2E Tests
// Tests entering/exiting focus mode and UI changes
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Focus Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
    await switchTab(page, 'singing')
    await page.waitForTimeout(500)
  })

  test('Focus mode button is visible on practice tab', async ({ page }) => {
    const focusBtn = page.locator('.focus-btn')
    await expect(focusBtn).toBeVisible()
    await expect(focusBtn).toHaveAttribute('title', 'Enter Focus Mode (minimal UI)')
  })

  test('Entering focus mode shows focus-mode view', async ({ page }) => {
    await page.locator('.focus-btn').click()
    await page.waitForTimeout(500)

    // FocusMode component should render with .focus-mode class
    await expect(page.locator('.focus-mode')).toBeVisible()
  })

  test('Focus mode shows exit button', async ({ page }) => {
    await page.locator('.focus-btn').click()
    await page.waitForTimeout(500)

    // Focus mode toolbar should have exit button
    const exitBtn = page.locator('.focus-exit')
    await expect(exitBtn).toBeVisible()
  })

  test('Exiting focus mode removes focus-mode view', async ({ page }) => {
    await page.locator('.focus-btn').click()
    await page.waitForTimeout(500)

    // Verify we're in focus mode
    await expect(page.locator('.focus-mode')).toBeVisible()

    // Exit via the exit button
    await page.locator('.focus-exit').click()
    await page.waitForTimeout(500)

    // Focus mode should no longer be visible
    await expect(page.locator('.focus-mode')).not.toBeVisible()
  })

  test('Focus mode shows play button', async ({ page }) => {
    await page.locator('.focus-btn').click()
    await page.waitForTimeout(500)

    // Focus mode has its own play button
    await expect(page.locator('.focus-play')).toBeVisible()
  })

  test('Focus mode key badge shows current key', async ({ page }) => {
    await page.locator('.focus-btn').click()
    await page.waitForTimeout(500)

    // Focus mode top bar shows key badge
    await expect(page.locator('.focus-key-badge')).toBeVisible()
  })
})
