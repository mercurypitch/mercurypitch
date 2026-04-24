// ============================================================
// Recursion Detection E2E Test — Detects too much recursion errors
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Recursion Detection', () => {
  test('Quick Start → Presets Library → Session Start detects recursion', async ({
    page,
    context,
  }) => {
    // Capture console errors
    const consoleErrors: string[] = []

    // Listen to console errors from the page
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        consoleErrors.push(text)
        console.error('[PAGE CONSOLE ERROR]:', text)
      }
    })

    // Also capture errors from the browser console
    context.on('page', (newPage) => {
      newPage.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
          console.error('[PAGE ERROR]:', msg.text())
        }
      })
    })

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

    test.afterEach(async () => {
      // Check for recursion errors after test
      const recursionErrors = consoleErrors.filter(
        (err) =>
          err.includes('too much recursion') || err.includes('InternalError'),
      )

      if (recursionErrors.length > 0) {
        console.error('RECURSION ERRORS DETECTED:', recursionErrors)
        throw new Error(
          `Detected ${recursionErrors.length} recursion errors:\n` +
            recursionErrors.map((e) => `  - ${e}`).join('\n'),
        )
      }
    })

    test('Start from Quick Start button → Presets modal → Session Start', async ({
      page,
    }) => {
      // Go to practice tab
      await switchTab(page, 'practice')
      await page.waitForTimeout(500)

      // Look for Quick Start button
      const quickStartBtn = page.locator(
        '.quick-action-btn:has-text("Quick Start")',
      )
      await expect(quickStartBtn).toBeVisible()
      await quickStartBtn.click()

      // Wait for presets modal to open
      await page.waitForTimeout(500)

      // Check if presets modal is visible
      const presetsModal = page.locator(
        '.presets-modal, .preset-list, .session-list',
      )
      const presetsVisible = (await presetsModal.count()) > 0
      if (!presetsVisible) {
        // Try alternative selectors
        const altModal = page.locator('.modal-overlay').first()
        const altVisible = await altModal.isVisible()
        if (!altVisible) {
          throw new Error('Presets modal did not open')
        }
      }

      // Click "Start" on the first available session
      const startBtn = page.locator('button:has-text("Start")').first()
      await expect(startBtn).toBeVisible()

      // Click Start button - this loads a session
      await startBtn.click()

      // Wait longer for playback to start and check for recursion
      await page.waitForTimeout(3000)

      // Verify we're still in practice mode
      const practiceTab = page.locator('#tab-practice')
      await expect(practiceTab).toHaveClass(/active/)
    })

    test('Quick Start → Presets Library → Play preset session', async ({
      page,
    }) => {
      await switchTab(page, 'practice')
      await page.waitForTimeout(500)

      const quickStartBtn = page.locator(
        '.quick-action-btn:has-text("Quick Start")',
      )
      await quickStartBtn.click()

      await page.waitForTimeout(500)

      // Look for session items
      const sessionItems = page.locator('.session-card, .preset-card')
      const count = await sessionItems.count()

      if (count > 0) {
        // Click the first session's Start button
        const startBtn = sessionItems
          .first()
          .locator('button:has-text("Start")')
        await startBtn.click()

        // Wait for playback
        await page.waitForTimeout(3000)

        // Check practice tab is still active
        await expect(page.locator('#tab-practice')).toHaveClass(/active/)
      }
    })

    test('Multiple rapid navigation cycles to catch cascading recursion', async ({
      page,
    }) => {
      await switchTab(page, 'practice')
      await page.waitForTimeout(500)

      // Quick Start button
      const quickStartBtn = page.locator(
        '.quick-action-btn:has-text("Quick Start")',
      )
      await quickStartBtn.click()
      await page.waitForTimeout(500)

      // Close and reopen multiple times
      for (let i = 0; i < 5; i++) {
        const modalOverlay = page.locator('.modal-overlay').first()
        await modalOverlay.click({ position: { x: 10, y: 10 } })
        await page.waitForTimeout(300)

        // Open again
        quickStartBtn.click()
        await page.waitForTimeout(300)
      }

      await page.waitForTimeout(1000)
    })
  })
})
