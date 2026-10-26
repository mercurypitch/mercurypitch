// ============================================================
// Lesson 9 Sing it — the ladder sung note by note from the fake microphone
// ============================================================
//
// WEB-SPEC's end-to-end check 6 (Tests), its stepped take: D3, F sharp 3,
// A3 and D4 at 1.5 s each (src/e2e/helpers/tone-wav.ts, `writeStepsWav`),
// played once from the moment the page opens the microphone, after 8 s of
// silence, so they start after Merc's ladder (6 s, then the take's 0.4 s
// gap) and inside the take's 6 s wait for the voice. The take's slots are
// timed from its first voiced frame, so each lines up with a step, and all
// four read as landed: "This time, 4 of your 4 notes landed in the band."

import { feel, start, take, toSing } from './helpers/lesson-09-sing'
import { expect, test } from './helpers/lesson-page'
import { fakeMicArgs, writeStepsWav } from './helpers/tone-wav'

const STEPS_WAV = writeStepsWav(
  [146.83, 185.0, 220, 293.66].map((hz) => ({ hz, seconds: 1.5 })),
  8,
)

test.use({
  launchOptions: { args: fakeMicArgs(STEPS_WAV, { loop: false }) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 120_000 })

test('reads D3, F sharp 3, A3 and D4 as four landed notes', async ({
  page,
}) => {
  await toSing(page)

  const lines = await take(page, start(page))
  await feel(page, 'workable')

  expect(lines).toHaveLength(4)
  for (const line of lines)
    expect(line).toMatch(/ · (Right in the middle|In the band): /)
  await expect(page.locator('[data-count-line]')).toHaveText(
    'This time, 4 of your 4 notes landed in the band.',
  )
})
