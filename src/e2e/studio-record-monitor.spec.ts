// Studio monitoring — with monitoring on, the armed input is heard through its lane's effects (its reverb rings on between the microphone's bursts), once for each lane armed on it, as a DAW sums its armed tracks, and not at all once monitoring is off; a take recorded meanwhile is the input, bit for bit, as a tap beside the take's own capture hears it.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { setMonitoring } from './helpers/studio-arming'
import { pcm16, takeAgainstTap, takeSamples, tapMicrophone, tappedSources, } from './helpers/studio-mic-tap'
import { audioClock, captureOutput, captureStudioOutput, clearClicks, importWav, noiseWav, readClicks, untilAudioClock, } from './helpers/studio-output-capture'
import { fakeMicArgs, writeNoiseBurstWav } from './helpers/tone-wav'

const RATE = 48_000
const BURST_SECONDS = 0.3
const GAP_SECONDS = 0.2
/** Four bursts, 2 s, which Chromium loops. */
const MIC_WAV = writeNoiseBurstWav(BURST_SECONDS, GAP_SECONDS, 4, 7)
/** The microphone's pattern repeats every burst and gap. */
const PERIOD = Math.round((BURST_SECONDS + GAP_SECONDS) * RATE)
/** 10 ms. */
const WINDOW = 480

test.use({
  launchOptions: { args: fakeMicArgs(MIC_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

function recordButton(page: Page): Locator {
  return studioRegion(page).locator('[data-studio-record]')
}

function armButton(page: Page, lane: string): Locator {
  return studioRegion(page).getByRole('button', {
    name: `Arm ${lane} for recording`,
    exact: true,
  })
}

async function arm(page: Page, lane: string): Promise<void> {
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'idle')
  await armButton(page, lane).click()
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
    timeout: 15_000,
  })
}

/** The RMS of each 10 ms of `samples`. */
function windowLevels(samples: Float32Array): number[] {
  const levels: number[] = []
  for (let from = 0; from + WINDOW <= samples.length; from += WINDOW) {
    let sum = 0
    for (let i = from; i < from + WINDOW; i++) sum += samples[i] ** 2
    levels.push(Math.sqrt(sum / WINDOW))
  }
  return levels
}

/** Mean square of the newest whole period: much the same wherever in the pattern it starts. */
function periodPower(samples: Float32Array): number {
  let sum = 0
  for (let i = samples.length - PERIOD; i < samples.length; i++)
    sum += samples[i] ** 2
  return sum / PERIOD
}

const powerDb = (ratio: number) => 10 * Math.log10(ratio)

/** Record `seconds` after the count-in on the armed lane, then wait for the take to be kept. */
async function recordTake(
  page: Page,
  title: string,
  seconds: number,
): Promise<void> {
  const studio = studioRegion(page)
  await page.keyboard.press('r')
  await expect(recordButton(page)).toHaveAccessibleName('Stop recording', {
    timeout: 10_000,
  })
  await untilAudioClock(page, (await audioClock(page)) + seconds)
  await page.keyboard.press('r')
  await expect(recordButton(page)).toHaveAccessibleName('Record', {
    timeout: 30_000,
  })
  await expect(
    studio.getByRole('button', { name: new RegExp(`, ${title}\\.wav, `) }),
  ).toHaveCount(1)
  await expect(
    studio.getByText('Saved in this browser', { exact: true }),
  ).toBeVisible({ timeout: 30_000 })
}

test.describe('Studio monitoring', () => {
  test("the armed input is heard only with monitoring on, through its lane's effects, once for each lane armed on it", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    // A second lane of the same role: the same effects and faders as Phrase.
    await importWav(page, 'Second', noiseWav(2, 0.1, 5))
    await arm(page, 'Phrase')

    const onAt = await setMonitoring(page, true)
    await untilAudioClock(page, onAt + 1)
    const heard = (await captureOutput(page)).samples
    const levels = windowLevels(heard)
    // The bursts are heard; between them the microphone is silent, and a dry
    // monitor would be too, but the lane's reverb rings on.
    expect(Math.max(...levels)).toBeGreaterThan(0.01)
    expect(Math.min(...levels)).toBeGreaterThan(1e-4)

    // A second lane armed on the microphone is heard beside the first, as a
    // DAW sums its armed tracks: two lanes that sound alike are 3 to 6 dB up
    // on one, and a lane hearing its input twice would add 3 dB more.
    await clearClicks(page)
    await armButton(page, 'Second').click()
    await expect(armButton(page, 'Second')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(armButton(page, 'Phrase')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const [added] = (await readClicks(page)).filter(
      ({ kind }) => kind === 'down',
    )
    await untilAudioClock(page, added.contextTime + 1.5)
    const both = (await captureOutput(page)).samples
    // Phrase disarmed, Second plays on alone.
    await clearClicks(page)
    await armButton(page, 'Phrase').click()
    await expect(armButton(page, 'Phrase')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    const [gone] = (await readClicks(page)).filter(
      ({ kind }) => kind === 'down',
    )
    await untilAudioClock(page, gone.contextTime + 1.5)
    const alone = (await captureOutput(page)).samples
    const one = periodPower(heard)
    const bothDb = powerDb(periodPower(both) / one)
    const aloneDb = powerDb(periodPower(alone) / one)
    console.log(
      `[studio-record-monitor] ${JSON.stringify({
        quietestDb: 20 * Math.log10(Math.min(...levels)),
        bothDb,
        aloneDb,
      })}`,
    )
    expect(bothDb).toBeGreaterThan(2.5)
    expect(bothDb).toBeLessThan(6.5)
    expect(Math.abs(aloneDb)).toBeLessThan(1)

    // Off, every monitor comes out of the graph and nothing is heard.
    const offAt = await setMonitoring(page, false)
    await untilAudioClock(page, offAt + 1.1)
    const off = (await captureOutput(page)).samples
    expect(Math.max(...off.map(Math.abs))).toBeLessThan(1e-5)
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed')
  })

  test("a take recorded while monitoring through the lane's effects is the input, bit for bit", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await tapMicrophone(page)
    await captureStudioOutput(page)
    await openArrangement(page)
    await arm(page, 'Phrase')
    await setMonitoring(page, true)
    await recordTake(page, 'Take 1', 3)

    const take = await takeSamples(page, 'Take 1')
    const heard = (await tappedSources(page)).map(([mono]) => pcm16(mono))
    const found = takeAgainstTap(heard, take)
    console.log(
      `[studio-record-monitor] ${JSON.stringify({ take: take.length, heard: heard.map((samples) => samples.length), found })}`,
    )
    expect(found).toMatchObject({ compared: take.length, differ: 0 })
  })
})
