// ============================================================
// Lesson 4 examples tests — the notes and timings of every sound (FACTS 56 to 63)
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { inGap, pathLength, pitchAt } from '@/features/lessons/kit/slide-guide'
import { groupOf, GUIDE_SEC, guideNotes, guidePath, guidePhrases, landOnDo, lengthOf, scaleDown, scaleUp, stopOnTi, TI_HOLD, whiteKeysRun, } from './examples'

const midis = (events: readonly { midi: number }[]): number[] =>
  events.map((e) => e.midi)

describe('the staircase examples', () => {
  it('plays a scale at 0.45 s a note, its last 0.9 s (FACTS 57)', () => {
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

  it('stops on ti and holds it 1.2 s; Land on do plays ti, then do for 1.2 s (FACTS 58)', () => {
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

  it('plays the white keys from a white start (FACTS 60), and nothing from a black one', () => {
    expect(midis(whiteKeysRun(62))).toEqual([62, 64, 65, 67, 69, 71, 72, 74])
    expect(whiteKeysRun(63)).toEqual([])
  })
})

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
