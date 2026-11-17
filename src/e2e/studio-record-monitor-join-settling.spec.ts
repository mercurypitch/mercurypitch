// Studio monitoring, a second lane armed while the microphone settles — with monitoring on, a lane armed on a microphone whose first lane opened it a moment ago is heard the moment that input settles, together with the first lane, not a settle of its own later, and no step is steeper than the tones' own.
import { expect, type Page, test } from '@playwright/test'
import { openArrangement } from './helpers/dedicatedstudio-fixture'
import { armButton, armLane, recordButton, setLaneInput, setMonitoring, } from './helpers/studio-arming'
import { tapMicrophone } from './helpers/studio-mic-tap'
import { steepest, steepestStep } from './helpers/studio-monitor-steps'
import { captureStudioOutput, clearClicks, importWav, noiseWav, readClicks, recordOutput, untilAudioClock, } from './helpers/studio-output-capture'
import { captureSpan, toneAmplitude } from './helpers/studio-output-span'
import { fakeMicArgs, writeStereoToneWav } from './helpers/tone-wav'

/** Phrase hears Input 1, Second Input 2: each lane's tone tells it apart in the output. */
const PHRASE_HZ = 110
const SECOND_HZ = 165
const MIC_WAV = writeStereoToneWav(PHRASE_HZ, SECOND_HZ, 10)
/** A window holding whole periods of both tones (two of 110 Hz, three of 165 Hz), so each reads the other as nothing. */
const WINDOW = Math.round(48_000 / 55)
/** How far apart the envelope is read. */
const HOP = 128
/**
 * How long after the microphone's first sound Second is pressed: well past
 * its arrival, so a lane waiting out a settle of its own is heard a tenth
 * of a second after Phrase, and well inside the quarter of a second Phrase
 * waits.
 */
const PRESS_AFTER_ARRIVAL_SECONDS = 0.08
/** How long a monitor waits on a new input's first sound before it rises (input-monitor.ts SETTLE_MS). */
const SETTLE_SECONDS = 0.25
/** How far apart two lanes rising together may be heard: a render quantum or two, and the window's reach. */
const TOGETHER_WITHIN_SECONDS = 0.03

test.use({
  launchOptions: { args: fakeMicArgs(MIC_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

/** Whether the Studio holds a microphone now, and whether one is still open (mic-sentinel.ts). */
function micState(
  page: Page,
): Promise<{ holds: readonly string[]; streamLive: boolean }> {
  return page.evaluate(() => {
    const sentinel = (
      window as unknown as {
        __micSentinel?: {
          dump: () => { holds: readonly string[]; streamLive: boolean }
        }
      }
    ).__micSentinel
    if (sentinel === undefined) throw new Error('No mic sentinel.')
    const { holds, streamLive } = sentinel.dump()
    return { holds, streamLive }
  })
}

/** The newest microphone source the tap has seen; 0 for none. */
function newestSource(page: Page): Promise<number> {
  return page.evaluate(() =>
    (window.__micTap ?? []).reduce(
      (most, { source }) => Math.max(most, source),
      0,
    ),
  )
}

/** Wait for the first sound of a microphone source newer than `after`; resolves with its time on the audio clock. */
async function firstSound(page: Page, after: number): Promise<number> {
  const handle = await page.waitForFunction(
    (older) => {
      for (const { source, frame, channels } of window.__micTap ?? []) {
        if (source <= older) continue
        const at = channels[0].findIndex(
          (value, i) => value !== 0 || (channels[1]?.[i] ?? 0) !== 0,
        )
        if (at >= 0) return (frame + at) / 48_000
      }
      return null
    },
    after,
    { polling: 5, timeout: 10_000 },
  )
  return (await handle.jsonValue()) as number
}

/**
 * Each tone's level in the output, a window at a time from `from`: where
 * it is first heard at a third of its level once both lanes play on, in
 * seconds on the audio clock.
 */
function heardAt(
  span: Awaited<ReturnType<typeof captureSpan>>,
  from: number,
  hz: number,
  level: number,
): number | null {
  for (let at = from; at + WINDOW <= span.samples.length; at += HOP)
    if (toneAmplitude(span, at, WINDOW, hz) > level / 3)
      return (span.startFrame + at + WINDOW / 2) / span.sampleRate
  return null
}

test.describe('Studio monitoring, a lane armed while the microphone settles', () => {
  test("a second lane armed while the first lane's new input settles is heard as that input settles, together with the first, no step steeper than the tones' own", async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await tapMicrophone(page, true)
    await captureStudioOutput(page)
    await openArrangement(page)
    await importWav(page, 'Second', noiseWav(2, 0.1, 5))
    // Each lane on a side of its own, kept on the lane for the arms below.
    await armLane(page, 'Phrase')
    await setLaneInput(page, 'Phrase', 'Channel', 'Input 1')
    await armLane(page, 'Second')
    await setLaneInput(page, 'Second', 'Channel', 'Input 2')
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    await armButton(page, 'Phrase').click()
    await armButton(page, 'Second').click()
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'idle')
    await setMonitoring(page, true)
    // The microphone closes after its linger (mic-manager.ts LINGER_MS), so
    // the next arm opens it afresh, as a singer's first arm does.
    await expect
      .poll(async () => (await micState(page)).streamLive, { timeout: 10_000 })
      .toBe(false)
    await recordOutput(page)
    const sources = await newestSource(page)

    await clearClicks(page)
    await armButton(page, 'Phrase').click()
    const arrived = await firstSound(page, sources)
    await untilAudioClock(page, arrived + PRESS_AFTER_ARRIVAL_SECONDS)
    await armButton(page, 'Second').click()
    await expect(armButton(page, 'Second')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    const [phrase, second] = (await readClicks(page)).filter(
      ({ kind }) => kind === 'up',
    )
    // Both lanes as they play on once their reverb has filled.
    const end = second.contextTime + 3
    await untilAudioClock(page, end)
    const span = await captureSpan(page, phrase.contextTime - 0.02, end)
    const tail = span.samples.length - 24 * WINDOW
    const levels = {
      phrase: toneAmplitude(span, tail, 24 * WINDOW, PHRASE_HZ),
      second: toneAmplitude(span, tail, 24 * WINDOW, SECOND_HZ),
    }
    const phraseHeard = heardAt(span, 0, PHRASE_HZ, levels.phrase)
    const secondHeard = heardAt(span, 0, SECOND_HZ, levels.second)
    const steady = steepest(span.samples.subarray(tail))
    const rise = steepestStep(
      span.samples.subarray(
        0,
        Math.round(
          (second.contextTime + 0.8 - span.startFrame / 48_000) * 48_000,
        ),
      ),
    )
    const measured = {
      arrivedAfterPhrase: arrived - phrase.contextTime,
      secondPressedAfterArrival: second.contextTime - arrived,
      phraseHeardAfter:
        phraseHeard === null ? null : phraseHeard - phrase.contextTime,
      secondHeardAfter:
        secondHeard === null ? null : secondHeard - second.contextTime,
      apart:
        phraseHeard === null || secondHeard === null
          ? null
          : secondHeard - phraseHeard,
      levels,
      steady,
      rise: rise.step,
      riseRatio: rise.step / steady,
      riseAfterPhrase:
        (span.startFrame + rise.index) / 48_000 - phrase.contextTime,
    }
    console.log(
      `[studio-record-monitor-join-settling] ${JSON.stringify(measured)}`,
    )

    expect(steady).toBeGreaterThan(1e-3)
    expect(levels.phrase).toBeGreaterThan(1e-3)
    expect(levels.second).toBeGreaterThan(1e-3)
    expect(phraseHeard).not.toBeNull()
    expect(secondHeard).not.toBeNull()
    // Second was pressed after the input's first sound and before Phrase
    // was heard: inside the input's first moments.
    expect(second.contextTime).toBeGreaterThan(arrived)
    expect(second.contextTime).toBeLessThan(phraseHeard!)
    // Heard as the input settles, together with Phrase: not a settle of its
    // own later, which would hear it a tenth of a second after Phrase.
    expect(Math.abs(secondHeard! - phraseHeard!)).toBeLessThan(
      TOGETHER_WITHIN_SECONDS,
    )
    expect(secondHeard! - second.contextTime).toBeLessThan(SETTLE_SECONDS)
    // Both rise from silence on the house envelope: no step steeper than
    // the two tones' own.
    expect(rise.step).toBeLessThanOrEqual(steady * 1.1)
  })
})
