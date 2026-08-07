// ============================================================
// A running exercise on a short, wide screen
// ============================================================
//
// The companion to exercise-tablet-landscape.spec.ts, split off because
// `launchOptions` is file-scoped in Playwright: a real run needs the fake
// microphone, and the idle tests must not pay for a browser relaunch.
//
// Idle and active fail differently. Idle overflows because the setup column
// has no height limit. Active is the opposite problem — the tracker and the
// exercise's own metrics are sized to the card, so when the card gets short
// they compete, and what loses is either the tracker (squeezed to an
// unreadable band) or the Stop button (pushed behind the fold). Being unable
// to END a run is worse than being unable to start one.
//
// Reachability alone is too weak a test here: Stop is absolutely positioned
// at the card's bottom edge, so it answers "visible" even when the card has
// clipped everything above it. These assert the frame invariant as well —
// content taller than the card must be scrollable, never clipped.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

const VIEWPORTS = [
  { name: 'tab-s9-landscape', width: 1280, height: 660 },
  { name: 'short-laptop', width: 1024, height: 560 },
] as const

test.describe('a running exercise fits a short, wide screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
      localStorage.setItem('pitchperfect_advanced_features', 'true')
    })
  })

  for (const vp of VIEWPORTS) {
    test(`Stop stays reachable at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await page.waitForSelector('#tab-exercises', { timeout: 15000 })
      await dismissOverlays(page)

      await page.locator('#tab-exercises').click()
      await page
        .locator('.exercise-card', { hasText: 'Long Note' })
        .first()
        .click()

      const start = page.locator('.exercise-btn-primary:has-text("Start")')
      await expect(start).toBeVisible({ timeout: 10000 })
      await start.scrollIntoViewIfNeeded()
      await start.click()

      const stop = page.locator('.exercise-btn-stop')
      await expect(stop).toBeVisible({ timeout: 15000 })
      await stop.scrollIntoViewIfNeeded()
      await expect(stop).toBeInViewport()

      const frame = await page.evaluate(() => {
        const area = document.querySelector('.exercise-canvas-area')
        if (area === null) return null
        const style = getComputedStyle(area)
        return {
          scrollTop: area.scrollTop,
          scrollHeight: area.scrollHeight,
          clientHeight: area.clientHeight,
          overflowY: style.overflowY,
        }
      })
      expect(frame).not.toBeNull()

      // Whatever does not fit has to be reachable. A clipped card is how the
      // run became unusable in the first place.
      if (frame!.scrollHeight > frame!.clientHeight + 1) {
        expect(['auto', 'scroll']).toContain(frame!.overflowY)
      }

      // Fitting is not the same as being usable. The card also has to give the
      // exercise's own visuals room, which is what the short-viewport
      // treatment is for: a compact tracker with a floor (never squeezed to an
      // unreadable band, never the full 200px band either) and Stop moved out
      // of the centre so it stops landing on the metrics row underneath.
      const layout = await page.evaluate(() => {
        const tracker = document.querySelector('.exercise-pitch-tracker')
        const stop = document.querySelector('.exercise-btn-stop')
        return {
          trackerHeight:
            tracker === null ? null : tracker.getBoundingClientRect().height,
          stopCentreX:
            stop === null
              ? null
              : stop.getBoundingClientRect().left +
                stop.getBoundingClientRect().width / 2,
          viewportWidth: window.innerWidth,
        }
      })
      if (layout.trackerHeight !== null) {
        expect(layout.trackerHeight).toBeGreaterThanOrEqual(140)
        expect(layout.trackerHeight).toBeLessThanOrEqual(160)
      }
      expect(layout.stopCentreX).not.toBeNull()
      expect(layout.stopCentreX!).toBeGreaterThan(layout.viewportWidth * 0.6)

      await page.screenshot({
        path: `test-results/exercise-active-${vp.name}.png`,
      })
    })
  }
})
