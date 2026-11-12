// ============================================================
// Lesson 18 Sing it — tune 1 sung in time into the fake microphone
// ============================================================
//
// WEB-SPEC's Tests 17 and 18 in a browser: tune 1 for the lower voice, do
// re mi so, so mi do, G3 A3 B3 D4, then D4 B3 and G3 held two beats, with
// mi 20 cents flat and a breath before the bar line
// (src/e2e/helpers/tone-wav.ts, `writeStepsWav`), played once from the
// moment Start opens the microphone, after 6 s of silence. The start takes
// 5.5 s from there to bar 1's first beat (do, its 0.4 s of quiet and the
// count-in's bar), so the tune comes in about half a beat late, a steady
// delay the take's anchor moves every note's beats by. From Start every
// other play on the page is disabled and no pitch line is drawn, and from
// bar 1's first beat to the take's end no sound plays, the click included.
// The take ends as the last note's window closes, and the pitch line and
// one line a note appear, mi read 20 cents below the written note; then
// Easy brings tune 2, and the lines stay.

import { expect, test } from './helpers/lesson-page'
import { fakeMicArgs, writeStepsWav } from './helpers/tone-wav'

/** A note `cents` from `midi`, as Hz. */
const hz = (midi: number, cents = 0): number =>
  440 * 2 ** ((midi - 69) / 12 + cents / 1200)

/** Tune 1 for the lower voice at 60 BPM, a beat a second: G3, A3, B3 20 cents flat, D4, a breath, D4, B3, G3. */
const TUNE_WAV = writeStepsWav(
  [
    { hz: hz(55), seconds: 1 },
    { hz: hz(57), seconds: 1 },
    { hz: hz(59, -20), seconds: 1 },
    { hz: hz(62), seconds: 0.85 },
    { hz: 0, seconds: 0.15 },
    { hz: hz(62), seconds: 1 },
    { hz: hz(59), seconds: 1 },
    { hz: hz(55), seconds: 2 },
  ],
  6,
)

test.use({
  launchOptions: { args: fakeMicArgs(TUNE_WAV, { loop: false }) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 90_000 })

test('tune 1 sung in time: every other play disabled from Start, no sound and no pitch line from half a beat before bar 1 to the take’s end, then the pitch line and one line a note, and Easy brings tune 2 (WEB-SPEC, Tests 17 and 18)', async ({
  page,
}) => {
  // Arrange: the moment the page starts each sound kept; sound on, Sing it
  // in the lower voice
  await page.addInitScript(() => {
    const w = window as unknown as { starts: number[] }
    w.starts = []
    const start = AudioScheduledSourceNode.prototype.start
    AudioScheduledSourceNode.prototype.start = function (
      this: AudioScheduledSourceNode,
      ...args: Parameters<typeof start>
    ) {
      w.starts.push(performance.now())
      start.apply(this, args)
    }
  })
  await page.goto('/learn/18')
  await page.locator('#gateBtn').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="lower"]').click()
  const live = page.locator('#singLive')
  const word = page.locator('[data-word-play="slur"]')
  const lines = page.locator('[data-readings] li')

  // Act: Start, the count-in, then bar 1's first beat, timed on the page
  await page.locator('[data-sing="start"]').click()
  await expect(page.locator('#singStatus')).toHaveText(
    'Counting in: one bar.',
    { timeout: 6000 },
  )
  const counting = [await word.isDisabled(), await live.isHidden()]
  const bar1 = await page.waitForFunction(
    () =>
      document.querySelector('#singStatus')?.textContent?.trim() ===
        'Your turn: sing in time with the cursor.' && performance.now(),
    undefined,
    { polling: 'raf', timeout: 10_000 },
  )
  const bar1At = (await bar1.jsonValue()) as number
  const taking = [await word.isDisabled(), await live.isHidden()]
  await expect(lines).toHaveCount(7, { timeout: 20_000 })
  const starts = await page.evaluate(
    () => (window as unknown as { starts: number[] }).starts,
  )

  // Assert: Tests 17 and 18 (FACTS 52 to 54)
  expect(counting).toEqual([true, true])
  expect(taking).toEqual([true, true])
  // do and the clicks before; nothing booked from 0.9 s before bar 1, as
  // the beat clock books each sound 0.1 s ahead, bar 1's click included
  expect(starts.filter((t) => t < bar1At - 900).length).toBeGreaterThan(0)
  expect(starts.filter((t) => t >= bar1At - 900)).toEqual([])
  await expect(word).toBeEnabled()
  await expect(live).toBeVisible()
  await expect(lines.nth(2)).toHaveText(
    /^Mi · In the band: (19|20|21) cents below the written note\.$/,
  )
  for (const i of [0, 1, 3, 4, 5, 6])
    await expect(lines.nth(i)).toHaveText(
      /^(Do|Re|Mi|So) · (Right in the middle|In the band): /,
    )
  await expect(page.locator('#singChart [data-octave-tag]')).toBeHidden()
  await expect(page.locator('#singChart canvas')).toHaveAttribute(
    'aria-label',
    "Your pitch line over the written notes' bands: do, re, mi, so, so, mi, do.",
  )
  await expect(page.locator('[data-panel="feel"]')).toBeVisible()

  // Act: Easy
  await page.locator('[data-feel="easy"]').click()

  // Assert: tune 2 on the staff, offered, and the lines kept
  await expect(page.locator('[data-sing-viz="1"]')).toHaveAttribute(
    'aria-label',
    'Bass staff, two bars of 4/4: G, G, B, B, then a long D and a long G, with a breath mark at the bar line',
  )
  await expect(page.locator('[data-sing="tune-2"]')).toBeVisible()
  await expect(lines).toHaveCount(7)
})
