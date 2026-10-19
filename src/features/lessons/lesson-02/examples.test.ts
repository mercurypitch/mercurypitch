// ============================================================
// Lesson 2 examples tests — the film's pitches and timings (FACTS 42-52)
// ============================================================

import { describe, expect, it } from 'vitest'
import { contourLength } from '@/features/lessons/kit/sound'
import { CENTS_GLIDE, CLIMB, glideCents, lengthOf, NEIGHBOURS, pair, QUIZ_PAIR, slide, slower, TONE_SPLIT, TWO_WAYS, } from './examples'

describe('the examples', () => {
  it('climbs A3 to A4 in thirteen notes, 0.42 s apart, the last held (FACTS 43)', () => {
    expect(CLIMB.map((e) => e.midi)).toEqual(
      Array.from({ length: 13 }, (_, k) => 57 + k),
    )
    expect(CLIMB[1].at - CLIMB[0].at).toBeCloseTo(0.42, 9)
    expect(CLIMB[12].at).toBeCloseTo(5.04, 9)
    expect(CLIMB[12].dur).toBe(0.9)
    expect(lengthOf(CLIMB)).toBeCloseTo(5.94, 9)
  })

  it("plays a pair at the film's pace: the second note 0.6 s in, for 0.75 s", () => {
    expect(pair(59, 60)).toEqual([
      { midi: 59, at: 0, dur: 0.55 },
      { midi: 60, at: 0.6, dur: 0.75 },
    ])
    expect(lengthOf(pair(59, 60))).toBeCloseTo(1.35, 9)
  })

  it('pairs the two halves of each two-step example 1.9 s apart', () => {
    expect(NEIGHBOURS.map((e) => e.midi)).toEqual([60, 61, 59, 60])
    expect(TWO_WAYS.map((e) => e.midi)).toEqual([60, 61, 62, 61])
    expect(QUIZ_PAIR.map((e) => e.midi)).toEqual([69, 71, 71, 72])
    expect(QUIZ_PAIR[2].at).toBe(1.9)
  })

  it('splits the tone C to D through C♯, then plays it whole (FACTS 48)', () => {
    expect(TONE_SPLIT.map((e) => e.midi)).toEqual([60, 61, 62, 60, 62])
  })

  it('glides 100 cents at 40 cents a second between two holds (FACTS 25)', () => {
    expect(glideCents(0.4)).toBe(0)
    expect(glideCents(1.75)).toBeCloseTo(50, 9)
    expect(glideCents(3.2)).toBe(100)
    expect(contourLength(CENTS_GLIDE)).toBeCloseTo(3.6, 9)
    expect(CENTS_GLIDE[2].hz).toBeCloseTo(233.08, 2)
  })

  it("sings Merc's slide in 4.2 s: A, up one semitone, back to A (FACTS 50)", () => {
    const points = slide(57)
    expect(contourLength(points)).toBeCloseTo(4.2, 9)
    expect(points[0].hz).toBe(220)
    expect(Math.max(...points.map((p) => p.hz))).toBeCloseTo(233.08, 2)
    expect(points[points.length - 1].hz).toBe(220)
  })

  it('slows an example down evenly, as a missed round replays it', () => {
    expect(slower(pair(64, 65), 2)).toEqual([
      { midi: 64, at: 0, dur: 1.1 },
      { midi: 65, at: 1.2, dur: 1.5 },
    ])
  })
})
