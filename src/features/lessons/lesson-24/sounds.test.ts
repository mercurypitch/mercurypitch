// ============================================================
// Lesson 24 sounds tests — the plays, their schedules and their voices
// ============================================================
//
// WEB-SPEC, Audio, and FACTS 41, 44 and 69: every play is the drone, A3 at
// 220 Hz, with its notes, for its own length; mi, so and the chord follow
// Step 2's switch; the drone and every note start together, so a run
// starts them in one task on one audio time; every voice is straight in
// Merc's "ooh" at the note level but Step 4's wave, which carries Lesson
// 22's cold-open wave on the top note alone; the slide holds, glides and
// holds as its schedule does; and each voice's schedule is the one its
// contour sounds.

import { describe, expect, it } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import type { PlayKey } from './sounds'
import { DRONE_HZ, linesOf, NOTE_GAIN, PIANO, playFor, PURE, QUIZ_PURE, schedulesOf, SLIDE, WIDE_WAVE, } from './sounds'

/** Each play's length, and its notes' frequencies at the start (FACTS 41, 44, 69). */
const PLAYS: readonly [PlayKey, number, readonly number[]][] = [
  ['pair', 3, [224]],
  ['slide', 10, [224]],
  ['222', 3, [222]],
  ['221', 3, [221]],
  ['220.5', 4, [220.5]],
  ['220', 3, [220]],
  ['octave', 3, [441]],
  ['fifth', 4, [hz(64)]],
  ['third', 4, [hz(61)]],
  ['mi', 3, [hz(61)]],
  ['so', 3, [hz(64)]],
  ['chord', 4, [hz(61), hz(64)]],
  ['mi-piano', 3, [hz(61)]],
  ['mi-pure', 3, [275]],
  ['wave', 4, [hz(64)]],
  ['straight', 4, [hz(64)]],
]

describe('the plays', () => {
  it('set each note against the drone for its own length', () => {
    for (const [key, sec, notes] of PLAYS) {
      // Act
      const p = playFor(key)
      const lines = linesOf(p)

      // Assert: the drone first, then the play's notes, each for the play's length
      expect(p.sec, key).toBe(sec)
      expect(
        lines.map((l) => l.points[0].hz),
        key,
      ).toEqual([DRONE_HZ, ...notes])
      for (const l of lines) expect(l.points.at(-1)?.t, key).toBe(sec)
    }
  })

  it("plays quick check 4's pair as a pure fifth over A3: 330 Hz for 4.0 s", () => {
    // Act
    const lines = linesOf(QUIZ_PURE)

    // Assert: FACTS 70, 77
    expect(lines.map((l) => l.points.map((p) => [p.t, p.hz]))).toEqual([
      [
        [0, DRONE_HZ],
        [4, DRONE_HZ],
      ],
      [
        [0, 330],
        [4, 330],
      ],
    ])
  })

  it("tunes mi, so and the chord by Step 2's switch: the piano's C sharp 4 and E4, or 275 and 330", () => {
    // Assert
    expect(PIANO).toEqual({ mi: hz(61), so: hz(64) })
    expect(PURE).toEqual({ mi: 275, so: 330 })
    const firsts = (key: PlayKey): number[] =>
      linesOf(playFor(key, 'pure')).map((l) => l.points[0].hz)
    expect(firsts('mi')).toEqual([220, 275])
    expect(firsts('so')).toEqual([220, 330])
    expect(firsts('chord')).toEqual([220, 275, 330])
    // the predict's plays and Step 3's are the piano's whatever the switch says
    expect(firsts('fifth')).toEqual([220, hz(64)])
    expect(firsts('mi-piano')).toEqual([220, hz(61)])
  })

  it("starts the drone and every note at the play's start, straight, but for the wave on the top note", () => {
    for (const [key] of PLAYS) {
      // Act
      const lines = linesOf(playFor(key))

      // Assert
      expect(lines.every((l) => l.t === 0)).toBe(true)
      expect(lines[0].vibrato).toBeNull()
      for (const l of lines.slice(1))
        expect(l.vibrato, key).toBe(key === 'wave' ? WIDE_WAVE : null)
    }
    expect(WIDE_WAVE).toEqual({ rate: 6, extent: 50, growIn: 0.3 })
    expect(NOTE_GAIN).toBe(0.13)
  })

  it('slides the top note as its schedule does: 224 Hz for 1.5 s, down to 220 by 7.5 s, then 220 to 10 s', () => {
    // Act
    const [, top] = linesOf(playFor('slide'))

    // Assert
    expect(SLIDE).toEqual({
      from: 224,
      to: 220,
      hold: 1.5,
      glide: 6,
      after: 2.5,
    })
    expect(top.points.map((p) => [p.t, p.hz])).toEqual([
      [0, 224],
      [1.5, 224],
      [7.5, 220],
      [10, 220],
    ])
  })
})

describe("each voice's schedule", () => {
  it("is the one its contour sounds: the drone steady, each note at its pitch, the slide's glide and Step 4's wave", () => {
    // Act
    const pair = schedulesOf(playFor('pair'))
    const slide = schedulesOf(playFor('slide'))
    const wave = schedulesOf(playFor('wave'))

    // Assert
    expect(pair.map((s) => s.hz(1))).toEqual([220, 224])
    expect(slide[1].hz(1)).toBe(224)
    expect(slide[1].hz(4.5)).toBeCloseTo(Math.sqrt(224 * 220), 9)
    expect(slide[1].hz(9)).toBe(220)
    // the wave swings about the piano's E4, 50 cents at a swing's top
    expect(wave[1].centre(1)).toBe(hz(64))
    expect(1200 * Math.log2(wave[1].hz(1 + 1 / 24) / hz(64))).toBeCloseTo(50, 6)
  })
})
