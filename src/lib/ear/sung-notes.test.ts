import { describe, expect, it } from 'vitest'
import type { F0Frame } from '@/lib/pitch-measurements'
import { scorePhraseFree, segmentSungNotes, sungDegrees } from './sung-notes'

const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
const HOP = 0.016

/** Voiced frames at the stream's hop from `fromS` to `toS`. */
function sing(midi: number, fromS: number, toS: number, conf = 0.9): F0Frame[] {
  const frames: F0Frame[] = []
  for (let t = fromS; t < toS; t += HOP) {
    frames.push({ t: Math.round(t * 1000) / 1000, f0: midiToFreq(midi), conf })
  }
  return frames
}

function rest(fromS: number, toS: number): F0Frame[] {
  const frames: F0Frame[] = []
  for (let t = fromS; t < toS; t += HOP) {
    frames.push({ t: Math.round(t * 1000) / 1000, f0: 0, conf: 0 })
  }
  return frames
}

function note(midi: number, fromS: number, toS: number): SungNoteLike {
  return { midi, startS: fromS, endS: toS, frames: 1 }
}
interface SungNoteLike {
  midi: number
  startS: number
  endS: number
  frames: number
}

describe('segmentSungNotes', () => {
  it('cuts voiced runs into notes and names each by its median', () => {
    const notes = segmentSungNotes([
      ...sing(60, 0, 0.4),
      ...rest(0.4, 0.6),
      ...sing(62, 0.6, 1.0),
      ...rest(1.0, 1.3),
    ])
    expect(notes).toHaveLength(2)
    expect(notes[0].midi).toBeCloseTo(60, 2)
    expect(notes[1].midi).toBeCloseTo(62, 2)
    expect(notes[0].startS).toBeCloseTo(0, 2)
    expect(notes[0].endS).toBeLessThan(0.41)
  })

  it('splits on a pitch step, and keeps a wobble inside one note', () => {
    // Re straight after Do, no breath between: two notes.
    expect(
      segmentSungNotes([...sing(60, 0, 0.3), ...sing(62, 0.3, 0.6)]),
    ).toHaveLength(2)
    // A 30-cent wobble around Do: one note.
    const wobble = [
      ...sing(60, 0, 0.2),
      ...sing(60.3, 0.2, 0.3),
      ...sing(59.8, 0.3, 0.5),
    ]
    const notes = segmentSungNotes(wobble)
    expect(notes).toHaveLength(1)
    expect(notes[0].midi).toBeCloseTo(60, 0)
  })

  it('bridges a consonant, drops a blip, ignores unconfident frames', () => {
    // A 50 ms unvoiced gap inside the note: still one note.
    expect(
      segmentSungNotes([
        ...sing(64, 0, 0.2),
        ...rest(0.2, 0.25),
        ...sing(64, 0.25, 0.45),
      ]),
    ).toHaveLength(1)
    // A 60 ms voiced blip: no note.
    expect(
      segmentSungNotes([...sing(64, 0, 0.06), ...rest(0.06, 0.5)]),
    ).toEqual([])
    // Confidence under the floor is not voicing.
    expect(segmentSungNotes(sing(64, 0, 0.5, 0.3))).toEqual([])
    expect(segmentSungNotes([])).toEqual([])
  })

  it('separates a repeated note only across silence', () => {
    const notes = segmentSungNotes([
      ...sing(67, 0, 0.3),
      ...rest(0.3, 0.45),
      ...sing(67, 0.45, 0.75),
    ])
    expect(notes).toHaveLength(2)
  })
})

describe('scorePhraseFree', () => {
  const root = 60

  it('meets a phrase sung in tune, any octave', () => {
    const score = scorePhraseFree(
      [note(72, 0, 0.3), note(74.2, 0.4, 0.7), note(55, 0.8, 1.1)],
      [1, 2, 5],
      root,
    )
    expect(score.correct).toBe(true)
    expect(score.firstMiss).toBeNull()
    expect(score.notes.map((n) => n.met)).toEqual([true, true, true])
    expect(score.notes[1].centsOff).toBe(20)
    expect(score.extra).toBe(0)
  })

  it('names the first slip', () => {
    const score = scorePhraseFree(
      [note(60, 0, 0.3), note(65, 0.4, 0.7), note(64, 0.8, 1.1)],
      [1, 2, 3],
      root,
    )
    expect(score.correct).toBe(false)
    expect(score.firstMiss).toBe(1)
    expect(score.notes.map((n) => n.met)).toEqual([true, false, true])
  })

  it('treats missing and extra notes as misses, never a crash', () => {
    const short = scorePhraseFree([note(60, 0, 0.3)], [1, 2, 3], root)
    expect(short.correct).toBe(false)
    expect(short.firstMiss).toBe(1)
    expect(short.notes[1].sungMidi).toBeNull()
    expect(short.notes[2].centsOff).toBeNull()

    const long = scorePhraseFree(
      [
        note(60, 0, 0.3),
        note(62, 0.4, 0.7),
        note(64, 0.8, 1.1),
        note(65, 1.2, 1.5),
      ],
      [1, 2, 3],
      root,
    )
    expect(long.correct).toBe(false)
    expect(long.firstMiss).toBe(3)
    expect(long.extra).toBe(1)
    expect(long.sung).toBe(4)

    const nothing = scorePhraseFree([], [1, 2, 3], root)
    expect(nothing.correct).toBe(false)
    expect(nothing.firstMiss).toBe(0)
    expect(nothing.notes).toHaveLength(3)
  })

  it('folds sung notes to the degree they are heard as', () => {
    expect(
      sungDegrees([note(72, 0, 0), note(55, 0, 0), note(71.6, 0, 0)], root),
    ).toEqual([1, 5, 8])
  })
})
