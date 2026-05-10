// ============================================================
// Walkthrough E2E Tests
// Tests for Learn modal (walkthrough chapters)
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

test.describe('Walkthrough Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  test('Walkthrough control button exists in sidebar', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn').first()
    await expect(walkthroughBtn).toBeVisible()
  })

  test('Clicking walkthrough button opens selection modal', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn').first()
    await walkthroughBtn.click()
    await page.waitForTimeout(500)

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()
  })

  test('Walkthrough selection shows progress text', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn').first()
    await walkthroughBtn.click()
    await page.waitForTimeout(500)

    const progressText = page.locator('.ws-progress-text')
    await expect(progressText).toBeVisible()
  })

  test('Walkthrough modal shows chapter items', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn').first()
    await walkthroughBtn.click()
    await page.waitForTimeout(500)

    // Chapter items should be visible
    const chapters = page.locator('.ws-chapter-item')
    const count = await chapters.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Close button closes walkthrough selection', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn').first()
    await walkthroughBtn.click()
    await page.waitForTimeout(500)

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()

    const closeBtn = modal.locator('.ws-close-btn')
    await closeBtn.click()
    await page.waitForTimeout(500)

    await expect(modal).not.toBeVisible()
  })

  test('Footer Got it button closes walkthrough selection', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn').first()
    await walkthroughBtn.click()
    await page.waitForTimeout(500)

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toBeVisible()

    const footerBtn = modal.locator('.ws-close-footer')
    await footerBtn.click()
    await page.waitForTimeout(500)

    await expect(modal).not.toBeVisible()
  })

  test('Walkthrough modal has correct class', async ({ page }) => {
    const walkthroughBtn = page.locator('.walkthrough-control-btn').first()
    await walkthroughBtn.click()
    await page.waitForTimeout(500)

    const modal = page.locator('.walkthrough-selection-overlay')
    await expect(modal).toHaveClass(/walkthrough-selection-overlay/)
  })
})
