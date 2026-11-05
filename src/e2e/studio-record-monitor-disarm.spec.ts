// Studio monitoring, armed and disarmed — the output never steps more steeply than the tone it monitors: an arm with monitoring on rises once the input has settled, a disarm glides the tone out on the house release and the microphone closes after it, and a re-arm inside that release crosses over on its own microphone and monitor.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { captureOutput, captureStudioOutput, clearClicks, readClicks, type StudioClickStamp, untilAudioClock, } from './helpers/studio-output-capture'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

/**
 * A low tone, so its own steepest step is small beside a cut's, and ten
 * seconds of it, more than the test hears: Chromium loops the file.
 */
const MIC_WAV = writeToneWav(110, 10)
/**
 * How far under the tone's peak the output must be where the monitor comes
 * apart: 40 dB, which the house release (CONVENTIONS.md 5b, a 36 ms time
 * constant) passes 166 ms in, well before the 240 ms the monitor waits.
 */
const UNDER_THE_PEAK_AT_THE_CUT = 0.01

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

/** Turn monitoring on in Sound; resolves with the audio clock at the change. */
async function monitor(page: Page): Promise<number> {
  const studio = studioRegion(page)
  await studio.getByRole('button', { name: 'Sound', exact: true }).click()
  await clearClicks(page)
  await studio
    .getByRole('checkbox', { name: 'Monitor through headphones' })
    .setChecked(true)
  const [change] = (await readClicks(page)).filter(
    ({ kind }) => kind === 'change',
  )
  await studio.getByRole('button', { name: 'Close Sound', exact: true }).click()
  return change.contextTime
}

/** The largest change from one sample to the next, and the sample it lands on. */
function steepestStep(samples: Float32Array): { step: number; index: number } {
  let step = 0
  let index = 0
  for (let i = 1; i < samples.length; i++) {
    const change = Math.abs(samples[i] - samples[i - 1])
    if (change > step) {
      step = change
      index = i
    }
  }
  return { step, index }
}

/** The largest change from one sample to the next. */
function steepest(samples: Float32Array): number {
  return steepestStep(samples).step
}

function peak(samples: Float32Array): number {
  let most = 0
  for (const sample of samples) most = Math.max(most, Math.abs(sample))
  return most
}

/** Arm Phrase with monitoring on, and wait for its reverb to fill. */
async function armHeard(page: Page): Promise<void> {
  await captureStudioOutput(page)
  await openArrangement(page)
  await armButton(page, 'Phrase').click()
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
    timeout: 15_000,
  })
  const onAt = await monitor(page)
  await untilAudioClock(page, onAt + 2)
  expect(await holds(page)).toContain('studio-record')
}

/**
 * The output up to `seconds` past `press`, the tone as it played until 20 ms
 * before the press, and where a time from the press falls in the output.
 */
async function aroundPress(
  page: Page,
  press: StudioClickStamp,
  seconds: number,
) {
  await untilAudioClock(page, press.contextTime + seconds)
  const { samples, startFrame, sampleRate } = await captureOutput(page)
  const at = (from: number) =>
    Math.round((press.contextTime + from) * sampleRate) - startFrame
  // A capture taken late starts after the press, and measures nothing of it.
  expect(at(-0.02)).toBeGreaterThan(0)
  return { samples, heard: samples.subarray(0, at(-0.02)), at }
}

test.describe('Studio monitoring, disarmed', () => {
  test("a disarm while the input is heard glides it out, no step steeper than the tone's own, then lets the microphone go", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await armHeard(page)

    await clearClicks(page)
    await armButton(page, 'Phrase').click()
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'idle')
    const [disarmed] = (await readClicks(page)).filter(
      ({ kind }) => kind === 'up',
    )
    const { samples, heard, at } = await aroundPress(page, disarmed, 0.55)
    const steady = steepest(heard)
    // From the press on: the release, then the cut where the monitor comes
    // apart, the input closing behind it, after which the output is nothing.
    const released = steepest(samples.subarray(at(-0.02)))
    let last = samples.length - 1
    while (last > at(0) && samples[last] === 0) last--
    const atTheCut = Math.abs(samples[last])
    console.log(
      `[studio-record-monitor-disarm] ${JSON.stringify({
        steadyPeak: peak(heard),
        steady,
        released,
        atTheCut,
        cutAfter: (last + 1 - at(0)) / 48_000,
      })}`,
    )
    expect(steady).toBeGreaterThan(1e-3)
    // A cut while the tone is heard would step by up to the tone's height,
    // tens of times its steepest step.
    expect(released).toBeLessThanOrEqual(steady * 1.1)
    // The monitor came apart inside the capture, its release done by then.
    expect(last).toBeLessThan(samples.length - 1)
    expect(atTheCut).toBeLessThanOrEqual(
      peak(heard) * UNDER_THE_PEAK_AT_THE_CUT,
    )
    await expect.poll(() => holds(page)).not.toContain('studio-record')
  })

  test("a re-arm inside the release keeps its own microphone and monitor through the first arm's late close", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await armHeard(page)

    await clearClicks(page)
    // Disarm and arm again at once: the second press lands in the first's
    // release, and that arm's input closes after the second has opened.
    await armButton(page, 'Phrase').dblclick()
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    const [disarmed, rearmed] = (await readClicks(page)).filter(
      ({ kind }) => kind === 'up',
    )
    expect(rearmed.contextTime - disarmed.contextTime).toBeLessThan(0.24)
    // Well past the first arm's close, a quarter of a second after the press.
    const { samples, heard, at } = await aroundPress(page, disarmed, 0.6)
    const steady = steepest(heard)
    // The first arm's release and the second arm's rise, on its own input.
    const crossing = steepestStep(samples.subarray(at(-0.02)))
    const crossed = crossing.step
    const playing = peak(samples.subarray(at(0.45)))
    console.log(
      `[studio-record-monitor-disarm] ${JSON.stringify({
        rearmedAfter: rearmed.contextTime - disarmed.contextTime,
        steadyPeak: peak(heard),
        steady,
        crossed,
        crossedAfter: (at(-0.02) + crossing.index - at(0)) / 48_000,
        playing,
      })}`,
    )
    expect(steady).toBeGreaterThan(1e-3)
    // The second arm's input starts mid-waveform, and its buffer runs dry
    // just after: a monitor already rising then steps by up to the tone's
    // height.
    expect(crossed).toBeLessThanOrEqual(steady * 1.1)
    // The second arm's source and microphone outlast the first arm's close:
    // its monitor plays on, and the Studio still holds the microphone.
    expect(playing).toBeGreaterThan(peak(heard) * 0.5)
    expect(await holds(page)).toContain('studio-record')
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed')
  })
})

test.describe('Studio monitoring, armed', () => {
  test("an arm with monitoring already on rises once the input has settled, no step steeper than the tone's own", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    // A first arm opens the audio clock, so the presses after it are stamped.
    await armButton(page, 'Phrase').click()
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    await armButton(page, 'Phrase').click()
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'idle')
    await expect
      .poll(() => holds(page), { timeout: 10_000 })
      .not.toContain('studio-record')
    await monitor(page)
    // The microphone closes after its linger (mic-manager.ts LINGER_MS), so
    // the arm opens it afresh, as a singer's first arm does.
    await expect.poll(() => micLive(page), { timeout: 10_000 }).toBe(false)

    await clearClicks(page)
    await armButton(page, 'Phrase').click()
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    const [armed] = (await readClicks(page)).filter(({ kind }) => kind === 'up')
    const { samples, at } = await aroundPress(page, armed, 0.6)
    // Where the monitor is first heard, and its rise from there: 20 ms
    // before to 200 ms after, past five of the crossing's time constants.
    let first = at(-0.02)
    while (first < samples.length && Math.abs(samples[first]) < 1e-4) first++
    const from = Math.max(0, first - 960)
    const onset = steepestStep(samples.subarray(from, first + 9600))
    const risen = peak(samples.subarray(at(0.5)))
    // The tone as it plays on once the lane's reverb has filled.
    await untilAudioClock(page, armed.contextTime + 2.5)
    const settled = (await captureOutput(page)).samples
    const steady = steepest(settled)
    console.log(
      `[studio-record-monitor-arm] ${JSON.stringify({
        steadyPeak: peak(settled),
        steady,
        onset: onset.step,
        onsetAfter: (from + onset.index - at(0)) / 48_000,
        heardAfter: (first - at(0)) / 48_000,
        risen,
      })}`,
    )
    expect(steady).toBeGreaterThan(1e-3)
    // The input's first samples start mid-waveform, and the browser's buffer
    // runs dry just after: a monitor already rising then steps by up to the
    // tone's height.
    expect(onset.step).toBeLessThanOrEqual(steady * 1.1)
    // Up a quarter of a second after the input's first sound, long before
    // the one-second wait for it runs out.
    expect(risen).toBeGreaterThan(peak(settled) * 0.5)
  })
})

/** Who holds a microphone now, and whether one is still open (mic-sentinel.ts). */
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

async function holds(page: Page): Promise<readonly string[]> {
  return (await micState(page)).holds
}

async function micLive(page: Page): Promise<boolean> {
  return (await micState(page)).streamLive
}
