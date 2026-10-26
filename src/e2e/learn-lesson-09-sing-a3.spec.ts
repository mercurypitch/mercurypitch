// ============================================================
// Lesson 9 Sing it — a steady A3 from the fake microphone
// ============================================================
//
// WEB-SPEC's end-to-end checks 6 and 7 (Tests), on a steady A3
// (src/e2e/helpers/tone-wav.ts, `writeToneWav(220)`) on the lower full
// ladder: so reads "Right in the middle" and the other three far from
// their bands, with "This time, 1 of your 4 notes landed in the band." and
// the tricky line; "Easy" offers Again and Again smaller, and after a
// second take neither shows; "Effortful" shows the gentle line, no Again,
// the feelings locked and the rest card; "Uncomfortable" the doctor lines,
// no Again, no lines and no count, and the rest card; and the
// microphone's tracks stop at the end of each take, and at once when the
// tab is hidden or the section left during one. Merc's ladder is 6 s and a
// take about 7, so the longest test runs about 35 s.

import { after, ending, feel, listening, micAsks, start, status, take, toSing, trackStops, tracksStop, watchMic, } from './helpers/lesson-09-sing'
import { expect, test } from './helpers/lesson-page'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(220, 20)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 120_000 })

test('reads so in the middle and the rest far off, "Easy" offers both Agains once, and the tracks stop after each take', async ({
  page,
}) => {
  await watchMic(page)
  await toSing(page)

  const lines = await take(page, start(page))
  expect(lines).toHaveLength(4)
  expect(lines[0]).toBe(
    'Do · About five semitones below, nearer a different note.',
  )
  expect(lines[1]).toBe(
    'Mi · About three semitones above, nearer a different note.',
  )
  expect(lines[2]).toMatch(/^So · Right in the middle: /)
  expect(lines[3]).toBe(
    'Top do · About five semitones below, nearer a different note.',
  )
  await tracksStop(page, 0)
  await feel(page, 'easy')
  await expect(page.locator('[data-count-line]')).toHaveText(
    'This time, 1 of your 4 notes landed in the band.',
  )
  await expect(page.locator('[data-closing="tricky"]')).toBeVisible()
  await expect(after(page, 'again')).toBeVisible()
  await expect(after(page, 'again-smaller')).toBeVisible()

  const stopped = await trackStops(page)
  await take(page, after(page, 'again'))
  await tracksStop(page, stopped)
  await feel(page, 'easy')
  await expect(after(page, 'again')).toBeHidden()
  await expect(after(page, 'again-smaller')).toBeHidden()
  await expect(ending(page, 'practise')).toBeVisible()
  expect(await micAsks(page)).toBe(2)
})

test('"Effortful" shows the gentle line, no Again, the feelings locked, and rests the Wrap', async ({
  page,
}) => {
  await toSing(page)
  await take(page, start(page))

  await feel(page, 'effortful')

  await expect(page.locator('[data-closing="gentle"]')).toBeVisible()
  await expect(page.locator('[data-count-line]')).toBeVisible()
  await expect(after(page, 'again')).toBeHidden()
  for (const b of await page.locator('[data-feel]').all())
    await expect(b).toBeDisabled()
  await expect(ending(page, 'rest')).toBeVisible()
})

test('"Uncomfortable" shows the doctor lines, no Again, no lines and no count, and rests the Wrap', async ({
  page,
}) => {
  await toSing(page)
  await take(page, start(page))

  await feel(page, 'uncomfortable')

  await expect(page.locator('[data-after-doctor]')).toBeVisible()
  await expect(page.locator('[data-readings]')).toBeHidden()
  await expect(page.locator('[data-count-line]')).toBeHidden()
  await expect(after(page, 'again')).toBeHidden()
  await expect(ending(page, 'rest')).toBeVisible()
})

test("the microphone's tracks stop at once when the tab is hidden during a take", async ({
  page,
}) => {
  await watchMic(page)
  await toSing(page)
  const before = await listening(page)

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })

  await tracksStop(page, before)
  await expect(status(page)).toHaveText('Your turn: do-mi-so-do, slowly.')
  await expect(start(page)).toBeVisible()
})

test("the microphone's tracks stop when the viewer leaves the section during a take", async ({
  page,
}) => {
  await watchMic(page)
  await toSing(page)
  const before = await listening(page)

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))

  // the section stays away 600 ms, then the microphone goes at once
  await tracksStop(page, before)
})
