// ============================================================
// Take part tests — the count-in and the other part under a take
// ============================================================
//
// Lesson 26 WEB-SPEC, Audio, and Lesson 28's, A part under a take: the
// count-in is one bar of clicks on the beat clock at the page's tempo, beat
// 1 higher; the other part is one voice booked on the audio clock at the
// run's level, under Merc's, all of it or the quiet check's first 2.0 s;
// and it breathes where the learner breathes, falling to a quarter for the
// last half beat of each note a breath follows, only on a note sung whole.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type * as BeatClockModule from './beat-clock'
import { runs as clockRuns } from './beat-clock-recorder.test-fixtures'
import { hz } from './notes'
import type * as SoundModule from './sound'
import { contourLength, MERC_GAIN } from './sound'
import type { TakePart } from './take-part'
import { bookPart, CHECK_SEC, PART_GAIN, partNotes, partSeconds, startCountIn, } from './take-part'

vi.mock('./beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./beat-clock-recorder.test-fixtures'))
    .FakeBeatClock,
}))
/** Every voice the part asked for: its line and its options. */
const voices = vi.hoisted(() => ({
  made: [] as {
    points: readonly { t: number; hz: number; level?: number }[]
    o: object
  }[],
}))
vi.mock('./sound', async (actual) => ({
  ...(await actual<typeof SoundModule>()),
  contourVoice: (
    points: readonly { t: number; hz: number; level?: number }[],
    o: object,
  ) => {
    voices.made.push({ points, o })
    return { alive: true, stop: () => undefined }
  },
}))

afterEach(() => {
  clockRuns.length = 0
  voices.made.length = 0
})

/** Lesson 28's lower part, bars 1 and 2: G3 F#3 | E3 G3, halves at 72 BPM, a breath after bar 2. */
const PART: TakePart = {
  midis: [55, 54, 52, 55],
  beats: [2, 2, 2, 2],
  bpm: 72,
  breaths: [1, 3],
}

describe('the count-in', () => {
  it('counts one bar of four clicks at the page’s tempo, beat 1 higher', () => {
    // Act
    startCountIn({
      bpm: 72,
      beats: 4,
      audible: true,
      onClick: () => undefined,
      onFrame: () => undefined,
    })

    // Assert
    const o = clockRuns[0].o
    expect(o.bpm()).toBe(72)
    expect(o.bar(0)?.beats).toBe(4)
    expect(o.bar(0)?.hits.map((h) => [h.beat, h.data])).toEqual([
      [0, { high: true }],
      [1, { high: false }],
      [2, { high: false }],
      [3, { high: false }],
    ])
    expect(o.bar(1)).toBeNull()
  })
})

describe('the other part under a take', () => {
  it('lasts its beats at its tempo: eight beats at 72 BPM, 6.67 s', () => {
    expect(partSeconds(PART)).toBeCloseTo(6.667, 3)
  })

  it('books one voice at the run’s level under Merc’s, on the audio clock', () => {
    // Act: half a beat ahead, as the take opens
    bookPart(PART, 0.42)

    // Assert
    const [part] = voices.made
    expect(part.o).toEqual({ kind: 'merc', gain: PART_GAIN, at: 0.42 })
    expect(PART_GAIN).toBeLessThan(MERC_GAIN)
    expect(contourLength(part.points as never)).toBeCloseTo(6.667, 3)
    expect(part.points[0].hz).toBeCloseTo(hz(55), 9)
  })

  it('breathes half a beat, 0.42 s, at the end of each note a breath follows', () => {
    // Act
    const notes = partNotes(PART)

    // Assert
    expect(notes.map((n) => n.breath ?? 0)).toEqual([
      0,
      expect.closeTo(0.4167, 3),
      0,
      expect.closeTo(0.4167, 3),
    ])
  })

  it('plays the quiet check’s first 2.0 s, and no breath on a note cut short', () => {
    // Act
    const notes = partNotes(PART, CHECK_SEC)
    bookPart(PART, 0, CHECK_SEC)

    // Assert: G3 whole, then F#3 for 0.33 s, its breath gone with its end
    expect(notes).toEqual([
      { midi: 55, sec: expect.closeTo(1.6667, 3) },
      { midi: 54, sec: expect.closeTo(0.3333, 3) },
    ])
    expect(contourLength(voices.made[0].points as never)).toBeCloseTo(2, 9)
    expect(voices.made[0].points.every((p) => (p.level ?? 1) === 1)).toBe(true)
  })

  it("dips the part's level to a quarter before its breath, and back for the next note", () => {
    // Act
    bookPart(PART, 0)

    // Assert
    const levels = voices.made[0].points.map((p) => p.level ?? 1)
    expect(levels.filter((l) => l === 0.25)).toHaveLength(2)
    expect(levels.at(-1)).toBe(1)
  })
})
