// ============================================================
// Piano Night's settings sheet waits below the phone's nav
// ============================================================
// On a phone the controls are a bottom sheet anchored on the nav, and the
// nav stays usable while it is up: it marks which panel is open and a second
// press puts it away. Closed, the sheet was moved down by 102% of its own
// height from the nav's top, which parked its top line inside the nav's
// band. It is invisible there, but it is a layer over the nav (the sheet
// stacks above it), and it came up across the nav each time it opened. The
// sheet now waits wholly below the screen and comes up from behind the nav.

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type Rect = { left: number; top: number; right: number; bottom: number }

const rectOf = (page: Page, selector: string): Promise<Rect> =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const r = element.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    })

const intersects = (a: Rect, b: Rect): boolean =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5

const NAV = 'nav[aria-label="Piano Night mobile navigation"]'
const SHEET = '#piano-night-settings'

test.use({ hasTouch: true, isMobile: true })

async function openRoom(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size)
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/piano-night', { waitUntil: 'domcontentloaded' })
  await expect(page.locator(NAV)).toBeVisible()
}

for (const size of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`keeps the closed sheet off the nav at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    // Arrange
    await openRoom(page, size)

    // Act
    const nav = await rectOf(page, NAV)
    const sheet = await rectOf(page, SHEET)
    const topLine = await rectOf(page, `${SHEET} > div`)

    // Assert
    expect(intersects(nav, topLine)).toBe(false)
    expect(intersects(nav, sheet)).toBe(false)
    expect(sheet.top).toBeGreaterThanOrEqual(size.height)
  })
}

test('opens the sheet onto the nav and from behind it, leaving the nav to answer', async ({
  page,
}) => {
  // Arrange
  await openRoom(page, { width: 390, height: 844 })
  const settings = page
    .locator(NAV)
    .getByRole('button', { name: 'Open Piano Night settings' })

  // Act
  await settings.click()
  await expect(page.locator(SHEET)).toHaveCSS('opacity', '1')
  await expect(page.locator(SHEET)).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 0)',
  )

  // Assert: the open sheet stands on the nav's top edge, not over it
  const nav = await rectOf(page, NAV)
  const sheet = await rectOf(page, SHEET)
  expect(Math.abs(sheet.bottom - nav.top)).toBeLessThan(1)
  // ...and the nav is the layer above it, so the sheet's travel passes
  // behind the nav rather than over its buttons.
  const zIndex = (selector: string): Promise<number> =>
    page
      .locator(selector)
      .evaluate((element) => Number(getComputedStyle(element).zIndex))
  const stack = { nav: await zIndex(NAV), sheet: await zIndex(SHEET) }
  expect(stack.nav).toBeGreaterThan(stack.sheet)
  // Every nav button still takes a press at its centre.
  const answers = await page
    .locator(`${NAV} button, ${NAV} a`)
    .evaluateAll((items) =>
      items
        .filter((item) => item.getBoundingClientRect().width > 0)
        .map((item) => {
          const r = item.getBoundingClientRect()
          const hit = document.elementFromPoint(
            r.left + r.width / 2,
            r.top + r.height / 2,
          )
          return hit !== null && (hit === item || item.contains(hit))
        }),
    )
  expect(answers.length).toBeGreaterThan(0)
  expect(answers.every(Boolean)).toBe(true)
  await expect(settings).toHaveAttribute('aria-expanded', 'true')
})
