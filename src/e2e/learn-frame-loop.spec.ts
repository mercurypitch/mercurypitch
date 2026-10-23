// ============================================================
// The lesson frame loop rests when nothing on the page moves
// ============================================================
//
// One requestAnimationFrame loop draws a lesson page's figures
// (kit/frame-loop.ts), and it stops asking for frames once every figure
// has nothing new to draw. The ring, the slide guide and the explorer never
// said so, and kept it asking every frame for as long as the page was open.
// On every page from Lesson 1 to Lesson 8, each figure that uses one of the
// three is scrolled into view and left to settle, and then it changes
// nothing for a whole second: no paint of its canvas, no change to the
// ring's drawing. A run of the figure (a sung note, Merc's slide, scale or
// version, Merc's siren, Lesson 13's plate in the explorer) brings its
// frames back, and once the run ends, or the motion switch holds the plate
// still, they stop again, and the ring has no ripple left on it. On a
// phone, where the explorer is a list, Lesson 8's whole page rests again
// once a second tap on Lesson 13's row folds its card away.
//
// On Lessons 6, 7 and 8 every figure now says when it has nothing to draw,
// so there the whole page asks for no frame at all at rest. Lessons 1 to 5
// each have drawers of their own that still draw every frame (S-26 in
// docs/plans/find-your-pitch/RELEASE-REVIEW.md), which keep their loop
// running whatever these three do, so there only the figures are watched.
// There the ring's checks pin only that it writes nothing at rest and leaves
// no ripple: its `wants` is pinned where the whole page rests (Lessons 6
// and 7) and by kit/sing.test.ts.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.describe.configure({ timeout: 150_000 })
test.use({ viewport: { width: 1280, height: 800 } })

/**
 * Counts every frame the page asks for, and each canvas's paints (every
 * frame a figure draws clears its canvas first), from before its first
 * script runs.
 */
async function watchFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      frameAsks: number
      paintsOf: WeakMap<HTMLCanvasElement, number>
    }
    w.frameAsks = 0
    w.paintsOf = new WeakMap()
    const ask = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (cb) => {
      w.frameAsks += 1
      return ask(cb)
    }
    const clear = CanvasRenderingContext2D.prototype.clearRect
    CanvasRenderingContext2D.prototype.clearRect = function (
      this: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
    ) {
      w.paintsOf.set(this.canvas, (w.paintsOf.get(this.canvas) ?? 0) + 1)
      clear.call(this, x, y, width, height)
    }
  })
}

/**
 * What changes over `ms` milliseconds: the frames the page asks for (no
 * selector), a canvas's paints, or the changes to another element's drawing
 * (the ring's SVG).
 */
const changesOver = (page: Page, sel: string | null, ms: number) =>
  page.evaluate(
    ([sel, ms]) =>
      new Promise<number>((resolve, reject) => {
        const w = window as unknown as {
          frameAsks: number
          paintsOf: WeakMap<HTMLCanvasElement, number>
        }
        if (sel === null) {
          const before = w.frameAsks
          window.setTimeout(() => resolve(w.frameAsks - before), ms)
          return
        }
        const el = document.querySelector(sel)
        if (el === null) {
          reject(new Error(`no ${sel}`))
          return
        }
        if (el instanceof HTMLCanvasElement) {
          const before = w.paintsOf.get(el) ?? 0
          window.setTimeout(
            () => resolve((w.paintsOf.get(el) ?? 0) - before),
            ms,
          )
          return
        }
        let n = 0
        const seen = new MutationObserver((records) => {
          n += records.length
        })
        seen.observe(el, {
          attributes: true,
          childList: true,
          subtree: true,
          characterData: true,
        })
        window.setTimeout(() => {
          seen.disconnect()
          resolve(n)
        }, ms)
      }),
    [sel, ms] as const,
  )

/** Once it has settled, `sel` (or, with null, the whole page) changes nothing for a whole second. */
async function expectRest(page: Page, sel: string | null): Promise<void> {
  await expect
    .poll(() => changesOver(page, sel, 1000), {
      timeout: 40_000,
      intervals: [0],
      message: `${sel ?? 'the page'} at rest`,
    })
    .toBe(0)
}

/** `sel` (or the whole page) draws frame after frame, once a scroll that brings it in has landed. */
async function expectMoving(page: Page, sel: string | null): Promise<void> {
  await expect
    .poll(() => changesOver(page, sel, 500), {
      timeout: 10_000,
      intervals: [0],
      message: `${sel ?? 'the page'} moving`,
    })
    .toBeGreaterThan(3)
}

/** Brings `sel` into view at once, as a reader's scroll would. */
async function scrollTo(page: Page, sel: string): Promise<void> {
  await page
    .locator(sel)
    .first()
    .evaluate((el) =>
      el.scrollIntoView({ block: 'center', behavior: 'instant' }),
    )
}

/** Each figure and the page (where `whole`) at rest, then moving once `run` starts it, then at rest again. */
async function runRests(
  page: Page,
  figures: readonly string[],
  whole: boolean,
  run: () => Promise<void>,
): Promise<void> {
  for (const sel of figures) await expectRest(page, sel)
  if (whole) await expectRest(page, null)
  await run()
  for (const sel of figures) await expectMoving(page, sel)
  if (whole) await expectMoving(page, null)
  for (const sel of figures) await expectRest(page, sel)
  if (whole) await expectRest(page, null)
}

/** Once `ring`'s run has come to rest, no ripple is left on it: the last ones faded out. */
async function expectNoRipples(page: Page, ring: string): Promise<void> {
  await expect(page.locator(`${ring} .ring-ripples circle`)).toHaveCount(0)
}

const PLATE = '#exCardHost .plate canvas'
const node = (page: Page, n: number) =>
  page.locator(`#graph button.node[aria-label^="Lesson ${n}:"]`)

/**
 * The explorer at rest; Lesson 13's plate shaking its sand, then held
 * still by the motion switch, then shaking again; and the page's own card,
 * with no plate, at rest.
 */
async function explorerRests(
  page: Page,
  own: number,
  whole: boolean,
): Promise<void> {
  await scrollTo(page, '#explorer')
  if (whole) await expectRest(page, null)

  await node(page, 13).click()
  await expectMoving(page, PLATE)
  if (whole) await expectMoving(page, null)

  // the switch sits in the masthead; a click there scrolls the page, so
  // the plate is brought back into view after each
  const motion = page.locator('#motionSwitch')
  await motion.click()
  await expect(motion).toHaveAttribute('aria-pressed', 'true')
  await scrollTo(page, PLATE)
  await expectRest(page, PLATE)
  if (whole) await expectRest(page, null)
  await motion.click()
  await expect(motion).toHaveAttribute('aria-pressed', 'false')
  await scrollTo(page, PLATE)
  await expectMoving(page, PLATE)

  await node(page, own).click()
  await expect(page.locator('#exCardHost .plate')).toHaveCount(0)
  if (whole) await expectRest(page, null)
}

/** Opens a lesson's page with a voice stored, as an earlier lesson stores it. */
async function open(page: Page, n: number): Promise<void> {
  await watchFrames(page)
  await page.addInitScript(() => {
    localStorage.setItem('fyp-voice', JSON.stringify('lower'))
  })
  await page.goto(`/learn/0${n}`)
}

/** Sing it past the comfort check: "Just listen today", or "Sing along". */
async function comfort(page: Page, answer: 'listen' | 'sing'): Promise<void> {
  await scrollTo(page, '#sing')
  await page.locator(`[data-comfort="${answer}"]`).click()
}

test("Lesson 1: the sing card's ring and the explorer rest", async ({
  page,
}) => {
  await open(page, 1)
  await scrollTo(page, '#sing .ring')

  await runRests(page, ['#sing .ring'], false, () =>
    page.locator('#singA3').click(),
  )
  await expectNoRipples(page, '#sing .ring')
  await explorerRests(page, 1, false)
})

test("Lesson 2: the slide's ring and guide and the explorer rest", async ({
  page,
}) => {
  await open(page, 2)
  await scrollTo(page, '#slideGuide')

  await runRests(page, ['#sing .ring', '#slideGuide canvas'], false, () =>
    page.locator('[data-slide="57"]').click(),
  )
  await expectNoRipples(page, '#sing .ring')
  await explorerRests(page, 2, false)
})

test("Lesson 3: Sing it's ring and the explorer rest", async ({ page }) => {
  await open(page, 3)
  await comfort(page, 'listen')
  await scrollTo(page, '#ring')

  await runRests(page, ['#ring'], false, () =>
    page.locator('[data-listen-note="0"]').click(),
  )
  await expectNoRipples(page, '#ring')
  await explorerRests(page, 3, false)
})

test("Lesson 4: the scale's ring and guide and the explorer rest", async ({
  page,
}) => {
  await open(page, 4)
  await scrollTo(page, '#scaleGuide')

  await runRests(page, ['#sing .ring', '#scaleGuide canvas'], false, () =>
    page.locator('[data-scale="50"]').click(),
  )
  await expectNoRipples(page, '#sing .ring')
  await explorerRests(page, 4, false)
})

test("Lesson 5: Sing it's ring and the explorer rest", async ({ page }) => {
  await open(page, 5)
  await comfort(page, 'listen')
  await scrollTo(page, '#ring')

  await runRests(page, ['#ring'], false, () =>
    page.locator('[data-listen-len="10"]').click(),
  )
  await expectNoRipples(page, '#ring')
  await explorerRests(page, 5, false)
})

test('Lesson 6: the ring, the guide and the explorer rest, and so does the whole page', async ({
  page,
}) => {
  await open(page, 6)
  await comfort(page, 'sing')
  await expect(page.locator('[data-panel="versions"]')).toBeVisible()
  await scrollTo(page, '#tuneGuide')

  await runRests(page, ['#singCard .ring', '#tuneGuide canvas'], true, () =>
    page.locator('[data-version="1"]').click(),
  )
  await expectNoRipples(page, '#singCard .ring')
  await explorerRests(page, 6, true)
})

test('Lesson 7: the ring and the explorer rest, and so does the whole page', async ({
  page,
}) => {
  await open(page, 7)
  await comfort(page, 'sing')
  await expect(page.locator('[data-panel="prepare"]')).toBeVisible()
  await scrollTo(page, '#ring')

  await runRests(page, ['#ring'], true, () =>
    page.locator('[data-panel="prepare"] [data-merc-siren]').click(),
  )
  await expectNoRipples(page, '#ring')
  await explorerRests(page, 7, true)
})

test('Lesson 8: the explorer rests, and so does the whole page', async ({
  page,
}) => {
  await open(page, 8)

  await explorerRests(page, 8, true)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("Lesson 8: the explorer's list rests once Lesson 13's card is folded away, and so does the whole page", async ({
    page,
  }) => {
    await open(page, 8)
    await scrollTo(page, '#exList')
    await expectRest(page, null)

    // on a phone the card opens under its row, and a second tap folds it away
    const row = page.locator('#exList [data-n="13"] button.it')
    await row.click()
    await expectMoving(page, '#exList .ex-detail .plate canvas')
    await expectMoving(page, null)
    await row.click()
    await expect(page.locator('#exList .ex-detail')).toHaveCount(0)
    await expectRest(page, null)
  })
})
