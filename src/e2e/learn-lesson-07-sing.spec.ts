// ============================================================
// Lesson 7 Sing it — every branch, on a siren from the fake microphone
// ============================================================
//
// WEB-SPEC's end-to-end checks 6 and 7 (Tests). Chromium's fake microphone
// plays a siren gliding from E3 up to E4 and back, even in semitones
// (src/e2e/helpers/tone-wav.ts, `writeGlideWav`), in a loop, so it never
// falls quiet and a take runs its full ten seconds, holding a whole turn at
// each end from any starting point. The reading is its middle half, "about
// G3 to C♯4", spoken "C sharp 4" in the status line; "Effortful" after it
// shows the gentle line, no Again, and the rest card. "Uncomfortable" shows
// the doctor lines, no Again, and the rest card. With sound off, Start
// stays unavailable after Merc's siren, with the sound-off hint. "Just
// listen today" never asks for the microphone, and a refused microphone
// listens only and keeps the Vocal Range Test card. The microphone's tracks
// stop when the tab is hidden during a take, and when the viewer leaves
// the section. A steady A3, its one-note reading and Again are
// learn-lesson-07-sing-a3.spec.ts's. Merc's siren is 6 s and a take about
// 11 s, so the longest test runs about 30 s.

import { expect, test } from '@playwright/test'
import { again, ending, feel, micAsks, playMerc, start, status, take, toSing, trackStops, watchMic, } from './helpers/lesson-07-sing'
import { fakeMicArgs, writeGlideWav } from './helpers/tone-wav'

const GLIDE_WAV = writeGlideWav(164.81, 329.63, 3)

test.use({
  launchOptions: { args: fakeMicArgs(GLIDE_WAV) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 120_000 })

test('the glide reads its middle half, about G3 to C♯4, spoken C sharp 4; "Effortful" rests the Wrap', async ({
  page,
}) => {
  await toSing(page)
  await playMerc(page)

  const line = await take(page, start(page))

  expect(line).toBe(
    'The lit band is the middle half of your siren: about G3 to C♯4.',
  )
  await expect(status(page)).toContainText('about G3 to C sharp 4')
  await expect(status(page)).not.toHaveText(/[♯♭]/)

  await feel(page, 'effortful')
  await expect(page.locator('[data-closing="gentle"]')).toHaveText(
    'Keep it gentle: rest before you sing again.',
  )
  await expect(again(page)).toBeHidden()
  await expect(ending(page, 'rest')).toBeVisible()
  await expect(ending(page, 'practise')).toBeHidden()
})

test("with sound off, Start stays unavailable after Merc's siren, and the hint says sound is off", async ({
  page,
}) => {
  await toSing(page)
  // the switch turns sound on from unset, then off
  await page.locator('#soundSwitch').click()
  await page.locator('#soundSwitch').click()
  await expect(page.locator('#soundSwitch')).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await playMerc(page)

  await expect(start(page)).toHaveAttribute('aria-disabled', 'true')
  await expect(page.locator('[data-start-hint]')).toHaveText(
    "Sound is off, so nothing played. Turn sound on to hear Merc's siren, then press Start.",
  )
})

test('"Uncomfortable" shows the doctor lines, no Again and no band, and rests the Wrap', async ({
  page,
}) => {
  await toSing(page)
  await playMerc(page)
  await take(page, start(page))

  await feel(page, 'uncomfortable')

  await expect(page.locator('[data-closing="enough"]')).toBeVisible()
  await expect(page.locator('[data-after-doctor]')).toBeVisible()
  await expect(again(page)).toBeHidden()
  await expect(ending(page, 'rest')).toBeVisible()
  await expect(ending(page, 'practise')).toBeHidden()
})

test('"Just listen today" never asks for the microphone, shows the doctor lines and rests the Wrap', async ({
  page,
}) => {
  await watchMic(page)

  await toSing(page, 'listen')

  await expect(status(page)).toHaveText(
    'Just listening today: the microphone stays off.',
  )
  await expect(page.locator('.doctor[data-listen-why="listen"]')).toBeVisible()
  await expect(start(page)).toBeHidden()
  await expect(ending(page, 'rest')).toBeVisible()
  await page.locator('[data-listen-play] [data-merc-siren]').click()
  await expect(status(page)).toHaveText(/^Merc sings the siren/)
  expect(await micAsks(page)).toBe(0)
})

test('a refused microphone listens only, and keeps the Vocal Range Test card', async ({
  page,
}) => {
  await watchMic(page, true)
  await toSing(page)
  await playMerc(page)

  await start(page).click()

  await expect(status(page)).toHaveText(
    'No microphone? Sing along anyway: Merc sings the siren first, and nothing listens.',
  )
  await expect(page.locator('[data-listen-why="nomic"]')).toBeVisible()
  await expect(ending(page, 'practise')).toBeVisible()
  expect(await micAsks(page)).toBe(1)
})

test("the microphone's tracks stop when the tab is hidden during a take", async ({
  page,
}) => {
  await watchMic(page)
  await toSing(page)
  await playMerc(page)
  await start(page).click()
  await expect(status(page)).toHaveText(/^Breathe, then hum/, {
    timeout: 10_000,
  })
  const before = await trackStops(page)

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

  await expect
    .poll(() => trackStops(page), { timeout: 2_000 })
    .toBeGreaterThan(before)
  await expect(status(page)).toHaveText(
    'Stopped listening: the microphone is off.',
    { timeout: 10_000 },
  )
})

test("the microphone's tracks stop when the viewer leaves the section during a take", async ({
  page,
}) => {
  await watchMic(page)
  await toSing(page)
  await playMerc(page)
  await start(page).click()
  await expect(status(page)).toHaveText(/^Breathe, then hum/, {
    timeout: 10_000,
  })
  const before = await trackStops(page)

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))

  // the section stays away 600 ms, then the manager's 2 s linger closes the device
  await expect
    .poll(() => trackStops(page), { timeout: 8_000 })
    .toBeGreaterThan(before)
})
