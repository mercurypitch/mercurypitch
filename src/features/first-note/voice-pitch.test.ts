// ============================================================
// The voice's first steady note, through a vibrato
// ============================================================
//
// voice-pitch.ts reads where the voice first holds a note near a line. A
// rock or a metal singer swings a semitone or so either way from the
// note's first moment, and a split vocal loses a reading here and there:
// both are the note. A slide is not, nor are two quick notes. A song sung
// with a vibrato left the rules without an entry before they read the
// note as its running median (ENTRY_RULES_VERSION 3).

import { describe, expect, it } from 'vitest'
import { findEntries, loudness, runSteps } from './entry-rules'
import type { SteadyNote } from './voice-pitch'
import { firstSteady, VOCAL_RATE, yinMidi } from './voice-pitch'

const rate = VOCAL_RATE

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

/** A seeded random source, the same every run. */
function seeded(seed = 11): () => number {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

interface Sung {
  readonly from: number
  readonly to: number
  readonly midi: number
  /** A vibrato: how far it swings either way, cents, and how often, Hz. */
  readonly vibrato?: { readonly cents: number; readonly hz: number }
  /** A slide from `midi`, semitones a second. */
  readonly slide?: number
}

/** A voice: each note a sine, swung or slid where asked, silence between. */
function sung(seconds: number, notes: readonly Sung[]): Float32Array {
  const samples = new Float32Array(Math.round(seconds * rate))
  for (const note of notes) {
    let phase = 0
    for (let i = Math.round(note.from * rate); i < note.to * rate; i++) {
      const t = i / rate - note.from
      const swing =
        note.vibrato === undefined
          ? 0
          : note.vibrato.cents * Math.sin(2 * Math.PI * note.vibrato.hz * t)
      const midi = note.midi + (note.slide ?? 0) * t + swing / 100
      phase += (2 * Math.PI * hz(midi)) / rate
      samples[i] = 0.5 * Math.sin(phase)
    }
  }
  return samples
}

/** The first steady note from 1.4 to 3.2 s, of a voice that comes in at 2. */
function steadyOf(samples: Float32Array): SteadyNote | null {
  return runSteps(
    firstSteady({ samples, rate }, loudness(samples, rate), 1.4, 3.2),
  )
}

describe("the voice's first steady note", () => {
  it('is the note a vibrato swings round, from where the note starts', () => {
    for (const vibrato of [
      { cents: 90, hz: 5 },
      { cents: 90, hz: 7 },
      { cents: 120, hz: 6 },
    ]) {
      const steady = steadyOf(
        sung(5, [{ from: 2, to: 3.5, midi: 57, vibrato }]),
      )
      // Where its first steady median sits: a moment into the note.
      expect(steady?.t ?? 0).toBeGreaterThanOrEqual(1.98)
      expect(steady?.t ?? 0).toBeLessThan(2.1)
      expect(steady?.swung).toBe(true)
      // Close enough to its note to be judged in tune (IN_TUNE_CENTS).
      expect(Math.abs((steady?.midi ?? 0) - 57) * 100).toBeLessThan(30)
    }
  })

  it('keeps the note through readings the pitch tracker misses here and there', () => {
    // A rasp: 3 ms of noise every fifth of a second.
    const samples = sung(5, [{ from: 2, to: 3.5, midi: 60 }])
    const random = seeded()
    for (let i = 2 * rate; i < 3.5 * rate; i++) {
      if ((i / rate - 2) % 0.2 < 0.003) samples[i] = random() * 2 - 1
    }
    let missed = 0
    let read = 0
    for (let t = 2.1; t < 3.4; t += 0.01) {
      read += 1
      if (yinMidi(samples, Math.round(t * rate), rate) === null) missed += 1
    }
    // Every fifth of a second of the note loses a reading or more.
    expect(missed / read).toBeGreaterThan(0.1)
    expect(steadyOf(samples)?.midi ?? 0).toBeCloseTo(60, 1)
  })

  it('blends no quick notes: its note is the one that holds', () => {
    const steady = steadyOf(
      sung(5, [
        { from: 2, to: 2.12, midi: 57 },
        { from: 2.12, to: 2.24, midi: 59 },
        { from: 2.24, to: 3.5, midi: 60 },
      ]),
    )
    expect(Math.round(steady?.midi ?? 0)).toBe(60)
  })

  it('holds no slide of five semitones a second or more', () => {
    for (const slide of [5, 6]) {
      expect(steadyOf(sung(5, [{ from: 2, to: 3.5, midi: 55, slide }]))).toBe(
        null,
      )
    }
  })
})

describe('a song sung with a vibrato', () => {
  it('asks for no second note when the first is too short to tell from it', () => {
    // A first note of 0.3 s and the next a semitone up, both swung 90
    // cents: too short for the running medians, which would read the second
    // as the line's first steady note. Whatever the vibrato's phase, the
    // line asks for the singer's first note or is left.
    const asked: number[] = []
    for (let k = 0; k < 8; k++) {
      const samples = new Float32Array(5 * rate)
      let phase = 0
      for (let i = 2 * rate; i < 3.8 * rate; i++) {
        const t = i / rate - 2
        const swing = 0.9 * Math.sin(2 * Math.PI * 5.5 * t + (k * Math.PI) / 4)
        phase += (2 * Math.PI * hz((t < 0.3 ? 59 : 60) + swing)) / rate
        samples[i] = 0.5 * Math.sin(phase)
      }
      const { entries } = findEntries({
        vocal: { samples, rate },
        level: loudness(samples, rate),
        notes: [
          { midi: 59, startSec: 2, endSec: 2.3 },
          { midi: 60, startSec: 2.3, endSec: 3.8 },
        ],
        lines: [{ start: 2, words: '' }],
      })
      for (const entry of entries) asked.push(entry.midi)
    }
    expect(asked.length).toBeGreaterThan(0)
    expect(asked.every((midi) => midi === 59)).toBe(true)
  })

  it('keeps its entries, each the note the vibrato swings round', () => {
    const vibrato = { cents: 90, hz: 5.5 }
    const samples = sung(12, [
      { from: 2, to: 4, midi: 57, vibrato },
      { from: 6.5, to: 8, midi: 60, vibrato },
      { from: 10.5, to: 11.8, midi: 57, vibrato },
    ])
    const { entries, dropped } = findEntries({
      vocal: { samples, rate },
      level: loudness(samples, rate),
      notes: [
        { midi: 57, startSec: 2, endSec: 4 },
        { midi: 60, startSec: 6.5, endSec: 8 },
        { midi: 57, startSec: 10.5, endSec: 11.8 },
      ],
      lines: [
        { start: 2, words: 'First' },
        { start: 6.5, words: 'Second' },
        { start: 10.5, words: 'Last' },
      ],
    })
    expect(dropped).toEqual([])
    expect(entries.map((entry) => entry.midi)).toEqual([57, 60, 57])
  })
})
