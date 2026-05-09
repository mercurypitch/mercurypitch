// ============================================================
// Recursion Detection E2E Test — Detects too much recursion errors
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Recursion Detection (Quick Start removed)', () => {
  test('Quick Start feature removed - skipped', async ({ page, context }) => {
    // Skip this test as Quick Start button was removed
    test.skip()
  })

  test('Start from Quick Start button → Presets modal → Session Start', async ({
    page,
  }) => {
    // Skip this test as Quick Start button was removed
    test.skip()
  })

  // GH #198: Skip all Quick Start related tests - feature removed

  test('Quick Start → Presets Library → Play preset session', async ({
    page,
  }) => {
    await switchTab(page, 'singing')
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
      const startBtn = sessionItems.first().locator('button:has-text("Start")')
      await startBtn.click()

      // Wait for playback
      await page.waitForTimeout(3000)

      // Check practice tab is still active
      await expect(page.locator('#tab-singing')).toHaveClass(/active/)
    }
  })

  test.skip('Quick Start multiple navigation cycles - feature removed', async ({
    page,
  }) => {
    // Skip this test as Quick Start button was removed
    test.skip()
  })
})
