// ============================================================
// Property-based & Fuzz Tests: MIDI Song Parser & Generators
// ============================================================

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { MidiNoteEvent, PitchDetection } from '@/lib/midi-generator'
import { buildMidiFile, mergeConsecutiveNotes, TICKS_PER_BEAT, } from '@/lib/midi-generator'
import { createBeatClock, createSecondsToBeatClock, defaultScoreTrack, gmInstrumentName, parseMidiSong, } from '@/lib/midi-song'

describe('Property-Based Tests: MIDI Song Parser & Generators', () => {
  it('never throws on arbitrary binary inputs for parseMidiSong', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 5000 }),
        (rawBytes) => {
          expect(() => {
            const result = parseMidiSong(rawBytes)
            if (result !== null) {
              expect(typeof result).toBe('object')
              expect(result.bpm).toBeGreaterThan(0)
              expect(Array.isArray(result.tracks)).toBe(true)
              for (const track of result.tracks) {
                expect(typeof track.id).toBe('string')
                expect(Array.isArray(track.notes)).toBe(true)
              }
            }
          }).not.toThrow()
        },
      ),
      { numRuns: 1000 },
    )
  })

  it('gmInstrumentName never throws and always returns a non-empty string', () => {
    fc.assert(
      fc.property(fc.integer({ min: -500, max: 500 }), (program) => {
        const name = gmInstrumentName(program)
        expect(typeof name).toBe('string')
        expect(name.length).toBeGreaterThan(0)
      }),
      { numRuns: 300 },
    )
  })

  it('createBeatClock and createSecondsToBeatClock are monotonic and mutually invertible', () => {
    const tempoChangeArbitrary = fc.record({
      beat: fc.double({ min: 0.1, max: 200, noNaN: true }),
      usPerBeat: fc.integer({ min: 100_000, max: 2_000_000 }), // 30 bpm - 600 bpm
    })

    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 300 }),
        fc.array(tempoChangeArbitrary, { minLength: 0, maxLength: 10 }),
        fc.double({ min: 0, max: 150, noNaN: true }),
        (bpm, tempoChanges, testBeat) => {
          const song = { bpm, tempoChanges }
          const beatToSec = createBeatClock(song)
          const secToBeat = createSecondsToBeatClock(song)

          // Origin invariant
          expect(beatToSec(0)).toBe(0)
          expect(secToBeat(0)).toBe(0)

          // Monotonicity: t(b2) >= t(b1) for b2 >= b1
          const sec1 = beatToSec(testBeat)
          const sec2 = beatToSec(testBeat + 5)
          expect(sec2).toBeGreaterThanOrEqual(sec1)

          // Invertibility: secToBeat(beatToSec(b)) ≈ b
          const recoveredBeat = secToBeat(sec1)
          expect(recoveredBeat).toBeCloseTo(testBeat, 4)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('buildMidiFile -> parseMidiSong round-trips sequential note events correctly', () => {
    // Generate sequential non-overlapping notes
    const sequentialNotesArbitrary = fc
      .array(
        fc.record({
          midi: fc.integer({ min: 21, max: 108 }),
          gapTicks: fc.integer({ min: 0, max: 240 }),
          durationTicks: fc.integer({ min: 120, max: 960 }),
        }),
        { minLength: 1, maxLength: 20 },
      )
      .map((items) => {
        let currentTick = 0
        const notes: MidiNoteEvent[] = []
        for (const item of items) {
          currentTick += item.gapTicks
          notes.push({
            midi: item.midi,
            tickOn: currentTick,
            tickOff: currentTick + item.durationTicks,
          })
          currentTick += item.durationTicks
        }
        return notes
      })

    fc.assert(
      fc.property(
        sequentialNotesArbitrary,
        fc.integer({ min: 40, max: 240 }),
        (notes, bpm) => {
          const midiBytes = buildMidiFile(notes, bpm)
          expect(midiBytes).not.toBeNull()
          if (!midiBytes) return

          const parsed = parseMidiSong(midiBytes)
          expect(parsed).not.toBeNull()
          expect(parsed?.bpm).toBe(bpm)
          expect(parsed?.tracks.length).toBeGreaterThan(0)

          const mainTrack = defaultScoreTrack(parsed!)
          expect(mainTrack.notes.length).toBe(notes.length)

          for (let i = 0; i < mainTrack.notes.length; i++) {
            const parsedNote = mainTrack.notes[i]
            const originalNote = notes[i]
            expect(parsedNote.midi).toBe(originalNote.midi)
            expect(parsedNote.startBeat).toBeCloseTo(
              originalNote.tickOn / TICKS_PER_BEAT,
              2,
            )
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('mergeConsecutiveNotes satisfies duration and gap invariants', () => {
    const detectionArbitrary = fc.record({
      midi: fc.integer({ min: 40, max: 80 }),
      noteName: fc.constantFrom('C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'),
      timeSec: fc.double({ min: 0, max: 60, noNaN: true }),
    }) as fc.Arbitrary<PitchDetection>

    fc.assert(
      fc.property(
        fc.array(detectionArbitrary, { minLength: 0, maxLength: 50 }),
        (detections) => {
          // Sort strictly by time
          detections.sort((a, b) => a.timeSec - b.timeSec)
          const merged = mergeConsecutiveNotes(detections)
          expect(Array.isArray(merged)).toBe(true)

          for (const note of merged) {
            expect(note.endSec).toBeGreaterThan(note.startSec)
            expect(Number.isFinite(note.midi)).toBe(true)
            expect(note.noteName.length).toBeGreaterThan(0)
          }
        },
      ),
      { numRuns: 300 },
    )
  })
})
