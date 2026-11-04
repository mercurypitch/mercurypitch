// ============================================================
// Lesson 11 Sing it — one slow siren on the fake microphone
// ============================================================
//
// WEB-SPEC's end-to-end checks for Sing it (Tests). Chromium's fake
// microphone plays a siren gliding from E3 up to C♯4 and back, even in
// semitones (src/e2e/helpers/tone-wav.ts, `writeGlideWav`), in a loop, so
// it never falls quiet and a take runs its full fourteen seconds. The take
// is drawn and read by nothing: the chart's summary is "Your siren, drawn
// as a line.", and "How did that feel?" follows. "Easy" closes on the plain
// line and offers Again; "Effortful" shows the gentle line, no Again, Merc's
// slow siren still to play, and the rest card. With sound off, Start stays
// unavailable after Merc's siren, with the sound-off hint. "Just listen
// today" never asks for the microphone, and a refused microphone listens
// only and keeps the practice card. The microphone's tracks stop when the
// tab is hidden during a take. Merc's siren is 8.5 s and a take about 15 s,
// so the longest test runs about 30 s.

import type { Locator, Page } from '@playwright/test'
import { micAsks, trackStops, watchMic } from './helpers/lesson-07-sing'
import { expect, test } from './helpers/lesson-page'
import { fakeMicArgs, writeGlideWav } from './helpers/tone-wav'

const GLIDE_WAV = writeGlideWav(164.81, 277.18, 4)

test.use({
  launchOptions: { args: fakeMicArgs(GLIDE_WAV) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 120_000 })

/**
 * Opens Sing it with a voice stored as an earlier lesson stores it, and
 * answers the comfort check: "Sing along" by default, or "Just listen
 * today".
 */
async function toSing(
  page: Page,
  comfort: 'sing' | 'listen' = 'sing',
): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('l11.seeded') === '1') return
    sessionStorage.setItem('l11.seeded', '1')
    localStorage.setItem('fyp-voice', JSON.stringify('lower'))
  })
  await page.goto('/learn/11#sing')
  await page.locator(`[data-comfort="${comfort}"]`).click()
  if (comfort === 'sing')
    await expect(page.locator('[data-panel="prepare"]')).toBeVisible()
}

const status = (page: Page): Locator => page.locator('#singStatus')
const start = (page: Page): Locator =>
  page.locator('[data-panel="prepare"] [data-sing="start"]')
const again = (page: Page): Locator =>
  page.locator('[data-panel="after"] [data-sing="again"]')
const ending = (page: Page, which: 'practise' | 'rest'): Locator =>
  page.locator(`#practiseCard [data-ending="${which}"]`)
const feel = (page: Page, f: string): Promise<void> =>
  page.locator(`[data-panel="feel"] [data-feel="${f}"]`).click()

/** Plays Merc's slow siren to its end: 8.5 s. */
async function playMerc(page: Page): Promise<void> {
  await page.locator('[data-panel="prepare"] [data-merc-siren]').click()
  await expect(status(page)).toHaveText(
    'Merc sings the slow siren on “ng”: listen to the way it slides.',
  )
  await expect(status(page)).not.toHaveText(/^Merc sings/, { timeout: 20_000 })
}

/** Presses Start, and waits for the take to end with its question. */
async function take(page: Page): Promise<void> {
  await start(page).click()
  await expect(status(page)).toHaveText(
    'Breathe, then hum one slow siren on “ng”, up only as far as is easy and back. We stop listening when you stop.',
    { timeout: 10_000 },
  )
  await expect(page.locator('[data-panel="feel"]')).toBeVisible({
    timeout: 30_000,
  })
}

test('a take draws the siren as a line, names nothing on it, asks how it felt; "Easy" offers Again', async ({
  page,
}) => {
  await watchMic(page)
  await toSing(page)
  await playMerc(page)

  await take(page)

  await expect(status(page)).toHaveText(
    'Your siren, drawn as a line. How did that feel?',
  )
  await expect(page.locator('#singChart canvas')).toHaveAttribute(
    'aria-label',
    'Your siren, drawn as a line.',
  )
  expect(await micAsks(page)).toBe(1)
  await feel(page, 'easy')
  await expect(page.locator('[data-closing="plain"]')).toHaveText(
    "That's it: one slow siren, done. Flip or no flip, that's a whole siren.",
  )
  await expect(again(page)).toBeVisible()
  await expect(again(page)).toHaveAccessibleName('Again: one more slow siren')
  await expect(ending(page, 'practise')).toBeVisible()
})

test('"Effortful" shows the gentle line, no Again, Merc\'s slow siren still to play, and rests the Wrap', async ({
  page,
}) => {
  await toSing(page)
  await playMerc(page)
  await take(page)

  await feel(page, 'effortful')

  await expect(page.locator('[data-closing="gentle"]')).toHaveText(
    'Keep it gentle: rest before you sing again.',
  )
  await expect(again(page)).toBeHidden()
  await expect(start(page)).toBeHidden()
  await expect(
    page.locator('[data-listen-play] [data-merc-siren]'),
  ).toBeVisible()
  await expect(ending(page, 'rest')).toBeVisible()
  await expect(ending(page, 'practise')).toBeHidden()
})

test("with sound off, Start stays unavailable after Merc's slow siren, and the hint says sound is off", async ({
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
    "Sound is off, so nothing played. Turn sound on to hear Merc's slow siren, then press Start.",
  )
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
  await expect(status(page)).toHaveText(/^Merc sings the slow siren/)
  expect(await micAsks(page)).toBe(0)
})

test('a refused microphone listens only, and keeps the practice card', async ({
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
