// ============================================================
// Lesson 6 examples tests — every fixed sound's notes, timings and pitches
// ============================================================
//
// WEB-SPEC, Tests 9, with the timings FACTS 63 to 69 give: each fixed
// example plays the notes FACTS 62 lists, at hz(m), and lasts as long as the
// facts say.

import { describe, expect, it } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import type { NoteEvent } from './examples'
import { ANCHORS, bothLines, lengthOf, LINE_C, LINE_FS, pair, QUIZ_FOURTH, QUIZ_LINES, slower, swappedLine, WORD_SOUNDS, } from './examples'
import { C4 } from './melody'

/** FACTS 62: every fixed example's notes, MIDI to hertz, to two decimals. */
const FACTS_62: Readonly<Record<number, number>> = {
  50: 146.83,
  52: 164.81,
  53: 174.61,
  54: 185.0,
  55: 196.0,
  57: 220.0,
  58: 233.08,
  59: 246.94,
  60: 261.63,
  62: 293.66,
  64: 329.63,
  65: 349.23,
  66: 369.99,
  67: 392.0,
  69: 440.0,
  70: 466.16,
  71: 493.88,
  72: 523.25,
  73: 554.37,
  74: 587.33,
  75: 622.25,
}

const midis = (events: readonly NoteEvent[]): number[] =>
  events.map((e) => e.midi)

const FIXED: readonly (readonly NoteEvent[])[] = [
  LINE_C,
  LINE_FS,
  QUIZ_LINES,
  QUIZ_FOURTH,
  bothLines(C4),
  swappedLine(C4),
  ...Object.values(WORD_SOUNDS),
  ...ANCHORS.flatMap((a) => [a.tune, a.interval]),
]

describe('the fixed examples', () => {
  it('play only the notes FACTS 62 lists, each at its frequency', () => {
    for (const events of FIXED)
      for (const e of events) {
        const listed = FACTS_62[e.midi]
        expect(listed, `MIDI ${e.midi}`).toBeDefined()
        expect(hz(e.midi)).toBeCloseTo(listed, 2)
      }
  })

  it('play the first line from C in 4.0 s, crotchets at 0.5 s and the minim at 1.0 s', () => {
    // Assert: FACTS 63
    expect(midis(LINE_C)).toEqual([60, 60, 67, 67, 69, 69, 67])
    expect(LINE_C.map((e) => e.dur)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1])
    expect(lengthOf(LINE_C)).toBe(4)
    expect(midis(LINE_FS)).toEqual([66, 66, 73, 73, 75, 75, 73])
  })

  it('play both lines in 8.0 s, and the swapped version in 4.0 s', () => {
    // Assert: FACTS 64 and 65
    expect(lengthOf(bothLines(C4))).toBe(8)
    expect(midis(swappedLine(C4))).toEqual([60, 60, 62, 62, 69, 69, 67])
    expect(lengthOf(swappedLine(C4))).toBe(4)
    // Slow doubles every length
    expect(lengthOf(bothLines(C4, 2))).toBe(16)
  })

  it("play quiz question 1's two lines with 0.6 s of silence between them", () => {
    // Assert: FACTS 63
    const fs = QUIZ_LINES.slice(7)
    expect(midis(fs)).toEqual(midis(LINE_FS))
    expect(fs[0].at - lengthOf(LINE_C)).toBeCloseTo(0.6, 9)
  })

  it('play a pair as 0.6 s then 0.8 s, 0.15 s apart, and a missed round 1.5 times slower', () => {
    // Assert: FACTS 64 and 67
    expect(pair(60, 65)).toEqual([
      { midi: 60, at: 0, dur: 0.6 },
      { midi: 65, at: 0.75, dur: 0.8 },
    ])
    expect(QUIZ_FOURTH).toEqual(pair(60, 65))
    expect(lengthOf(slower(pair(60, 67), 1.5))).toBeCloseTo(1.55 * 1.5, 9)
  })

  it('give the four words their pairs, and Transpose its two halves 0.5 s apart', () => {
    // Assert: FACTS 66
    expect(midis(WORD_SOUNDS.interval)).toEqual([60, 67])
    expect(midis(WORD_SOUNDS.step)).toEqual([69, 67])
    expect(midis(WORD_SOUNDS.leap)).toEqual([62, 67])
    expect(midis(WORD_SOUNDS.transpose)).toEqual([
      60, 60, 67, 67, 66, 66, 73, 73,
    ])
    expect(WORD_SOUNDS.transpose[4].at - 2).toBeCloseTo(0.5, 9)
  })

  it("give the anchor board each tune's own notes and its bare interval", () => {
    // Assert: FACTS 68
    const by = Object.fromEntries(ANCHORS.map((a) => [a.id, a]))
    expect(midis(by.m2.tune)).toEqual([65, 65, 64, 64])
    expect(midis(by.M2.tune)).toEqual([69, 69, 67])
    expect(by.M2.tune[2].dur).toBe(1)
    expect(midis(by.P4.tune)).toEqual([60, 65, 65, 65, 69, 67, 65, 67])
    expect(lengthOf(by.P4.tune)).toBe(4)
    expect(midis(by.P5.tune)).toEqual([60, 60, 67, 67])
    expect(midis(by.P8.tune)).toEqual([57, 69])
    for (const a of ANCHORS) {
      const [lo, hi] = midis(a.interval)
      expect(Math.abs(hi - lo), a.id).toBe(a.semitones)
    }
  })
})
