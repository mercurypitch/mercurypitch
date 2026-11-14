// ============================================================
// Lesson 28 Sing it's sounds tests — do, the count-in, the part and the plays
// ============================================================
//
// WEB-SPEC, Tests 1 and 9, with the kit's runs and beat clock as
// recorders: do, 1.0 s on the chosen voice's "ooh", G3 or G4; the count-in,
// one bar of four clicks at 72 BPM, 3.33 s, beat 1 higher; the part under a
// take at 72 BPM, breathing after bars 2, 4 and 6, all of it or the quiet
// check's 2.0 s; Play the song, bars 1 to 8 with both parts' notes sharing
// their onsets, 26.67 s; and the first turn, the other part alone.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { drive, resetRuns as resetClocks, runs as clocks, } from '@/features/lessons/kit/beat-clock-recorder.test-fixtures'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { MERC_GAIN } from '@/features/lessons/kit/sound'
import { partNotes as partNotesOf } from '@/features/lessons/kit/take-part'
import { DO_SEC, MERC_PART, PART_SEC, TAVI_PART } from './sing-plan'
import { CHECK_SEC, QUIET_GAP_SEC, startCountIn, startDo, startFirst, startSong, takePartOf, } from './sing-sounds'
import { BAR_SEC, BPM } from './song'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (
    await import('@/features/lessons/kit/beat-clock-recorder.test-fixtures')
  ).FakeBeatClock,
}))

beforeEach(() => {
  resetRuns()
  resetClocks()
})

const end = (notes: readonly { t: number; dur: number }[]): number =>
  Math.max(...notes.map((n) => n.t + n.dur))

describe('the run’s sounds', () => {
  it('sings do for each voice on Merc’s “ooh”, G3 or G4, 1.0 s, then 0.4 s of quiet', () => {
    // Act
    startDo('lower', true)
    startDo('higher', true)

    // Assert: Tests 1
    expect(runs.map((r) => r.notes.map((n) => [n.midi, n.dur]))).toEqual([
      [[55, DO_SEC]],
      [[67, DO_SEC]],
    ])
    expect(runs[0].o).toMatchObject({ kind: 'merc', gain: MERC_GAIN })
    expect([DO_SEC, QUIET_GAP_SEC]).toEqual([1, 0.4])
  })

  it('counts in one bar of four clicks at 72 BPM, 3.33 s, beat 1 higher, each told as heard', () => {
    // Arrange
    const heard: number[] = []

    // Act
    startCountIn(
      true,
      (b) => heard.push(b),
      () => undefined,
    )
    drive()

    // Assert
    const o = clocks[0].o
    const bar = o.bar(0)
    expect(o.bpm()).toBe(BPM)
    expect(bar?.hits.map((h) => h.data)).toEqual([
      { high: true },
      { high: false },
      { high: false },
      { high: false },
    ])
    expect(heard).toEqual([0, 1, 2, 3])
    expect((4 * 60) / BPM).toBeCloseTo(BAR_SEC, 9)
    expect(BAR_SEC).toBeCloseTo(3.333, 3)
  })

  it('books the part under a take at 72 BPM, breathing after bars 2, 4 and 6, all of it or the quiet check’s 2.0 s', () => {
    // Act
    const part = takePartOf(TAVI_PART)
    const whole = partNotesOf(part)
    const check = partNotesOf(part, CHECK_SEC)

    // Assert: Tests 9; the breath on the notes before each mark, a half beat
    expect([part.bpm, part.breaths]).toEqual([72, [3, 6, 10]])
    expect(whole.map((n) => n.breath ?? 0).filter((b) => b > 0)).toHaveLength(3)
    expect(whole.reduce((a, n) => a + n.sec, 0)).toBeCloseTo(PART_SEC, 9)
    expect(check.reduce((a, n) => a + n.sec, 0)).toBeCloseTo(CHECK_SEC, 9)
  })
})

describe('the card’s plays', () => {
  it('plays the song’s bars 1 to 8, both parts note against note, 26.67 s', () => {
    // Act
    startSong(true)

    // Assert: Tests 1; every two-part play's notes share their onsets
    const notes = runs[0].notes
    expect(notes).toHaveLength(28)
    expect(end(notes)).toBeCloseTo(PART_SEC, 9)
    const onsets = (midis: readonly number[]) =>
      notes
        .filter((n) => midis.includes(n.midi))
        .map((n) => Number(n.t.toFixed(6)))
    expect(onsets(MERC_PART.midis)).toEqual(onsets(TAVI_PART.midis))
  })

  it('plays the other part alone first: Tavi’s for the lower voice, Merc’s for the higher, 26.67 s', () => {
    // Act
    startFirst('lower', true)
    startFirst('higher', true)

    // Assert
    expect(runs.map((r) => r.notes.map((n) => n.midi))).toEqual([
      [...TAVI_PART.midis],
      [...MERC_PART.midis],
    ])
    expect(end(runs[0].notes)).toBeCloseTo(PART_SEC, 9)
  })
})
