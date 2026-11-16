// Studio monitoring, a heard lane's channel changed — on a stereo input with one tone on both sides in step, Input 2 twice as loud as Input 1, a lane heard on Input 1 and moved to Input 2 crosses over at once: Input 2 rises as Input 1 glides out, with no step steeper than the tone's own.
import { expect, test } from '@playwright/test'
import { openArrangement } from './helpers/dedicatedstudio-fixture'
import { armLane, recordButton, setLaneInput, setMonitoring, } from './helpers/studio-arming'
import { aroundPress, firstRise, JOINED_WITHIN_SECONDS, peak, periodEnvelope, steepest, steepestStep, } from './helpers/studio-monitor-steps'
import { audioClock, captureOutput, captureStudioOutput, clearClicks, readClicks, untilAudioClock, } from './helpers/studio-output-capture'
import { fakeMicArgs, writeStereoToneWav } from './helpers/tone-wav'

const HZ = 110
/** One tone on both sides, in step, Input 2 twice as loud: the lane's level tells its channel. */
const MIC_WAV = writeStereoToneWav(HZ, HZ, 10, [0.25, 0.5])
/** One period of the tone, in frames. */
const PERIOD = Math.round(48_000 / HZ)

test.use({
  launchOptions: { args: fakeMicArgs(MIC_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

test.describe('Studio monitoring, a channel changed', () => {
  test("a heard lane moved to another channel of its input crosses over at once, no step steeper than the tone's own", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    await armLane(page, 'Phrase')
    await setMonitoring(page, true)
    await setLaneInput(page, 'Phrase', 'Channel', 'Input 1')
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    // Heard on Input 1 until the lane's reverb has filled.
    await untilAudioClock(page, (await audioClock(page)) + 2)

    await clearClicks(page)
    await setLaneInput(page, 'Phrase', 'Channel', 'Input 2')
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    const [changed] = (await readClicks(page)).filter(
      ({ kind }) => kind === 'change',
    )
    // A fifth of a second of Input 1 before the change, and the crossover.
    const { samples, heard, at } = await aroundPress(page, changed, 0.45)
    const crossing = steepestStep(samples.subarray(at(-0.02)))
    // Input 2, twice as loud, lifts the output past Input 1's level as it
    // rises. A lane that waited for its input to settle left Input 1 to glide
    // out first, and the output fell before it rose.
    const first = firstRise(samples, at(-0.02), PERIOD, peak(heard))
    const heardAfter = first === null ? null : (first - at(0)) / 48_000
    const lowest = Math.min(
      ...periodEnvelope(samples, at(-0.02), PERIOD).map(({ value }) => value),
    )
    // Input 2 as it plays on once the lane's reverb has filled again.
    await untilAudioClock(page, changed.contextTime + 2.5)
    const after = (await captureOutput(page)).samples
    const steady = steepest(after)
    console.log(
      `[studio-record-monitor-channel] ${JSON.stringify({
        input1Peak: peak(heard),
        input2Peak: peak(after),
        steady,
        crossed: crossing.step,
        crossedAfter: (at(-0.02) + crossing.index - at(0)) / 48_000,
        heardAfter,
        dippedTo: lowest / peak(heard),
      })}`,
    )
    expect(steady).toBeGreaterThan(1e-3)
    // The lane hears Input 2 now: twice Input 1's level.
    expect(peak(after) / peak(heard)).toBeGreaterThan(1.6)
    expect(peak(after) / peak(heard)).toBeLessThan(2.4)
    // The source flows already: Input 2 rises at once, from silence, with
    // nothing steeper than the louder side's own tone.
    expect(crossing.step).toBeLessThanOrEqual(steady * 1.1)
    expect(heardAfter).not.toBeNull()
    expect(heardAfter).toBeLessThan(JOINED_WITHIN_SECONDS)
  })
})
