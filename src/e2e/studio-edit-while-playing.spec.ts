// Studio edits while playing — a clip edit to one lane changes that lane on the running graph: the others play on untouched, and the edit is heard within a few tens of milliseconds.
import { expect, test } from '@playwright/test'
import { openArrangement, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'
import type { StudioCapture, StudioClickStamp, } from './helpers/studio-output-capture'
import { audioClock, captureStudioOutput, clearClicks, liveSources, readClicks, untilAudioClock, } from './helpers/studio-output-capture'
import type { EditReading } from './helpers/studio-output-edit'
import { EDIT_STEADY_MS, readEdit } from './helpers/studio-output-edit'
import { captureSpan } from './helpers/studio-output-span'
import { importSteady } from './helpers/studio-output'

// 200 and 500 Hz: a 10 ms window holds whole periods of both, and is a whole
// number of frames at 44.1 and at 48 kHz, so neither tone leaks into the
// other's reading. Neither is a harmonic of the other.
const TONES = { edited: 500, untouched: 200 }

/**
 * A capture as captureOutput returns one: the untouched tone at 0.1 and the
 * edited one at 0.3, which falls to 0.15 over 30 ms from `changeMs` after
 * the stamp. `dip` takes the untouched tone 3 dB down for 40 ms from there;
 * `cut` steps the edited tone to its new level instead of fading.
 */
function syntheticEdit(
  sampleRate: number,
  changeMs: number,
  options: { dip?: boolean; cut?: boolean; silent?: boolean } = {},
): { capture: StudioCapture; stamp: StudioClickStamp } {
  const startFrame = 200_000
  const stampIndex = Math.round(0.4 * sampleRate)
  const change = stampIndex + Math.round((changeMs / 1000) * sampleRate)
  const fade = Math.round(0.03 * sampleRate)
  const dipEnd = change + Math.round(0.04 * sampleRate)
  const samples = Float32Array.from({ length: sampleRate }, (_, index) => {
    if (options.silent) return 0
    const into = Math.min(1, Math.max(0, (index - change) / fade))
    const share = options.cut ? (index >= change ? 1 : 0) : into
    const edited = 0.3 * (1 - 0.5 * share)
    const untouched =
      options.dip && index >= change && index < dipEnd ? 0.1 / Math.SQRT2 : 0.1
    const t = index / sampleRate
    return (
      edited * Math.sin(2 * Math.PI * TONES.edited * t) +
      untouched * Math.sin(2 * Math.PI * TONES.untouched * t)
    )
  })
  const contextTime = (startFrame + stampIndex) / sampleRate
  return {
    capture: { sampleRate, startFrame, samples },
    stamp: {
      kind: 'key',
      performanceMs: 0,
      contextTime,
      outputContextTime: contextTime,
      outputPerformanceMs: 0,
      baseLatency: 0.01,
      outputLatency: 0,
    },
  }
}

test.describe('Studio edits while playing', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // No browser: this checks the reader at the CI runner's 44.1 kHz and at
  // 48 kHz. A dip, a cut or a late change must read as one, and silence or
  // a capture that misses the edit must be no reading at all.
  test('reads an edit the same at 44.1 and 48 kHz, and a broken one as broken', () => {
    for (const rate of [44100, 48000]) {
      const clean = syntheticEdit(rate, 40)
      const heard = readEdit(clean.capture, clean.stamp, TONES, 300)
      expect(heard.editedBeforeDb).toBeCloseTo(-10.5, 1)
      expect(heard.editedAfterDb).toBeCloseTo(-16.5, 1)
      // Half way through the 30 ms fade, timed to a 10 ms window's middle.
      expect(Math.abs(heard.heardMs! - 55)).toBeLessThan(1.5)
      expect(heard.untouchedDipDb).toBeLessThan(0.01)
      expect(heard.editedDipDb).toBeLessThan(0.01)
      expect(heard.clickDb).toBeLessThan(1)

      // The cut lands on a peak of the edited tone, so it steps the wave.
      const broken = syntheticEdit(rate, 40.5, { dip: true, cut: true })
      const read = readEdit(broken.capture, broken.stamp, TONES, 300)
      expect(read.untouchedDipDb).toBeGreaterThan(2.5)
      expect(read.clickDb).toBeGreaterThan(20)

      const late = {
        ...clean.capture,
        startFrame: clean.capture.startFrame + 9000,
      }
      expect(() => readEdit(late, clean.stamp, TONES, 300)).toThrow(
        'does not hold',
      )
      const silent = syntheticEdit(rate, 40, { silent: true })
      expect(() => readEdit(silent.capture, silent.stamp, TONES, 300)).toThrow(
        'holds no level',
      )
      // 330 and 165 Hz do not fit a 10 ms window whole: refused, not misread.
      expect(() =>
        readEdit(
          clean.capture,
          clean.stamp,
          { edited: 330, untouched: 165 },
          300,
        ),
      ).toThrow('whole periods')
    }
  })

  test('a clip edit changes only its lane, heard within tens of milliseconds, a split starts nothing, and a new sound role hands over @smoke', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    await importSteady(page, 'Pad', [TONES.edited])
    await importSteady(page, 'Low', [TONES.untouched], 0.1)
    // The fixture's phrase swells; only the steady lanes play.
    await studio
      .locator('[data-studio-track]')
      .getByRole('button', { name: 'Mute Phrase', exact: true })
      .click()
    await studio.getByRole('button', { name: 'Play song', exact: true }).click()
    await untilAudioClock(page, (await audioClock(page)) + 2)

    /** Make one edit and read what it did, from the stamp of `kind` it makes. */
    const measure = async (
      label: string,
      kind: StudioClickStamp['kind'],
      settleMs: number,
      act: () => Promise<unknown>,
    ): Promise<EditReading & { sources: number }> => {
      await untilAudioClock(page, (await audioClock(page)) + 1)
      await clearClicks(page)
      const before = await liveSources(page)
      await act()
      const stamp = (await readClicks(page)).find(
        (click) => click.kind === kind,
      )
      expect(stamp, `${label}: no ${kind} stamp`).toBeDefined()
      const capture = await captureSpan(
        page,
        stamp!.contextTime - EDIT_STEADY_MS / 1000 - 0.05,
        stamp!.contextTime + settleMs / 1000 + 0.1,
      )
      const reading = {
        ...readEdit(capture, stamp!, TONES, settleMs),
        sources: (await liveSources(page)).created - before.created,
      }
      console.log(
        `[studio-edit-while-playing] ${JSON.stringify({ label, ...reading })}`,
      )
      return reading
    }

    const pad = studioClip(page, 'Pad')
    const toolbar = studio.getByRole('toolbar', { name: 'Selected clip' })
    await pad.click()
    await toolbar.getByRole('button', { name: 'Details', exact: true }).click()
    const gain = studio.getByRole('spinbutton', { name: /^Clip gain/ })
    await gain.fill('-6')
    const quieter = await measure('clip gain -6 dB', 'key', 500, () =>
      gain.press('Tab'),
    )
    await studio.getByRole('button', { name: 'Close Clip details' }).click()

    await pad.click()
    const split = await measure('split', 'down', 500, () =>
      toolbar.getByRole('button', { name: 'Split', exact: true }).click(),
    )
    await expect(pad).toHaveCount(2)

    // One millisecond later: the clip under the playhead moves.
    const later = pad.last()
    await later.click()
    const nudge = await measure('nudge', 'keyup', 500, () =>
      later.press('Alt+ArrowRight'),
    )
    // Each press is a commit, and each one moves the lane again.
    const burst = await measure('five nudges', 'keyup', 700, async () => {
      for (let press = 0; press < 5; press++)
        await later.press('Alt+ArrowRight')
    })

    await studio
      .getByRole('button', { name: 'Pad details', exact: true })
      .click()
    const role = studio.getByRole('combobox', { name: 'Sound role' })
    const next = (await role.inputValue()) === 'voice' ? 'keys' : 'voice'
    const sound = await measure('sound role', 'change', 900, () =>
      role.selectOption(next),
    )
    await expect(role).toHaveValue(next)
    await expect(
      studio.getByRole('button', { name: 'Pause song', exact: true }),
    ).toBeVisible()

    // Before lane re-planning, every clip edit here handed the whole song to
    // a new graph: the untouched lane dipped 0.55 to 0.88 dB, clip gain was
    // heard 144 to 150 ms after the key, and each edit started every lane's
    // sources again (headless Chromium, three runs).
    for (const [label, reading] of [
      ['clip gain', quieter],
      ['split', split],
      ['nudge', nudge],
      ['five nudges', burst],
    ] as const) {
      expect.soft(reading.untouchedDipDb, label).toBeLessThan(0.1)
      expect.soft(reading.clickDb, label).toBeLessThan(6)
    }
    expect.soft(quieter.heardMs, 'clip gain').not.toBeNull()
    expect.soft(quieter.heardMs!, 'clip gain').toBeLessThan(100)
    expect.soft(quieter.editedAfterDb - quieter.editedBeforeDb).toBeLessThan(-5)
    // One new source, on the lane the edit changed; none for a split, which
    // leaves the plan as it was.
    expect.soft(quieter.sources, 'clip gain').toBe(1)
    expect.soft(nudge.sources, 'nudge').toBe(1)
    expect.soft(split.sources, 'split').toBe(0)
    expect.soft(split.heardMs, 'split').toBeNull()
    expect.soft(split.editedDipDb, 'split').toBeLessThan(0.1)
    // A new sound role brings another chain, so a new run takes the song
    // over: with no dropout, and heard 323 to 339 ms after the change.
    expect.soft(sound.sources, 'sound role').toBeGreaterThan(0)
    expect.soft(sound.untouchedDipDb, 'sound role').toBeLessThan(3)
  })
})
