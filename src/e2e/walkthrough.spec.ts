// ============================================================
// Walkthrough E2E Tests
// Tests for Learn modal (walkthrough chapters)
// ============================================================
//
// The selection modal is opened from Home's header, not the sidebar. It
// used to live in the sidebar next to Guide and Tour, and this spec still
// clicked the first `.walkthroughControlBtn` it found there — which after
// the move is the Guide button, so every test that expected the selection
// overlay was clicking something else entirely and waiting for a modal
// nobody had opened. Six of them failed on every push to main from
// 46ed37c4 onward, unnoticed because PR branches only run `--grep @smoke`
// and this spec carries no smoke tag: the full suite runs on main alone,
// which is the one place a red gate blocks nothing.
//
// Driving it through `data-testid="home-learn"` keeps the spec honest about
// where the control actually is; the class-based selectors below stay as
// they are, because they describe the modal, which did not move.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

const SELECTION_OVERLAY =
  '[class*="walkthroughSelectionOverlay"], .walkthrough-selection-overlay'

test.describe('Walkthrough Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  /** Home is the default tab, so the Learn button is already on screen. */
  const openSelection = async (page: import('@playwright/test').Page) => {
    await page.getByTestId('home-learn').click()
    const modal = page.locator(SELECTION_OVERLAY)
    await expect(modal).toBeVisible()
    return modal
  }

  test('Learn control button exists in the Home header', async ({ page }) => {
    await expect(page.getByTestId('home-learn')).toBeVisible()
  })

  test('Clicking Learn opens the selection modal', async ({ page }) => {
    await openSelection(page)
  })

  test('Walkthrough selection shows progress text', async ({ page }) => {
    await openSelection(page)

    const progressText = page.locator(
      '[class*="wsProgressText"], .ws-progress-text',
    )
    await expect(progressText).toBeVisible()
  })

  test('Walkthrough modal shows chapter items', async ({ page }) => {
    await openSelection(page)

    const chapters = page.locator('[class*="wsChapterItem"], .ws-chapter-item')
    await expect(chapters.first()).toBeVisible()
  })

  test('Close button closes walkthrough selection', async ({ page }) => {
    const modal = await openSelection(page)

    const closeBtn = modal.locator('[class*="wsCloseBtn"], .ws-close-btn')
    await closeBtn.click()
    await expect(modal).toBeHidden()
  })

  test('Footer Got it button closes walkthrough selection', async ({
    page,
  }) => {
    const modal = await openSelection(page)

    const footerBtn = modal.locator(
      '[class*="wsCloseFooter"], .ws-close-footer',
    )
    await footerBtn.click()
    await expect(modal).toBeHidden()
  })

  test('Walkthrough modal has correct class', async ({ page }) => {
    const modal = await openSelection(page)

    await expect(modal).toHaveClass(
      /walkthroughSelectionOverlay|walkthrough-selection-overlay/,
    )
  })

  test('The sidebar still offers Guide, which is not the walkthrough', async ({
    page,
  }) => {
    // The button this spec used to click. It opens the guide-tour picker,
    // and the distinction is exactly what went unnoticed for a day.
    const guideBtn = page
      .locator('[class*="walkthroughControlBtn"], .walkthrough-control-btn')
      .first()
    await expect(guideBtn).toBeVisible()
    await expect(guideBtn).toContainText('Guide')
    await guideBtn.click()
    await expect(page.locator(SELECTION_OVERLAY)).toHaveCount(0)
  })
})
