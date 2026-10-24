// ============================================================
// Lesson 9 sounds tests — every note, timing and drawn point the page plays
// ============================================================
//
// WEB-SPEC, Tests 4 and 9: the cold open's leap and three paths (FACTS 91);
// Steps 1 to 3's notes (FACTS 92); Step 4's five leaps in the syllabus's
// order, 12.4 s and 24.8 s slowed (FACTS 93); Step 5's landing, which lands
// 80 cents under so and settles 25 under (FACTS 94), and Step 2's copy, 75
// under (FACTS 98); the Four words and Merc's ladder (FACTS 91, 95), and
// free play, whose timing is borrowed from Steps 1 and 4; Slow doubling
// every onset and length of whatever it slows, and moving no pitch (FACTS
// 92); every fixed note at hz(m) for FACTS 90's notes; and every window
// holding every note its state plays.

import { describe, expect, it } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { ChartState, RungId } from './ladder-data'
import { doOf, leapName, leapSize, RUNG_ORDER, windowOf } from './ladder-data'
import type { SoundNote } from './sounds'
import { climbNotes, COPY_LANDS, COPY_TRACE, FIVE_LEAPS, fiveLeapsNotes, freeNotes, hearFirstNotes, LANDING_SEC, landingAt, landingSound, landingTrace, leapNotes, lengthOf, MERC_LEAP, mercLadderNotes, OVER_LEAPS, PATH_IDS, pathNotes, SLOW, stepNotes, wordNotes, } from './sounds'

const VOICES: readonly Voice[] = ['lower', 'higher']

/** FACTS 90: every fixed note, MIDI to hertz, to two decimals. */
const FACTS_90: Readonly<Record<number, number>> = {
  50: 146.83,
  52: 164.81,
  54: 185.0,
  55: 196.0,
  57: 220.0,
  62: 293.66,
  64: 329.63,
  66: 369.99,
  67: 392.0,
  69: 440.0,
  74: 587.33,
}

const midis = (notes: readonly SoundNote[]): number[] =>
  notes.map((n) => n.midi)
const times = (notes: readonly SoundNote[]): string[] =>
  notes.map((n) => n.t.toFixed(9))
const fixed = (xs: readonly number[]): string[] => xs.map((x) => x.toFixed(9))

/** Every pair of rungs free play can tap in turn, the first tap and a repeat included. */
const TAPS: readonly [RungId | null, RungId][] = [
  ...RUNG_ORDER.map((to) => [null, to] as [null, RungId]),
  ...RUNG_ORDER.flatMap((from) =>
    RUNG_ORDER.map((to) => [from, to] as [RungId, RungId]),
  ),
]

/** Every fixed sound each chart state plays, from `d`, at speed and slowed. */
function soundsOf(state: ChartState, d: number): SoundNote[][] {
  const both = (f: (slow: number) => SoundNote[]) => [f(1), f(SLOW)]
  switch (state) {
    case 'compact':
      return [leapNotes(d, MERC_LEAP), ...PATH_IDS.map((p) => pathNotes(d, p))]
    case 'step':
      return [
        ...both((s) => stepNotes(d, s)),
        ...both((s) => leapNotes(d, MERC_LEAP, s)),
      ]
    case 'hear':
      return [
        ...both((s) => hearFirstNotes(d, s)),
        ...both((s) => leapNotes(d, MERC_LEAP, s)),
      ]
    case 'ladder':
      return [
        ...both((s) => climbNotes(d, s)),
        ...OVER_LEAPS.flatMap((l) => both((s) => leapNotes(d, l, s))),
      ]
    case 'order':
      return both((s) => fiveLeapsNotes(d, s))
    case 'landing':
      return [[landingSound(d).first]]
    case 'free':
      return TAPS.flatMap(([from, to]) => [
        freeNotes(d, from, to),
        freeNotes(d, from, to, { hearFirst: true, slow: SLOW }),
      ])
  }
}

const STATES: readonly ChartState[] = [
  'compact',
  'step',
  'hear',
  'ladder',
  'order',
  'landing',
  'free',
]

describe('the cold open', () => {
  it("plays Merc's leap, do then so, and the three paths through re, mi and fa, 1.0 s a note", () => {
    // Act
    const leap = leapNotes(doOf('lower'), MERC_LEAP)
    const paths = PATH_IDS.map((p) => pathNotes(doOf('lower'), p))

    // Assert: FACTS 91
    expect(midis(leap)).toEqual([50, 57])
    expect(paths.map(midis)).toEqual([
      [50, 52, 57],
      [50, 54, 57],
      [50, 55, 57],
    ])
    for (const p of [leap, ...paths]) {
      expect(p.map((n) => n.dur)).toEqual(p.map(() => 1))
      expect(times(p)).toEqual(fixed(p.map((_, i) => i)))
    }
  })

  it('plays them an octave up for the higher voice', () => {
    // Act
    const paths = PATH_IDS.map((p) => midis(pathNotes(doOf('higher'), p)))

    // Assert
    expect(midis(leapNotes(doOf('higher'), MERC_LEAP))).toEqual([62, 69])
    expect(paths).toEqual([
      [62, 64, 69],
      [62, 66, 69],
      [62, 67, 69],
    ])
  })
})

describe('Steps 1 to 3', () => {
  it('play the step do to re and the leap do to so, and Slow doubles each without moving a pitch', () => {
    // Act
    const step = stepNotes(50)
    const slowStep = stepNotes(50, SLOW)

    // Assert: FACTS 92
    expect(midis(step)).toEqual([50, 52])
    expect(lengthOf(step)).toBe(2)
    expect(midis(slowStep)).toEqual(midis(step))
    expect(lengthOf(slowStep)).toBe(4)
    expect(lengthOf(leapNotes(50, MERC_LEAP, SLOW))).toBe(4)
  })

  it('play so alone for Hear it first, and the climb do, mi, so, top do', () => {
    // Act
    const hear = hearFirstNotes(62)
    const climb = climbNotes(50)

    // Assert: FACTS 92
    expect(hear).toEqual([{ t: 0, midi: 69, dur: 1 }])
    expect(midis(climb)).toEqual([50, 54, 57, 62])
    expect(lengthOf(climb)).toBe(4)
    expect(OVER_LEAPS.map((l) => midis(leapNotes(50, l)))).toEqual([
      [50, 57],
      [50, 62],
    ])
  })
})

describe("Step 4's five leaps", () => {
  it("come in the syllabus's order: mi to so, do to mi, do to so, so to the top do, do to the top do", () => {
    // Act
    const notes = fiveLeapsNotes(doOf('lower'))

    // Assert: FACTS 93
    expect(FIVE_LEAPS).toEqual([
      { from: 'mi', to: 'so' },
      { from: 'do', to: 'mi' },
      { from: 'do', to: 'so' },
      { from: 'so', to: 'top' },
      { from: 'do', to: 'top' },
    ])
    expect(midis(notes)).toEqual([54, 57, 50, 54, 50, 57, 57, 62, 50, 62])
  })

  it('are a minor third, a major third, a perfect fifth, a perfect fourth and an octave', () => {
    // Act
    const sizes = FIVE_LEAPS.map(leapSize)

    // Assert: FACTS 20 and 36
    expect(sizes).toEqual([3, 4, 7, 5, 12])
    expect(sizes.map(leapName)).toEqual([
      'a minor third',
      'a major third',
      'a perfect fifth',
      'a perfect fourth',
      'an octave',
    ])
  })

  it('take 12.4 s, two notes of 1.0 s a leap and 0.6 s between leaps, and 24.8 s slowed', () => {
    // Act
    const notes = fiveLeapsNotes(50)
    const slow = fiveLeapsNotes(50, SLOW)

    // Assert
    expect(lengthOf(notes)).toBeCloseTo(12.4, 9)
    expect(lengthOf(slow)).toBeCloseTo(24.8, 9)
    expect(times(notes)).toEqual(
      fixed([0, 1, 2.6, 3.6, 5.2, 6.2, 7.8, 8.8, 10.4, 11.4]),
    )
    expect(midis(slow)).toEqual(midis(notes))
  })
})

describe("Step 5's landing", () => {
  it('holds do for 1.0 s, lands 80 cents under so, slides up and settles 25 cents under, 3.0 s', () => {
    // Act
    const read = [0.5, 1, 1.3, 1.6, 2.2, 2.6, 3].map(landingAt)

    // Assert: FACTS 94
    expect(LANDING_SEC).toBe(3)
    expect(read).toEqual([
      { rung: 'do', cents: 0 },
      { rung: 'so', cents: -80 },
      { rung: 'so', cents: -80 },
      { rung: 'so', cents: -80 },
      { rung: 'so', cents: -25 },
      { rung: 'so', cents: -25 },
      { rung: 'so', cents: -25 },
    ])
    expect(landingAt(1.9).cents).toBeCloseTo(-52.5, 9)
  })

  it('draws its line through those points, cents from do, as far as the play has gone', () => {
    // Act
    const whole = landingTrace()
    const atLeap = landingTrace(1)
    const midSlide = landingTrace(1.9)

    // Assert
    expect(whole.map((p) => p.c)).toEqual([0, 0, 620, 620, 675, 675])
    expect(fixed(whole.map((p) => p.t))).toEqual(fixed([0, 1, 1, 1.6, 2.2, 3]))
    expect(atLeap).toEqual([
      { t: 0, c: 0 },
      { t: 1, c: 0 },
      { t: 1, c: 620 },
    ])
    expect(midSlide.at(-1)?.t).toBe(1.9)
    expect(midSlide.at(-1)?.c).toBeCloseTo(647.5, 9)
  })

  it("draws nothing before its start or past its end, whatever the play's clock says", () => {
    // Act
    const early = landingTrace(-1)
    const late = landingTrace(4)

    // Assert
    expect(early).toEqual(landingTrace(0))
    expect(early).toEqual([{ t: 0, c: 0 }])
    expect(late).toEqual(landingTrace(3))
  })

  it("sounds do, then one gliding voice at FACTS 94's frequencies, 6.0 s with Slow", () => {
    for (const [v, lands, settles] of [
      ['lower', 210.07, 216.85],
      ['higher', 420.13, 433.69],
    ] as const) {
      // Act
      const { first, slide } = landingSound(doOf(v))

      // Assert
      expect(first).toEqual({ t: 0, midi: doOf(v), dur: 1 })
      expect(slide.at).toBe(1)
      const [a, b, c, d] = slide.points.map((p) => p.hz)
      expect([a, b, c, d].map((f) => f.toFixed(2))).toEqual(
        [lands, lands, settles, settles].map((f) => f.toFixed(2)),
      )
      expect(fixed(slide.points.map((p) => p.t))).toEqual(
        fixed([0, 0.6, 1.2, 2]),
      )
    }
    const slow = landingSound(50, SLOW)
    expect(slow.slide.at + (slow.slide.points.at(-1)?.t ?? 0)).toBeCloseTo(6, 9)
  })
})

describe("Step 2's illustrated copy", () => {
  it('leaps from do’s band and lands 75 cents under so, 210.67 Hz or 421.35 Hz', () => {
    // Act
    const landed = COPY_TRACE.at(-1)?.c ?? 0

    // Assert: FACTS 98, over do's slot and so's, the copy measured from so
    expect(COPY_TRACE).toEqual([
      { t: 0, c: 0 },
      { t: 1, c: 0 },
      { t: 1, c: 625 },
      { t: 2, c: 625 },
    ])
    expect(landed).toBe(700 + COPY_LANDS)
    expect(COPY_LANDS).toBe(-75)
    expect(hz(50 + landed / 100)).toBeCloseTo(210.67, 2)
    expect(hz(62 + landed / 100)).toBeCloseTo(421.35, 2)
  })
})

describe('the other sounds', () => {
  it('give the Four words their plays, and Landing zone none', () => {
    // Act
    const words = wordNotes(50)

    // Assert: FACTS 91
    expect(midis(words.leap)).toEqual([50, 57])
    expect(midis(words.third)).toEqual([50, 54, 54, 57])
    expect(times(words.third)).toEqual(fixed([0, 1, 2.3, 3.3]))
    expect(midis(words.arpeggio)).toEqual([50, 54, 57, 62])
    expect(words.zone).toEqual([])
  })

  it("sing Merc's ladder at 1.5 s a note: 6.0 s full, 7.5 s smaller", () => {
    // Act
    const full = mercLadderNotes('full', 50)
    const smaller = mercLadderNotes('smaller', 62)

    // Assert: FACTS 76 and 95
    expect(midis(full)).toEqual([50, 54, 57, 62])
    expect(times(full)).toEqual(fixed([0, 1.5, 3, 4.5]))
    expect(lengthOf(full)).toBe(6)
    expect(midis(smaller)).toEqual([62, 66, 69, 66, 62])
    expect(lengthOf(smaller)).toBe(7.5)
  })

  it('play a free-play tap as its rung alone, and a tap after another as the leap, its landing note first under Hear it first', () => {
    // Act
    const first = freeNotes(50, null, 'so')
    const again = freeNotes(50, 'so', 'so')
    const down = freeNotes(50, 'top', 'so')
    const heard = freeNotes(50, 'so', 'top', { hearFirst: true })
    const slow = freeNotes(50, 'so', 'top', { hearFirst: true, slow: SLOW })

    // Assert
    expect(first).toEqual([{ t: 0, midi: 57, dur: 1 }])
    expect(again).toEqual(first)
    expect(midis(down)).toEqual([62, 57])
    expect(midis(heard)).toEqual([62, 57, 62])
    expect(times(heard)).toEqual(fixed([0, 1.6, 2.6]))
    expect(lengthOf(slow)).toBeCloseTo(2 * lengthOf(heard), 9)
  })
})

/** A sound as Slow sees it: its notes, and the landing's gliding slide. */
interface Slowable {
  readonly notes: readonly SoundNote[]
  readonly slide?: ReturnType<typeof landingSound>['slide']
}

/** Every sound Slow slows, from `d`, at a given slowing. */
function slowables(d: number): ((slow: number) => Slowable)[] {
  const leaps = [MERC_LEAP, ...OVER_LEAPS, ...FIVE_LEAPS]
  return [
    (s) => ({ notes: stepNotes(d, s) }),
    (s) => ({ notes: hearFirstNotes(d, s) }),
    (s) => ({ notes: climbNotes(d, s) }),
    ...leaps.map((l) => (s: number) => ({ notes: leapNotes(d, l, s) })),
    (s) => ({ notes: fiveLeapsNotes(d, s) }),
    ...TAPS.flatMap(([from, to]) =>
      [false, true].map((hearFirst) => (s: number) => ({
        notes: freeNotes(d, from, to, { hearFirst, slow: s }),
      })),
    ),
    (s) => {
      const { first, slide } = landingSound(d, s)
      return { notes: [first], slide }
    },
  ]
}

/** A slide's start and point times `by` times longer, and its pitches as they are; null for none. */
const slideShape = (x: Slowable, by = 1) =>
  x.slide === undefined
    ? null
    : {
        at: (x.slide.at * by).toFixed(9),
        times: fixed(x.slide.points.map((p) => p.t * by)),
        hz: x.slide.points.map((p) => p.hz),
      }

describe('Slow', () => {
  it('doubles every onset and length of each sound it slows, the slide’s start and points too, and moves no pitch', () => {
    for (const v of VOICES)
      for (const sound of slowables(doOf(v))) {
        // Act
        const once = sound(1)
        const slowed = sound(SLOW)

        // Assert
        expect(midis(slowed.notes)).toEqual(midis(once.notes))
        expect(times(slowed.notes)).toEqual(
          fixed(once.notes.map((n) => n.t * SLOW)),
        )
        expect(fixed(slowed.notes.map((n) => n.dur))).toEqual(
          fixed(once.notes.map((n) => n.dur * SLOW)),
        )
        expect(slideShape(slowed)).toEqual(slideShape(once, SLOW))
      }
  })
})

describe('every fixed sound', () => {
  it("plays only FACTS 90's notes, each at hz(m), in either voice", () => {
    // Arrange
    const all = VOICES.flatMap((v) => [
      ...STATES.flatMap((s) => soundsOf(s, doOf(v))),
      ...Object.values(wordNotes(doOf(v))),
      mercLadderNotes('full', doOf(v)),
      mercLadderNotes('smaller', doOf(v)),
    ])

    for (const notes of all)
      for (const n of notes) {
        // Act
        const listed = FACTS_90[n.midi]

        // Assert
        expect(listed, `MIDI ${n.midi}`).toBeDefined()
        expect(hz(n.midi)).toBeCloseTo(listed, 2)
      }
  })

  it('sits inside the window of the state that plays it', () => {
    for (const v of VOICES)
      for (const state of STATES) {
        // Arrange
        const d = doOf(v)
        const [lo, hi] = windowOf(state, d)

        // Act
        const played = soundsOf(state, d)
          .flat()
          .map((n) => n.midi)

        // Assert
        expect(Math.min(...played), state).toBeGreaterThanOrEqual(lo)
        expect(Math.max(...played), state).toBeLessThanOrEqual(hi)
      }
    // and Step 5's line, which glides in cents, stays inside its window too
    const [lo, hi] = windowOf('landing', 50)
    for (const p of landingTrace()) {
      expect(50 + (p.c ?? 0) / 100).toBeGreaterThanOrEqual(lo)
      expect(50 + (p.c ?? 0) / 100).toBeLessThanOrEqual(hi)
    }
  })
})
