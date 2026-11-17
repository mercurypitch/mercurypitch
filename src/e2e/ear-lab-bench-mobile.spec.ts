// ============================================================
// The bench and a drill on a phone held upright
// ============================================================
//
// 375x553 is an iPhone SE inside Safari's chrome — the smallest screen the
// app still targets, and the one the Ear Lab was worst on. The web's older
// bench fixed its own furniture at both ends of a stage that scrolled
// between them, and its instrument strip wrapped nineteen instruments into
// a slab that scrolled both ways. Merc's bench (the web's face of the tab
// since Nov 2026) lays the instruments out in six stations instead, and
// opens each drill in a room drawn over the whole window, the app's own
// bars and all. Its pads still have to fit the one screen a singer taps at
// without looking.
//
// Three measurements, because the parts fail differently:
//
//   * The stations. Six fixed slots, two to a row: every one a full tap
//     target, none past the screen's edge, nothing sideways. Asserting the
//     rows rather than a height: a grid that got shorter by shrinking its
//     tiles under the touch target would pass a height check and still be
//     wrong.
//
//   * A drill mid-run. The room is a grid — header, run line, stage,
//     console — and the instrument in the stage scales to the height the
//     console leaves it. The console at its tallest (the verdict in Merc's
//     bubble, the pads and the pinned row) has to end on the screen, and
//     not by squeezing the instrument to nothing.
//
//   * The room over the app's bars: the web's tab bar and its voice pill
//     stay on the page while a drill is open, and the room has to cover
//     them, or they sit over its pads.
//
//   * The foot of the window, which the room shares with two things the
//     web lays over everything: the cookie bar, open until a visitor has
//     answered it, and the toasts. The console stands on the bar's space,
//     and says how much of the foot it takes so the toasts stand on it
//     (src/lib/foot-space.ts).

import { expect, test, type Page } from '@playwright/test'
import { dismissOverlays, openNavTab } from './helpers/ui'

/** Open a station's sheet on the bench and start one of its instruments. */
async function startFromStation(
  page: Page,
  faculty: string,
  instrument: string,
): Promise<void> {
  await page
    .locator(`[data-testid="merc-station"][data-faculty="${faculty}"]`)
    .click()
  await page
    .getByTestId('merc-station-row')
    .filter({ hasText: instrument })
    .first()
    .click()
  await expect(page.getByTestId('ear-stage')).toBeVisible()
}

/** Answer the question on the pads, and wait for Merc's verdict. */
async function answerOnce(page: Page): Promise<void> {
  const pads = page.locator(
    '[data-testid="ear-stage-pads"] button:not([disabled])',
  )
  await expect(pads.first()).toBeVisible({ timeout: 20_000 })
  await pads.first().click()
  await expect(page.getByTestId('ear-stage')).toHaveAttribute(
    'data-beat',
    'reveal',
    { timeout: 10_000 },
  )
}

/** The console's foot and the instrument, against the window. */
function measureRoom(page: Page) {
  return page.evaluate(() => {
    const room = document.querySelector('[data-testid="ear-stage"]')
    const pads = document.querySelector('[data-testid="ear-stage-pads"]')
    const pinned = document.querySelector('[data-testid="merc-pinned"]')
    const figure = room?.querySelector('figure') ?? null
    if (room === null || pads === null || figure === null) return null
    const padBoxes = [...pads.querySelectorAll('button')].map((pad) =>
      pad.getBoundingClientRect(),
    )
    return {
      viewportHeight: window.innerHeight,
      roomScroll: room.scrollHeight - room.clientHeight,
      padsBottom: pads.getBoundingClientRect().bottom,
      pinnedBottom: pinned?.getBoundingClientRect().bottom ?? null,
      figureHeight: figure.getBoundingClientRect().height,
      padCount: padBoxes.length,
      shortestPad: Math.min(...padBoxes.map((box) => box.height)),
    }
  })
}

/** An iPhone SE with Safari's chrome around it. */
test.use({ viewport: { width: 375, height: 553 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  // Through the tab bar rather than /ear-lab: the built site has a real
  // dist/ear-lab/ directory of room art, and the static server answers that
  // path with its listing instead of the app.
  await page.goto('/')
  await dismissOverlays(page)
  await openNavTab(page, 'tab-ear-lab')
})

test('lays the six stations out on a phone, every one a full tap target @smoke', async ({
  page,
}) => {
  const stations = page.getByTestId('merc-station')
  await expect(stations.first()).toBeVisible()

  const layout = await page.evaluate(() => {
    const tiles = [
      ...document.querySelectorAll('[data-testid="merc-station"]'),
    ].map((tile) => tile.getBoundingClientRect())
    if (tiles.length === 0) return null
    return {
      count: tiles.length,
      rows: new Set(tiles.map((box) => Math.round(box.top))).size,
      shortest: Math.min(...tiles.map((box) => box.height)),
      narrowest: Math.min(...tiles.map((box) => box.width)),
      rightmost: Math.max(...tiles.map((box) => box.right)),
      leftmost: Math.min(...tiles.map((box) => box.left)),
      viewportWidth: document.documentElement.clientWidth,
      sideways:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }
  })

  expect(layout, 'could not measure the stations').not.toBe(null)
  if (layout === null) return

  expect(layout.count, 'the bench drew a station short').toBe(6)
  expect(layout.rows, 'the stations are not two to a row').toBe(3)
  expect(
    layout.shortest,
    'a station is under the touch target',
  ).toBeGreaterThanOrEqual(44)
  expect(layout.narrowest).toBeGreaterThanOrEqual(44)
  expect(layout.leftmost).toBeGreaterThanOrEqual(0)
  expect(
    layout.rightmost,
    'a station runs past the screen edge',
  ).toBeLessThanOrEqual(layout.viewportWidth)
  expect(layout.sideways, 'the bench scrolls sideways').toBe(0)
})

test('fits a running drill on an upright phone without a scroll @smoke', async ({
  page,
}) => {
  await startFromStation(page, 'resolution', 'Hairline')
  // Mid-run, with Merc's verdict over the pads: the console at its
  // tallest is the state the whole drill is spent in.
  await answerOnce(page)

  const layout = await measureRoom(page)
  expect(layout, 'could not measure the room').not.toBe(null)
  if (layout === null) return

  expect(layout.roomScroll, 'the room scrolls').toBeLessThanOrEqual(1)
  expect(
    layout.padsBottom,
    'the answer pads end below the screen',
  ).toBeLessThanOrEqual(layout.viewportHeight + 1)
  expect(
    layout.pinnedBottom ?? 0,
    'Hear it again and Next end below the screen',
  ).toBeLessThanOrEqual(layout.viewportHeight + 1)
  // The fit has to come from somewhere other than the instrument vanishing.
  expect(
    layout.figureHeight,
    'the instrument has been squeezed to nothing',
  ).toBeGreaterThanOrEqual(80)
})

test('covers the tab bar and the voice pill while a drill is open @smoke', async ({
  page,
}) => {
  await startFromStation(page, 'resolution', 'Hairline')
  await expect(
    page.locator('[data-testid="ear-stage-pads"] button:not([disabled])', {
      hasText: 'The first',
    }),
  ).toBeVisible({ timeout: 20_000 })

  // Whatever is drawn where the app's bars are, it is the room's.
  const covered = await page.evaluate(() => {
    const room = document.querySelector('[data-testid="ear-stage"]')
    const centre = (element: Element | null) => {
      if (element === null) return null
      const box = element.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return null
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    }
    return [
      [
        'the tab bar',
        centre(document.querySelector('[data-tour="mobile-tabbar"]')),
      ],
      [
        'the voice pill',
        centre(document.querySelector('[data-testid="voice-control-pill"]')),
      ],
      ['the foot of the screen', { x: innerWidth / 2, y: innerHeight - 4 }],
    ].map(([name, point]) => {
      if (point === null || typeof point === 'string') return [name, 'absent']
      const top = document.elementFromPoint(point.x, point.y)
      return [name, room !== null && room.contains(top) ? 'room' : 'over it']
    })
  })

  // Both bars are on a phone's page: one that was not found is a test
  // that looked in the wrong place, not a room that covers it.
  for (const [name, verdict] of covered) {
    expect(verdict, `${name}, under the room`).toBe('room')
  }
})

test('stands the console on the cookie bar, and the toasts on the console @smoke', async ({
  page,
}) => {
  await startFromStation(page, 'resolution', 'Hairline')
  await expect(
    page.locator('[data-testid="ear-stage-pads"] button:not([disabled])', {
      hasText: 'The first',
    }),
  ).toBeVisible({ timeout: 20_000 })

  const foot = () =>
    page.evaluate(() => {
      const consoleEl = document.querySelector(
        '[data-testid="ear-stage-console"]',
      )
      const pinned = document.querySelector('[data-testid="merc-pinned"]')
      if (consoleEl === null || pinned === null) return null
      return {
        viewportHeight: window.innerHeight,
        consoleTop: consoleEl.getBoundingClientRect().top,
        pinnedBottom: pinned.getBoundingClientRect().bottom,
        dock: Number.parseFloat(
          document.documentElement.style.getPropertyValue('--page-dock-space'),
        ),
      }
    })

  // What the toasts stand on, on a phone: the whole of the console, from
  // its top to the window's foot (src/styles/Notifications.module.css).
  const plain = await foot()
  expect(plain, 'could not measure the console').not.toBe(null)
  if (plain === null) return
  expect(
    Math.abs(plain.dock - (plain.viewportHeight - plain.consoleTop)),
  ).toBeLessThanOrEqual(1)

  // The e2e build ships no Google tag, so the real bar never mounts. It is
  // stood in for by what it publishes while open (ConsentBanner.tsx), as
  // in toast-above-consent-banner.spec.ts.
  const BAR = 176
  await page.evaluate((px) => {
    document.documentElement.style.setProperty(
      '--consent-banner-space',
      `${px}px`,
    )
  }, BAR)

  await expect
    .poll(async () => (await foot())?.pinnedBottom ?? Infinity)
    .toBeLessThanOrEqual(plain.viewportHeight - BAR)
  // And the toasts still stand on the console, now that it has moved.
  await expect
    .poll(async () => {
      const now = await foot()
      return now === null
        ? Infinity
        : Math.abs(now.dock - (now.viewportHeight - now.consoleTop))
    })
    .toBeLessThanOrEqual(1)

  // Leaving the room gives the foot back.
  await page.getByRole('button', { name: 'End the run' }).first().click()
  await page
    .getByTestId('merc-exit')
    .getByRole('button', { name: 'End the run' })
    .click()
  await expect(page.getByTestId('ear-stage')).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--page-dock-space'),
    ),
  ).toBe('')
})

// ============================================================
// The console on the phone that had the most room and used it worst
// ============================================================
//
// 390x664 is an iPhone 14 inside Safari's chrome. On the old stage it was
// the bad case: it cleared the short-viewport rules that rescued the SE and
// got the desk's console instead, 579px of drill in a 505px porthole. Six
// answers is where a console gets tall, so Stack is the drill to measure.
test.describe('the taller phone', () => {
  test.use({ viewport: { width: 390, height: 664 } })

  test('answers a six-way question without a scroll @smoke', async ({
    page,
  }) => {
    await startFromStation(page, 'colour', 'Stack')
    await answerOnce(page)

    const layout = await measureRoom(page)
    expect(layout, 'could not measure the console').not.toBe(null)
    if (layout === null) return

    expect(layout.padCount, 'Stack drew fewer than six pads').toBe(6)
    expect(layout.roomScroll, 'the room scrolls').toBeLessThanOrEqual(1)
    expect(
      layout.padsBottom,
      'the answer pads end below the screen',
    ).toBeLessThanOrEqual(layout.viewportHeight + 1)
    expect(
      layout.pinnedBottom ?? 0,
      'Hear it again and Next end below the screen',
    ).toBeLessThanOrEqual(layout.viewportHeight + 1)
    // The floor, so none of the above was bought below the touch target.
    expect(
      layout.shortestPad,
      'an answer pad is under the 44px touch target',
    ).toBeGreaterThanOrEqual(44)
  })

  test('keeps the voice pill in the header, off the page @smoke', async ({
    page,
  }) => {
    // On the bench, where the pill is the app's and not under a room.

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
