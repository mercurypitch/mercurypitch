// ============================================================
// Session Editor E2E Tests
// Tests for collapsible interface, melody library, and timeline
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Session Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
    // Switch to compose tab via the store bridge
    await switchTab(page, 'compose')
    await page.waitForTimeout(500)
    // Click the "Session Editor" view toggle
    const viewBtn = page.locator('[data-testid="view-session-editor"]')
    await expect(viewBtn).toBeVisible({ timeout: 5000 })
    await viewBtn.click()
    // Wait for lazy-loaded SessionEditor component to render
    await page.waitForSelector('[data-testid="session-editor"]', {
      timeout: 5000,
    })
  })

  test('Session Editor is visible in editor tab', async ({ page }) => {
    await expect(page.locator('[data-testid="session-editor"]')).toBeVisible()
  })

  test('Session Editor header shows title', async ({ page }) => {
    await expect(
      page.locator('[data-testid="session-editor-title"]'),
    ).toContainText('Session Editor')
  })

  test('Session Editor is expanded by default', async ({ page }) => {
    await expect(
      page.locator('[data-testid="session-editor-content"]'),
    ).toBeVisible()
  })

  test('Clicking header collapses session editor', async ({ page }) => {
    // The header toggles expand/collapse
    await page.locator('[data-testid="session-editor-header"]').click()
    await page.waitForTimeout(500)
    await expect(
      page.locator('[data-testid="session-editor-content"]'),
    ).not.toBeVisible()
  })

  test('Clicking header re-expands session editor', async ({ page }) => {
    const header = page.locator('[data-testid="session-editor-header"]')
    // Collapse
    await header.click()
    await page.waitForTimeout(500)
    // Re-expand
    await header.click()
    await page.waitForTimeout(500)
    await expect(
      page.locator('[data-testid="session-editor-content"]'),
    ).toBeVisible()
  })

  test('Melody library shows search input', async ({ page }) => {
    await expect(
      page.locator('[data-testid="melody-search-input"]'),
    ).toBeVisible()
  })

  test('Search input accepts text', async ({ page }) => {
    const searchInput = page.locator('[data-testid="melody-search-input"]')
    await searchInput.fill('test')
    await expect(searchInput).toHaveValue('test')
  })

  test('Timeline section shows section heading', async ({ page }) => {
    // Timeline section heading is within the session editor content
    await expect(
      page.locator(
        '[data-testid="session-editor-content"] h4:has-text("Session Timeline")',
      ),
    ).toBeVisible()
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
    // The session select is inside the header's title div
    const selects = page.locator(
      '[data-testid="session-editor"] .session-select',
    )
    await expect(selects.first()).toBeAttached()
  })
})
