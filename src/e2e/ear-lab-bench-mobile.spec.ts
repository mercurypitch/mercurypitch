// ============================================================
// The bench and a drill on a phone held upright
// ============================================================
//
// 375x553 is an iPhone SE inside Safari's chrome — the smallest screen the
// app still targets, and the one the Ear Lab was worst on. The room fixes
// its own furniture at both ends of a stage that scrolls between them, so
// the app header, the session bar, the bridge and the tab bar left the
// bench a porthole 321px tall, and everything inside it was laid out for a
// desk.
//
// Two measurements, because the two halves fail differently:
//
//   * The instrument strip. Its stylesheet calls it "one unbroken line"
//     and gave it seven fixed columns; the Lab has nineteen instruments.
//     Seven columns of 132px in a 358px bench wrapped them into three rows
//     AND overflowed sideways — a two-axis slab 407px tall, taller than the
//     porthole it lived in, in which you could never see which row you were
//     on. Asserting one row rather than a height: a strip that got shorter
//     by shrinking its buttons under the touch target would pass a height
//     check and still be wrong.
//
//   * A drill mid-run. The stage is a three-row grid — bar, body, console —
//     and the instrument between them clamps to the height the chrome
//     leaves. The reserve that clamp subtracts was measured for a phone on
//     its side; upright inside Safari it was two dozen pixels short, and
//     the answer pads went under a scroll in the one screen a singer taps
//     at without looking.

import { expect, test, type Page } from '@playwright/test'
import { dismissOverlays, openNavTab } from './helpers/ui'

/**
 * Turn auto-advance off, so a verdict waits for Next instead of the run
 * moving on under the measurement. Call it once a run is under way — the
 * switch is in the drill bar, which only carries it while a run is live. A drill passes through several console
 * heights — a listen pad that is a label one moment and a button the next,
 * a verdict that is one line or three — and with the run advancing on its
 * own, which one got measured was down to the clock.
 */
async function parkOnTheVerdict(page: Page): Promise<void> {
  const auto = page.getByTestId('ear-auto-advance')
  await expect(auto).toBeVisible()
  if ((await auto.getAttribute('aria-checked')) === 'true') {
    await auto.click()
  }
  await expect(auto).toHaveAttribute('aria-checked', 'false')
}

/** The listen pad once it is a button again: the run has parked. */
function parkedPad(page: Page) {
  return page.locator('[class*="playPad"]:not([disabled])')
}

/** An iPhone SE with Safari's chrome around it. */
test.use({ viewport: { width: 375, height: 553 } })

test('keeps the instrument strip to one line on a phone @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  // Through the tab bar rather than /ear-lab: the built site has a real
  // dist/ear-lab/ directory of room art, and the static server answers that
  // path with its listing instead of the app.
  await page.goto('/')
  await dismissOverlays(page)
  await openNavTab(page, 'tab-ear-lab')

  const strip = page.locator('[data-tour="ear.drills"]')
  await expect(strip).toBeVisible()

  const layout = await page.evaluate(() => {
    const element = document.querySelector('[data-tour="ear.drills"]')
    if (element === null) return null
    const buttons = [...element.querySelectorAll(':scope > button')]
    if (buttons.length === 0) return null
    const boxes = buttons.map((button) => button.getBoundingClientRect())
    return {
      count: buttons.length,
      rows: new Set(boxes.map((box) => Math.round(box.top))).size,
      stripHeight: element.getBoundingClientRect().height,
      tallestButton: Math.max(...boxes.map((box) => box.height)),
      shortestButton: Math.min(...boxes.map((box) => box.height)),
      // A line you can reach the end of: it has to scroll sideways, since
      // nineteen instruments do not fit a phone at a readable size.
      scrollsSideways: element.scrollWidth > element.clientWidth + 1,
    }
  })

  expect(layout, 'could not measure the instrument strip').not.toBe(null)
  if (layout === null) return

  // Guards the walk: an empty strip would satisfy every check below.
  expect(layout.count, 'the strip listed no instruments').toBeGreaterThan(8)

  expect(
    layout.rows,
    'the instrument strip wraps into more than one row on a phone',
  ).toBe(1)
  expect(
    layout.scrollsSideways,
    'the strip does not scroll, so the instruments past the screen edge cannot be reached',
  ).toBe(true)
  // And it is one row because the buttons sit side by side, not because they
  // were squeezed under the touch target.
  expect(
    layout.shortestButton,
    'the strip fits one row by shrinking its buttons below the touch target',
  ).toBeGreaterThanOrEqual(44)
  expect(
    layout.stripHeight,
    'the strip is taller than the single row of buttons it holds',
  ).toBeLessThanOrEqual(layout.tallestButton + 2)
})

test('fits a running drill on an upright phone without a scroll @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  // Through the tab bar rather than /ear-lab: the built site has a real
  // dist/ear-lab/ directory of room art, and the static server answers that
  // path with its listing instead of the app.
  await page.goto('/')
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
  await parkOnTheVerdict(page)

  // Mid-run, with the verdict block under the pads: the console at its
  // tallest is the state the whole drill is spent in.
  await firstPad.click()
  await expect(page.locator('[class*="lastCall"]').first()).toBeVisible({
    timeout: 10_000,
  })
  // Parked, not mid-reveal: this is the console at its tallest — the verdict
  // showing and the listen pad back as a real button.
  await expect(parkedPad(page).first()).toBeVisible({ timeout: 20_000 })

  const layout = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="ear-stage"]')
    const pads = document.querySelector('[data-testid="ear-stage-pads"]')
    const figure = stage?.querySelector('[class*="figure"] > svg') ?? null
    if (stage === null || pads === null || figure === null) return null
    // The drill does not scroll itself — it is `min-height: 100%` inside the
    // room's one scrolling surface, so its own scrollHeight always equals its
    // height and says nothing. The porthole is the ancestor that scrolls.
    let porthole: Element | null = stage.parentElement
    while (
      porthole !== null &&
      getComputedStyle(porthole).overflowY !== 'auto'
    ) {
      porthole = porthole.parentElement
    }
    if (porthole === null) return null
    return {
      stageHeight: stage.getBoundingClientRect().height,
      portholeHeight: porthole.clientHeight,
      portholeScroll: porthole.scrollHeight,
      padsBottom: pads.getBoundingClientRect().bottom,
      portholeBottom: porthole.getBoundingClientRect().bottom,
      figureHeight: figure.getBoundingClientRect().height,
    }
  })

  expect(layout, 'could not measure the stage').not.toBe(null)
  if (layout === null) return

  expect(
    layout.portholeScroll,
    'the drill overflows an upright phone, so the answer pads sit under a scroll',
  ).toBeLessThanOrEqual(layout.portholeHeight + 1)
  expect(
    layout.padsBottom,
    'the answer pads end below the visible stage',
  ).toBeLessThanOrEqual(layout.portholeBottom + 1)
  // The fit has to come from somewhere other than the instrument vanishing.
  expect(
    layout.figureHeight,
    'the instrument has been squeezed to nothing',
  ).toBeGreaterThanOrEqual(80)
})

// ============================================================
// The console on the phone that had the most room and used it worst
// ============================================================
//
// 390x664 is an iPhone 14 inside Safari's chrome. It is 111px taller than
// the SE above, which is exactly why it was the bad case: it clears the
// short-viewport rules that rescue the SE, and got the desk's console
// instead — a keycap for a key it has no keyboard for, the answer and its
// note stacked, and a three-row verdict block. Measured mid-run: 579px of
// drill in a 505px porthole.
test.describe('the taller phone', () => {
  test.use({ viewport: { width: 390, height: 664 } })

  test('answers a six-way question without a scroll @smoke', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await dismissOverlays(page)
    await openNavTab(page, 'tab-ear-lab')

    // Stack, not Hairline: six answers is where the console gets tall, and a
    // two-answer drill fits whatever the layout does.
    await page
      .locator('[data-tour="ear.drills"] button', { hasText: 'Stack' })
      .first()
      .click()
    await expect(page.getByTestId('ear-stage')).toBeVisible()

    // "Begin", not "Practice run": an identification drill has no calibration
    // to practise against, it just plays a chord.
    await page.getByText('Begin').click()
    // The pads are disabled while the chord sounds; the run reaches the answer
    // phase when the first one takes a tap.
    const pads = page.locator(
      '[data-testid="ear-stage-pads"] button:not([disabled])',
    )
    await expect(pads.first()).toBeEnabled({ timeout: 20_000 })
    await parkOnTheVerdict(page)
    await pads.first().click()
    await expect(page.locator('[class*="lastCall"]').first()).toBeVisible({
      timeout: 10_000,
    })
    // Parked, for the same reason as the drill above: this is the console at
    // its tallest, and the state the singer actually reads the verdict in.
    await expect(parkedPad(page).first()).toBeVisible({ timeout: 20_000 })

    const layout = await page.evaluate(() => {
      const stage = document.querySelector('[data-testid="ear-stage"]')
      const pad = document.querySelector(
        '[data-testid="ear-stage-pads"] button',
      )
      const lastCall = document.querySelector('[class*="lastCall"]')
      if (stage === null || pad === null || lastCall === null) return null
      let porthole: Element | null = stage.parentElement
      while (
        porthole !== null &&
        getComputedStyle(porthole).overflowY !== 'auto'
      ) {
        porthole = porthole.parentElement
      }
      if (porthole === null) return null
      const label = pad.querySelector('[class*="padLabel"]')
      const sub = pad.querySelector('[class*="padSub"]')
      const keycap = pad.querySelector('[class*="padKey"]')
      return {
        portholeHeight: porthole.clientHeight,
        portholeScroll: porthole.scrollHeight,
        padHeight: pad.getBoundingClientRect().height,
        keycapShown:
          keycap !== null && getComputedStyle(keycap).display !== 'none',
        labelTop: label?.getBoundingClientRect().top ?? null,
        subTop: sub?.getBoundingClientRect().top ?? null,
        // The verdict block is a grid, so its own resolved row track list is
        // the row count — a kicker over a line over a note was three. Read off
        // the grid rather than off the children's positions: the mark spans
        // every row and sits 2px low, which reads as a row of its own.
        lastCallRows: getComputedStyle(lastCall)
          .gridTemplateRows.trim()
          .split(/\s+/).length,
      }
    })

    expect(layout, 'could not measure the console').not.toBe(null)
    if (layout === null) return

    expect(
      layout.portholeScroll,
      'the drill overflows the phone, so the answer pads sit under a scroll',
    ).toBeLessThanOrEqual(layout.portholeHeight + 1)

    expect(
      layout.keycapShown,
      'the answer pads still show a keycap for a keyboard the phone does not have',
    ).toBe(false)

    // The answer and its note on one line, not stacked. Compared rather than
    // pinned: what matters is that they share a row, at whatever height the
    // type lands on.
    expect(layout.labelTop, 'the pad has no label').not.toBe(null)
    expect(layout.subTop, 'the pad has no note to place').not.toBe(null)
    expect(
      Math.abs((layout.subTop ?? 0) - (layout.labelTop ?? 0)),
      'the answer and its note are on separate rows',
    ).toBeLessThan(12)

    expect(
      layout.lastCallRows,
      'the verdict block still stacks three rows',
    ).toBeLessThanOrEqual(2)

    // The floor, so none of the above was bought below the touch target.
    expect(
      layout.padHeight,
      'an answer pad is under the 44px touch target',
    ).toBeGreaterThanOrEqual(44)
  })

  test('keeps the voice pill in the header, off the page @smoke', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await dismissOverlays(page)

    const pill = page.getByTestId('voice-control-pill')
    await expect(pill).toBeVisible()

    const placed = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="voice-control-pill"]')
      const header = document.querySelector('header')
      if (el === null || header === null) return null
      return {
        placement: el.getAttribute('data-placement'),
        inHeader: header.contains(el),
        bottom: el.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
      }
    })

    expect(placed, 'could not find the voice pill').not.toBe(null)
    if (placed === null) return

    // In the header rather than fixed over the bottom-left corner, where it
    // sat on whatever the page had put there — and where the Ear Lab console
    // paid 46px of a 390px stage to avoid it.
    expect(placed.placement).toBe('docked')
    expect(
      placed.inHeader,
      'the voice pill is not in the app header on a phone',
    ).toBe(true)
    expect(
      placed.bottom,
      'the voice pill still hangs over the bottom of the page',
    ).toBeLessThan(placed.viewportHeight / 2)
  })
})
