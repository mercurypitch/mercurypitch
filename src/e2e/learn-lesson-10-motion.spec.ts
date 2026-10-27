// ============================================================
// Lesson 10 under reduced motion — nothing travels, nothing moves on its own
// ============================================================
//
// WEB-SPEC's thirteenth end-to-end check (Tests, End to end 13), page-wide,
// at 390 x 844 with reduced motion emulated from before the first script.
// No bead travels: each change of the steps' chord beads and of free
// play's, Step 1's third, Step 2's stack, Step 3's root, Step 5's spread and
// free play's slide to B4 and spread to B5, is drawn whole in its first
// frame and then held, so the stack and the spread show in their end
// states at once; and the page asks for no frame after each. Merc and Tavi
// hold still through the cold open's chord, both moves and the reveal,
// with Tavi's celebration skipped. And each section of the page, once on
// screen, asks for no frame and runs no animation. Sing it's ring holding
// still with no ripples, and its guide lighting the path's notes in turn in
// place of its travelling line, are learn-lesson-10-sing.spec.ts's; the
// cold open's bead landing at once is hero-marks.test.ts's. On the e2e
// bundle, which shows drafts.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectAtOnce, expectStill, openStep, watchFrames, } from './helpers/lesson-qa'

/** The steps' chord beads, and their drawing. */
const TOY = '#toyChord'
const TOY_CANVAS = `${TOY} [data-chord-viz] canvas`
/** Free play's, and its drawing. */
const FREE = '#freePlay'
const FREE_CANVAS = `${FREE} [data-chord-viz] canvas`

/**
 * Merc and Tavi, as the hero shows them now, from the same place on the
 * screen each time, with the spiral between them, which lights as a chord
 * sounds, masked out.
 */
async function mercs(page: Page): Promise<Buffer[]> {
  await page
    .locator('#duo')
    .evaluate((el) =>
      el.scrollIntoView({ block: 'center', behavior: 'instant' }),
    )
  const mask = [page.locator('#heroSpiral')]
  return Promise.all(
    ['#mercBlue', '#mercOrange'].map((m) =>
      page.locator(m).screenshot({ mask }),
    ),
  )
}

test.use({ viewport: { width: 390, height: 844 } })
test.describe.configure({ timeout: 120_000 })

test.beforeEach(async ({ page }) => {
  await watchFrames(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('no bead travels in the steps: the third, the stack, the root and the spread land at once, in their end states, and the page rests after each', async ({
  page,
}) => {
  const toy = (sel: string): Locator => page.locator(`${TOY} ${sel}`)

  // Step 1's third, then Step 2's stack
  await openStep(page, '/learn/10', 1)
  await expectStill(page, 'Step 1')
  await expectAtOnce(page, TOY_CANVAS, 'Step 1: Minor', () =>
    toy('[data-chord-quality] [data-quality="minor"]').click(),
  )
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await expect(page.locator('#stepNow')).toHaveText('2')
  await expectStill(page, 'Step 2')
  await expectAtOnce(page, TOY_CANVAS, 'Step 2: Stack a third', () =>
    toy('[data-chord-stack]').click(),
  )
  await expect(toy('.chord-hit')).toHaveCount(5)
  await expectStill(page, 'Step 2, stacked')

  // Step 3's root, then Step 5's spread
  await openStep(page, '/learn/10', 3)
  await expectAtOnce(page, TOY_CANVAS, 'Step 3: Root higher', () =>
    toy('[data-chord-root="1"]').click(),
  )
  await expectStill(page, 'Step 3, on D4')
  await openStep(page, '/learn/10', 5)
  await page.locator('#predictScale [data-choice="three"]').click()
  await expectAtOnce(page, TOY_CANVAS, 'Step 5: Scale', () =>
    toy('[data-chord-view] [data-view="scale"]').click(),
  )
  await expect(toy('[data-chord-targets]')).toBeHidden()
  await expectStill(page, 'Step 5, spread')
})

test('no bead travels in free play: slid to B4 and spread to B5, each lands at once, and it rests after', async ({
  page,
}) => {
  const free = (sel: string): Locator => page.locator(`${FREE} ${sel}`)
  const higher = free('[data-chord-root="1"]')
  await page.goto('/learn/10')
  await free('[data-chord-viz]').scrollIntoViewIfNeeded()
  await expectStill(page, 'free play')

  // Act, Assert: C4 to A4, then the last slide and the spread
  for (let i = 0; i < 5; i++) await higher.click()
  await expectAtOnce(page, FREE_CANVAS, 'free play: Root higher to B4', () =>
    higher.click(),
  )
  await expect(higher).toHaveAttribute('aria-disabled', 'true')
  await expectAtOnce(page, FREE_CANVAS, 'free play: Scale on B4', () =>
    free('[data-view="scale"]').click(),
  )
  await expect(free('[data-chord-targets]')).toBeHidden()
  await expectStill(page, 'free play, spread')
})

test('Merc and Tavi hold still through the chord, both moves and the reveal, and each section asks for no frame once on screen', async ({
  page,
}) => {
  await page.goto('/learn/10')
  const move = (m: string): Locator =>
    page.locator(`.hero-plays [data-play="${m}"]`)
  /** Plays `b` to its end; Merc and Tavi as they stood while it sounded. */
  const playThrough = async (b: Locator): Promise<Buffer[]> => {
    await b.click()
    await expect(b).toHaveClass(/\bis-on\b/)
    const during = await mercs(page)
    await expect(b).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
    return during
  }

  // Act: the cold open at rest, its chord, the choice, both moves, the reveal
  await expectStill(page, 'the cold open')
  const before = await mercs(page)
  const shown = [await playThrough(page.locator('#heroPlay'))]
  await page.locator('#predict [data-choice="mi"]').click()
  shown.push(await playThrough(move('move-mi')))
  shown.push(await playThrough(move('move-so')))
  await expect(page.locator('#predict .reveal')).toBeVisible()
  await expectStill(page, 'the cold open, revealed')
  shown.push(await mercs(page))

  // Assert: the same two stills throughout
  expect(
    shown.map((pair) =>
      pair.map((m, i) => m.equals(before[i] ?? Buffer.alloc(0))),
    ),
  ).toEqual([
    [true, true],
    [true, true],
    [true, true],
    [true, true],
  ])
  // and each section, brought on screen, rests
  for (const s of [
    '#recall',
    '#words',
    '#lesson',
    '#sing',
    '#check',
    '#wrap',
    FREE,
    '#explorer',
  ]) {
    await page
      .locator(s)
      .evaluate((el) =>
        el.scrollIntoView({ block: 'start', behavior: 'instant' }),
      )
    await expectStill(page, s)
  }
})
