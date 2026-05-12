// ============================================================
// Session Editor E2E Tests
// Tests for collapsible interface, melody library, and timeline
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

test.describe('Session Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
    // Click the Editor tab
    await page.locator('#tab-compose').click()
    await page.waitForTimeout(500)
    // Click the "Session Editor" view button
    await page.locator('button:has-text("Session Editor")').click()
    await page.waitForTimeout(500)
  })

  test('Session Editor is visible in editor tab', async ({ page }) => {
    await expect(page.locator('.session-editor')).toBeVisible()
  })

  test('Session Editor header shows title', async ({ page }) => {
    await expect(page.locator('.session-editor-title')).toContainText(
      'Session Editor',
    )
  })

  test('Session Editor is expanded by default', async ({ page }) => {
    await expect(page.locator('.session-editor-content')).toBeVisible()
    await expect(page.locator('.melody-library-section')).toBeVisible()
    await expect(page.locator('.timeline-section')).toBeVisible()
  })

  test('Clicking header collapses session editor', async ({ page }) => {
    // The header (not the toggle-btn) toggles expand/collapse
    await page.locator('.session-editor-header').click()
    await page.waitForTimeout(500)
    await expect(page.locator('.session-editor-content')).not.toBeVisible()
  })

  test('Clicking header re-expands session editor', async ({ page }) => {
    const header = page.locator('.session-editor-header')
    // Collapse
    await header.click()
    await page.waitForTimeout(500)
    // Re-expand
    await header.click()
    await page.waitForTimeout(500)
    await expect(page.locator('.session-editor-content')).toBeVisible()
  })

  test('Melody library shows search input', async ({ page }) => {
    await expect(page.locator('.search-input')).toBeVisible()
  })

  test('Search input accepts text', async ({ page }) => {
    const searchInput = page.locator('.search-input')
    await searchInput.fill('test')
    await expect(searchInput).toHaveValue('test')
  })

  test('Timeline section shows section heading', async ({ page }) => {
    const timelineHeadings = page.locator('.timeline-section .section-title')
    await expect(timelineHeadings).toBeVisible()
  })

  test('Rest duration input is visible', async ({ page }) => {
    await expect(page.locator('#rest-duration')).toBeVisible()
  })

  test('Rest duration can be changed', async ({ page }) => {
    const restInput = page.locator('#rest-duration')
    await restInput.fill('2000')
    await expect(restInput).toHaveValue('2000')
  })

  test('Session select in editor actions is visible', async ({ page }) => {
    // The session select is inside the header's actions div
    const selects = page.locator('.session-editor .session-select')
    await expect(selects.first()).toBeAttached()
  })
})
