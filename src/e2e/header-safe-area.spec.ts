// ============================================================
// The app header stays out of the iOS status bar
// ============================================================
//
// Installed to the home screen the app runs standalone with
// `viewport-fit=cover`, so the document extends under the status bar and
// `env(safe-area-inset-top)` is the only thing keeping chrome clear of it.
// The header carried that inset in mobile-polish.css as `padding-top`, and
// AppHeader.css — which loads later and matches at the same specificity —
// set the `padding` SHORTHAND, resetting it. The inset was silently dropped:
// the title and the account/support pills rendered inside the translucent
// strip, unreadable and out of reach of a tap.
//
// The insets are driven through `--safe-top` / `--safe-right`, the tokens
// every safe-area rule reads, so the test can stand in for a notch that a
// desktop browser never reports. That is the point of the token indirection
// — without it this bug is only reproducible on real hardware.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

/** A Dynamic Island iPhone in portrait. */
const STATUS_BAR = 59

test.use({ viewport: { width: 390, height: 844 } })

test('keeps the header title and account pills clear of the status bar @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/#/karaoke')
  await dismissOverlays(page)
  await expect(page.locator('header')).toBeVisible()

  const measure = async (safeTop: number) =>
    page.evaluate((inset) => {
      const root = document.documentElement
      if (inset > 0) root.style.setProperty('--safe-top', `${inset}px`)
      else root.style.removeProperty('--safe-top')
      const header = document.querySelector('header')
      if (header === null) throw new Error('no header')
      const rect = (selector: string): number | null => {
        const found = document.querySelector(selector)
        return found === null ? null : found.getBoundingClientRect().top
      }
      const value = {
        headerTop: header.getBoundingClientRect().top,
        headerHeight: header.getBoundingClientRect().height,
        titleTop: rect('.app-title'),
        supportTop: rect('.header-support'),
      }
      root.style.removeProperty('--safe-top')
      return value
    }, safeTop)

  const flat = await measure(0)
  const notched = await measure(STATUS_BAR)

  // The header itself starts at the very top in both cases — it is the
  // content inside it that has to move, not the bar.
  expect(flat.headerTop).toBe(0)
  expect(notched.headerTop).toBe(0)

  // Everything the singer reads or taps sits below the status bar.
  expect(
    notched.titleTop,
    'the app title renders inside the iOS status bar',
  ).toBeGreaterThanOrEqual(STATUS_BAR)
  expect(
    notched.supportTop,
    'the account and support pills render inside the iOS status bar, where they cannot be tapped',
  ).toBeGreaterThanOrEqual(STATUS_BAR)

  // The bar grows by the inset rather than absorbing it: absorbing it would
  // squash the 44px account target instead of moving it down.
  expect(notched.headerHeight - flat.headerHeight).toBeCloseTo(STATUS_BAR, 0)

  // No inset, no change — desktop and flat-topped phones keep today's header.
  expect(flat.titleTop).toBeLessThan(STATUS_BAR)
  expect(flat.supportTop).toBeLessThan(STATUS_BAR)
})
