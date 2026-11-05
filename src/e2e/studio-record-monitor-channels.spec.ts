// Studio monitoring, one side of a stereo input — with monitoring on, a lane on Input 2 records and hears the right-hand side alone, and on Inputs 1 + 2 both sides at half each: each take is its pick of the input, bit for bit, as a tap beside the take's own capture hears it, and the left-hand tone reaches the speakers only through a lane that picks it.
import { expect, type Page, test } from '@playwright/test'
import { openArrangement } from './helpers/dedicatedstudio-fixture'
import { armLane, recordButton, recordTake, setLaneInput, setMonitoring, } from './helpers/studio-arming'
import { pcm16, takeAgainstTap, takeSamples, tapMicrophone, tappedSources, } from './helpers/studio-mic-tap'
import { audioClock, captureOutput, captureStudioOutput, untilAudioClock, } from './helpers/studio-output-capture'
import { toneAmplitude } from './helpers/studio-output-span'
import { fakeMicArgs, writeToneAndBurstsWav } from './helpers/tone-wav'

const TONE_HZ = 440
/** A tone on input 1 and bursts of noise on input 2, 4 s, which Chromium loops. */
const STEREO_WAV = writeToneAndBurstsWav(TONE_HZ, 0.3, 0.2, 8, 11)

test.use({
  launchOptions: { args: fakeMicArgs(STEREO_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

/** Phrase on `channel`, armed again on it, and the tone the speakers carry a second and a half later. */
async function pickAndHear(page: Page, channel: string): Promise<number> {
  await setLaneInput(page, 'Phrase', 'Channel', channel)
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
    timeout: 15_000,
  })
  await untilAudioClock(page, (await audioClock(page)) + 1.5)
  const heard = await captureOutput(page)
  return toneAmplitude(heard, 0, heard.samples.length, TONE_HZ)
}

/** Record about three seconds on the armed lane, kept as `title`. */
async function recordThreeSeconds(page: Page, title: string): Promise<void> {
  await recordTake(page, title, async () => {
    await untilAudioClock(page, (await audioClock(page)) + 1)
  })
}

test.describe('Studio monitoring, one side of a stereo input', () => {
  test('a lane monitored through its effects records its pick of the input bit for bit, and hears only that', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await tapMicrophone(page, true)
    await captureStudioOutput(page)
    await openArrangement(page)
    await armLane(page, 'Phrase')
    await setMonitoring(page, true)

    const alone = await pickAndHear(page, 'Input 2')
    await recordThreeSeconds(page, 'Take 1')
    const pair = await pickAndHear(page, 'Inputs 1 + 2')
    await recordThreeSeconds(page, 'Take 2')

    const sources = await tappedSources(page)
    const right = sources.map(([, side]) => pcm16(side))
    const mixed = sources.map(([left, side]) => {
      // As the split mixes a pair: the two summed, then halved (input-channels.ts).
      const both = new Float32Array(left.length)
      for (let i = 0; i < left.length; i++) both[i] = (left[i] + side[i]) * 0.5
      return pcm16(both)
    })
    const first = await takeSamples(page, 'Take 1')
    const second = await takeSamples(page, 'Take 2')
    const takes = {
      inputTwo: takeAgainstTap(right, first),
      pair: takeAgainstTap(mixed, second),
    }
    console.log(
      `[studio-record-monitor-channels] ${JSON.stringify({ sources: sources.length, toneAlone: alone, tonePair: pair, takes })}`,
    )
    expect(takes.inputTwo).toMatchObject({ compared: first.length, differ: 0 })
    expect(takes.pair).toMatchObject({ compared: second.length, differ: 0 })
    // The tone on input 1 is heard through a lane on the pair, and not
    // through one on Input 2: what is left there is the noise's own share.
    expect(pair).toBeGreaterThan(0.02)
    expect(alone).toBeLessThan(pair / 20)
  })
})
