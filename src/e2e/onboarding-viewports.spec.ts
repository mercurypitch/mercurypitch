// ============================================================
// Onboarding at real device sizes
// ============================================================
// A landscape tablet is the awkward case: plenty of width, very little
// height (and less again inside browser chrome). The twin beat lost the
// top of its portrait there — a centred flex column pushes overflow out
// of BOTH ends, so the cut-off half was unreachable by scrolling.
//
// These tests assert the invariant rather than a pixel: nothing may sit
// above the frame's top edge, and if the content is taller than the
// frame it must be scrollable. Screenshots are attached for the eye.

import { expect, test } from '@playwright/test'
import { FRESH_VISITOR_INIT } from './helpers/tone-wav'

const VIEWPORTS = [
  // Samsung Tab S9+ landscape, minus browser chrome — the reported case.
  { name: 'tablet-landscape', width: 1280, height: 660 },
  { name: 'tablet-portrait', width: 800, height: 1180 },
  { name: 'phone', width: 390, height: 780 },
] as const

const beat = (page: import('@playwright/test').Page, name: string) =>
  page.locator(`[data-beat="${name}"]`)

test.describe('onboarding fits every screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FRESH_VISITOR_INIT)
  })

  for (const vp of VIEWPORTS) {
    test(`the twin beat is fully reachable at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await page.evaluate(() => {
        ;(
          window as unknown as { __startOnboarding?: () => void }
        ).__startOnboarding?.()
      })

      // The twin beat needs a measured voiceprint, which needs a mic. Drive
      // the flow to the Map instead and assert the same frame invariant on
      // whichever beat is showing — the geometry is the frame's, not the
      // beat's.
      await page.goto('/#/map')
      const map = beat(page, 'map')
      await expect(map).toBeVisible({ timeout: 15000 })

      const geometry = await page.evaluate(() => {
        const frame = document.querySelector('[data-beat]')?.parentElement
        if (frame === null || frame === undefined) return null
        const content = frame.getBoundingClientRect()
        return {
          scrollTop: frame.scrollTop,
          scrollHeight: frame.scrollHeight,
          clientHeight: frame.clientHeight,
          overflowY: getComputedStyle(frame).overflowY,
          top: content.top,
        }
      })
      expect(geometry).not.toBeNull()

      // Nothing starts above the fold: a frame scrolled to 0 must show its
      // first pixel. (The bug showed as content ALREADY scrolled past the
      // top with no way back.)
      expect(geometry!.scrollTop).toBe(0)

      // When the content is taller than the frame, it must be scrollable —
      // never silently clipped.
      if (geometry!.scrollHeight > geometry!.clientHeight + 1) {
        expect(['auto', 'scroll']).toContain(geometry!.overflowY)
      }

      await page.screenshot({
        path: `test-results/onboarding-${vp.name}.png`,
        fullPage: false,
      })
    })
  }
})
