// ============================================================
// Exercises on a short, wide screen
// ============================================================
//
// A tablet used as a small laptop is the awkward case: plenty of width,
// very little height, and less again once the browser chrome takes its
// cut. `onboarding-viewports.spec.ts` already pins this invariant for the
// onboarding frame; the exercise stage had the same defect and no test.
//
// Two separate faults produced one symptom (Start off-screen, no way to
// scroll to it):
//
//   1. The idle panel centred its column with `justify-content: center`
//      inside `overflow: hidden`. Centred overflow spills past BOTH edges,
//      so the parts that did not fit were unreachable — a scrollbar cannot
//      reach content above the start edge.
//   2. The note dial was sized from viewport WIDTH only
//      (`clamp(232px, 68vw, 300px)`), so a screen with 660px of height
//      still gave it 300px of that height.
//
// The fix for (1) was gated behind `@media (max-width: 768px)`, which is
// why a phone was fine and a tablet was not: the condition was never
// "narrow", it was "the content does not fit".
//
// These assert reachability rather than pixels — can a singer actually
// press Start — plus the frame invariant, so a future regression in either
// direction is caught.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

const VIEWPORTS = [
  // Samsung Tab S9+ landscape, minus browser chrome — the reported case.
  { name: 'tab-s9-landscape', width: 1280, height: 660 },
  // A meaner one: the same tablet with more chrome, or a small netbook.
  { name: 'short-laptop', width: 1024, height: 560 },
] as const

/** The idle scroll container's geometry, as the browser computes it. */
async function frameGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const frame = document.querySelector('.exercise-canvas-area')
    if (frame === null) return null
    const style = getComputedStyle(frame)
    return {
      scrollTop: frame.scrollTop,
      scrollHeight: frame.scrollHeight,
      clientHeight: frame.clientHeight,
      overflowY: style.overflowY,
    }
  })
}

test.describe('the exercise stage fits a short, wide screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
  })

  for (const vp of VIEWPORTS) {
    test(`Start is reachable at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await page.waitForSelector('#tab-exercises', { timeout: 15000 })
      await dismissOverlays(page)

      await page.locator('#tab-exercises').click()
      // Long Note carries the note dial, which is the tallest idle setup.
      await page
        .locator('.exercise-card', { hasText: 'Long Note' })
        .first()
        .click()

      const start = page.locator('.exercise-idle-start')
      await expect(start).toBeVisible({ timeout: 10000 })

      // The whole point: a singer has to be able to get to it. If the
      // container cannot scroll, this cannot succeed.
      await start.scrollIntoViewIfNeeded()
      await expect(start).toBeInViewport()

      const geometry = await frameGeometry(page)
      expect(geometry).not.toBeNull()

      // Content taller than the frame must be scrollable, never clipped.
      if (geometry!.scrollHeight > geometry!.clientHeight + 1) {
        expect(['auto', 'scroll']).toContain(geometry!.overflowY)
      }

      await page.screenshot({
        path: `test-results/exercise-idle-${vp.name}.png`,
      })
    })

    test(`the dial leaves room to breathe at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await page.waitForSelector('#tab-exercises', { timeout: 15000 })
      await dismissOverlays(page)

      await page.locator('#tab-exercises').click()
      await page
        .locator('.exercise-card', { hasText: 'Long Note' })
        .first()
        .click()
      await expect(page.locator('.exercise-idle-start')).toBeVisible({
        timeout: 10000,
      })

      // The dial is square and shares the column with Start. Letting it eat
      // more than about half the viewport height is what pushed Start out,
      // so cap the share rather than the pixel size.
      const dialHeight = await page.evaluate(() => {
        const svg = document.querySelector('svg[class*="face"]')
        return svg === null ? null : svg.getBoundingClientRect().height
      })
      if (dialHeight !== null) {
        expect(dialHeight).toBeLessThanOrEqual(vp.height * 0.5)
      }
    })
  }
})
