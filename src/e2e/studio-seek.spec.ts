// Studio seek while playing — a press on the ruler moves the playing song there at once, with no dip, no gap and no sources left behind.
import { expect, test } from '@playwright/test'
import { openArrangement, setStudioZoom, studioRegion, } from './helpers/dedicatedstudio-fixture'
import type { StudioCapture, StudioClickStamp, } from './helpers/studio-output-capture'
import { audioClock, captureOutput, captureStudioOutput, clearClicks, importWav, liveSources, noiseWav, readClicks, readSeek, twoPartWav, untilAudioClock, } from './helpers/studio-output-capture'

// At 20 pixels a second the ruler shows the whole 40 second song.
const ZOOM = 20

/**
 * A capture as captureOutput returns one: 330 Hz until 50 ms after the
 * click, then 990 Hz, with `gapMs` of silence between them.
 */
function syntheticSeek(
  sampleRate: number,
  gapMs: number,
): { capture: StudioCapture; click: StudioClickStamp } {
  const startFrame = 100_000
  const clickIndex = 9600
  const switchIndex = clickIndex + Math.round(0.05 * sampleRate)
  const resumeIndex = switchIndex + Math.round((gapMs / 1000) * sampleRate)
  const samples = Float32Array.from({ length: 32768 }, (_, index) => {
    if (index >= switchIndex && index < resumeIndex) return 0
    const hz = index < switchIndex ? 330 : 990
    return 0.1 * Math.sin((2 * Math.PI * hz * index) / sampleRate)
  })
  const contextTime = (startFrame + clickIndex) / sampleRate
  return {
    capture: { sampleRate, startFrame, samples },
    click: {
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

test.describe('Studio seek while playing', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // A machine with no sound card, such as the CI runner, plays at 44.1 kHz,
  // where a millisecond is not a whole number of frames. The reader once
  // found no tone there and read every level as NaN, so its dip and silence
  // passed on nothing. No browser: this checks the reader itself.
  test('reads a seek the same at 44.1 and 48 kHz, and reads a broken one as broken', () => {
    for (const rate of [44100, 48000]) {
      const clean = syntheticSeek(rate, 0)
      const heard = readSeek(clean.capture, clean.click, 990, 300)
      expect(heard.beforeDb).toBeCloseTo(-23, 0)
      expect(heard.afterDb).toBeCloseTo(-23, 0)
      expect(heard.dipDb['30']).toBeLessThan(0.5)
      expect(heard.silentMs).toBe(0)
      // Timed to a quarter millisecond in 5 ms windows: within a millisecond.
      expect(Math.abs(heard.clickToSoundMs! - 50)).toBeLessThan(1)

      const gap = syntheticSeek(rate, 20)
      const broken = readSeek(gap.capture, gap.click, 990, 300)
      expect(broken.silentMs).toBeGreaterThan(10)
      expect(broken.dipDb['10']).toBeGreaterThan(40)
      expect(Math.abs(broken.clickToSoundMs! - 70)).toBeLessThan(1)

      // A capture that misses the click, or holds no level, is no reading.
      const late = {
        ...clean.capture,
        startFrame: clean.capture.startFrame + 9600,
      }
      expect(() => readSeek(late, clean.click, 990, 300)).toThrow(
        'does not hold the click',
      )
      const silent = { ...clean.capture, samples: new Float32Array(32768) }
      expect(() => readSeek(silent, clean.click, 990, 300)).toThrow(
        'holds no level',
      )
    }
  })

  test('a press on the ruler moves a playing song there at once with no dip or gap, and fifty more leave no sources behind @smoke', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    // The pad's pitch tells the song's halves apart; the noise makes any two
    // places in it unrelated, as two places in a song are.
    await importWav(page, 'Pad', twoPartWav(40, 20, [330, 990], 0.3))
    await importWav(page, 'Air', noiseWav(40, 0.05, 7))
    await studio
      .locator('[data-studio-track]')
      .getByRole('button', { name: 'Mute Phrase', exact: true })
      .click()
    await setStudioZoom(page, ZOOM)
    const ruler = studio.getByRole('slider', { name: 'Song playhead' })
    const box = (await ruler.boundingBox())!
    const press = async (seconds: number) => {
      await page.mouse.move(box.x + seconds * ZOOM, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.up()
    }
    const playhead = async () =>
      Number(await ruler.getAttribute('aria-valuenow'))

    await studio.getByRole('button', { name: 'Play song', exact: true }).click()
    // A full capture of steady playback before the press.
    await expect.poll(playhead, { timeout: 15_000 }).toBeGreaterThan(1.5)

    await clearClicks(page)
    await press(25)
    const down = (await readClicks(page)).find(({ kind }) => kind === 'down')!
    await untilAudioClock(page, down.contextTime + 0.47)
    const seek = readSeek(await captureOutput(page), down, 990, 300)
    // A seek that stopped and rebuilt the song fell 37 dB here, stayed
    // 20 dB down for over 100 ms, and the new place came 206 ms or more
    // after the press.
    expect(seek.dipDb['30']).toBeLessThan(2)
    expect(seek.silentMs).toBe(0)
    expect(seek.clickToSoundMs).not.toBeNull()
    expect(seek.clickToSoundMs!).toBeLessThan(100)
    expect(await playhead()).toBeGreaterThanOrEqual(25)

    const before = await liveSources(page)
    for (let index = 0; index < 50; index++) await press(4 + ((index * 7) % 30))
    // A retired source plays out its 10 ms fade, then ends.
    await untilAudioClock(page, (await audioClock(page)) + 1)
    const after = await liveSources(page)
    expect(after.created).toBeGreaterThan(before.created)
    expect(after.live).toBeLessThanOrEqual(before.live)
    await expect(
      studio.getByRole('button', { name: 'Pause song', exact: true }),
    ).toBeVisible()
  })
})
