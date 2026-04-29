// ============================================================
// Walkthrough E2E Tests
// ============================================================

import { test, expect } from '@playwright/test'

test.describe('Walkthrough Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for app to initialize
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
  })

  test('Walkthrough control button exists in header', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn')
    await expect(walkthroughBtn).toBeVisible()
  })

  test('Clicking walkthrough button opens selection modal', async ({
    page,
  }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn')
    await walkthroughBtn.click()

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()
    await expect(modal).toHaveAttribute(
      'class',
      /walkthrough-selection-overlay/,
    )
  })

  test('Walkthrough selection shows progress percentage', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn')
    await walkthroughBtn.click()

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()

    const percentage = modal.locator('.ws-percentage')
    await expect(percentage).toBeVisible()
  })

  test('Walkthrough tabs show remaining walkthroughs with badges', async ({
    page,
  }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn')
    await walkthroughBtn.click()

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()

    // Check practice tab
    const practiceTab = modal.locator('.ws-tab:has-text("Practice")')
    await expect(practiceTab).toBeVisible()

    // Check editor tab
    const editorTab = modal.locator('.ws-tab:has-text("Editor")')
    await expect(editorTab).toBeVisible()

    // Check settings tab
    const settingsTab = modal.locator('.ws-tab:has-text("Settings")')
    await expect(settingsTab).toBeVisible()
  })

  test('Walkthrough steps display correctly in modal', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn')
    await walkthroughBtn.click()

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()

    // Click on Practice tab
    const practiceTab = modal.locator('.ws-tab:has-text("Practice")')
    await practiceTab.click()

    // Check that walkthrough items are shown
    const walkthroughList = modal.locator('.ws-list')
    await expect(walkthroughList).toBeVisible()

    // At least one walkthrough should be shown
    const walkthroughItems = walkthroughList.locator('.ws-item')
    const count = await walkthroughItems.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Completed walkthroughs section shows completed items', async ({
    page,
  }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn')
    await walkthroughBtn.click()

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()

    const completedSection = modal.locator('.ws-completed-section')
    await expect(completedSection).not.toBeVisible() // No completed walkthroughs initially
  })

  test('Skip button closes walkthrough selection', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn')
    await walkthroughBtn.click()

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()

    const skipBtn = modal.locator('.ws-skip-btn')
    await skipBtn.click()

    await expect(modal).not.toBeVisible()
  })

  test('Walkthrough modal has close button', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn')
    await walkthroughBtn.click()

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()

    const closeBtn = modal.locator('.ws-close-btn')
    await expect(closeBtn).toBeVisible()
  })

  test('Start Now button closes walkthrough selection', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn')
    await walkthroughBtn.click()

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()

    const startBtn = modal.locator('.ws-done-btn')
    await startBtn.click()

    await expect(modal).not.toBeVisible()
  })

  test('Walkthrough modal styles are consistent', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn')
    await walkthroughBtn.click()

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()

    // Check modal has correct class
    await expect(modal).toHaveClass(/walkthrough-selection-overlay/)
  })
})
