// ============================================================
// Lesson 9 Sing it — a steady D3 from the fake microphone
// ============================================================
//
// WEB-SPEC's end-to-end check 6 (Tests), on a steady D3
// (src/e2e/helpers/tone-wav.ts, `writeToneWav(146.83)`) on the lower full
// ladder: do reads "Right in the middle", and the top do too, "You sang it
// an octave lower: same note.", landed.

import { feel, start, take, toSing } from './helpers/lesson-09-sing'
import { expect, test } from './helpers/lesson-page'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(146.83, 20)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 120_000 })

test('reads the top do an octave lower, on its note, and counts it landed', async ({
  page,
}) => {
  await toSing(page)

  const lines = await take(page, start(page))
  await feel(page, 'workable')

  expect(lines[0]).toMatch(/^Do · Right in the middle: /)
  expect(lines[3]).toMatch(
    /^Top do · Right in the middle: .+ You sang it an octave lower: same note\.$/,
  )
  await expect(page.locator('[data-count-line]')).toHaveText(
    'This time, 2 of your 4 notes landed in the band.',
  )
})
