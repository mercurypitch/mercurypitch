// ============================================================
// A drill is still a drill with the phone turned sideways
// ============================================================
//
// The stage sizes itself by WIDTH, through a container query. A phone in
// landscape is wide and short, so none of that fires and the console is
// laid out for a screen twice as tall as the one it is on. Measured at
// 844x390 mid-run: the console took 274px of 390 and, being sticky to the
// bottom, covered the exercise body completely. The drill was not cramped,
// it was invisible.
//
// The assertion is the relationship, not the numbers: the console may not
// take more of the screen than it leaves, and the instrument has to be on
// screen above it. Pinning "console <= 161px" would fail the first time a
// drill adds a row, and would still pass if the body went to zero.

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
    .locator('[data-tour="ear.drills"] button', { hasText: 'Hairline' })
    .first()
    .click()
  await expect(page.getByTestId('ear-stage')).toBeVisible()

  await page.getByText('Practice run').click()
  const firstPad = page.locator(
    '[data-testid="ear-stage-pads"] button:not([disabled])',
    { hasText: 'The first' },
  )
  await expect(firstPad).toBeVisible({ timeout: 10_000 })

  // Answer one, because the last call is half the problem: the console is at
  // its tallest once the verdict block is under the pads, and that is the
  // state a singer spends the whole drill in. Measuring the first question
  // measures the one console layout that never actually persists.
  await firstPad.click()
  // The block, not its "Last call" kicker: the kicker is pure chrome and the
  // compaction under test is what hides it, so waiting on that text would
  // only ever find the layout this test exists to replace.
  await expect(page.locator('[class*="lastCall"]').first()).toBeVisible({
    timeout: 10_000,
  })

  const layout = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="ear-stage"]')
    if (stage === null) return null
    const cls = (element: Element): string =>
      typeof element.className === 'string'
        ? element.className
        : (element.getAttribute('class') ?? '')
    const find = (name: string): Element | undefined =>
      [...stage.children].find((child) => cls(child).includes(name))
    const consoleEl = find('console')
    const bodyEl = find('body')
    const figure = stage.querySelector('[class*="figure"] > svg')
    if (consoleEl === undefined || bodyEl === undefined || figure === null) {
      return null
    }
    return {
      viewportHeight: window.innerHeight,
      consoleTop: consoleEl.getBoundingClientRect().top,
      consoleHeight: consoleEl.getBoundingClientRect().height,
      bodyTop: bodyEl.getBoundingClientRect().top,
      figureBottom: figure.getBoundingClientRect().bottom,
      figureHeight: figure.getBoundingClientRect().height,
    }
  })

  expect(layout, 'could not measure the stage').not.toBe(null)
  if (layout === null) return

  // The console is sticky to the bottom and the body scrolls behind it by
  // design, so "do they overlap" is not the question — how much of the
  // screen the console claims is. At 274 of 390 there was nothing left to
  // see; the drill has to get at least half its own stage back.
  expect(
    layout.consoleHeight,
    'the console takes more of a landscape screen than it leaves for the drill',
  ).toBeLessThan(layout.viewportHeight / 2)

  // And the room it gives back reaches the instrument, rather than being
  // absorbed by padding: a figure clamped to nothing would satisfy the
  // check above while leaving the drill just as unreadable.
  expect(
    layout.figureHeight,
    'the instrument has been squeezed to nothing',
  ).toBeGreaterThanOrEqual(80)

  // The console starts below the top of the body, i.e. some of the stage is
  // in front of it rather than the console owning the whole screen.
  expect(
    layout.consoleTop,
    'the console starts at or above the body, leaving no stage visible',
  ).toBeGreaterThan(layout.bodyTop)
})
