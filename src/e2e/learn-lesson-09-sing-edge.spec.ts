// ============================================================
// Lesson 9 Sing it — Start tapped at the screen's edge, with no scroll
// ============================================================
//
// A viewer taps Start wherever it sits on the screen, so these taps are
// real ones on its centre, a touch on a phone and a click on a desktop
// (`page.touchscreen.tap`, `page.mouse.click`), and Playwright makes no
// scroll of its own: Start with its bottom a few px above the screen's
// bottom edge, the warm-up closed and then open, and Start at the top edge
// of what shows, just under the sticky masthead, at a phone's size and a
// desktop's. Each take must reach its readings: as the take begins the
// card gives way, the briefing and the warm-up going and the live chart
// coming, and that must never carry Sing it off screen long enough for the
// leave watch to end the take (sing.ts). The fake microphone plays a
// steady A3 (`writeToneWav(220)`), so every take reads four lines.

import type { Page } from '@playwright/test'
import { micAsks, start, status, TAKE_LINE, toSing, watchMic, } from './helpers/lesson-09-sing'
import { expect, test } from './helpers/lesson-page'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(220, 20)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 120_000 })

/**
 * Where Start is tapped: its bottom a few px above the screen's bottom
 * edge, or its top a few px under the top of what shows, the sticky
 * masthead's bottom edge, since nothing under the masthead takes a tap.
 */
type Edge = 'bottom' | 'top'

/** Waits until the page has stopped scrolling: the same scroll across a few frames. */
async function stillScroll(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = -1
        let same = 0
        const look = (): void => {
          same = window.scrollY === last ? same + 1 : 0
          last = window.scrollY
          if (same >= 5) resolve()
          else requestAnimationFrame(look)
        }
        requestAnimationFrame(look)
      }),
  )
}

/** Where Start sits against the edge of what shows: px to spare, and the point a tap lands on. */
interface Placed {
  readonly x: number
  readonly y: number
  /** Px between Start and the edge it is placed at. */
  readonly gap: number
  /** The point a tap lands on is Start's, not the masthead's or another's. */
  readonly hits: boolean
}

/**
 * Sets the warm-up open or closed and scrolls, at once, so Start sits at
 * `edge`, 3 px from the edge of what shows, then gives the point a tap
 * lands on: Start's centre.
 */
async function placeStart(
  page: Page,
  edge: Edge,
  warmUp: boolean,
): Promise<Placed> {
  await page.evaluate((open) => {
    const w = document.querySelector<HTMLDetailsElement>('#warmup')
    if (w !== null) w.open = open
  }, warmUp)
  await stillScroll(page)
  const shows = (): Promise<{ top: number; bottom: number }> =>
    page.evaluate(() => ({
      top: document.querySelector('.mast')?.getBoundingClientRect().bottom ?? 0,
      bottom: window.innerHeight,
    }))
  const edges = await shows()
  await start(page).evaluate(
    (el, [at, top, bottom]) => {
      const r = el.getBoundingClientRect()
      const by = at === 'bottom' ? r.bottom - (bottom - 3) : r.top - (top + 3)
      window.scrollBy({ top: by, behavior: 'instant' })
    },
    [edge, edges.top, edges.bottom] as const,
  )
  await stillScroll(page)
  return start(page).evaluate(
    (el, [at, top, bottom]) => {
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      const hit = document.elementFromPoint(x, y)
      return {
        x,
        y,
        gap: at === 'bottom' ? bottom - r.bottom : r.top - top,
        hits: hit !== null && el.contains(hit),
      }
    },
    [edge, edges.top, edges.bottom] as const,
  )
}

for (const [viewport, touch] of [
  [{ width: 390, height: 844 }, true],
  [{ width: 1440, height: 900 }, false],
] as const) {
  test.describe(`Start at the screen's edge at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport, hasTouch: touch, isMobile: touch })

    for (const [edge, warmUp] of [
      ['bottom', false],
      ['top', false],
      ['bottom', true],
    ] as const) {
      test(`a ${touch ? 'touch' : 'click'} on Start at the ${edge} edge${warmUp ? ', the warm-up open,' : ''} reaches its readings`, async ({
        page,
      }) => {
        // Arrange
        await watchMic(page)
        await toSing(page)
        const at = await placeStart(page, edge, warmUp)

        // Act: a tap at a point of the screen; Playwright scrolls nothing
        if (touch) await page.touchscreen.tap(at.x, at.y)
        else await page.mouse.click(at.x, at.y)

        // Assert
        expect(at.hits).toBe(true)
        expect(at.gap).toBeGreaterThanOrEqual(0)
        expect(at.gap).toBeLessThan(6)
        await expect(status(page)).toHaveText(TAKE_LINE, { timeout: 20_000 })
        await expect(status(page)).toHaveText('How did that feel?', {
          timeout: 30_000,
        })
        await expect(page.locator('[data-readings] li')).toHaveCount(4)
        expect(await micAsks(page)).toBe(1)
      })
    }
  })
}
