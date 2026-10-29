// Studio Play after Pause — the graph Pause keeps sounds again sooner than a rebuilt one, and a clip edit while paused moves it instead of rebuilding it.
import { expect, test } from '@playwright/test'
import { openArrangement, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'
import type { StudioCapture, StudioClickStamp, } from './helpers/studio-output-capture'
import { audioClock, captureStudioOutput, clearClicks, importWav, readClicks, untilAudioClock, } from './helpers/studio-output-capture'
import type { StartReading } from './helpers/studio-output-span'
import { captureSpan, readStart } from './helpers/studio-output-span'
import { steadyWav } from './helpers/studio-output'

/** A capture of silence, then a 330 Hz tone opening over 90 ms from `startMs` after the press. */
function syntheticStart(
  sampleRate: number,
  startMs: number | null,
): { capture: StudioCapture; press: StudioClickStamp } {
  const startFrame = 100_000
  const pressIndex = 4800
  const openIndex =
    startMs === null
      ? Infinity
      : pressIndex + Math.round((startMs / 1000) * sampleRate)
  const attack = Math.round(0.09 * sampleRate)
  const samples = Float32Array.from({ length: 65536 }, (_, index) => {
    if (index < openIndex) return 0
    // The house attack: exponential from the 1e-4 floor to full in 90 ms.
    const gain =
      index - openIndex >= attack
        ? 1
        : 1e-4 ** (1 - (index - openIndex) / attack)
    return 0.3 * gain * Math.sin((2 * Math.PI * 330 * index) / sampleRate)
  })
  const contextTime = (startFrame + pressIndex) / sampleRate
  return {
    capture: { sampleRate, startFrame, samples },
    press: {
      kind: 'down',
      performanceMs: 0,
      contextTime,
      outputContextTime: contextTime,
      outputPerformanceMs: 0,
      baseLatency: 0.01,
      outputLatency: 0,
    },
  }
}

test.describe('Studio Play after Pause', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // No browser: this checks the reader at the CI runner's 44.1 kHz and at
  // 48 kHz, and that silence or a capture without the press is no reading.
  test('reads a start from silence the same at 44.1 and 48 kHz, and silence as no start', () => {
    for (const rate of [44100, 48000]) {
      const { capture, press } = syntheticStart(rate, 120)
      const start = readStart(capture, press, 330, 600)
      expect(start.settledDb).toBeCloseTo(-10.5, 0)
      expect(start.beforeDb).toBeLessThan(-100)
      // -40 dB is half way up the attack, -6 dB at 83 ms into it, each read
      // at the middle of a 5 ms window: within a couple of milliseconds.
      expect(Math.abs(start.firstSoundMs! - 165)).toBeLessThan(3)
      expect(Math.abs(start.halfLevelMs! - 203)).toBeLessThan(3)

      const silent = syntheticStart(rate, null)
      expect(() => readStart(silent.capture, silent.press, 330, 600)).toThrow(
        'holds no level',
      )
      const late = {
        ...capture,
        startFrame: capture.startFrame + 4800,
      }
      expect(() => readStart(late, press, 330, 600)).toThrow(
        'does not hold the action',
      )
    }
  })

  test('Play after Pause starts the kept graph well before a graph rebuilt after an edit while paused @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    await importWav(page, 'Pad', steadyWav(40, [330], 0.3))
    await studio
      .locator('[data-studio-track]')
      .getByRole('button', { name: 'Mute Phrase', exact: true })
      .click()
    const toggle = studio.getByRole('button', {
      name: /^(Play|Pause) song$/,
    })
    const pressToggle = async () => {
      const box = (await toggle.boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.up()
    }
    const measurePlay = async (
      label: string,
      pausedSeconds = 1,
    ): Promise<StartReading> => {
      await expect(toggle).toHaveAccessibleName('Play song')
      await expect(toggle).toBeEnabled()
      await untilAudioClock(page, (await audioClock(page)) + pausedSeconds)
      await clearClicks(page)
      await pressToggle()
      const clicks = await readClicks(page)
      const down = clicks.find(({ kind }) => kind === 'down')!
      const up = clicks.find(({ kind }) => kind === 'up')!
      const start = readStart(
        await captureSpan(page, down.contextTime - 0.1, down.contextTime + 1),
        down,
        330,
        900,
      )
      console.log(
        `[studio-play-start] ${JSON.stringify({
          label,
          ...start,
          pressToReleaseMs: (up.contextTime - down.contextTime) * 1000,
          baseLatencyMs: down.baseLatency * 1000,
          outputLatencyMs: down.outputLatency * 1000,
        })}`,
      )
      expect(start.beforeDb).toBeLessThan(start.settledDb - 40)
      expect(start.firstSoundMs).not.toBeNull()
      expect(start.halfLevelMs).not.toBeNull()
      await expect(toggle).toHaveAccessibleName('Pause song')
      return start
    }

    // The first Play makes the audio context the capture listens to.
    await toggle.click()
    await expect(toggle).toHaveAccessibleName('Pause song')
    await untilAudioClock(page, (await audioClock(page)) + 1)
    await pressToggle()

    const warm = await measurePlay('play after pause')
    await untilAudioClock(page, (await audioClock(page)) + 0.5)
    await pressToggle()

    // Once its reverb has rung out the kept graph stops being rendered
    // (5.5 s at most for the default sounds), and Play connects it again.
    const quiet = await measurePlay('play after the kept graph went quiet', 8)
    await untilAudioClock(page, (await audioClock(page)) + 0.5)
    await pressToggle()

    // A clip moved while paused re-plans the kept graph's lane.
    const pad = studioClip(page, 'Pad')
    await pad.click()
    await pad.press('Alt+ArrowRight')
    await expect(
      studio.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible()
    const moved = await measurePlay('play after a clip moved while paused')
    await untilAudioClock(page, (await audioClock(page)) + 0.5)
    await pressToggle()

    // A take added while paused brings a lane the kept graph never built,
    // so Play builds afresh. Its tone is far from the pad's and quiet.
    await importWav(page, 'Air', steadyWav(40, [2000], 0.02))
    const rebuilt = await measurePlay(
      'play after a take was added while paused',
    )

    // Measured in headless Chromium on Linux: the kept graph reached half
    // level 125 to 136 ms after the press, a rebuilt one 210 to 220 ms; the
    // build and its tenth-of-a-second lead are what a kept graph saves. The
    // rest is the device callback, the chains' latency and the 90 ms attack.
    for (const kept of [warm, quiet, moved]) {
      expect(kept.halfLevelMs!).toBeLessThan(rebuilt.halfLevelMs! - 50)
      expect(kept.firstSoundMs!).toBeLessThan(rebuilt.firstSoundMs! - 50)
    }
  })
})
