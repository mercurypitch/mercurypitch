// ============================================================
// A drill is still a drill with the phone turned sideways
// ============================================================
//
// A phone in landscape is wide and short. The old stage sized itself by
// width, so at 844x390 its console was laid out for a screen twice as tall
// and covered the exercise body completely: 274px of 390. Merc's room (the
// web's face of the Ear Lab since Nov 2026) stacked its console under
// the stage the same way and took 254px of 390, so on a short screen held
// sideways it stands the console beside the stage (merc/room.module.css).
//
// The assertion is the relationship, not the numbers: the console may not
// take more of the screen than it leaves, and the instrument has to be on
// screen and clear of it. Pinning "console <= 161px" would fail the first
// time a drill adds a row, and would still pass if the stage went to zero.

import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab } from './helpers/ui'

/** An iPhone-class handset on its side. */
test.use({ viewport: { width: 844, height: 390 } })

test('leaves the instrument on screen in landscape @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await page.waitForSelector('#app-tabs', { timeout: 10_000 })
  await dismissOverlays(page)

  await openNavTab(page, 'tab-ear-lab')
  await page
    .locator('[data-testid="merc-station"][data-faculty="resolution"]')
    .click()
  await page
    .getByTestId('merc-station-row')
    .filter({ hasText: 'Hairline' })
    .first()
    .click()
  await expect(page.getByTestId('ear-stage')).toBeVisible()

  const firstPad = page.locator(
    '[data-testid="ear-stage-pads"] button:not([disabled])',
    { hasText: 'The first' },
  )
  await expect(firstPad).toBeVisible({ timeout: 20_000 })

  // Answer one, because the verdict is half the problem: Merc's bubble
  // grows to say it, and that is the console at its tallest. Measuring the
  // first question measures the one console that never persists.
  await firstPad.click()
  await expect(page.getByTestId('ear-stage')).toHaveAttribute(
    'data-beat',
    'reveal',
    { timeout: 10_000 },
  )

  const layout = await page.evaluate(() => {
    const room = document.querySelector('[data-testid="ear-stage"]')
    const consoleEl = document.querySelector(
      '[data-testid="ear-stage-console"]',
    )
    const figure = room?.querySelector('figure') ?? null
    const drawn = figure?.querySelector('svg') ?? figure
    if (room === null || consoleEl === null || drawn === null) return null
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect()
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }
    }
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      console: box(consoleEl),
      figure: box(drawn),
    }
  })

  expect(layout, 'could not measure the room').not.toBe(null)
  if (layout === null) return
  const { viewport, console: desk, figure } = layout

  // How much of the screen the console claims: at 274 of 390 there was
  // nothing left to see; the drill has to get at least half of it back.
  expect(
    desk.width * desk.height,
    'the console takes more of a landscape screen than it leaves for the drill',
  ).toBeLessThan((viewport.width * viewport.height) / 2)

  // And the room it gives back reaches the instrument, rather than being
  // absorbed by padding: a figure clamped to nothing would satisfy the
  // check above while leaving the drill just as unreadable.
  expect(
    figure.height,
    'the instrument has been squeezed to nothing',
  ).toBeGreaterThanOrEqual(80)

  // The instrument is on the screen and clear of the console, above it or
  // beside it, and the console ends on the screen.
  const clear =
    desk.left >= figure.right - 1 ||
    figure.left >= desk.right - 1 ||
    desk.top >= figure.bottom - 1
  expect(clear, 'the console covers the instrument').toBe(true)
  expect(figure.top).toBeGreaterThanOrEqual(0)
  expect(figure.bottom).toBeLessThanOrEqual(viewport.height + 1)
  expect(desk.bottom).toBeLessThanOrEqual(viewport.height + 1)
})
