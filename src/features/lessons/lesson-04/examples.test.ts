// ============================================================
// Lesson 4 examples tests — Sing it's model (FACTS 63); the staircase's scales are the kit's
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { inGap, pathLength, pitchAt } from '@/features/lessons/kit/slide-guide'
import { lengthOf } from '@/features/lessons/kit/stairs-plays'
import { GUIDE_SEC, guideNotes, guidePath, guidePhrases, TI_HOLD, } from './examples'

const midis = (events: readonly { midi: number }[]): number[] =>
  events.map((e) => e.midi)

describe("Sing it's model (FACTS 63)", () => {
  it('sings seventeen notes in 18.2 s: up to so and back, up to ti, ti held 2 s, then do', () => {
    // Act
    const notes = guideNotes(50)
    const ti = notes[15]

    // Assert
    expect(notes).toHaveLength(17)
    expect(midis(notes)).toEqual([
      50, 52, 54, 55, 57, 55, 54, 52, 50, 50, 52, 54, 55, 57, 59, 61, 62,
    ])
    expect(lengthOf(notes)).toBeCloseTo(GUIDE_SEC, 9)
    expect(GUIDE_SEC).toBe(18.2)
    expect(ti.midi).toBe(61)
    expect(ti.at).toBeCloseTo(TI_HOLD.from, 9)
    expect(ti.at + ti.dur).toBeCloseTo(TI_HOLD.to, 9)
  })

  it('rests 2 s after the first phrase and 0.6 s before do', () => {
    // Arrange
    const notes = guideNotes(50)
    const end = (i: number): number => notes[i].at + notes[i].dur

    // Assert
    expect(notes[9].at - end(8)).toBeCloseTo(2, 9)
    expect(notes[16].at - end(15)).toBeCloseTo(0.6, 9)
  })

  it('draws the path the voice sings, silent through both rests', () => {
    // Act
    const path = guidePath(50)

    // Assert
    expect(pathLength(path)).toBeCloseTo(GUIDE_SEC, 9)
    expect(path.filter((p) => p.gap === true)).toHaveLength(2)
    expect(inGap(path, 8.5)).toBe(true)
    expect(inGap(path, 16.7)).toBe(true)
    expect(inGap(path, 5)).toBe(false)
    expect(pitchAt(path, 3.4)).toBe(57)
    expect(pitchAt(path, 15)).toBe(61)
  })

  it('keeps its shape when do moves', () => {
    const onD3 = guidePath(50).map((p) => p.midi - 50)
    const onBb2 = guidePath(46).map((p) => p.midi - 46)
    expect(onBb2).toEqual(onD3)
  })

  it('sings each phrase as one line from its own start', () => {
    // Act
    const phrases = guidePhrases(50)

    // Assert
    expect(phrases.map((p) => p.at)).toEqual([0, 9.6, 17])
    for (const p of phrases) expect(p.points[0].t).toBe(0)
  })
})
