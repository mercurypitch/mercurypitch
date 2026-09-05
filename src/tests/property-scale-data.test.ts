// ============================================================
// Property-based & Invariant Tests: Scale Data & Music Theory
// ============================================================

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { freqToMidi, freqToNote, keyTonicFreq, midiToFreq, midiToNote, NOTE_NAMES, noteToMidi, SCALE_DEFINITIONS, scaleDegreeSet, snapMidiToScale, } from '@/lib/scale-data'

describe('Property-Based Tests: Scale Data & Music Theory', () => {
  it('midiToFreq is strictly positive, monotonic, and satisfies the octave doubling rule', () => {
    fc.assert(
      fc.property(fc.double({ min: -50, max: 150, noNaN: true }), (midi) => {
        const freq = midiToFreq(midi)
        expect(Number.isFinite(freq)).toBe(true)
        expect(freq).toBeGreaterThan(0)

        // Octave doubling rule: f(m + 12) = 2 * f(m)
        const freqOctaveUp = midiToFreq(midi + 12)
        expect(freqOctaveUp).toBeCloseTo(freq * 2, 5)

        // Semitone ratio: f(m + 1) / f(m) = 2^(1/12)
        const freqSemitoneUp = midiToFreq(midi + 1)
        expect(freqSemitoneUp / freq).toBeCloseTo(Math.pow(2, 1 / 12), 5)
      }),
      { numRuns: 1000 },
    )
  })

  it('freqToMidi and midiToFreq round-trip for integer MIDI values', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 127 }), (midi) => {
        const freq = midiToFreq(midi)
        const recoveredMidi = freqToMidi(freq)
        expect(recoveredMidi).toBe(midi)
      }),
      { numRuns: 200 },
    )
  })

  it('midiToNote and noteToMidi round-trip for all standard MIDI notes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 127 }), (midi) => {
        const { name, octave } = midiToNote(midi)
        expect(NOTE_NAMES).toContain(name)
        const recoveredMidi = noteToMidi(name, octave)
        expect(recoveredMidi).toBe(midi)
      }),
      { numRuns: 200 },
    )
  })

  it('freqToNote never throws and outputs valid cents deviation bounded within [-50, 50]', () => {
    fc.assert(
      fc.property(fc.double({ min: 20, max: 10000, noNaN: true }), (freq) => {
        const note = freqToNote(freq)
        expect(Number.isFinite(note.midi)).toBe(true)
        expect(Number.isFinite(note.cents)).toBe(true)
        expect(NOTE_NAMES).toContain(note.name)
        // Cents deviation from nearest note is within [-50, 50]
        expect(Math.abs(note.cents)).toBeLessThanOrEqual(50)
      }),
      { numRuns: 1000 },
    )
  })

  it('scaleDegreeSet produces pitch classes strictly within [0, 11]', () => {
    const scaleKeys = Object.keys(SCALE_DEFINITIONS)
    fc.assert(
      fc.property(
        fc.constantFrom(
          'C',
          'G',
          'D',
          'A',
          'E',
          'B',
          'F#',
          'F',
          'Bb',
          'Eb',
          'Ab',
          'Db',
          'Gb',
        ),
        fc.constantFrom(...scaleKeys),
        (key, scaleType) => {
          const degrees = scaleDegreeSet(key, scaleType)
          expect(degrees.size).toBeGreaterThan(0)
          for (const deg of degrees) {
            expect(deg).toBeGreaterThanOrEqual(0)
            expect(deg).toBeLessThanOrEqual(11)
          }
        },
      ),
      { numRuns: 300 },
    )
  })

  it('snapMidiToScale is idempotent and outputs finite integer MIDI', () => {
    const scaleKeys = Object.keys(SCALE_DEFINITIONS)
    fc.assert(
      fc.property(
        fc.double({ min: 21, max: 108, noNaN: true }),
        fc.constantFrom(
          'C',
          'G',
          'D',
          'A',
          'E',
          'B',
          'F#',
          'F',
          'Bb',
          'Eb',
          'Ab',
          'Db',
          'Gb',
        ),
        fc.constantFrom(...scaleKeys),
        (midi, key, scaleType) => {
          const snapped1 = snapMidiToScale(midi, key, scaleType)
          expect(Number.isInteger(snapped1.midi)).toBe(true)

          // Idempotency: snapping an already snapped pitch returns the same pitch
          const snapped2 = snapMidiToScale(snapped1.midi, key, scaleType)
          expect(snapped2.midi).toBe(snapped1.midi)
          expect(snapped2.snapped).toBe(false)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('keyTonicFreq is strictly positive for all keys and octaves', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'C',
          'C#',
          'Db',
          'D',
          'Eb',
          'E',
          'F',
          'F#',
          'Gb',
          'G',
          'Ab',
          'A',
          'Bb',
          'B',
        ),
        fc.integer({ min: 0, max: 8 }),
        (key, octave) => {
          const freq = keyTonicFreq(key, octave)
          expect(Number.isFinite(freq)).toBe(true)
          expect(freq).toBeGreaterThan(0)
        },
      ),
      { numRuns: 200 },
    )
  })
})
