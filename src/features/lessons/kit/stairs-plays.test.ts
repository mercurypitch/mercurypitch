// ============================================================
// Staircase plays tests — the notes and timings of each scale it plays
// ============================================================

import { describe, expect, it } from 'vitest'
import { groupOf, landOnDo, lengthOf, scaleDown, scaleUp, stopOnTi, whiteKeysRun, } from './stairs-plays'
import { MAJOR_FIVE } from './stairs-scales'

const midis = (events: readonly { midi: number }[]): number[] =>
  events.map((e) => e.midi)

describe('the staircase plays', () => {
  it('plays a scale at 0.45 s a note, its last 0.9 s (Lesson 4 FACTS 57)', () => {
    // Act
    const up = scaleUp(60)

    // Assert
    expect(midis(up)).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
    expect(up.map((e) => e.at)).toEqual(up.map((_, i) => i * 0.45))
    expect(up.slice(0, 7).every((e) => e.dur === 0.45)).toBe(true)
    expect(up[7].dur).toBe(0.9)
    expect(lengthOf(up)).toBeCloseTo(4.05, 9)
  })

  it('doubles every length when slow', () => {
    expect(lengthOf(scaleUp(60, 2))).toBeCloseTo(8.1, 9)
    expect(scaleUp(60, 2)[1].at).toBe(0.9)
  })

  it('plays down from do to do, and the pattern from any start', () => {
    expect(midis(scaleDown(62))).toEqual([74, 73, 71, 69, 67, 66, 64, 62])
    expect(midis(scaleUp(66))).toEqual([66, 68, 70, 71, 73, 75, 77, 78])
  })

  it('stops on ti and holds it 1.2 s; Land on do plays ti, then do for 1.2 s (Lesson 4 FACTS 58)', () => {
    // Act
    const stop = stopOnTi(62)
    const land = landOnDo(62)

    // Assert
    expect(midis(stop)).toEqual([62, 64, 66, 67, 69, 71, 73])
    expect(stop[6].dur).toBe(1.2)
    expect(midis(land)).toEqual([73, 74])
    expect(land.map((e) => [e.at, e.dur])).toEqual([
      [0, 0.45],
      [0.45, 1.2],
    ])
  })

  it("plays each of Group's brackets: do to fa, and so to do", () => {
    expect(midis(groupOf(60, 0))).toEqual([60, 62, 64, 65])
    expect(midis(groupOf(60, 1))).toEqual([67, 69, 71, 72])
  })

  it('plays the white keys from a white start (Lesson 4 FACTS 60), and nothing from a black one', () => {
    expect(midis(whiteKeysRun(62))).toEqual([62, 64, 65, 67, 69, 71, 72, 74])
    expect(whiteKeysRun(63)).toEqual([])
  })
})

describe("Play up on another scale's stairs (Lesson 20)", () => {
  it('plays the five with the top do at the same pace: 3.15 s', () => {
    // Act
    const events = scaleUp(48, 1, MAJOR_FIVE)

    // Assert
    expect(events.map((e) => e.midi)).toEqual([48, 50, 52, 55, 57, 60])
    expect(lengthOf(events)).toBeCloseTo(3.15, 9)
  })
})
