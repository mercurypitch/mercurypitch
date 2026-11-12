// ============================================================
// Lesson 20 Sing it — the run sung back from the fake microphone
// ============================================================
//
// WEB-SPEC, Toys 6, in the browser. The run sung back: D3, E3, F sharp 3,
// A3, B3, A3, F sharp 3, E3 and D3 at 0.75 s each (src/e2e/helpers/
// tone-wav.ts, `writeStepsWav`), played once from the moment the page opens
// the microphone, after 8 s of silence, so they start after Merc's run
// (6.75 s, then the take's 0.4 s gap) and inside the take's 6 s wait for
// the voice. The take's slots are timed from its first voiced frame, so
// each lines up with a note, and all nine read as landed. Then Again,
// faster plays the run at 0.45 s a note, the count-in and the guide, with
// nothing listening, and asks again (states 4 to 8). And with the
// microphone refused, Play Merc's run sings on into the guide's sweep, lit
// until the sweep ends (state 9). The card's steps are Lesson 9's, the same
// kit card (src/e2e/helpers/lesson-09-sing.ts), on this page.

import type { Locator, Page } from '@playwright/test'
import { after, feel, micAsks, prepare, start, status, tap, watchMic, } from './helpers/lesson-09-sing'
import { expect, test } from './helpers/lesson-page'
import { fakeMicArgs, writeStepsWav } from './helpers/tone-wav'

/** The run from D3: do, re, mi, so, la, so, mi, re, do. */
const RUN_HZ = [146.83, 164.81, 185, 220, 246.94, 220, 185, 164.81, 146.83]
const RUN_WAV = writeStepsWav(
  RUN_HZ.map((hz) => ({ hz, seconds: 0.75 })),
  8,
)

test.use({
  launchOptions: { args: fakeMicArgs(RUN_WAV, { loop: false }) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 120_000 })

/** The status line while the take listens. */
const TAKE_LINE = "Start on do when you're ready."

/** Opens Sing it with the lower voice stored, as an earlier lesson stores it, and answers the comfort check. */
async function toSing(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('l20.seeded') === '1') return
    sessionStorage.setItem('l20.seeded', '1')
    localStorage.setItem('fyp-voice', JSON.stringify('lower'))
  })
  await page.goto('/learn/20#sing')
  await page.locator('[data-comfort="sing"]').click()
}

/** Presses `button`, waits through Merc's run and the take, and gives the reading's lines. */
async function take(page: Page, button: Locator): Promise<string[]> {
  await tap(button)
  await expect(status(page)).toHaveText(TAKE_LINE, { timeout: 20_000 })
  await expect(status(page)).toHaveText('How did that feel?', {
    timeout: 30_000,
  })
  return page.locator('[data-readings] li').allTextContents()
}

test('reads the run sung back as nine landed notes; then Again, faster plays with nothing listening, and asks again', async ({
  page,
}) => {
  // Arrange
  await watchMic(page)
  await toSing(page)

  // Act: the take, "Easy", and the faster pass run to its end
  const lines = await take(page, start(page))
  await feel(page, 'easy')
  await expect(page.locator('[data-count-line]')).toHaveText(
    'This time, 9 of your 9 notes landed in the band.',
  )
  const asked = await micAsks(page)
  await tap(after(page, 'faster'))
  const passing = await status(page).textContent()
  await expect(status(page)).toHaveText('How did that feel?', {
    timeout: 15_000,
  })
  await feel(page, 'easy')

  // Assert
  expect(lines).toEqual([
    "Do · Right in the middle: on Merc's note.",
    "Re · Right in the middle: on Merc's note.",
    "Mi · Right in the middle: on Merc's note.",
    "So · Right in the middle: on Merc's note.",
    "La · Right in the middle: on Merc's note.",
    "So again · Right in the middle: on Merc's note.",
    "Mi again · Right in the middle: on Merc's note.",
    "Re again · Right in the middle: on Merc's note.",
    "Do again · Right in the middle: on Merc's note.",
  ])
  expect(passing).toBe('Sing along as each bead lights, if you like.')
  expect(await micAsks(page)).toBe(asked)
  await expect(page.locator('[data-closing="faster"]')).toBeVisible()
  await expect(after(page, 'faster')).toBeHidden()
})

test("with the microphone refused, Play Merc's run sings on into the guide's sweep, lit until the sweep ends", async ({
  page,
}) => {
  // Arrange
  await watchMic(page, true)
  await toSing(page)
  await tap(start(page))
  await expect(status(page)).toHaveText(
    'No microphone? Sing along anyway: Merc sings the run first, and nothing listens.',
  )
  const merc = prepare(page).locator('[data-merc-ladder]')

  // Act: Merc 6.75 s, the take's 0.4 s gap, the sweep 6.75 s
  const began = Date.now()
  await tap(merc)
  await expect(merc).toHaveClass(/\bis-on\b/)
  await expect(merc).not.toHaveClass(/\bis-on\b/, { timeout: 20_000 })
  const lit = Date.now() - began

  // Assert: longer than Merc alone, and no longer than the three together
  expect(lit).toBeGreaterThan(12_000)
  expect(lit).toBeLessThan(18_000)
})
