// ============================================================
// The instrument holds still through a run
// ============================================================
//
// The stage is a three-row grid (bar, body, console), and the body centres
// the instrument in the height the console leaves it, so every pixel the
// console gains lifts the instrument by half a pixel. On a phone Hairline
// rose 12.5px when the question took two lines and about 41px when the
// first verdict arrived under the pads; on a desk the key hint lifted it
// 8px each time the pads armed. The console now keeps room for its
// longest lines from the first question on.

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
      .locator('[data-tour="ear.drills"] button', { hasText: 'Hairline' })
      .first()
      .click()
    await expect(page.getByTestId('ear-stage')).toBeVisible()

    await page.getByText('Practice run').click()
    const armed = page.locator(
      '[data-testid="ear-stage-pads"] button:not([disabled])',
      { hasText: 'The first' },
    )
    await expect(armed).toBeVisible({ timeout: 10000 })

    // Auto-advance off, so each verdict waits for Next and the run cannot
    // move on under a measurement.
    const auto = page.getByTestId('ear-auto-advance')
    if ((await auto.getAttribute('aria-checked')) === 'true') await auto.click()
    await expect(auto).toHaveAttribute('aria-checked', 'false')
    // The listen pad is a button again once the run has parked on a verdict.
    const next = page.locator('[class*="playPad"]:not([disabled])')

    const tops: Record<string, number> = {}
    for (const trial of [1, 2]) {
      await expect(armed).toBeVisible({ timeout: 10000 })
      tops[`question ${trial}`] = await instrumentTop(page)
      await armed.click()
      await expect(page.getByTestId('ear-stage-last-call')).toBeVisible()
      await expect(next).toBeVisible()
      tops[`verdict ${trial}`] = await instrumentTop(page)
      if (trial === 1) await next.click()
    }

    const values = Object.values(tops)
    expect(values.every(Number.isFinite), JSON.stringify(tops)).toBe(true)
    expect(
      Math.max(...values) - Math.min(...values),
      `the instrument moved: ${JSON.stringify(tops)}`,
    ).toBeLessThanOrEqual(1)
  })
}
