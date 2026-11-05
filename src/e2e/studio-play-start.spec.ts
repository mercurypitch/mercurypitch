// Studio Play after Pause — every Play after the first starts a graph that was ready before the press: the one Pause kept, moved with a clip edit, or built ahead after an edit it could not follow.
import { expect, test } from '@playwright/test'
import { openArrangement, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'
import type { StudioCapture, StudioClickStamp, } from './helpers/studio-output-capture'
import { audioClock, captureStudioOutput, clearClicks, importWav, readClicks, readStarts, untilAudioClock, } from './helpers/studio-output-capture'
import type { StartReading } from './helpers/studio-output-span'
import { captureSpan, readStart } from './helpers/studio-output-span'
import { steadyWav } from './helpers/studio-output'

/** A capture of silence, then a 330 Hz tone opening over 10 ms from `startMs` after the press. */
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
  const attack = Math.round(0.01 * sampleRate)
  const samples = Float32Array.from({ length: 65536 }, (_, index) => {
    if (index < openIndex) return 0
    // Studio's attack from silence: a raised cosine to full in 10 ms.
    const gain =
      index - openIndex >= attack
        ? 1
        : Math.sin((Math.PI / 2) * ((index - openIndex) / attack)) ** 2
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
      // -40 dB comes 0.65 ms into the attack and -6 dB 8.3 ms into it, each
      // read at the middle of a 5 ms window: within a couple of milliseconds.
      expect(Math.abs(start.firstSoundMs! - 119.5)).toBeLessThan(3)
      expect(Math.abs(start.halfLevelMs! - 124.7)).toBeLessThan(3)

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

  test('Play after Pause, and after an edit while paused, starts a graph that was ready before the press @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    // Hold the playback tier. Under Auto, the device benchmark that lands a
    // few seconds in moves the tier from the next Play (playback-quality.ts),
    // and a graph of another tier is built afresh, so a kept graph would be
    // rebuilt with no edit at all. Balanced is the tier the timings below
    // were measured at.
    await page.addInitScript(() =>
      localStorage.setItem('mercurypitch.studio.playbackQuality', 'balanced'),
    )
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
    // Play schedules the song a lead past the audio clock it reads as it
    // acts, and its first source start stamps that read (captureStudioOutput).
    const playedAfter = async (
      release: StudioClickStamp,
    ): Promise<StudioClickStamp> => {
      let played: StudioClickStamp | undefined
      await expect
        .poll(async () => {
          played = (await readStarts(page)).find(
            ({ performanceMs }) => performanceMs >= release.performanceMs,
          )
          return played !== undefined
        })
        .toBe(true)
      return played!
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
      const played = await playedAfter(up)
      const start = readStart(
        await captureSpan(
          page,
          played.contextTime - 0.1,
          played.contextTime + 1,
        ),
        played,
        330,
        900,
      )
      console.log(
        `[studio-play-start] ${JSON.stringify({
          label,
          ...start,
          pressToReleaseMs: (up.contextTime - down.contextTime) * 1000,
          releaseToPlayMs: played.performanceMs - up.performanceMs,
          clockMovedMs: (played.contextTime - up.contextTime) * 1000,
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

    // A take added while paused brings a lane the kept graph never built.
    // Once the edit settles the graph is built ahead and parked
    // (prebuilt-run.ts), so Play starts it as it starts a kept one. Its
    // tone is far from the pad's and quiet.
    await importWav(page, 'Air', steadyWav(40, [2000], 0.02))
    const added = await measurePlay(
      'play after a take was added while paused',
      2,
    )

    // Every one of these Plays starts a graph that was ready before the
    // press. Only the first Play of a visit builds in the press now (the
    // clock comes into being inside it), so the readings are held to the
    // soonest of them.
    //
    // Each is timed from the audio clock Play read as it started the song,
    // not from the press. The press is stamped at pointerdown, but Play acts
    // on the click after the release, and Playwright's press and release
    // are two round trips: on a loaded CI runner they landed 3 to 37 ms
    // apart. And the clock moves a device callback (1,024 frames, 21.3 ms)
    // at a time, so a callback that landed between a stamp and Play's own
    // read moved the reading by a callback. Together they failed this spec
    // on every retry of one run with nothing built: each failing reading,
    // taken from the release, was under a build's.
    //
    // From the clock Play read, in headless Chromium on Linux with the
    // Studio's 'playback' buffers, idle or with every core busy: a ready
    // graph reached half level 52 to 58 ms later, and the first Play, built
    // in the press, 91.5 ms. A built graph starts 60 ms past its build so
    // its new compressors settle first (run.ts), where a ready one starts a
    // callback and 5 ms out (seekEarliest): 34 ms apart, so a graph built in
    // the press still reads well past the soonest.
    const readings = [warm, quiet, moved, added]
    const soonest = (key: 'firstSoundMs' | 'halfLevelMs') =>
      Math.min(...readings.map((reading) => reading[key]!))
    for (const reading of readings) {
      expect(reading.halfLevelMs!).toBeLessThan(soonest('halfLevelMs') + 25)
      expect(reading.firstSoundMs!).toBeLessThan(soonest('firstSoundMs') + 25)
    }
  })
})
