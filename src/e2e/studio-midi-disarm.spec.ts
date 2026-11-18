// Studio MIDI disarm — with a fake Web MIDI keyboard in the page and the piano's synth playing (the sampled grand's samples refused), a MIDI lane disarmed while a note sounds lets it out on the house release, as a microphone's disarm does: a key still held, or one the sustain pedal holds ringing. The output never steps more steeply than the note's own steepest step, its envelope taking more than 30 ms to fall from 90 % of the note to 25 %, and it is silent once the lane's monitor has come apart. Nothing reaches the live site.
import { expect, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { armButton, armLane, recordButton } from './helpers/studio-arming'
import { installFakeMidi, playLaneFromKeys, playMidi as play, routeNetwork, } from './helpers/studio-midi'
import { aroundPress, peak, periodEnvelope, steepest, } from './helpers/studio-monitor-steps'
import { audioClock, captureStudioOutput, clearClicks, readClicks, untilAudioClock, } from './helpers/studio-output-capture'

test.use({ viewport: { width: 1440, height: 900 } })

/** How long the note sounds before the disarm: past its 8 ms rise and into its decay, as a player's held note is. */
const SOUNDING_SECONDS = 0.3
/** One period of middle C, in frames. */
const PERIOD = Math.round(48_000 / 261.63)

/**
 * How long the output's envelope (periodEnvelope, read a render quantum at
 * a time) takes from `from` to fall from 90 % of `level` to 25 % of it:
 * the house release some 46 ms, a cut one or two readings, 5 ms at most.
 */
function fallSeconds(
  samples: Float32Array,
  from: number,
  level: number,
): number {
  const readings = periodEnvelope(samples, from, PERIOD)
  const begun = readings.find(({ value }) => value < level * 0.9)
  const fallen = readings.find(({ value }) => value < level * 0.25)
  if (begun === undefined || fallen === undefined) return Number.NaN
  return (fallen.frame - begun.frame) / 48_000
}

/** Arm Lane 2 on the fake keyboard, and wait out its monitor's rise on the arm. */
async function armKeys(page: Page): Promise<string[]> {
  const live = await routeNetwork(page)
  await page.addInitScript(installFakeMidi)
  await captureStudioOutput(page)
  await openArrangement(page)
  const studio = studioRegion(page)
  await studio
    .getByRole('button', { name: 'New audio lane', exact: true })
    .click()
  await playLaneFromKeys(page, 'Lane 2')
  await armLane(page, 'Lane 2')
  await untilAudioClock(page, (await audioClock(page)) + 0.3)
  return live
}

const sounding = [
  {
    name: 'a key still held',
    press: [[0x90, 60, 100]],
  },
  {
    name: 'a key the sustain pedal holds ringing',
    press: [
      [0xb0, 64, 127],
      [0x90, 60, 100],
      [0x80, 60, 0],
    ],
  },
] as const

test.describe('Studio MIDI disarm', () => {
  for (const { name, press } of sounding)
    test(`a disarm lets ${name} out on the release, no step steeper than the note's own`, async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const live = await armKeys(page)
      for (const bytes of press) await play(page, [...bytes])
      await untilAudioClock(page, (await audioClock(page)) + SOUNDING_SECONDS)

      await clearClicks(page)
      await armButton(page, 'Lane 2').click()
      await expect(recordButton(page)).toHaveAttribute('data-phase', 'idle')
      const [disarmed] = (await readClicks(page)).filter(
        ({ kind }) => kind === 'up',
      )
      const { samples, heard, at } = await aroundPress(page, disarmed, 0.55)
      const own = steepest(heard)
      // From the press on: the release, then the monitor coming apart.
      const released = steepest(samples.subarray(at(-0.02)))
      // The note's height as the press came: its last period heard.
      const level = peak(heard.subarray(heard.length - PERIOD))
      const fall = fallSeconds(samples, at(-0.02), level)
      const after = peak(samples.subarray(at(0.4)))
      console.log(
        `[studio-midi-disarm] ${JSON.stringify({
          name,
          notePeak: peak(heard),
          own,
          released,
          releasedAgainstOwn: released / own,
          level,
          fall,
          after,
        })}`,
      )
      // Release the pedal and the key: the lane's port has gone already.
      await play(page, [0xb0, 64, 0])
      await play(page, [0x80, 60, 0])

      expect(peak(heard)).toBeGreaterThan(0.005)
      // A cut while the note sounds steps by up to its height, many times
      // its own steepest step. The note starts and is cut on render quanta,
      // and 4 cuts in 10 fell near a zero crossing of its wave and stepped
      // no further than it (headless Chromium): how fast the envelope falls
      // tells those apart.
      expect(released).toBeLessThanOrEqual(own * 1.1)
      expect(fall).toBeGreaterThan(0.03)
      expect(after).toBe(0)
      expect(live).toEqual([])
    })
})
