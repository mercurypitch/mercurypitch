// ============================================================
// Lesson tour — a first visit's welcome tour on a lesson page
// ============================================================
//
// The one learn spec that starts clean: it imports Playwright's own `test`,
// not helpers/lesson-page.ts, which closes the tour for every other spec.
// A first visit opens the tour on Merc and Tavi's stage; Next walks its
// steps; Done, Skip, the X and Escape close it for good; the lesson menu's
// "Tour this page", and the question mark at the masthead's right end, play
// it again; the mark keeps to the masthead's row at every width, over
// nothing on the page. Phone and desktop, reduced motion, and no sideways
// scroll at any step. On Lessons 1 and 2 a first visit's card comes once Merc and
// Tavi have landed, the page held still till then (kit/opening-hold.ts), so
// a wait for it there allows the hold's cap.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { HOLD_CAP } from '../features/lessons/kit/opening-hold'
import { TOUR_KEY, TOUR_VERSION } from '../features/lessons/kit/tour-gate'
import { lessonPages, lessonPath } from '../../tools/draft-lessons'

/** Every lesson page the e2e bundle carries: every build carries every one. */
const LESSONS = lessonPages(fileURLToPath(new URL('../..', import.meta.url)))

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }
/** A first visit's card on Lessons 1 and 2, which waits for the opening, at most until the cap. */
const OPENED = { timeout: HOLD_CAP + 2000 }

const TITLES = [
  'Meet Merc and Tavi',
  'One step at a time',
  'Your turn to sing',
  'The season, mapped',
  'Find your way',
]

const card = (page: Page) =>
  page.getByRole('dialog', {
    name: /Meet Merc and Tavi|One step|Your turn|The season|Find your way/,
  })
const next = (page: Page) =>
  card(page).getByRole('button', { name: /^(Next|Done)$/ })

/** The tour's record, as the page reads it. */
const record = (page: Page): Promise<string | null> =>
  page.evaluate((k) => localStorage.getItem(k), TOUR_KEY)

/**
 * Whether the spotlight lies over the targets that show for `selectors`,
 * 8 px out, as far as they show on the screen.
 */
function lit(page: Page, selectors: readonly string[]): Promise<boolean> {
  return page.evaluate((sels) => {
    const els = sels
      .map((s) => document.querySelector(s))
      .filter(
        (el): el is Element => el !== null && el.getClientRects().length > 0,
      )
    const spot = document.querySelector('.tour-spot')
    if (els.length === 0 || spot === null) return false
    const rs = els.map((el) => el.getBoundingClientRect())
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const want = [
      Math.max(Math.min(...rs.map((r) => r.left)) - 8, -8),
      Math.max(Math.min(...rs.map((r) => r.top)) - 8, -8),
      Math.min(Math.max(...rs.map((r) => r.right)) + 8, vw + 8),
      Math.min(Math.max(...rs.map((r) => r.bottom)) + 8, vh + 8),
    ]
    const s = spot.getBoundingClientRect()
    const got = [s.left, s.top, s.right, s.bottom]
    return got.every((v, i) => Math.abs(v - want[i]) < 1.5)
  }, selectors)
}

/** The page wider than its viewport, in px: 0 when nothing scrolls sideways. */
const sideways = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )

const STEP_TARGETS: readonly (readonly string[])[] = [
  ['#heroStage'],
  ['#stepsStage'],
  ['#sing'],
  ['#graph', '#exList'],
  ['.lm-btn', '#mastNav', '.lm-tour'],
]

for (const [name, size] of [
  ['phone', PHONE],
  ['desktop', DESKTOP],
] as const) {
  test(`on a ${name} (${size.width} x ${size.height}) a first visit opens on Merc and Tavi, and Next lights every step with nothing scrolling sideways`, async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(size)
    await page.goto('/learn/01')
    await expect(card(page)).toBeVisible(OPENED)
    await expect(card(page).getByRole('heading')).toHaveText(TITLES[0])
    await expect(card(page)).toContainText('1 of 5')
    await expect(next(page)).toBeFocused()
    const seen: string[] = []

    // Act
    for (const [i, targets] of STEP_TARGETS.entries()) {
      await expect(card(page).getByRole('heading')).toHaveText(TITLES[i])
      await expect.poll(() => lit(page, targets)).toBe(true)
      expect(await sideways(page)).toBeLessThanOrEqual(0)
      seen.push(await card(page).getByRole('heading').innerText())
      if (i < STEP_TARGETS.length - 1) await next(page).click()
    }

    // Assert
    expect(seen).toEqual(TITLES)
    await expect(next(page)).toHaveText('Done')
    await expect(card(page)).toContainText('5 of 5')
  })
}

test('on a phone the card docks at the foot and each target shows in the room above it @smoke', async ({
  page,
}) => {
  // Arrange
  await page.setViewportSize(PHONE)
  await page.goto('/learn/03')
  await expect(card(page)).toBeVisible()
  const placed: string[] = []

  // Act
  for (const [i, targets] of STEP_TARGETS.entries()) {
    await expect.poll(() => lit(page, targets)).toBe(true)
    const where = await page.evaluate((sels) => {
      const box = document.querySelector('.tour-card')?.getBoundingClientRect()
      const mast = document.getElementById('mast')?.getBoundingClientRect()
      const el = sels
        .map((s) => document.querySelector(s))
        .find((e) => e !== null && e.getClientRects().length > 0)
      const t = el?.getBoundingClientRect()
      if (box === undefined || mast === undefined || t === undefined)
        return 'missing'
      const docked =
        Math.abs(window.innerHeight - 12 - box.bottom) < 2 &&
        Math.abs(box.left - 12) < 1
      // the target's top shows between the masthead's foot and the card (the masthead's own step, in it)
      const floor = el?.closest('#mast') === null ? mast.bottom : mast.top
      const above = t.top >= floor - 1 && t.top < box.top - 40
      return docked && above
        ? 'ok'
        : `card ${box.top}-${box.bottom}, target top ${t.top}`
    }, targets)
    placed.push(where)
    if (i < STEP_TARGETS.length - 1) await next(page).click()
  }

  // Assert
  expect(placed).toEqual(['ok', 'ok', 'ok', 'ok', 'ok'])
})

test('walking the tour on a wide screen glides past every step and marks none of them reached, and reading counts again after it', async ({
  page,
}) => {
  // Arrange: on a wide screen the step deck follows the scroll, and the kit
  // keeps the furthest step reached (kit/position.ts, `fyp-pos`)
  await page.setViewportSize(DESKTOP)
  await page.goto('/learn/01')
  await expect(card(page)).toBeVisible(OPENED)
  const glides: boolean[] = []

  // Act: every step, from the deck to Sing it to the map, then Done; each
  // Next leaves the page where it was in its own task, and the page glides
  for (const [i, targets] of STEP_TARGETS.entries()) {
    await expect.poll(() => lit(page, targets)).toBe(true)
    glides.push(
      await page.evaluate(() => {
        const before = window.scrollY
        document.querySelector<HTMLElement>('[data-tour-next]')?.click()
        return window.scrollY === before
      }),
    )
    if (i === STEP_TARGETS.length - 1) await expect(card(page)).toBeHidden()
  }
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.classList.contains('touring'),
      ),
    )
    .toBe(false)
  const during = await page.evaluate(() => localStorage.getItem('fyp-pos'))
  const deckAfter = await page.locator('#stepNow').textContent()
  // the viewer's own scroll to step 3, once the page is at rest
  await page.evaluate(() =>
    document
      .querySelector('.step[data-step="3"]')
      ?.scrollIntoView({ block: 'center', behavior: 'instant' }),
  )

  // Assert
  expect(glides).toEqual([true, true, true, true, true])
  expect(during).toBeNull()
  expect(deckAfter).toBe('1')
  await expect(page.locator('#stepNow')).toHaveText('3')
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('fyp-pos')))
    .toBe(JSON.stringify({ 1: { step: 3, of: 6 } }))
})

test('the dimmed page and the cutout take no presses: only the card answers', async ({
  page,
}) => {
  // Arrange
  await page.setViewportSize(DESKTOP)
  await page.goto('/learn/01')
  await expect.poll(() => lit(page, ['#heroStage']), OPENED).toBe(true)

  // Act: what a press lands on, in the cutout and on the dim
  const hits = await page.evaluate(() => {
    const s = document.querySelector('.tour-spot')?.getBoundingClientRect()
    if (s === undefined) return []
    return [
      [s.left + s.width / 2, s.top + s.height / 2],
      [8, window.innerHeight - 8],
    ].map(([x, y]) => document.elementFromPoint(x, y)?.className ?? '')
  })

  // Assert
  expect(hits).toEqual(['tour-sheet', 'tour-sheet'])
})

for (const [way, close] of [
  [
    'Done',
    async (page: Page) => {
      for (let i = 0; i < TITLES.length; i++) await next(page).click()
    },
  ],
  [
    'Skip tour',
    async (page: Page) => {
      await card(page).getByRole('button', { name: 'Skip tour' }).click()
    },
  ],
  [
    'the X',
    async (page: Page) => {
      await card(page).getByRole('button', { name: 'Close tour' }).click()
    },
  ],
  [
    'Escape',
    async (page: Page) => {
      await page.keyboard.press('Escape')
    },
  ],
] as const) {
  test(`${way} closes the tour for good: the record is written and a reload does not bring it back`, async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await page.goto('/learn/02')
    await expect(card(page)).toBeVisible(OPENED)

    // Act
    await close(page)
    await expect(card(page)).toBeHidden()
    const kept = await record(page)
    const tourLoads: string[] = []
    page.on('request', (r) => {
      if (/\/tour-[^/]*\.js$/.test(r.url())) tourLoads.push(r.url())
    })
    await page.reload({ waitUntil: 'networkidle' })

    // Assert: the gate never loads the tour on a browser that closed it
    expect(kept).toBe(TOUR_VERSION)
    await expect(page.locator('.lm-btn')).toBeVisible()
    expect(tourLoads).toEqual([])
    await expect(card(page)).toBeHidden()
  })
}

test('Tab stays in the card, Escape closes it, and the focus goes back to the menu button that replayed it', async ({
  page,
}) => {
  // Arrange: a browser that has closed the tour, replaying it from the menu
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    TOUR_KEY,
    TOUR_VERSION,
  ] as const)
  await page.setViewportSize(DESKTOP)
  await page.goto('/learn/04')
  await page.locator('.lm-btn').click()
  await page
    .locator('#lessonMenu')
    .getByRole('button', { name: 'Tour this page' })
    .click()
  await expect(card(page).getByRole('heading')).toHaveText(TITLES[0])
  const inside: boolean[] = []

  // Act
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    inside.push(
      await card(page).evaluate((c) => c.contains(document.activeElement)),
    )
  }
  await page.keyboard.press('Escape')

  // Assert
  expect(inside).toEqual([true, true, true, true, true, true])
  await expect(card(page)).toBeHidden()
  await expect(page.locator('.lm-btn')).toBeFocused()
})

for (const [name, size] of [
  ['phone', PHONE],
  ['desktop', DESKTOP],
] as const) {
  test(`on a ${name} the question mark plays the tour again from step 1 on a return visit, and takes the focus back`, async ({
    page,
  }) => {
    // Arrange: a browser that has closed the tour
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [
      TOUR_KEY,
      TOUR_VERSION,
    ] as const)
    await page.setViewportSize(size)
    await page.goto('/learn/04')
    const mark = page.getByRole('button', { name: 'Tour this page' })
    await expect(mark).toBeVisible()
    const [markBox, menuBox] = await Promise.all([
      mark.boundingBox(),
      page.locator('.lm-btn').boundingBox(),
    ])

    // Act
    await mark.click()

    // Assert: step 1, then Escape gives the focus back to the question mark
    await expect(card(page).getByRole('heading')).toHaveText(TITLES[0])
    await expect(card(page)).toContainText('1 of 5')
    expect(markBox?.height).toBe(menuBox?.height)
    expect(markBox?.width).toBeGreaterThanOrEqual(44)
    expect(await sideways(page)).toBeLessThanOrEqual(0)
    await page.keyboard.press('Escape')
    await expect(card(page)).toBeHidden()
    await expect(mark).toBeFocused()
  })
}

/** Every width the masthead's row changes at, from the narrowest phone to the last before the row has room to spare, a landscape phone among them. */
const NARROW = [
  [320, 568],
  [360, 740],
  [390, 844],
  [844, 390],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1180, 820],
] as const

for (let n = 1; n <= 8; n++) {
  test(`on Lesson ${n}, at every width from 320 to 1180 px, the question mark ends the masthead's row: a 44 px target that covers nothing`, async ({
    page,
  }) => {
    // Arrange: a return visit
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [
      TOUR_KEY,
      TOUR_VERSION,
    ] as const)
    await page.goto(`/learn/0${n}`)
    const mark = page.getByRole('button', { name: 'Tour this page' })
    await expect(mark).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const placed: unknown[] = []

    // Act
    for (const [width, height] of NARROW) {
      await page.setViewportSize({ width, height })
      placed.push(
        await mark.evaluate((el, size) => {
          const r = el.getBoundingClientRect()
          const row = el.parentElement as HTMLElement
          const mast = document.getElementById('mast')?.getBoundingClientRect()
          const others = Array.from(
            row.querySelectorAll<HTMLElement>(':scope > a, :scope > button'),
          ).filter((c) => c !== el && c.getClientRects().length > 0)
          const meets = (o: DOMRect) =>
            Math.min(o.right, r.right) - Math.max(o.left, r.left) > 0.5 &&
            Math.min(o.bottom, r.bottom) - Math.max(o.top, r.top) > 0.5
          const top = document.elementFromPoint(
            r.left + r.width / 2,
            r.top + r.height / 2,
          )
          return {
            size,
            inMast:
              mast !== undefined &&
              r.top >= mast.top &&
              r.bottom <= mast.bottom &&
              r.left >= mast.left &&
              r.right <= mast.right,
            last: others.every(
              (o) => o.getBoundingClientRect().right <= r.left,
            ),
            meets: others
              .filter((o) => meets(o.getBoundingClientRect()))
              .map((o) => o.className),
            onTop: top !== null && el.contains(top),
            target: r.width >= 44 && r.height >= 44,
            // The mark's own place, not the page's scroll width: a lesson's
            // content can outgrow a window resized under it, which says
            // nothing about where the masthead puts the mark.
            inView:
              r.left >= 0 && r.right <= document.documentElement.clientWidth,
          }
        }, `${width}x${height}`),
      )
    }

    // Assert
    expect(placed).toEqual(
      NARROW.map(([width, height]) => ({
        size: `${width}x${height}`,
        inMast: true,
        last: true,
        meets: [],
        onTop: true,
        target: true,
        inView: true,
      })),
    )
  })
}

test('a deep link skips the tour this time, and the next lesson page opened at the top offers it', async ({
  page,
}) => {
  // Arrange
  await page.setViewportSize(DESKTOP)
  await page.goto('/learn/03#sing', { waitUntil: 'networkidle' })
  await expect(page.locator('.lm-btn')).toBeVisible()
  const deep = await record(page)

  // Act
  await page.goto('/learn/05')

  // Assert: the deep link wrote nothing, so the next page still offers it
  expect(deep).toBeNull()
  await expect(card(page).getByRole('heading')).toHaveText(TITLES[0])
})

test('every lesson page offers the same five steps', async ({ page }) => {
  // Arrange
  await page.setViewportSize(DESKTOP)
  const counts: string[] = []

  // Act
  for (const n of LESSONS) {
    await page.goto(lessonPath(n))
    await expect(card(page)).toBeVisible(OPENED)
    // its words, not as drawn: the count is set in capitals
    counts.push((await card(page).locator('.tour-count').textContent()) ?? '')
    await card(page).getByRole('button', { name: 'Skip tour' }).click()
    await page.evaluate((k) => localStorage.removeItem(k), TOUR_KEY)
  }

  // Assert: Lesson 12's among them, built before Lesson 11's
  expect(LESSONS).toContain(12)
  expect(counts).toEqual(LESSONS.map(() => '1 of 5'))
})

for (const [n, name, size] of [
  [10, 'phone', PHONE],
  [10, 'desktop', DESKTOP],
  [12, 'phone', PHONE],
  [12, 'desktop', DESKTOP],
] as const) {
  test(`on Lesson ${n}, a written lesson's page, on a ${name} (${size.width} x ${size.height}) each of the five steps lights its targets`, async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(size)
    await page.goto(lessonPath(n))
    await expect(card(page)).toBeVisible(OPENED)
    const lights: boolean[] = []

    // Act
    for (const [i, targets] of STEP_TARGETS.entries()) {
      await expect(card(page).getByRole('heading')).toHaveText(TITLES[i])
      await expect.poll(() => lit(page, targets)).toBe(true)
      lights.push(await lit(page, targets))
      if (i < STEP_TARGETS.length - 1) await next(page).click()
    }

    // Assert
    expect(lights).toEqual([true, true, true, true, true])
    await expect(card(page)).toContainText('5 of 5')
  })
}

test("on Lesson 1's first visit the page holds still while Merc and Tavi land, and the card comes once they have, before the cap", async ({
  page,
}) => {
  // Arrange: when the hold starts and lifts, and when the card comes, with
  // whether any landing or bubble is still moving then
  await page.addInitScript(() => {
    const log = {
      held: [] as number[],
      card: 0,
      moving: [] as string[],
    }
    Object.assign(window, { tourLog: log })
    new MutationObserver(() => {
      const on = document.documentElement.classList.contains('tour-wait')
      if (on !== (log.held.length % 2 === 1))
        log.held.push(Math.round(performance.now()))
      if (log.card === 0 && document.querySelector('.tour-card') !== null) {
        log.card = Math.round(performance.now())
        log.moving = ['#mercBlue', '#mercOrange', '#bubbleO', '#bubbleB']
          .map((s) => document.querySelector(s))
          .filter((el): el is Element => el !== null)
          .filter((el) =>
            el.getAnimations().some((a) => a.playState === 'running'),
          )
          .map((el) => el.id)
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    })
  })
  await page.setViewportSize(DESKTOP)
  await page.goto('/learn/01')
  await expect(page.locator('html')).toHaveClass(/\btour-wait\b/)

  // Act: the wheel, then the keys that scroll a page
  await page.mouse.move(700, 500)
  await page.mouse.wheel(0, 900)
  for (const k of ['PageDown', 'Space', 'ArrowDown', 'End'])
    await page.keyboard.press(k)
  const held = await page.evaluate(() => ({
    y: window.scrollY,
    overflow: getComputedStyle(document.documentElement).overflowY,
  }))
  await expect(card(page)).toBeVisible(OPENED)
  const log = await page.evaluate(
    () =>
      (
        window as unknown as {
          tourLog: { held: number[]; card: number; moving: string[] }
        }
      ).tourLog,
  )

  // Assert: still at the top with no scrollbar; the card once nothing moves,
  // before the cap, and the page let go as it comes
  expect(held).toEqual({ y: 0, overflow: 'hidden' })
  expect(log.moving).toEqual([])
  expect(log.card).toBeLessThan(HOLD_CAP)
  expect(log.held).toHaveLength(2)
  expect(log.held[1] - log.card).toBeLessThanOrEqual(50)
  await expect(page.locator('html')).not.toHaveClass(/\btour-wait\b/)
})

test("Lesson 3's first visit holds nothing: its card comes at once, and the page scrolls", async ({
  page,
}) => {
  // Arrange: whether the hold is ever put on
  await page.addInitScript(() => {
    Object.assign(window, { everHeld: false })
    new MutationObserver(() => {
      if (document.documentElement.classList.contains('tour-wait'))
        Object.assign(window, { everHeld: true })
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  })
  await page.setViewportSize(DESKTOP)

  // Act
  await page.goto('/learn/03')
  await expect(card(page)).toBeVisible()

  // Assert
  expect(
    await page.evaluate(
      () => (window as unknown as { everHeld: boolean }).everHeld,
    ),
  ).toBe(false)
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).overflowY,
    ),
  ).not.toBe('hidden')
})

test.describe('under reduced motion', () => {
  test('the page jumps to each step and nothing glides', async ({ page }) => {
    // Arrange
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize(DESKTOP)
    await page.goto('/learn/01')
    await expect(card(page)).toBeVisible()

    // Act: Next, then where the page is and the card's and the spotlight's longest
    // transition, in seconds, in the same task, before any frame
    const after = await page.evaluate(() => {
      const before = window.scrollY
      document.querySelector<HTMLElement>('[data-tour-next]')?.click()
      return {
        moved: window.scrollY !== before,
        glides: ['.tour-card', '.tour-spot'].map((s) =>
          Math.max(
            ...getComputedStyle(document.querySelector(s) as Element)
              .transitionDuration.split(',')
              .map((d) => parseFloat(d)),
          ),
        ),
      }
    })

    // Assert: the page is already there, and no transition runs past the kit's
    // reduced-motion floor of 0.001 ms
    expect(after.moved).toBe(true)
    expect(Math.max(...after.glides)).toBeLessThanOrEqual(0.000001)
    await expect.poll(() => lit(page, ['#stepsStage'])).toBe(true)
  })
})
