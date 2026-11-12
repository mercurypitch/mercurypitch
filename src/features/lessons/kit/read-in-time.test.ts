// ============================================================
// Read-in-time tests — each note in its own beats, anchored on the first
// ============================================================
//
// Lesson 18's WEB-SPEC, Tests 7 (FACTS 52, 54), on synthetic takes as
// `verify18.mjs` runs them in section 8: the take's first run of 0.15 s or
// more anchors it from a quarter of a beat early to two beats late; a
// note's window reaches a quarter of a beat either side of its beats,
// anchored, and a frame in two windows counts for both; a note is heard at
// 0.45 s within 60 cents and not at 0.44; one not heard is read only from
// its own beats, and reads "We didn't hear a steady note there." where its
// voice is another written note's, never a gap measured from it.

import { describe, expect, it } from 'vitest'
import type { F0Frame } from '@/lib/mirror/metrics'
import { readingLines } from './read-along'
import type { InTimeOptions, InTimeReading, WrittenNote } from './read-in-time'
import { readInTime, windowsClose } from './read-in-time'

const HOP = 0.01
/** Bar 1's first beat on the audio clock; at 60 BPM a beat is 1 s. */
const BAR1 = 10
const G3 = 55
const A3 = 57
const B3 = 59
const C4 = 60
const D4 = 62

/** Tune 1 in G for the lower voice: do re mi so, so mi do, the last a half note. */
const TUNE_1: readonly WrittenNote[] = [
  { midi: G3, beat: 0, beats: 1 },
  { midi: A3, beat: 1, beats: 1 },
  { midi: B3, beat: 2, beats: 1 },
  { midi: D4, beat: 3, beats: 1 },
  { midi: D4, beat: 4, beats: 1 },
  { midi: B3, beat: 5, beats: 1 },
  { midi: G3, beat: 6, beats: 2 },
]
const LABELS = ['Do', 'Re', 'Mi', 'So', 'So', 'Mi', 'Do']
const OPTIONS: InTimeOptions = {
  notes: TUNE_1,
  bpm: 60,
  bar1: BAR1,
  // the take keeps frames from half a beat before bar 1
  opened: BAR1 - 0.5,
}
const NOT_STEADY = "We didn't hear a steady note there."

/** A stretch of one pitch, `from` s after bar 1's first beat, for `sec` s. */
interface Part {
  readonly midi: number
  readonly from: number
  readonly sec: number
  readonly cents?: number
}

const hz = (midi: number, cents = 0): number =>
  440 * 2 ** ((midi - 69 + cents / 100) / 12)

/** A take's raw frames, a frame every 10 ms: 46 frames hold 0.45 s, a frame's time counting from the one before. */
const take = (parts: readonly Part[]): F0Frame[] =>
  parts
    .flatMap((p) => {
      const out: F0Frame[] = []
      for (let i = 0; i * HOP < p.sec - 1e-9; i++)
        out.push({
          t: BAR1 + p.from + i * HOP,
          f0: hz(p.midi, p.cents),
          conf: 0.95,
        })
      return out
    })
    .sort((a, b) => a.t - b.t)

/** Tune 1 sung in tune, each note held its full length, `late` s after its written beat. */
const tune1 = (late = 0): Part[] =>
  TUNE_1.map((n) => ({ midi: n.midi, from: n.beat + late, sec: n.beats }))

function voiced(r: InTimeReading) {
  if (!r.voice) throw new Error('expected a voice')
  return r
}

const linesOf = (r: InTimeReading): string[] =>
  readingLines(LABELS, voiced(r).notes)

const ON_TIME_LINES = [
  'Do · Right in the middle: on the written note.',
  'Re · Right in the middle: on the written note.',
  'Mi · Right in the middle: on the written note.',
  'So · Right in the middle: on the written note.',
  'So · Right in the middle: on the written note.',
  'Mi · Right in the middle: on the written note.',
  'Do · Right in the middle: on the written note.',
]

/** A line measuring a gap: neither heard on its note nor not steady. */
const isGap = (line: string): boolean =>
  !line.includes(NOT_STEADY) &&
  !/Right in the middle|In the band|Close/.test(line)

describe('the in-time reader’s anchor', () => {
  it.each([
    ['on time', 0],
    ['a quarter of a beat early', -0.25],
    ['a whole beat late', 1],
    ['two beats late', 2],
  ])(
    'anchors a take whose first note comes %s, and reads it as if on time',
    (_, late) => {
      // Act
      const r = voiced(readInTime(take(tune1(late)), OPTIONS))

      // Assert
      expect(r.shift).toBeCloseTo(late, 6)
      expect(readingLines(LABELS, r.notes)).toEqual(ON_TIME_LINES)
    },
  )

  it.each([
    ['more than a quarter of a beat early', -0.26],
    ['more than two beats late', 2.01],
  ])('anchors nothing where the first note comes %s', (_, late) => {
    // Act
    const r = voiced(readInTime(take(tune1(late)), OPTIONS))

    // Assert
    expect(r.shift).toBeNull()
  })

  it('anchors on a run of 0.15 s, never a shorter one', () => {
    // Arrange: a blip a fifth of a beat early, then the tune a beat late
    const blip = (sec: number): Part => ({ midi: G3, from: -0.2, sec })

    // Act: 15 frames span 0.14 s, 16 span 0.15
    const short = voiced(readInTime(take([blip(0.15), ...tune1(1)]), OPTIONS))
    const long = voiced(readInTime(take([blip(0.16), ...tune1(1)]), OPTIONS))

    // Assert
    expect(short.shift).toBeCloseTo(1, 6)
    expect(long.shift).toBeCloseTo(-0.2, 6)
  })

  it('anchors nothing where do was hummed through the count-in, and reads the notes on their written beats', () => {
    // Arrange: do from before the take opened into bar 1, the rest on time
    const parts = [{ midi: G3, from: -0.8, sec: 1.8 }, ...tune1().slice(1)]

    // Act
    const r = voiced(readInTime(take(parts), OPTIONS))

    // Assert
    expect(r.shift).toBeNull()
    expect(readingLines(LABELS, r.notes)).toEqual(ON_TIME_LINES)
  })

  it('anchors nothing on a run already going as the take opens, wherever the take opens', () => {
    // Arrange: a take opened inside the span, do hummed from before it
    const late = { ...OPTIONS, opened: BAR1 - 0.2 }
    const parts = [{ midi: G3, from: -0.8, sec: 1.8 }, ...tune1().slice(1)]

    // Act
    const hummed = voiced(readInTime(take(parts), late))
    const started = voiced(readInTime(take(tune1(-0.1)), late))

    // Assert
    expect(hummed.shift).toBeNull()
    expect(started.shift).toBeCloseTo(-0.1, 6)
  })

  it('never hunts for a later run where the first falls outside the span', () => {
    // Arrange: 0.3 s of voice 0.4 s before bar 1, then the tune on time
    const parts = [{ midi: G3, from: -0.4, sec: 0.3 }, ...tune1()]

    // Act
    const early = voiced(readInTime(take(parts), OPTIONS))
    const alone = voiced(readInTime(take(tune1()), OPTIONS))

    // Assert
    expect(early.shift).toBeNull()
    expect(alone.shift).toBeCloseTo(0, 6)
  })

  it('ends the take a quarter of a beat after bar 2, moved by the anchor', () => {
    // Act
    const onTime = windowsClose(take(tune1()), OPTIONS)
    const late = windowsClose(take(tune1(2)), OPTIONS)
    const unanchored = windowsClose(take(tune1(2.5)), OPTIONS)

    // Assert
    expect(onTime).toBeCloseTo(BAR1 + 8.25, 6)
    expect(late).toBeCloseTo(BAR1 + 10.25, 6)
    expect(unanchored).toBeCloseTo(BAR1 + 8.25, 6)
  })
})

describe('the in-time reader’s windows', () => {
  it.each([0, 1])(
    'opens a note’s window a quarter of a beat before its first beat, moved %s s by the anchor',
    (late) => {
      // Arrange: do ends before re's window opens; re's first frame inside it starts its count
      const parts = (reFrom: number): Part[] => [
        { midi: G3, from: late, sec: 0.7 },
        { midi: A3, from: late + reFrom, sec: 0.48 },
      ]

      // Act: 46 frames inside the window, then 45
      const inside = voiced(readInTime(take(parts(0.73)), OPTIONS))
      const outside = voiced(readInTime(take(parts(0.72)), OPTIONS))

      // Assert
      expect(inside.notes[1].heard).toBe(true)
      expect(outside.notes[1].heard).toBe(false)
    },
  )

  it.each([0, 1])(
    'closes a note’s window a quarter of a beat after its last beat, moved %s s by the anchor',
    (late) => {
      // Arrange
      const parts = (reFrom: number): Part[] => [
        { midi: G3, from: late, sec: 0.7 },
        { midi: A3, from: late + reFrom, sec: 0.46 },
      ]

      // Act
      const inside = voiced(readInTime(take(parts(1.8)), OPTIONS))
      const outside = voiced(readInTime(take(parts(1.81)), OPTIONS))

      // Assert
      expect(inside.notes[1].heard).toBe(true)
      expect(outside.notes[1].heard).toBe(false)
    },
  )

  it('counts a frame in two windows for both notes', () => {
    // Arrange: one so, half a second across the two sos' windows
    const parts = [
      ...tune1().slice(0, 3),
      { midi: D4, from: 3.75, sec: 0.51 },
      ...tune1().slice(5),
    ]

    // Act
    const r = voiced(readInTime(take(parts), OPTIONS))

    // Assert
    expect(r.notes[3].heard).toBe(true)
    expect(r.notes[4].heard).toBe(true)
  })
})

describe('a note heard on its note', () => {
  it('is heard at 0.45 s within 60 cents, and not at 0.44', () => {
    // Act
    const heard = voiced(
      readInTime(take([{ midi: G3, from: 0, sec: 0.46 }]), OPTIONS),
    )
    const short = voiced(
      readInTime(take([{ midi: G3, from: 0, sec: 0.45 }]), OPTIONS),
    )

    // Assert
    expect(heard.notes[0].heard).toBe(true)
    expect(short.notes[0].heard).toBe(false)
  })

  it('takes back half a frame’s time for each frame outside, never below zero', () => {
    // Arrange: 0.3 s on do, 0.2 s a semitone off (back 0.1 s), then on again
    const dipped = (after: number): Part[] => [
      { midi: G3, from: 0, sec: 0.31 },
      { midi: G3 + 1, from: 0.31, sec: 0.2 },
      { midi: G3, from: 0.51, sec: after },
    ]
    const offFirst = [
      { midi: G3 + 1, from: 0, sec: 0.3 },
      { midi: G3, from: 0.3, sec: 0.45 },
    ]

    // Act
    const enough = voiced(readInTime(take(dipped(0.26)), OPTIONS))
    const notEnough = voiced(readInTime(take(dipped(0.24)), OPTIONS))
    const fromZero = voiced(readInTime(take(offFirst), OPTIONS))

    // Assert
    expect(enough.notes[0].heard).toBe(true)
    expect(notEnough.notes[0].heard).toBe(false)
    expect(fromZero.notes[0].heard).toBe(true)
  })

  it('takes back half a stretch’s time where there was no voice', () => {
    // Arrange: 0.3 s on do, a quarter-second gap, then on again
    const gapped = (after: number): Part[] => [
      { midi: G3, from: 0, sec: 0.31 },
      { midi: G3, from: 0.56, sec: after },
    ]

    // Act
    const enough = voiced(readInTime(take(gapped(0.22)), OPTIONS))
    const notEnough = voiced(readInTime(take(gapped(0.21)), OPTIONS))

    // Assert
    expect(enough.notes[0].heard).toBe(true)
    expect(notEnough.notes[0].heard).toBe(false)
  })

  it('reads every note heard on its note an octave lower, with Lesson 3’s line within 50 cents', () => {
    // Arrange
    const lower = (cents: number): Part[] =>
      tune1().map((p) => ({ ...p, midi: p.midi - 12, cents }))

    // Act
    const inTune = linesOf(readInTime(take(lower(0)), OPTIONS))
    const near = linesOf(readInTime(take(lower(-45)), OPTIONS))
    const far = linesOf(readInTime(take(lower(-55)), OPTIONS))

    // Assert
    expect(inTune[0]).toBe(
      'Do · Right in the middle: on the written note. You sang it an octave lower: same note.',
    )
    expect(near[0]).toBe(
      'Do · Close: 45 cents below the written note. You sang it an octave lower: same note.',
    )
    expect(far[0]).toBe('Do · Close: 55 cents below the written note.')
    expect(
      inTune.every((l) =>
        l.endsWith('You sang it an octave lower: same note.'),
      ),
    ).toBe(true)
  })

  it('reads a tune sung 0.4 s early, before the span, on its written beats', () => {
    // Act
    const r = voiced(readInTime(take(tune1(-0.4)), OPTIONS))

    // Assert
    expect(r.shift).toBeNull()
    expect(readingLines(LABELS, r.notes)).toEqual(ON_TIME_LINES)
  })

  it('reads tune 1 sung 1.5 beats late, or 0.2 s early, as if on time', () => {
    // Act
    const late = linesOf(readInTime(take(tune1(1.5)), OPTIONS))
    const early = linesOf(readInTime(take(tune1(-0.2)), OPTIONS))

    // Assert
    expect(late).toEqual(ON_TIME_LINES)
    expect(early).toEqual(ON_TIME_LINES)
  })
})

describe('a note not heard on its note', () => {
  it('reads both sos left out as not steady, with mi coming in 0.1 s or 0.4 s early', () => {
    for (const early of [0.1, 0.4]) {
      // Arrange
      const parts = tune1().flatMap((p, i) =>
        i === 3 || i === 4
          ? []
          : i === 5
            ? [{ ...p, from: p.from - early }]
            : [p],
      )

      // Act
      const lines = linesOf(readInTime(take(parts), OPTIONS))

      // Assert
      expect(lines[3]).toBe(`So · ${NOT_STEADY}`)
      expect(lines[4]).toBe(`So · ${NOT_STEADY}`)
      expect(lines.filter(isGap)).toEqual([])
    }
  })

  it('gives no gap line where the last three notes drift 1.2 beats late, finding the long do late in its window', () => {
    // Arrange
    const parts = tune1().map((p, i) =>
      i >= 4 ? { ...p, from: p.from + 1.2 } : p,
    )

    // Act
    const r = voiced(readInTime(take(parts), OPTIONS))
    const lines = readingLines(LABELS, r.notes)

    // Assert
    expect(lines[4]).toBe(`So · ${NOT_STEADY}`)
    expect(lines[5]).toBe(`Mi · ${NOT_STEADY}`)
    expect(r.notes[6].heard).toBe(true)
    expect(lines.filter(isGap)).toEqual([])
  })

  it('gives no gap line where the tune comes 2.5 beats late, past the span', () => {
    // Act
    const r = voiced(readInTime(take(tune1(2.5)), OPTIONS))
    const lines = readingLines(LABELS, r.notes)

    // Assert
    expect(r.shift).toBeNull()
    expect(lines.filter(isGap)).toEqual([])
    expect(lines[0]).toBe(`Do · ${NOT_STEADY}`)
  })

  it('reads a note whose own beats hold the note two places before it as not steady', () => {
    // Arrange: do held through re's and mi's beats, the rest on time
    const parts = [{ midi: G3, from: 0, sec: 3 }, ...tune1().slice(3)]

    // Act
    const lines = linesOf(readInTime(take(parts), OPTIONS))

    // Assert
    expect(lines.slice(0, 3)).toEqual([
      'Do · Right in the middle: on the written note.',
      `Re · ${NOT_STEADY}`,
      `Mi · ${NOT_STEADY}`,
    ])
  })

  it('reads mi sung 150 cents flat, beside re, as not heard', () => {
    // Arrange
    const parts = tune1().map((p, i) => (i === 2 ? { ...p, cents: -150 } : p))

    // Act
    const lines = linesOf(readInTime(take(parts), OPTIONS))

    // Assert
    expect(lines[2]).toBe(`Mi · ${NOT_STEADY}`)
  })

  it('reads re sung as fa, on time, as its gap from re', () => {
    // Arrange
    const parts = tune1().map((p, i) => (i === 1 ? { ...p, midi: C4 } : p))

    // Act
    const r = voiced(readInTime(take(parts), OPTIONS))
    const lines = readingLines(LABELS, r.notes)

    // Assert
    expect(r.notes[1]).toMatchObject({ heard: false })
    expect(lines[1]).toBe(
      'Re · About three semitones above, nearer a different note.',
    )
    expect(lines.filter((_, i) => i !== 1)).toEqual(
      ON_TIME_LINES.filter((_, i) => i !== 1),
    )
  })

  it('reads a note with too little voice in its own beats as not steady', () => {
    // Arrange: re for 0.25 s after its attack, then nothing until mi
    const parts = [
      ...tune1().slice(0, 1),
      { midi: C4, from: 1.15, sec: 0.25 },
      ...tune1().slice(2),
    ]

    // Act
    const lines = linesOf(readInTime(take(parts), OPTIONS))

    // Assert
    expect(lines[1]).toBe(`Re · ${NOT_STEADY}`)
  })

  it('reads a note’s own beats only after a 0.15 s attack, leaving out the note before’s tail', () => {
    // Arrange: do held 0.2 s into re's beats, then 0.2 s of fa, then nothing until mi
    const parts = [
      { midi: G3, from: 0, sec: 1.2 },
      { midi: C4, from: 1.2, sec: 0.2 },
      ...tune1().slice(2),
    ]

    // Act
    const lines = linesOf(readInTime(take(parts), OPTIONS))

    // Assert: 0.24 s of voice after the attack, so no reading from do's tail
    expect(lines[1]).toBe(`Re · ${NOT_STEADY}`)
  })

  it('reads every note not heard as not steady in a take with no anchor, never a gap', () => {
    // Arrange: hummed through the count-in, then re sung as fa
    const parts = [
      { midi: G3, from: -0.8, sec: 1.8 },
      { midi: C4, from: 1, sec: 1 },
      ...tune1().slice(2),
    ]

    // Act
    const lines = linesOf(readInTime(take(parts), OPTIONS))

    // Assert
    expect(lines[1]).toBe(`Re · ${NOT_STEADY}`)
  })
})

describe('the in-time reader’s lines', () => {
  it('leaves the next note’s reading alone where a note had no voice in its window', () => {
    // Arrange: re left out
    const parts = tune1().filter((_, i) => i !== 1)

    // Act
    const left = voiced(readInTime(take(parts), OPTIONS))
    const whole = voiced(readInTime(take(tune1()), OPTIONS))

    // Assert
    expect(readingLines(LABELS, left.notes)[1]).toBe(`Re · ${NOT_STEADY}`)
    expect(left.notes[2]).toEqual(whole.notes[2])
  })

  it('reads a take with no voiced frame in any window as no voice', () => {
    // Act
    const silent = readInTime([], OPTIONS)
    const before = readInTime(take([{ midi: G3, from: -2, sec: 1 }]), OPTIONS)
    const after = readInTime(take(tune1(9)), OPTIONS)

    // Assert
    expect(silent).toEqual({ voice: false })
    expect(before).toEqual({ voice: false })
    expect(after).toEqual({ voice: false })
  })

  it('gives no count, no advice and no word on timing in any line', () => {
    // Arrange
    const takes = [
      tune1(),
      tune1(1),
      tune1(2.5),
      tune1().map((p, i) => (i === 1 ? { ...p, midi: C4 } : p)),
      tune1().map((p, i) => (i >= 4 ? { ...p, from: p.from + 1.2 } : p)),
      tune1().map((p) => ({ ...p, midi: p.midi - 12, cents: 20 })),
    ]

    // Act
    const lines = takes.flatMap((t) => linesOf(readInTime(take(t), OPTIONS)))

    // Assert
    for (const line of lines) {
      expect(line).toMatch(
        /the written note|We didn't hear a steady note there\.|nearer a different note/,
      )
      expect(line).not.toMatch(
        /\bof \d|\d+\s*\/\s*\d|score|try|again|listen|late|early|beat|tim(e|ing)|great|well done|perfect/i,
      )
    }
  })
})
