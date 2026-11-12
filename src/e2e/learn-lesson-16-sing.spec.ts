// ============================================================
// Lesson 16 Sing it — the first phrase sung from the page into the fake microphone
// ============================================================
//
// WEB-SPEC's Tests 16 and 17 in a browser: G3, A3 20 cents flat, B3, A3
// and G3 (src/e2e/helpers/tone-wav.ts, `writeStepsWav`), played once from
// the moment Start opens the microphone, after 6 s of silence, so they
// come after the start (do, then do, mi, so, mi, do, 4.4 s, and the take's
// 0.4 s) and inside the take's 8 s wait for the voice. From Start to the
// take's end no pitch line is drawn and every other play on the page is
// disabled; the take ends as the fifth note passes, and the pitch line and
// one line a note appear, re read 20 cents below the written note, with no
// octave tag; then Easy draws the second phrase with only the house and
// its Names switch off, and the lines stay.

import { expect, test } from './helpers/lesson-page'
import { fakeMicArgs, writeStepsWav } from './helpers/tone-wav'

/** A note `cents` from `midi`, as Hz. */
const hz = (midi: number, cents = 0): number =>
  440 * 2 ** ((midi - 69) / 12 + cents / 1200)

/** The first phrase for the lower voice, do, re, mi, re, do: G3, A3 20 cents flat, B3, A3, G3. */
const PHRASE_WAV = writeStepsWav(
  [
    { hz: hz(55), seconds: 0.9 },
    { hz: hz(57, -20), seconds: 0.9 },
    { hz: hz(59), seconds: 0.9 },
    { hz: hz(57), seconds: 0.9 },
    { hz: hz(55), seconds: 1.3 },
  ],
  6,
)

test.use({
  launchOptions: { args: fakeMicArgs(PHRASE_WAV, { loop: false }) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 90_000 })

test('the first phrase read from the page: no pitch line and no other play until the take ends, then the pitch line and one line a note, and Easy brings the second phrase with its names off (WEB-SPEC, Tests 16 and 17)', async ({
  page,
}) => {
  // Arrange: sound on, Sing it in the lower voice
  await page.goto('/learn/16')
  await page.locator('#gateBtn').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="lower"]').click()
  const live = page.locator('#singLive')
  const word = page.locator('[data-word-play="sight"]')
  const lines = page.locator('[data-readings] li')

  // Act: Start, the start sung, then the take
  await page.locator('[data-sing="start"]').click()
  const starting = await live.isHidden()
  await expect(page.locator('#singStatus')).toHaveText(
    "Your turn: start on do when you're ready.",
    { timeout: 10_000 },
  )
  const taking = [await live.isHidden(), await word.isDisabled()]
  await expect(live).toBeVisible({ timeout: 20_000 })

  // Assert: Tests 16 and 17, FACTS 46 and 47
  expect(starting).toBe(true)
  expect(taking).toEqual([true, true])
  await expect(word).toBeEnabled()
  await expect(lines).toHaveCount(5)
  await expect(lines.nth(1)).toHaveText(
    /^Re · In the band: (19|20|21) cents below the written note\.$/,
  )
  for (const i of [0, 2, 3, 4])
    await expect(lines.nth(i)).toHaveText(
      /^(Do|Re|Mi) · (Right in the middle|In the band): /,
    )
  await expect(page.locator('#singChart [data-octave-tag]')).toBeHidden()
  await expect(page.locator('#singChart canvas')).toHaveAttribute(
    'aria-label',
    "Your pitch line over the written notes' bands: do, re, mi, re, do.",
  )
  await expect(page.locator('[data-panel="feel"]')).toBeVisible()

  // Act: Easy
  await page.locator('[data-feel="easy"]').click()

  // Assert: the second phrase with only the house, Names off, and the lines kept
  const staff = page.locator('#singStaff')
  await expect(staff.locator('.st-head')).toHaveCount(5)
  await expect(staff.locator('.st-home')).toHaveCount(1)
  await expect(staff.locator('.st-syl')).toHaveCount(0)
  await expect(staff.locator('[data-names="off"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('[data-sing="phrase-2"]')).toBeVisible()
  await expect(live).toBeVisible()
})
