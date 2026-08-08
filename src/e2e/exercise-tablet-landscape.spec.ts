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

/**
 * Opens Guided Warmup — the busiest idle column: two description lines, the
 * routine pills AND the dial — and asserts its text blocks stack instead of
 * overlapping. Browser zoom shrinks the CSS viewport, so a heavily zoomed
 * tablet behaves like an even shorter screen; the failure mode there is not
 * clipping but *collapse*. The idle column is a flex item, and once it must
 * shrink, its children give up their height while their text keeps
 * rendering — the description printed across the ROUTINE label.
 */
async function assertIdleTextStacks(
  page: import('@playwright/test').Page,
  width: number,
  height: number,
) {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await page.waitForSelector('#tab-exercises', { timeout: 15000 })
  await dismissOverlays(page)

  await page.locator('#tab-exercises').click()
  await page
    .locator('.exercise-card', { hasText: 'Guided Warmup' })
    .first()
    .click()
  await expect(page.locator('.exercise-idle-start')).toBeVisible({
    timeout: 10000,
  })

  const rects = await page.evaluate(() => {
    const blocks = [
      ...document.querySelectorAll(
        '.exercise-idle-placeholder p, .routine-picker-label, .exercise-idle-start',
      ),
    ]
    return blocks.map((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, height: r.height }
    })
  })
  expect(rects.length).toBeGreaterThanOrEqual(4)

  // Reading order must also be stacking order: each block starts below the
  // one before it. Two blocks sharing pixels is the reported bug.
  for (let i = 1; i < rects.length; i++) {
    expect
      .soft(
        rects[i].top,
        `block ${i} starts above the bottom of block ${i - 1}`,
      )
      .toBeGreaterThanOrEqual(rects[i - 1].bottom - 2)
  }
  // And no block may be squeezed to a sliver of its text.
  for (const r of rects) {
    expect.soft(r.height).toBeGreaterThan(10)
  }
}

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

    test(`idle text never overlaps at ${vp.name}`, async ({ page }) => {
      await assertIdleTextStacks(page, vp.width, vp.height)
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

  // The reported case: a tablet zoomed far in. Zoom scales the CSS viewport
  // down, so 1280x660 at ~150% zoom lays out like this.
  test('idle text never overlaps when heavily zoomed (1280x420)', async ({
    page,
  }) => {
    await assertIdleTextStacks(page, 1280, 420)
  })
})
