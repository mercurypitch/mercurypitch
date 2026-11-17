// ============================================================
// The instrument holds still through a run
// ============================================================
//
// On the old stage the body centred the instrument in the height the
// console left it, so every pixel the console gained lifted the instrument
// by half a pixel: on a phone Hairline rose 12.5px when the question took
// two lines and about 41px when the first verdict arrived. Merc's room (the
// web's face of the Ear Lab since Nov 2026) stands the instrument at the
// top of its stage, under the run line, so when Merc's bubble grows at the
// verdict it grows into the room under the instrument, which stays where
// it was (merc/room.module.css, .figure).

import { expect, test, type Page } from '@playwright/test'
import { dismissOverlays, openNavTab } from './helpers/ui'

/** Where the instrument's top edge is, once the frame has been laid out. */
function instrumentTop(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        // Two frames: a state that has just changed is laid out by then.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const svg = document.querySelector(
              '[data-testid="ear-stage"] figure svg',
            )
            resolve(svg === null ? Number.NaN : svg.getBoundingClientRect().top)
          }),
        )
      }),
  )
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`keeps Hairline's instrument still from question to verdict at ${viewport.width}x${viewport.height} @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
    })
    // Through the tab bar rather than /ear-lab: the built site has a real
    // dist/ear-lab/ directory of room art, and the static server answers
    // that path with its listing instead of the app.
    await page.goto('/')
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
    const room = page.getByTestId('ear-stage')
    await expect(room).toBeVisible()

    const armed = page.locator(
      '[data-testid="ear-stage-pads"] button:not([disabled])',
      { hasText: 'The first' },
    )

    const tops: Record<string, number> = {}
    for (const trial of [1, 2]) {
      await expect(armed).toBeVisible({ timeout: 20_000 })
      tops[`question ${trial}`] = await instrumentTop(page)
      await armed.click()
      await expect(room).toHaveAttribute('data-beat', 'reveal')
      tops[`verdict ${trial}`] = await instrumentTop(page)
      // A right answer moves on after the hold, by Merc's rule; a wrong
      // one waits for Next.
      if (trial === 1) {
        const next = page.getByTestId('merc-next')
        if (await next.isVisible()) await next.click()
      }
    }

    const values = Object.values(tops)
    expect(values.every(Number.isFinite), JSON.stringify(tops)).toBe(true)
    expect(
      Math.max(...values) - Math.min(...values),
      `the instrument moved: ${JSON.stringify(tops)}`,
    ).toBeLessThanOrEqual(1)
  })
}
