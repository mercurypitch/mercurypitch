// Studio monitoring, armed and disarmed — the output never steps more steeply than the tone it monitors: an arm with monitoring on rises once the input has settled, a second lane armed on the microphone another lane holds is heard at once, a disarm glides the tone out on the house release and the microphone closes after it, and a re-arm inside that release is heard at once beside the arm gliding out, on its own hold of the microphone.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { aroundPress, firstRise, JOINED_WITHIN_SECONDS, peak, periodEnvelope, steepest, steepestStep, } from './helpers/studio-monitor-steps'
import { captureOutput, captureStudioOutput, clearClicks, importWav, noiseWav, readClicks, untilAudioClock, } from './helpers/studio-output-capture'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

/**
 * A low tone, so its own steepest step is small beside a cut's, and ten
 * seconds of it, more than the test hears: Chromium loops the file.
 */
const MIC_WAV = writeToneWav(110, 10)
/** One period of the tone, in frames. */
const PERIOD = Math.round(48_000 / 110)
/**
 * How far into the first arm's release the re-arm is pressed: past a render
 * quantum, so the release has fallen where the re-arm rises, and well inside
 * the 240 ms the first arm's input stays open.
 */
const REARM_AFTER_SECONDS = 0.04
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

/** Arm Phrase with monitoring on, and wait for its reverb to fill; `lanes` are imported first, each a lane of Phrase's role. */
async function armHeard(
  page: Page,
  lanes: readonly string[] = [],
): Promise<void> {
  await captureStudioOutput(page)
  await openArrangement(page)
  for (const [index, lane] of lanes.entries())
    await importWav(page, lane, noiseWav(2, 0.1, 5 + index))
  await armButton(page, 'Phrase').click()
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
    timeout: 15_000,
  })
  const onAt = await monitor(page)
  await untilAudioClock(page, onAt + 2)
  expect(await holds(page)).toContain('studio-record')
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

  test("a re-arm inside the release is heard at once as the first arm glides out, and keeps its own microphone and monitor through the first arm's late close", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await armHeard(page)

    await clearClicks(page)
    // Disarm, and arm again once the release is under way: the second press
    // lands in the first's release, and that arm's input closes after the
    // second has opened. Pressed together, the two monitors cross in one
    // render quantum, and the output holds level wherever the re-arm rises.
    await armButton(page, 'Phrase').click()
    const [disarmed] = (await readClicks(page)).filter(
      ({ kind }) => kind === 'up',
    )
    await untilAudioClock(page, disarmed.contextTime + REARM_AFTER_SECONDS)
    await armButton(page, 'Phrase').click()
    await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    const [, rearmed] = (await readClicks(page)).filter(
      ({ kind }) => kind === 'up',
    )
    expect(rearmed.contextTime - disarmed.contextTime).toBeLessThan(0.24)
    // Well past the first arm's close, a quarter of a second after the press.
    const { samples, heard, at } = await aroundPress(page, disarmed, 0.6)
    const steady = steepest(heard)
    // The first arm's release and the second arm's rise, on the same input.
    const crossing = steepestStep(samples.subarray(at(-0.02)))
    const crossed = crossing.step
    const playing = peak(samples.subarray(at(0.45)))
    // The output falls on the first arm's release until the second arm's
    // rise overtakes it: it is lowest where the second arm is first heard.
    // One that waited for its input to settle left a silence after the first
    // arm came apart, and rose a quarter of a second on.
    const lowest = periodEnvelope(samples, at(-0.02), PERIOD).reduce(
      (low, reading) => (reading.value <= low.value ? reading : low),
    )
    const rearmAt = at(rearmed.contextTime - disarmed.contextTime)
    const heardAfter = (lowest.frame - rearmAt) / 48_000
    console.log(
      `[studio-record-monitor-disarm] ${JSON.stringify({
        rearmedAfter: rearmed.contextTime - disarmed.contextTime,
        steadyPeak: peak(heard),
        steady,
        crossed,
        crossedAfter: (at(-0.02) + crossing.index - at(0)) / 48_000,
        heardAfter,
        dippedTo: lowest.value / peak(heard),
        playing,
      })}`,
    )
    expect(steady).toBeGreaterThan(1e-3)
    // A rise begun before the input's samples flowed would step by up to the
    // tone's height where they arrive.
    expect(crossed).toBeLessThanOrEqual(steady * 1.1)
    // The input flows already: the re-arm rises at once, not a settle later.
    expect(heardAfter).toBeLessThan(JOINED_WITHIN_SECONDS)
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
    // A cold arm waits for its new input to settle, a quarter of a second
    // past its first sound.
    expect((first - at(0)) / 48_000).toBeGreaterThan(0.25)
    // Up a quarter of a second after the input's first sound, long before
    // the one-second wait for it runs out.
    expect(risen).toBeGreaterThan(peak(settled) * 0.5)
  })

  test("a second lane armed on the microphone another armed lane holds is heard at once, no step steeper than the tone's own", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await armHeard(page, ['Second'])

    await clearClicks(page)
    await armButton(page, 'Second').click()
    await expect(armButton(page, 'Second')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const [joined] = (await readClicks(page)).filter(
      ({ kind }) => kind === 'up',
    )
    // A fifth of a second of Phrase alone before the press, and the join.
    const { samples, heard, at } = await aroundPress(page, joined, 0.45)
    const alone = peak(heard)
    const first = firstRise(samples, at(-0.02), PERIOD, alone)
    const rise = steepestStep(samples.subarray(at(-0.02)))
    // Both lanes as they play on once the second lane's reverb has filled.
    await untilAudioClock(page, joined.contextTime + 2.5)
    const both = (await captureOutput(page)).samples
    const steady = steepest(both)
    const heardAfter = first === null ? null : (first - at(0)) / 48_000
    console.log(
      `[studio-record-monitor-join] ${JSON.stringify({
        alonePeak: alone,
        bothPeak: peak(both),
        steady,
        rise: rise.step,
        riseAfter: (at(-0.02) + rise.index - at(0)) / 48_000,
        heardAfter,
      })}`,
    )
    expect(steady).toBeGreaterThan(1e-3)
    expect(peak(both)).toBeGreaterThan(alone * 1.5)
    // The input flows already: the second lane rises from silence at once,
    // smoothly, and adds nothing steeper than the two lanes' own tone.
    expect(rise.step).toBeLessThanOrEqual(steady * 1.1)
    expect(heardAfter).not.toBeNull()
    expect(heardAfter).toBeLessThan(JOINED_WITHIN_SECONDS)
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
