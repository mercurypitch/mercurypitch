// ============================================================
// Lesson 20 sounds tests — the run's notes, its line and every timing
// ============================================================
//
// FACTS 39, 80 and 82a, as the toys play them: each voice's do, the run at
// Tempo's five notches, Merc's line held on each note and gliding into the
// next over 50 ms, Staccato's short notes, and Play it smudged's
// illustrated singer, four of whose nine notes land in their bands.

import { describe, expect, it } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import { contourLength } from '@/features/lessons/kit/sound'
import { lengthOf, scaleUp } from '@/features/lessons/kit/stairs-plays'
import { MAJOR_FIVE } from '@/features/lessons/kit/stairs-scales'
import { BETWEEN_SEC, RUN_NAMES, runDo, runLine, runNotes, runSec, SMUDGE, smudgeCentsAt, smudgeLands, smudgeLine, stairsDo, TEMPOS, TOUCH, } from './sounds'

describe("each voice's do", () => {
  it('stands the staircase on C3, or C4, and the run on D3, or D4 (FACTS 8, 26)', () => {
    // Act
    const dos = [null, 'lower', 'higher'].map((v) => [
      stairsDo(v as 'lower' | 'higher' | null),
      runDo(v as 'lower' | 'higher' | null),
    ])

    // Assert
    expect(dos).toEqual([
      [48, 50],
      [48, 50],
      [60, 62],
    ])
  })
})

describe('the staircase plays', () => {
  it('plays the major scale in 4.05 s, the five in 3.15 s, and the two halves 0.5 s apart, 7.7 s (FACTS 80)', () => {
    // Act
    const major = lengthOf(scaleUp(48))
    const five = lengthOf(scaleUp(48, 1, MAJOR_FIVE))

    // Assert
    expect(major).toBeCloseTo(4.05, 9)
    expect(five).toBeCloseTo(3.15, 9)
    expect(major + BETWEEN_SEC + five).toBeCloseTo(7.7, 9)
    expect(five + BETWEEN_SEC + five).toBeCloseTo(6.8, 9)
  })
})

describe('the run', () => {
  it('is do, re, mi, so, la, so, mi, re and do from D3: D, E, F sharp, A, B and back', () => {
    // Act
    const notes = runNotes(50, 0.6)

    // Assert
    expect(RUN_NAMES).toEqual([
      'do',
      're',
      'mi',
      'so',
      'la',
      'so',
      'mi',
      're',
      'do',
    ])
    expect(notes.map((n) => n.midi)).toEqual([
      50, 52, 54, 57, 59, 57, 54, 52, 50,
    ])
  })

  it("lasts 6.75, 5.40, 4.05, 2.70 and 1.80 s at Tempo's five notches (FACTS 39)", () => {
    // Act
    const lengths = TEMPOS.map((t) => runSec(t))

    // Assert
    expect(lengths.map((s) => Math.round(s * 100) / 100)).toEqual([
      6.75, 5.4, 4.05, 2.7, 1.8,
    ])
  })

  it('sings staccato as nine 0.15 s notes 0.45 s apart, 3.75 s, legato 4.05 s, 8.3 s with the 0.5 s between (FACTS 31, 80)', () => {
    // Act
    const staccato = runNotes(50, TOUCH.every, TOUCH.staccato)

    // Assert
    expect(staccato.map((n) => n.t)).toEqual([
      0, 0.45, 0.9, 1.35, 1.8, 2.25, 2.7, 3.15, 3.6,
    ])
    expect(staccato.every((n) => n.dur === 0.15)).toBe(true)
    expect(runSec(TOUCH.every, TOUCH.staccato)).toBeCloseTo(3.75, 9)
    expect(
      runSec(TOUCH.every, TOUCH.staccato) + BETWEEN_SEC + runSec(TOUCH.every),
    ).toBeCloseTo(8.3, 9)
  })

  it("holds Merc's line on each note and glides into the next over its last 50 ms", () => {
    // Act
    const line = runLine(50, 0.6)

    // Assert: re's two points, then mi's first, 50 ms after re's hold ends
    expect(
      line.slice(2, 5).map((p) => [Math.round(p.t * 1000) / 1000, p.hz]),
    ).toEqual([
      [0.6, hz(52)],
      [1.15, hz(52)],
      [1.2, hz(54)],
    ])
    expect(contourLength(line)).toBeCloseTo(5.4, 9)
  })
})

describe('Play it smudged', () => {
  it('lands four of its nine notes in their bands, and five out (FACTS 82a)', () => {
    // Act
    const lands = SMUDGE.cents.map((_c, i) => smudgeLands(i))

    // Assert
    expect(lands).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ])
  })

  it('glides each note for 0.12 s of its 0.2 s and holds it where it lands, 1.80 s in all', () => {
    // Act: mi, from re 20 cents flat to mi 50 flat
    const atStart = smudgeCentsAt(0.4)
    const halfway = smudgeCentsAt(0.46)
    const landed = smudgeCentsAt(0.52)
    const held = smudgeCentsAt(0.59)
    const line = smudgeLine(50)

    // Assert
    expect(atStart).toBeCloseTo(180, 6)
    expect(halfway).toBeCloseTo(265, 6)
    expect(landed).toBeCloseTo(350, 6)
    expect(held).toBeCloseTo(350, 6)
    expect(contourLength(line)).toBeCloseTo(1.8, 9)
    expect(line[line.length - 1].hz).toBeCloseTo(hz(50.15), 6)
  })
})
