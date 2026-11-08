// ============================================================
// Circle geometry tests — twelve fifths, the keys round the circle, its parts and the walk
// ============================================================
//
// Lesson 21's circle of fifths (WEB-SPEC, Toys 3; FACTS 23 to 31): the
// ring threaded by fifths visits every note once, each key sits a fifth
// from its neighbours with its signature, the bottom three carry two names,
// the house's three parts, and the walk of twelve pure fifths overshooting
// C by 23.46 cents where equal ones close.

import { describe, expect, it } from 'vitest'
import { angleBetween, angleOf, CIRCLE, FIFTHS, PARTS, seatOf, seatsOf, stepSeat, walkGapCents, walkHz, } from './circle-geometry'
import { majorScale } from './major-scale'
import { signName } from './notes'
import { keyOfScale } from './staff-key'
import { midiOf } from './staff-places'

/** An angle within one turn, from 0. */
const turn = (a: number): number =>
  ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)

const name = (k: (typeof CIRCLE)[number]): string =>
  [k.tonic, k.twin]
    .flatMap((s) => (s === null ? [] : [signName(s, { octave: false })]))
    .join('/')

describe('the ring threaded by fifths', () => {
  it('visits every note once in twelve fifths, and comes back to C', () => {
    // Assert: FACTS 24 and 28
    FIFTHS.forEach((pc, i) => expect(FIFTHS[(i + 1) % 12]).toBe((pc + 7) % 12))
    expect(new Set(FIFTHS).size).toBe(12)
  })

  it("seats each bead a semitone apart on Lesson 2's ring, and a fifth apart on the circle", () => {
    // Assert: G is seven semitones round the ring, one place round the circle
    expect(seatOf(7, 'semitones')).toBe(7)
    expect(seatOf(7, 'fifths')).toBe(1)
    expect(seatOf(5, 'fifths')).toBe(11)
    expect(turn(angleBetween(7, 'semitones', 'fifths', 0))).toBeCloseTo(
      angleOf(7),
    )
    expect(turn(angleBetween(7, 'semitones', 'fifths', 1))).toBeCloseTo(
      angleOf(1),
    )
  })

  it('keeps the even pitch classes where they are and sends the odd ones half a turn clockwise as the ring re-threads', () => {
    for (const pc of FIFTHS) {
      // Act
      const travel =
        angleBetween(pc, 'semitones', 'fifths', 1) -
        angleBetween(pc, 'semitones', 'fifths', 0)

      // Assert: seat 7p, so 6p semitones' worth of turn, none or a half
      expect(travel).toBeCloseTo(pc % 2 === 0 ? 0 : Math.PI, 9)
    }
  })
})

describe('the keys round the circle', () => {
  it('names the twelve keys clockwise from C, the bottom three twice, sharp over flat', () => {
    // Assert: FACTS 23
    expect(CIRCLE.map(name)).toEqual([
      'C',
      'G',
      'D',
      'A',
      'E',
      'B/C♭',
      'F♯/G♭',
      'C♯/D♭',
      'A♭',
      'E♭',
      'B♭',
      'F',
    ])
  })

  it('gives each key one sharp more clockwise and one flat more anticlockwise, as its scale has them', () => {
    for (const k of CIRCLE.filter((x) => x.read)) {
      // Act: the scale from the key's tonic
      const sig = keyOfScale(majorScale(midiOf(k.tonic)))

      // Assert
      expect(sig).toEqual(k.key)
    }
    expect(CIRCLE.map((k) => `${k.key.count}${k.key.sign}`)).toEqual([
      '0sharp',
      '1sharp',
      '2sharp',
      '3sharp',
      '4sharp',
      '5sharp',
      '6sharp',
      '7sharp',
      '4flat',
      '3flat',
      '2flat',
      '1flat',
    ])
  })

  it('reads the six keys next to C, and no key past three sharps or flats', () => {
    // Assert: FACTS 25
    expect(CIRCLE.filter((k) => k.read).map(name)).toEqual([
      'C',
      'G',
      'D',
      'A',
      'E♭',
      'B♭',
      'F',
    ])
  })
})

describe('the parts the house moves within', () => {
  it('runs Step 2 from C round to A, Step 3 from E flat round to C, and free play from E flat round to A', () => {
    // Assert: WEB-SPEC, Toys 3
    expect(seatsOf(PARTS.sharps)).toEqual([0, 1, 2, 3])
    expect(seatsOf(PARTS.flats)).toEqual([9, 10, 11, 0])
    expect(seatsOf(PARTS.all)).toEqual([9, 10, 11, 0, 1, 2, 3])
    expect(seatsOf(PARTS.all).every((s) => CIRCLE[s].read)).toBe(true)
  })

  it('stops a step at each end of its part', () => {
    // Assert
    expect(stepSeat(0, 1, PARTS.sharps)).toBe(1)
    expect(stepSeat(3, 1, PARTS.sharps)).toBeNull()
    expect(stepSeat(0, -1, PARTS.sharps)).toBeNull()
    expect(stepSeat(0, -1, PARTS.flats)).toBe(11)
    expect(stepSeat(9, -1, PARTS.flats)).toBeNull()
    expect(stepSeat(0, 1, PARTS.flats)).toBeNull()
    expect(stepSeat(9, -1, PARTS.all)).toBeNull()
    expect(stepSeat(3, 1, PARTS.all)).toBeNull()
    expect(stepSeat(4, 1, PARTS.all)).toBeNull()
  })
})

describe('the walk of twelve fifths', () => {
  it("plays FACTS 31's thirteen pure fifths, folded into the octave from C4", () => {
    // Arrange
    const facts = [
      261.63, 392.44, 294.33, 441.49, 331.12, 496.68, 372.51, 279.38, 419.07,
      314.31, 471.46, 353.59, 265.19,
    ]

    // Act
    const hz = walkHz('pure')

    // Assert
    expect(hz).toHaveLength(13)
    hz.forEach((f, i) => expect(Math.abs(f - facts[i])).toBeLessThan(0.006))
  })

  it('ends 23.46 cents above C on pure fifths, and on C on equal ones', () => {
    // Assert: FACTS 30 and 31
    expect(walkGapCents('pure')).toBeCloseTo(23.46, 2)
    expect(walkGapCents('equal')).toBeCloseTo(0, 6)
    expect(walkHz('equal')[12]).toBeCloseTo(walkHz('equal')[0], 6)
  })
})
