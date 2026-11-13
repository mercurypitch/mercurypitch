// ============================================================
// Lesson 26 Sing it's sounds tests — the model, the count-in, the part and the listening play
// ============================================================
//
// WEB-SPEC, Audio, and Tests 1: the quiet check plays 2.0 s of the other
// part, the model 6.0 s, the count-in one bar of four, 4.0 s at 60 BPM,
// beat 1 higher, and a run's part 6.0 s; the part is one voice along its
// contour, booked on the audio clock at the run's level, under Merc's; and
// "Just listen today"'s play is the tune, the part, then both, 1.0 s
// apart, 20.0 s, the two parts' notes sharing their onsets.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { runs as clockRuns } from '@/features/lessons/kit/beat-clock-recorder.test-fixtures'
import { hz } from '@/features/lessons/kit/notes'
import type * as RunModule from '@/features/lessons/kit/run'
import { runs } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type * as SoundModule from '@/features/lessons/kit/sound'
import { contourLength, MERC_GAIN, NOTE_GAIN, } from '@/features/lessons/kit/sound'
import { partOf, tuneOf } from './sing-plan'
import { bookPart, CHECK_SEC, LISTEN_SEC, listenNotes, PART_GAIN, runNotes, startCountIn, startListen, startModel, } from './sing-sounds'

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
/** Every voice the part asked for: its line and its options. */
const voices = vi.hoisted(() => ({
  made: [] as { points: readonly { t: number; hz: number }[]; o: object }[],
}))
vi.mock('@/features/lessons/kit/sound', async (actual) => ({
  ...(await actual<typeof SoundModule>()),
  contourVoice: (points: readonly { t: number; hz: number }[], o: object) => {
    voices.made.push({ points, o })
    return { alive: true, stop: () => undefined }
  },
}))

afterEach(() => {
  runs.length = 0
  clockRuns.length = 0
  voices.made.length = 0
})

describe('Sing it’s sounds', () => {
  it('sings the model, the learner’s part alone in Merc’s “ooh” at his level, 6.0 s, each note told as it starts', () => {
    // Arrange
    const heard: number[] = []

    // Act
    startModel(partOf('lower').midis, true, (i) => heard.push(i))
    runs[0].note(2)

    // Assert
    expect(runs[0].notes).toEqual(runNotes(partOf('lower').midis))
    expect(runs[0].notes.map((n) => [n.t, n.dur])).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 2],
    ])
    expect([runs[0].o.kind, runs[0].o.gain]).toEqual(['merc', MERC_GAIN])
    expect(heard).toEqual([2])
  })

  it('counts in one bar of four clicks at 60 BPM, beat 1 higher', () => {
    // Act
    startCountIn(
      true,
      () => undefined,
      () => undefined,
    )

    // Assert: 4.0 s
    const o = clockRuns[0].o
    expect(o.bpm()).toBe(60)
    expect(o.bar(0)?.beats).toBe(4)
    expect(o.bar(0)?.hits.map((h) => [h.beat, h.data])).toEqual([
      [0, { high: true }],
      [1, { high: false }],
      [2, { high: false }],
      [3, { high: false }],
    ])
    expect(o.bar(1)).toBeNull()
  })

  it('books the other part as one voice, 6.0 s from its start on the audio clock, at the run’s level under Merc’s', () => {
    // Act: half a beat ahead, as the take opens
    bookPart(tuneOf('lower').midis, 0.5)

    // Assert
    const [part] = voices.made
    expect(part.o).toEqual({ kind: 'merc', gain: PART_GAIN, at: 0.5 })
    expect(PART_GAIN).toBeLessThan(MERC_GAIN)
    expect(contourLength(part.points as never)).toBeCloseTo(6, 9)
    expect(part.points[0].hz).toBeCloseTo(hz(55), 9)
    expect(part.points.at(-1)?.hz).toBeCloseTo(hz(55), 9)
  })

  it('plays the quiet check’s 2.0 s: the part’s first two notes, from now', () => {
    // Act
    bookPart(partOf('higher').midis, 0, CHECK_SEC)

    // Assert
    const [part] = voices.made
    expect(CHECK_SEC).toBe(2)
    expect(contourLength(part.points as never)).toBeCloseTo(2, 9)
    expect([part.points[0].hz, part.points.at(-1)?.hz]).toEqual([
      hz(71),
      hz(72),
    ])
  })

  it('plays “Just listen today”: the tune, the part, then both, 1.0 s apart, 20.0 s, the parts’ notes sharing their onsets', () => {
    // Act
    startListen(tuneOf('lower'), partOf('lower'), true, () => undefined)

    // Assert
    const notes = listenNotes(tuneOf('lower'), partOf('lower'))
    expect(runs[0].notes).toEqual(notes)
    expect([runs[0].o.kind, runs[0].o.gain]).toEqual(['merc', NOTE_GAIN])
    expect(LISTEN_SEC).toBe(20)
    expect(Math.max(...notes.map((n) => n.t + n.dur))).toBe(20)
    expect(notes.slice(0, 5).map((n) => n.midi)).toEqual(tuneOf('lower').midis)
    expect(notes.slice(5, 10).map((n) => [n.t, n.midi])).toEqual(
      partOf('lower').midis.map((m, i) => [7 + i, m]),
    )
    expect(notes.slice(10, 15).map((n) => n.t)).toEqual(
      notes.slice(15).map((n) => n.t),
    )
    expect(notes[10].t).toBe(14)
  })
})
