// ============================================================
// Lesson 12 under reduced motion — nothing travels, nothing moves on its own
// ============================================================
//
// WEB-SPEC's thirteenth end-to-end check (Tests, End to end 13), page-wide,
// at 390 x 844 with reduced motion emulated from before the first script.
// No room travels: Step 2's key switch turns every room round the ring at
// once, drawn whole in its first frame and then held, and so does free
// play's; and the page asks for no frame after each. The walk draws each
// segment whole as its note starts, so a tune asks for frames only while
// it plays, and once it ends the page rests again. Merc and Tavi hold still
// through the cold open's four chords, both tunes and the reveal, with
// Tavi's celebration skipped. And each section of the page, once on screen,
// asks for no frame and runs no animation. The corner's slide landing at
// once is rooms-draw.test.ts's. On the e2e bundle, which shows drafts.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectAtOnce, expectStill, openStep, watchFrames, } from './helpers/lesson-qa'

/** The steps' ring of rooms, and its drawing. */
const TOY = '#toyRooms'
const TOY_CANVAS = `${TOY} [data-rooms-viz] canvas`
/** Free play's, and its drawing. */
const FREE = '#freePlay'
const FREE_CANVAS = `${FREE} [data-rooms-viz] canvas`

/**
 * Merc and Tavi, as the hero shows them now, from the same place on the
 * screen each time, with the ring between them, which lights as a chord
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

test('no room travels: the key switch turns every room at once, on the stage and in free play, and the page rests after each', async ({
  page,
}) => {
  // Step 2's key switch
  await openStep(page, '/learn/12', 2)
  await expectStill(page, 'Step 2')
  await expectAtOnce(page, TOY_CANVAS, 'Step 2: G', () =>
    page.locator(`${TOY} [data-rooms-key] [data-key="G"]`).click(),
  )
  await expectStill(page, 'Step 2, in G')

  // free play's
  await page.locator(FREE).scrollIntoViewIfNeeded()
  await expectStill(page, 'free play')
  await expectAtOnce(page, FREE_CANVAS, 'free play: G', () =>
    page.locator(`${FREE} [data-rooms-key] [data-key="G"]`).click(),
  )
  await expectStill(page, 'free play, in G')
})

test('Merc and Tavi hold still through the four chords, both tunes and the reveal, and each section asks for no frame once on screen', async ({
  page,
}) => {
  await page.goto('/learn/12')
  const tune = (t: string): Locator =>
    page.locator(`.hero-plays [data-play="${t}"]`)
  /** Plays `b` to its end; Merc and Tavi as they stood while it sounded. */
  const playThrough = async (b: Locator): Promise<Buffer[]> => {
    await b.click()
    await expect(b).toHaveClass(/\bis-on\b/)
    const during = await mercs(page)
    await expect(b).not.toHaveClass(/\bis-on\b/, { timeout: 15_000 })
    return during
  }

  // Act: the cold open at rest, its four chords, the choice, both tunes, the reveal
  await expectStill(page, 'the cold open')
  const before = await mercs(page)
  const shown = [await playThrough(page.locator('#heroPlay'))]
  await page.locator('#predict [data-choice="hardly"]').click()
  shown.push(await playThrough(tune('tune-1')))
  shown.push(await playThrough(tune('tune-2')))
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
