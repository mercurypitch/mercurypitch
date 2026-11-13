// ============================================================
// Inversions tests — Turn over's pitches, its return and its names
// ============================================================
//
// Lesson 27's Turn over: each press moves the lowest note up an octave and
// the press after the last inversion returns the chord to its first
// pitches, the third press for a triad and the fourth for a seventh chord,
// so no press climbs past FACTS 72's pitches (WEB-SPEC, Tests 19; FACTS 50).

import { describe, expect, it } from 'vitest'
import { nextPosition, POSITION_NAMES, positionsOf, turnOver, } from './inversions'

const C4 = 60

describe('turning a chord over', () => {
  it('moves the lowest note up an octave and keeps the notes low to high', () => {
    // Assert: C major, C E G, then E G C (FACTS 48)
    expect(turnOver([C4, C4 + 4, C4 + 7])).toEqual([64, 67, 72])
    expect(turnOver([67, 64, 72])).toEqual([67, 72, 76])
  })

  it('gives a triad three positions and a seventh chord four, each as FACTS 72 has them', () => {
    // Assert: I, and V7, for the higher voice
    expect(positionsOf([60, 64, 67])).toEqual([
      [60, 64, 67],
      [64, 67, 72],
      [67, 72, 76],
    ])
    expect(positionsOf([55, 59, 62, 65])).toEqual([
      [55, 59, 62, 65],
      [59, 62, 65, 67],
      [62, 65, 67, 71],
      [65, 67, 71, 74],
    ])
    // free play's I with its seventh reaches G5, the page's highest note
    expect(positionsOf([60, 64, 67, 71]).at(-1)).toEqual([71, 72, 76, 79])
  })

  it('returns to root position after the last inversion, however many presses', () => {
    // Arrange: a seventh chord's positions
    const all = positionsOf([55, 59, 62, 65])
    let at = 0
    const heard = new Set<number>()

    // Act: forty presses
    for (let press = 0; press < 40; press++) {
      at = nextPosition(at, all.length)
      all[at].forEach((m) => heard.add(m))
    }

    // Assert: the fourth press is root position again, and nothing past D5
    expect([1, 2, 3, 4].map((n) => nextPosition(n - 1, 4))).toEqual([
      1, 2, 3, 0,
    ])
    expect(nextPosition(2, 3)).toBe(0)
    expect(Math.max(...heard)).toBe(74)
    expect(Math.min(...heard)).toBe(55)
  })

  it('names each position by its bass', () => {
    // Assert
    expect(POSITION_NAMES).toEqual([
      'Root position',
      'First inversion',
      'Second inversion',
      'Third inversion',
    ])
  })
})
