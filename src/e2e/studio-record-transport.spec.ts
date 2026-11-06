// Studio take transport — a take keeps its song: the song plays on under a take while the singer reads the words in another tab, and the take keeps all it heard.
import { expect, type Locator, type Page, test } from '@playwright/test'
import type { StudioClip } from '../lib/studio/model/types'
import { openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { audioClock, captureOutput, captureStudioOutput, clearClicks, importWav, readClicks, untilAudioClock, } from './helpers/studio-output-capture'
import { steadyWav } from './helpers/studio-output'
import { fakeMicArgs, TONE_HZ, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(TONE_HZ, 20)
const RATE = 48_000
/** One bar of 4/4 at the 120 bpm a new song starts at. */
const COUNT_IN_SECONDS = 2
/** The recorder starts its capture this long after the press (studio-recorder.ts). */
const START_LEAD_SECONDS = 0.1

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
  viewport: { width: 1440, height: 900 },
})

function recordButton(page: Page): Locator {
  return studioRegion(page).locator('[data-studio-record]')
}

/** Arm `lane` from its header; resolves once the microphone is open. */
async function arm(page: Page, lane: string): Promise<void> {
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'idle')
  await studioRegion(page)
    .getByRole('button', { name: `Arm ${lane} for recording`, exact: true })
    .click()
  await expect(recordButton(page)).toHaveAttribute('data-phase', 'armed', {
    timeout: 15_000,
  })
}

/** The page goes behind another tab, or comes back, as the browser says it. */
async function showPage(page: Page, shown: boolean): Promise<void> {
  await page.evaluate((visible) => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => !visible,
    })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (visible ? 'visible' : 'hidden'),
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }, shown)
}

/** The level the page sends to its speakers now: the RMS of its last 680 ms. */
async function outputRms(page: Page): Promise<number> {
  const { samples } = await captureOutput(page)
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / samples.length)
}

/** The take's clip: the one on `trackId`. */
async function takeOn(page: Page, trackId: string): Promise<StudioClip> {
  const clip = (await readStudioProject(page)).clips.find(
    (item) => item.trackId === trackId,
  )
  if (!clip) throw new Error('The take is not in the song.')
  return clip
}

test.describe('Studio take transport', () => {
  test('plays the song on under a take while the tab is hidden, and keeps all of the take', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    // A backing long enough to play under the whole take.
    await importWav(page, 'Backing', steadyWav(14, [262], 0.4))
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()
    await arm(page, 'Lane 3')
    const toggle = studio.getByRole('button', { name: /^(Play|Pause) song$/ })

    await clearClicks(page)
    await page.keyboard.press('r')
    await expect(recordButton(page)).toHaveAccessibleName('Stop recording', {
      timeout: 10_000,
    })
    await expect(toggle).toHaveAccessibleName('Pause song')
    await untilAudioClock(page, (await audioClock(page)) + 1)

    // The singer goes to the words in another tab for two seconds.
    await showPage(page, false)
    const hiddenAt = await audioClock(page)
    await untilAudioClock(page, hiddenAt + 2)
    const heardHidden = await outputRms(page)
    const stillPlaying = await toggle.getAttribute('aria-label')
    await showPage(page, true)
    await untilAudioClock(page, (await audioClock(page)) + 0.5)

    await page.keyboard.press('r')
    await expect(recordButton(page)).toHaveAccessibleName('Record', {
      timeout: 30_000,
    })
    await expect(
      studio.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible({ timeout: 30_000 })
    const [start, stop] = (await readClicks(page)).filter(
      ({ kind }) => kind === 'key',
    )
    const ran =
      stop.contextTime -
      start.contextTime -
      START_LEAD_SECONDS -
      COUNT_IN_SECONDS
    const lane = (await readStudioProject(page)).tracks.find(
      (track) => track.name === 'Lane 3',
    )!
    const take = await takeOn(page, lane.id)
    const kept = (take.sourceOutFrame - take.sourceInFrame) / RATE
    console.log(
      `[studio-record-hidden] ${JSON.stringify({ heardHidden, stillPlaying, ran, kept })}`,
    )

    // The backing went on while hidden: the speakers got its steady tone
    // (RMS 0.06 after the lane's loudness match and the master), not silence.
    expect(stillPlaying).toBe('Pause song')
    expect(heardHidden).toBeGreaterThan(0.02)
    // The take ran straight through the hidden stretch, and ended as usual.
    expect(Math.abs(kept - ran)).toBeLessThan(0.03)
    expect(ran).toBeGreaterThan(3)
    await expect(studio.locator('[data-studio-record-message]')).toHaveCount(0)
  })
})
