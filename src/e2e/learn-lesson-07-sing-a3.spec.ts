// ============================================================
// Lesson 7 Sing it — a steady A3 from the fake microphone
// ============================================================
//
// WEB-SPEC's end-to-end checks 6, 7 and 11 (Tests), on a steady A3
// (src/e2e/helpers/tone-wav.ts, `writeToneWav(220)`) in the lower voice:
// Start waits for Merc's siren; the take reads as its one note, "about
// A3"; "Easy" offers Again once, and after a second take it is gone, the
// Wrap keeping the Vocal Range Test card; the microphone's tracks stop at
// the end of each take; and nothing from a take is written to storage,
// which holds only the Contract's keys. Every other branch is
// learn-lesson-07-sing.spec.ts's, on a siren.

import { expect, test } from '@playwright/test'
import { again, ending, feel, micAsks, playMerc, start, status, take, toSing, trackStops, watchMic, } from './helpers/lesson-07-sing'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(220, 20)

/** WEB-SPEC's Contract: every key the page may store, and the kit's `fyp-pos`. */
const CONTRACT_KEYS = [
  'fyp-l07-recall-seed',
  'fyp-l07-recall-v1',
  'fyp-l07-seed',
  'fyp-l07-quiz-v1',
  'fyp-done',
  'fyp-voice',
  'fyp-l07-warmup',
  'fyp-motion',
  'fyp-pos',
]

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 120_000 })

test('in the lower voice it reads as its one note; "Easy" offers Again once, and the tracks stop after each take @smoke', async ({
  page,
}) => {
  await watchMic(page)
  await toSing(page)
  await expect(start(page)).toHaveAttribute('aria-disabled', 'true')
  await playMerc(page)
  await expect(start(page)).toHaveAttribute('aria-disabled', 'false')

  const line = await take(page, start(page))
  expect(line).toBe('The lit band is the middle of your siren: about A3.')
  await expect(status(page)).toHaveText(
    'The lit band is the middle of your siren: about A3. How did that feel?',
  )
  await expect
    .poll(() => trackStops(page), { timeout: 5_000 })
    .toBeGreaterThan(0)
  await feel(page, 'easy')
  await expect(page.locator('[data-closing="band"]')).toHaveText(
    "That's it: one gentle siren, done. The lit band shows where its middle notes sat today.",
  )
  await expect(again(page)).toBeVisible()

  const stopped = await trackStops(page)
  await take(page, again(page))
  await expect
    .poll(() => trackStops(page), { timeout: 5_000 })
    .toBeGreaterThan(stopped)
  await feel(page, 'easy')
  await expect(again(page)).toBeHidden()
  await expect(ending(page, 'practise')).toBeVisible()
  await expect(ending(page, 'practise')).toContainText(
    'Ten minutes, gently, most days',
  )
  await expect(ending(page, 'rest')).toBeHidden()
  expect(await micAsks(page)).toBe(2)

  // storage holds only the Contract's keys, and the kit's memory of the
  // furthest step (kit/position.ts): no band, no note, no take, no answer
  const keys = await page.evaluate(() =>
    Array.from(
      { length: localStorage.length },
      (_, i) => localStorage.key(i) ?? '',
    ),
  )
  expect(keys).toContain('fyp-voice')
  for (const key of keys) expect(CONTRACT_KEYS).toContain(key)
})
