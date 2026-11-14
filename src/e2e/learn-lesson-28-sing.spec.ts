// ============================================================
// Lesson 28 Sing it — a run sung back from the fake microphone
// ============================================================
//
// WEB-SPEC, Toys 6 and Tests 8, 10 and 12, in the browser, on one file
// (src/e2e/helpers/tone-wav.ts, `writeStepsWav`) played once from each
// opening of the microphone: G3 from 0.3 s to 1.5 s, then Merc's part,
// bars 1 to 8 at 72 BPM, from 5.2 s, with its breaths after bars 2, 4 and
// 6 and a gap between the two D3s. With headphones the quiet check plays
// Tavi's part's first 2.0 s and hears the G3, so no run starts and its
// line says why, offering No headphones. Alone, there is no check: do at
// once, 0.4 s of quiet and the count-in put bar 1 about 4.9 s after the
// microphone opens, so the part comes in about a third of a beat late, and
// the take reads it in time from its first note. The recording is kept,
// in memory only, and plays back with Tavi's part; Delete drops it and the
// lines stay.

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import type { ToneStep } from './helpers/tone-wav'
import { fakeMicArgs, writeStepsWav } from './helpers/tone-wav'

/** Merc's part, bars 1 to 8: each note's hertz, to the nearest, and its beats. */
const MERC: readonly (readonly [hz: number, beats: number])[] = [
  [196, 2],
  [185, 2],
  [165, 2],
  [196, 2],
  [220, 2],
  [196, 2],
  [147, 4],
  [196, 2],
  [220, 2],
  [247, 2],
  [196, 2],
  [147, 2],
  [147, 2],
  [196, 4],
]
const BEAT_SEC = 60 / 72
/** The rest a note gives up at its end: a breath after bars 2, 4 and 6, and a gap between the two D3s. */
const REST: Readonly<Record<number, number>> = {
  3: 0.3,
  6: 0.3,
  10: 0.3,
  11: 0.1,
}

/** Seconds to two places: the file's name holds every step's. */
const sec = (s: number): number => Math.round(s * 100) / 100

/** The G3 the quiet check hears, then the part from 5.2 s. */
const STEPS: ToneStep[] = [
  { hz: 196, seconds: 1.2 },
  { hz: 0, seconds: 3.7 },
  ...MERC.flatMap(([hz, beats], i): ToneStep[] => {
    const rest = REST[i] ?? 0
    const note = { hz, seconds: sec(beats * BEAT_SEC - rest) }
    return rest > 0 ? [note, { hz: 0, seconds: rest }] : [note]
  }),
]
const SUNG_WAV = writeStepsWav(STEPS, 0.3)

test.use({
  launchOptions: { args: fakeMicArgs(SUNG_WAV, { loop: false }) },
  permissions: ['microphone'],
})
test.describe.configure({ timeout: 120_000 })

/**
 * Keeps the page's last microphone stream, to see it let go, and every
 * buffer the page starts, with its length, from before its first script.
 */
async function watchMicAndBuffers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      lastStream: MediaStream | null
      buffers: number[]
    }
    w.lastStream = null
    w.buffers = []
    const media = navigator.mediaDevices as MediaDevices | undefined
    if (media !== undefined) {
      const ask = media.getUserMedia.bind(media)
      media.getUserMedia = async (constraints) => {
        const stream = await ask(constraints)
        w.lastStream = stream
        return stream
      }
    }
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (
      this: AudioBufferSourceNode,
      ...args: Parameters<typeof start>
    ) {
      w.buffers.push(this.buffer?.duration ?? 0)
      start.apply(this, args)
    }
  })
}

/** Whether the page has let go of the microphone: every track of its last stream ended. */
const micLetGo = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const s = (window as unknown as { lastStream: MediaStream | null })
      .lastStream
    return s !== null && s.getTracks().every((t) => t.readyState === 'ended')
  })

/** The lengths of the buffers the page has started, s. */
const buffers = (page: Page): Promise<number[]> =>
  page.evaluate(() => (window as unknown as { buffers: number[] }).buffers)

test("with headphones the quiet check hears a note and starts no run; alone, the part sung from the file reads in the band, its take plays back with Tavi's part, and Delete drops it, the lines staying (WEB-SPEC, Tests 8, 10 and 12)", async ({
  page,
}) => {
  // Arrange: sound on from the gate, the choice made, the lower voice and headphones
  await watchMicAndBuffers(page)
  await page.goto('/learn/28')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="merc"]').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  const status = page.locator('#singStatus')
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="lower"]').click()
  await page.locator('[data-phones="on"]').click()

  // Act: Start, with the G3 in the microphone during Tavi's part
  await page.locator('[data-panel="start"] [data-sing="start"]').click()

  // Assert: no run, the line over Start, beside No headphones
  const heardLine =
    "The microphone heard a note during Tavi's part. Check your headphones, or choose No headphones to sing alone."
  await expect(status).toHaveText(heardLine, { timeout: 8000 })
  await expect(page.locator('[data-quiet-failed]')).toHaveText(heardLine)
  await expect(page.locator('[data-phones="off"]')).toBeVisible()

  // Act: No headphones, once the microphone is let go, so the next Start
  // opens it afresh and the file plays from its start; then the run
  await expect.poll(() => micLetGo(page)).toBe(true)
  await page.locator('[data-phones="off"]').click()
  await expect(status).toHaveText(
    "Read what this does, then press Start, or hear Tavi's part first.",
  )
  await page.locator('[data-panel="start"] [data-sing="start"]').click()

  // Assert: do, the count-in and the take, then a line a note, each in the band
  await expect(status).toHaveText('Merc sings do.', { timeout: 5000 })
  await expect(status).toHaveText('Your turn: sing in time with the cursor.', {
    timeout: 10_000,
  })
  await expect(status).toHaveText('How did that feel?', { timeout: 40_000 })
  const lines = await page.locator('[data-readings] li').allTextContents()
  expect(lines).toHaveLength(14)
  expect(
    lines.filter((l) => !/In the band|Right in the middle/.test(l)),
  ).toEqual([])
  const hear = page.locator('[data-sing="playback"]')
  await expect(hear).toBeVisible()
  await expect(hear).toHaveText("Hear it with Tavi's part")

  // Act: the take with Tavi's part
  const before = await buffers(page)
  await hear.click()

  // Assert: the recording, longer than the part's 26.67 s, plays
  await expect(status).toHaveText("Your take with Tavi's part.")
  await expect
    .poll(async () =>
      (await buffers(page)).slice(before.length).some((s) => s > 26),
    )
    .toBe(true)

  // Act: Delete your take
  await page.locator('[data-sing="delete"]').click()

  // Assert: the take gone, the lines kept
  await expect(status).toHaveText('Your take is deleted. The lines stay.')
  await expect(hear).toBeHidden()
  await expect(page.locator('[data-readings] li')).toHaveCount(14)
})
