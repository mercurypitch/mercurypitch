// ============================================================
// A step link keeps its step, however soon the stage is touched
// ============================================================
//
// `/learn/04#step-3` opens the deck on Step 3 and scrolls the page to it
// (kit/step-deck.ts, `openAt`). A viewer who reaches for the stage at once,
// before that scroll has landed, must still be left on Step 3: shown on the
// deck, and its text on screen beside the stage, once the page holds still.
// The scroll used to go smoothly (the page's `scroll-behavior: smooth` turns
// an "auto" scroll into a smooth one), so focus coming to a stage control
// (a Tab, a press) brought the control into view and stopped it short, with
// the deck on Step 3 beside another step's text, until the page next moved
// and the deck followed it back up. The focus comes the moment the deck
// reads Step 3, as early as a viewer can reach it; a Playwright click alone
// waits for the stage to stop moving, which is after the scroll has landed.

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

/** Settles once the page has not scrolled for a second and a half. */
async function heldStill(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const w = window as Window & {
            __still?: { y: number; since: number }
          }
          const now = performance.now()
          if (w.__still?.y !== window.scrollY) {
            w.__still = { y: window.scrollY, since: now }
          }
          return now - w.__still.since > 1500
        }),
      { timeout: 15_000, intervals: [100] },
    )
    .toBe(true)
}

/** Whether Step `n`'s text crosses the middle band the deck follows. */
const stepInView = (page: Page, n: number): Promise<boolean> =>
  page.locator(`.step[data-step="${n}"]`).evaluate((el) => {
    const r = el.getBoundingClientRect()
    return (
      r.top < window.innerHeight * 0.58 && r.bottom > window.innerHeight * 0.42
    )
  })

test.use({ viewport: { width: 1440, height: 900 } })

test('a step link opened and the stage pressed at once leaves the deck on its step, in view', async ({
  page,
}) => {
  await page.goto('/learn/04#step-3', { waitUntil: 'commit' })
  await expect(page.locator('#stepNow')).toHaveText('3')
  const control = page.locator('#stepsStage .toy.is-active button:visible')

  await control.first().evaluate((el) => el.focus())
  await control.first().click()
  await heldStill(page)

  await expect(page.locator('#stepNow')).toHaveText('3')
  expect(await stepInView(page, 3)).toBe(true)
})
