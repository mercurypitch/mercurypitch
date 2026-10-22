// ============================================================
// Walkthrough E2E Tests
// Tests for Learn modal (walkthrough chapters)
// ============================================================
//
// The selection modal is opened from the sidebar's Learn button, beside
// Guide and Tour. It spent a release in Home's header, next to the Find Your
// Pitch "Lessons" link; two controls both called learn led to different
// places, so Learn went back to the sidebar and Home keeps Lessons.
//
// History worth keeping: while Learn was on Home, this spec still clicked the
// first `.walkthroughControlBtn` in the sidebar, which by then was Guide, so
// every test that expected the selection overlay was clicking something else
// entirely. Six of them failed on every push to main from 46ed37c4 onward,
// unnoticed because PR branches only run `--grep @smoke` and this spec carries
// no smoke tag: the full suite runs on main alone. Driving it through
// `data-testid="sidebar-learn"` keeps the spec honest about where the control
// is; the class-based selectors below describe the modal, which did not move.

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

  /** The desktop rail is open on every tab, Home included. */
  const openSelection = async (page: import('@playwright/test').Page) => {
    await page.getByTestId('sidebar-learn').click()
    const modal = page.locator(SELECTION_OVERLAY)
    await expect(modal).toBeVisible()
    return modal
  }

  test('Learn control button exists in the sidebar', async ({ page }) => {
    await expect(page.getByTestId('sidebar-learn')).toBeVisible()
  })

  test('Home keeps Lessons and no longer shows Learn', async ({ page }) => {
    await expect(page.getByTestId('home-lessons')).toBeVisible()
    await expect(page.getByTestId('home-learn')).toHaveCount(0)
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
    // The button this spec once clicked by position. It opens the guide-tour
    // picker, and the distinction is exactly what went unnoticed for a day;
    // Learn sits before it now, so it is found by its name.
    const guideBtn = page
      .locator('[class*="walkthroughControlBtn"], .walkthrough-control-btn')
      .filter({ hasText: 'Guide' })
    await expect(guideBtn).toBeVisible()
    await guideBtn.click()
    await expect(page.locator(SELECTION_OVERLAY)).toHaveCount(0)
  })
})
