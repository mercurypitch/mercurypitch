// ============================================================
// Steady note — which note a voice sat on while it missed one
// ============================================================
//
// Readings are cents off the note asked for (C4 here), 60 a second.

import { describe, expect, it } from 'vitest'
import type { PitchPoint } from '@/lib/hold/hold-reading'
import type { SteadyOptions } from './steady-note'
import { closestSteadyNote, firstSteadyNote } from './steady-note'

const C4 = 60

/** Singer's band and land time, nothing held over, the hold's 0.1 s centre. */
const SINGER: SteadyOptions = {
  targetMidi: C4,
  tolCents: 35,
  landMs: 250,
  octaveFold: false,
  heldOver: false,
  centreTauSec: 0.1,
}

/** Readings from cents, frame by frame, from `startT`. */
function readings(cents: readonly number[], startT = 0): PitchPoint[] {
  return cents.map((c, i) => ({ t: startT + i / 60, cents: c }))
}

const held = (cents: number, seconds: number): number[] =>
  Array.from({ length: Math.round(seconds * 60) }, () => cents)

describe('closestSteadyNote', () => {
  it('names the steady note nearest the note asked for', () => {
    // Arrange: B-flat3, a tone under, then C-sharp4, a semitone over.
    const points = readings([...held(-200, 0.5), ...held(100, 0.5)])

    // Act
    const note = closestSteadyNote(points, SINGER)

    // Assert
    expect(note?.midi).toBe(C4 + 1)
    expect(note?.cents).toBeCloseTo(100, 6)
  })

  it('finds no steady note in a slide', () => {
    // Arrange: -250 to +250 cents in 0.5 s.
    const slide = Array.from({ length: 30 }, (_, i) => -250 + (500 * i) / 29)

    // Act
    const note = closestSteadyNote(readings(slide), SINGER)

    // Assert
    expect(note).toBeNull()
  })

  it('does not count a stretch shorter than the land time', () => {
    // Arrange: 0.2 s on a note, under Singer's 250 ms.
    const points = readings(held(-200, 0.2))

    // Act
    const note = closestSteadyNote(points, SINGER)

    // Assert
    expect(note).toBeNull()
  })

  it.each([
    [true, -300],
    [false, 100],
  ])(
    'skips the last note held over at the start only when it was (held over: %s)',
    (heldOver, cents) => {
      // Arrange: the voice still on the last note, a semitone over, then a
      // try three semitones under.
      const points = readings([...held(100, 0.5), ...held(-300, 0.5)])

      // Act
      const note = closestSteadyNote(points, { ...SINGER, heldOver })

      // Assert
      expect(note?.cents).toBeCloseTo(cents, 6)
    },
  )

  it('starts a new run after a gap, so only the opening run is held over', () => {
    // Arrange: held over at +100, a breath of 0.3 s, then +100 again.
    const points = [
      ...readings(held(100, 0.5)),
      ...readings(held(100, 0.5), 0.8),
    ]

    // Act
    const note = closestSteadyNote(points, { ...SINGER, heldOver: true })

    // Assert
    expect(note?.cents).toBeCloseTo(100, 6)
  })

  it('counts a note sung with a vibrato as steady when it would land', () => {
    // Arrange: 1 s at -170 cents with a 5 Hz, +-40 cent vibrato; the
    // smoothed centre swings about +-12, inside Professional's 25.
    const vibrato = Array.from(
      { length: 60 },
      (_, i) => -170 + 40 * Math.sin((2 * Math.PI * 5 * i) / 60),
    )

    // Act
    const note = closestSteadyNote(readings(vibrato), {
      ...SINGER,
      tolCents: 25,
      landMs: 200,
    })

    // Assert: whole cycles, so the median is the centre.
    expect(note?.midi).toBe(C4 - 2)
    expect(note?.cents).toBeCloseTo(-170, 6)
  })

  it("names a wrong note held only Merc's 0.45 s after a big leap, at Professional", () => {
    // Arrange: G4 asked for. The last note, C4, held over (700 under),
    // then A4 (200 over) for 27 frames. Smoothed from C4, the centre would
    // take 18 frames to settle within Professional's 50, leaving 9.
    const points = [
      ...readings(held(-700, 0.25), 0.5),
      ...readings(held(200, 0.45), 0.75),
    ]

    // Act
    const note = closestSteadyNote(points, {
      ...SINGER,
      targetMidi: 67,
      tolCents: 25,
      landMs: 200,
      heldOver: true,
    })

    // Assert
    expect(note).toEqual({ midi: 69, cents: 200 })
  })

  it('never starts the centre again on a vibrato swing, so a wide vibrato stays one note', () => {
    // Arrange: 1 s at -170 with a 6 Hz, +-60 cent vibrato: each reading
    // stays well within a semitone of the smoothed centre.
    const vibrato = Array.from(
      { length: 60 },
      (_, i) => -170 + 60 * Math.sin((2 * Math.PI * 6 * i) / 60),
    )

    // Act
    const note = closestSteadyNote(readings(vibrato), {
      ...SINGER,
      tolCents: 25,
      landMs: 200,
    })

    // Assert: whole cycles, so the median is the centre.
    expect(note?.midi).toBe(C4 - 2)
    expect(note?.cents).toBeCloseTo(-170, 6)
  })

  it.each([600, 1000, 2000, 4000])(
    'finds no steady note in a slide of %i cents a second, at Professional',
    (centsPerSecond) => {
      // Arrange: 0.5 s through the note at that speed; the faster ones
      // start the centre again on the way.
      const half = centsPerSecond / 4
      const slide = Array.from(
        { length: 30 },
        (_, i) => -half + (2 * half * i) / 29,
      )

      // Act
      const note = closestSteadyNote(readings(slide), {
        ...SINGER,
        tolCents: 25,
        landMs: 200,
      })

      // Assert
      expect(note).toBeNull()
    },
  )

  it('drops a tracker octave slip inside a steady note', () => {
    // Arrange: 0.4 s at -200 with a two-frame slip an octave up halfway.
    // Smoothed, the slip alone would split it into two short stretches.
    const cents = held(-200, 0.4)
    cents[12] = 1000
    cents[13] = 1000

    // Act
    const note = closestSteadyNote(readings(cents), { ...SINGER, landMs: 300 })

    // Assert
    expect(note?.midi).toBe(C4 - 2)
    expect(note?.cents).toBeCloseTo(-200, 6)
  })

  it.each([
    [true, 200],
    [false, -1000],
  ])(
    'keeps the octave sung and folds only the distance (fold: %s)',
    (octaveFold, cents) => {
      // Arrange: D3 for C4, ten semitones under.
      const points = readings(held(-1000, 0.5))

      // Act
      const note = closestSteadyNote(points, { ...SINGER, octaveFold })

      // Assert
      expect(note?.midi).toBe(50)
      expect(note?.cents).toBeCloseTo(cents, 6)
    },
  )
})

describe('firstSteadyNote', () => {
  it('takes the first note the voice sat on, not the nearest', () => {
    // Arrange: a tone under, held, then onto the note itself.
    const points = readings([...held(-200, 0.5), ...held(0, 0.5)])

    // Act
    const note = firstSteadyNote(points, SINGER)

    // Assert
    expect(note).toEqual({ midi: C4 - 2, cents: -200 })
  })

  it('takes a stretch still being sung once it has lasted the land time', () => {
    // Arrange: a scoop up, then 0.3 s on a note 20 cents flat, still going.
    const scoop = [-180, -150, -120, -90, -60, -40]
    const points = readings([...scoop, ...held(-20, 0.3)])

    // Act
    const note = firstSteadyNote(points, SINGER)

    // Assert
    expect(note?.midi).toBe(C4)
    expect(note?.cents).toBeCloseTo(-20, 0)
  })

  it('finds nothing before the voice has sat still for the land time', () => {
    // Arrange: 0.2 s of a note, under Singer's 250 ms.
    const points = readings(held(30, 0.2))

    // Act / Assert
    expect(firstSteadyNote(points, SINGER)).toBeNull()
  })

  it('reads a voice heard only five times a second as one run, given the gap', () => {
    // Arrange: 20 cents sharp for a second, a reading every 0.2 s.
    const points = Array.from({ length: 6 }, (_, i) => ({
      t: i * 0.2,
      cents: 20,
    }))

    // Act / Assert: the Mirror's gap splits every reading off...
    expect(firstSteadyNote(points, SINGER)).toBeNull()
    // ...and a wider one keeps them a run.
    expect(firstSteadyNote(points, { ...SINGER, runGapSec: 0.3 })).toEqual({
      midi: C4,
      cents: 20,
    })
  })

  it('folds the note to the nearest octave at the levels that fold', () => {
    // Arrange: the note an octave under, and 15 cents sharp of it.
    const points = readings(held(-1185, 0.4))

    // Act
    const note = firstSteadyNote(points, { ...SINGER, octaveFold: true })

    // Assert
    expect(note?.midi).toBe(C4 - 12)
    expect(note?.cents).toBeCloseTo(15, 0)
  })
})
