// ============================================================
// Lesson 18 Sing it's runs tests — do, the count-in, then the bars
// ============================================================
//
// The bars, pure: a take's and Play the start's run is do and its quiet,
// the count-in and the tune's two bars with nothing in them, 13.4 s; Merc's
// tunes sing both, a second's pause and a second count-in between them,
// 26.4 s (WEB-SPEC, Toys 5; FACTS 49, 58, 59). Then on the beat clock as a
// recorder, against a staff that records what it is told: do in Merc's
// "ooh" lighting the house's note, the clicks, beat 1 higher, a dot of the
// strip lit a click, the count-in's start reported, each beat's pad lit in
// the bars, nothing sung in a take, the cursor at tempo and stopping at
// the final bar line; Merc's tunes sing every note as written, the one
// before the breath mark 0.6 s, and turn to the second tune, on the one
// staff or on its own.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import type { ReadMarks, ReadMarksState, } from '@/features/lessons/kit/read-marks'
import type { RhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { drive, finish, resetRuns, runs } from './page-dom.test-fixtures'
import type { SungPart, SungStaff } from './sung'
import { BETWEEN_BEATS, startSung, sungBars, sungSeconds } from './sung'
import { SING_1, SING_2 } from './tunes'

/** What the run booked: each note's frequency, length and voice, and each knock's beat-1 flag. */
const booked = vi.hoisted(() => ({
  notes: [] as { freq: number; dur: number; kind: string | undefined }[],
  wood: [] as boolean[],
}))

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (freq: number, o: { dur: number; kind?: string }) => {
    booked.notes.push({ freq, dur: o.dur, kind: o.kind })
    return null
  },
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: (_bus: unknown, _when: number, high: boolean) => {
    booked.wood.push(high)
  },
}))

/** A staff that records what the run lights and sets on it. */
function recorder(): SungStaff & {
  readonly lights: { pad: number | null; sounding: number | null }[]
  readonly sets: Partial<ReadMarksState>[]
} {
  const lights: { pad: number | null; sounding: number | null }[] = []
  const sets: Partial<ReadMarksState>[] = []
  return {
    lights,
    sets,
    bar: { light: (x: never) => lights.push(x) } as unknown as RhythmBar,
    marks: { set: (x: never) => sets.push(x) } as unknown as ReadMarks,
  }
}

const TAKE: readonly SungPart[] = [{ tune: SING_1, sing: false }]
const MERC: readonly SungPart[] = [
  { tune: SING_1, sing: true },
  { tune: SING_2, sing: true },
]
/** The last run's frame, as the clock draws it. */
const frame = (bar: number, beat: number, beats: number): void =>
  runs[runs.length - 1].o.onFrame?.({ bar, beat, beats })
const G3 = 55
const A3 = 57
const B3 = 59
const D4 = 62

beforeEach(() => {
  booked.notes.length = 0
  booked.wood.length = 0
  resetRuns()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the bars', () => {
  it('puts do and its quiet before the count-in, then the tune’s two bars with nothing in them, for a take: 13.4 s', () => {
    // Act
    const { bars, plan } = sungBars(TAKE)

    // Assert (FACTS 49, 58)
    expect(bars.map((b) => b.beats)).toEqual([4, 4, 4])
    expect(bars[0].hits.map((h) => [h.beat, h.data])).toEqual([
      [-1.4, { k: 'do' }],
      [0, { k: 'click', high: true }],
      [1, { k: 'click', high: false }],
      [2, { k: 'click', high: false }],
      [3, { k: 'click', high: false }],
    ])
    expect([bars[1].hits, bars[2].hits]).toEqual([[], []])
    expect(plan).toEqual([
      { part: 0, kind: 'count', from: -4 },
      { part: 0, kind: 'tune', from: 0 },
      { part: 0, kind: 'tune', from: 4 },
    ])
    expect(sungSeconds(TAKE)).toBeCloseTo(13.4, 9)
  })

  it('sings both tunes for Merc, a second’s pause and a second count-in between them, do only once: 26.4 s', () => {
    // Act
    const { bars, plan } = sungBars(MERC)

    // Assert (FACTS 59)
    expect(plan.map((p) => [p.part, p.kind])).toEqual([
      [0, 'count'],
      [0, 'tune'],
      [0, 'tune'],
      [1, 'pause'],
      [1, 'count'],
      [1, 'tune'],
      [1, 'tune'],
    ])
    expect(bars.map((b) => b.beats)).toEqual([4, 4, 4, BETWEEN_BEATS, 4, 4, 4])
    expect(
      bars.flatMap((b) => b.hits.filter((h) => h.data.k === 'do')),
    ).toHaveLength(1)
    expect(
      bars.map((b) =>
        b.hits.flatMap((h) =>
          h.data.k === 'note' ? [[h.beat, h.data.part, h.data.i]] : [],
        ),
      ),
    ).toEqual([
      [],
      [
        [0, 0, 0],
        [1, 0, 1],
        [2, 0, 2],
        [3, 0, 3],
      ],
      [
        [0, 0, 4],
        [1, 0, 5],
        [2, 0, 6],
      ],
      [],
      [],
      [
        [0, 1, 0],
        [1, 1, 1],
        [2, 1, 2],
        [3, 1, 3],
      ],
      [
        [0, 1, 4],
        [2, 1, 5],
      ],
    ])
    expect(sungSeconds(MERC)).toBeCloseTo(26.4, 9)
  })
})

describe('a take’s run', () => {
  it('sings do in Merc’s ooh, lighting the house’s note until the first click, counts in a dot a click, then lights each beat’s pad in silence', async () => {
    // Arrange
    const staff = recorder()
    const counted = vi.fn()

    // Act
    startSung({
      clef: 'bass',
      parts: TAKE,
      staffOf: () => staff,
      audible: true,
      onCount: counted,
    })
    drive()
    const lights = [...staff.lights]
    const dots = staff.sets.flatMap((s) =>
      s.countIn === undefined || s.countIn === null ? [] : [s.countIn.lit],
    )
    await finish()

    // Assert (WEB-SPEC, Toys 5, states 5 and 6)
    expect(booked.notes).toEqual([{ freq: hz(G3), dur: 1, kind: 'merc' }])
    expect(booked.wood).toEqual([true, false, false, false])
    expect(counted).toHaveBeenCalledTimes(1)
    expect(lights).toEqual([
      { pad: null, sounding: 0 },
      { pad: null, sounding: null },
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((pad) => ({ pad, sounding: null })),
    ])
    expect(dots).toEqual([0, 1, 2, 3, null])
    expect(staff.sets.at(-1)).toEqual({ countIn: null, cursor: 8 })
    expect(staff.lights.at(-1)).toEqual({ pad: null, sounding: null })
  })

  it('reports each frame’s beats into the bars, below 0 in the count-in, and moves the cursor at tempo only in the bars', () => {
    // Arrange: motion on
    vi.spyOn(Motion, 'paused', 'get').mockReturnValue(false)
    vi.spyOn(Motion, 'locked', 'get').mockReturnValue(false)
    const staff = recorder()
    const seen: (readonly [number, number])[] = []
    startSung({
      clef: 'bass',
      parts: TAKE,
      staffOf: () => staff,
      audible: true,
      onBeats: (part, beats) => seen.push([part, beats]),
    })

    // Act
    frame(0, 3, 3.5)
    const inCount = staff.sets.some((s) => s.cursor !== undefined)
    frame(1, 0, 4.25)
    frame(2, 1, 9.5)

    // Assert
    expect(seen).toEqual([
      [0, -0.5],
      [0, 0.25],
      [0, 5.5],
    ])
    expect(inCount).toBe(false)
    expect(staff.sets.map((s) => s.cursor)).toEqual([0.25, 5.5])
  })

  it('moves the cursor from beat to beat with motion paused', () => {
    // Arrange
    vi.spyOn(Motion, 'paused', 'get').mockReturnValue(true)
    const staff = recorder()
    startSung({
      clef: 'bass',
      parts: TAKE,
      staffOf: () => staff,
      audible: true,
    })

    // Act
    frame(1, 0, 4.25)
    frame(2, 1, 9.5)

    // Assert
    expect(staff.sets.map((s) => s.cursor)).toEqual([0, 5])
  })

  it('leaves the cursor where it was when the run is stopped, not at the final bar line', async () => {
    // Arrange
    const staff = recorder()
    const r = startSung({
      clef: 'bass',
      parts: TAKE,
      staffOf: () => staff,
      audible: true,
    })

    // Act
    r.stop()
    await r.done

    // Assert
    expect(staff.sets.at(-1)).toEqual({ countIn: null, cursor: null })
  })
})

describe('Merc’s tunes', () => {
  it('sings every note as written in the chosen voice, the one before each breath mark 0.6 s', async () => {
    // Arrange
    const staff = recorder()

    // Act
    startSung({
      clef: 'bass',
      parts: MERC,
      staffOf: () => staff,
      show: () => undefined,
      audible: true,
    })
    await finish()

    // Assert (FACTS 59, 81): G3 A3 B3 D4, D4 B3 G3; G3 G3 B3 B3, D4 G3
    const q = heldSeconds(1, 60)
    const h = heldSeconds(2, 60)
    expect(booked.notes.map((n) => [n.freq, n.dur])).toEqual([
      [hz(G3), 1],
      [hz(G3), q],
      [hz(A3), q],
      [hz(B3), q],
      [hz(D4), 0.6],
      [hz(D4), q],
      [hz(B3), q],
      [hz(G3), h],
      [hz(G3), q],
      [hz(G3), q],
      [hz(B3), q],
      [hz(B3), 0.6],
      [hz(D4), h],
      [hz(G3), h],
    ])
    expect(new Set(booked.notes.map((n) => n.kind))).toEqual(new Set(['merc']))
    expect(booked.wood).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ])
  })

  it('lights each note amber as it sounds, by the beats into its tune', () => {
    // Arrange
    const staff = recorder()
    startSung({
      clef: 'bass',
      parts: MERC,
      staffOf: () => staff,
      audible: true,
    })

    // Act
    frame(1, 0, 4.5)
    frame(2, 2, 10.5)

    // Assert: tune 1's do, then its long G, the seventh sound
    expect(staff.lights).toEqual([
      { pad: null, sounding: 0 },
      { pad: null, sounding: 6 },
    ])
  })

  it('shows tune 2 on the one staff as the pause starts, its cursor cleared', () => {
    // Arrange
    const staff = recorder()
    const shown: number[] = []
    startSung({
      clef: 'bass',
      parts: MERC,
      staffOf: () => staff,
      show: (part) => shown.push(part),
      audible: true,
    })

    // Act: to the pause
    drive(13)

    // Assert
    expect(shown).toEqual([1])
    expect(staff.sets).toContainEqual({ cursor: null, countIn: null })
  })

  it('turns to tune 2’s own staff when both are drawn, putting the first one out', () => {
    // Arrange
    const one = recorder()
    const two = recorder()
    startSung({
      clef: 'treble',
      parts: MERC,
      staffOf: (part) => (part === 0 ? one : two),
      audible: true,
    })

    // Act: tune 1, the pause and tune 2's count-in, then its first beat
    drive(18)

    // Assert
    expect(one.lights.at(-1)).toEqual({ pad: null, sounding: null })
    expect(two.lights).toEqual([{ pad: 0, sounding: null }])
    expect(two.sets.map((s) => s.countIn?.lit)).toEqual([0, 1, 2, 3, null])
    expect(booked.notes[0].freq).toBe(hz(G3 + 12))
  })
})
