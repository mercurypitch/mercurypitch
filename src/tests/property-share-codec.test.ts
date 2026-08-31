// ============================================================
// Property-based & Fuzz Tests: Share Codec
// ============================================================

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { CompactMelodyItem, MelodyShareData } from '@/lib/share-codec'
import { decodeSharePayload, encodeExerciseForShare, encodeMelodyForShare, encodeRoutineForShare, generateMelodyItemsFromCompact, } from '@/lib/share-codec'
import type { MelodyItem } from '@/types'

describe('Property-Based Tests: Share Codec', () => {
  it('never throws on arbitrary fuzzed string inputs to decodeSharePayload', () => {
    fc.assert(
      fc.property(fc.string(), (randomString) => {
        expect(() => {
          const result = decodeSharePayload(randomString)
          if (result !== null) {
            expect(typeof result).toBe('object')
            expect(result.v).toBe(1)
          }
        }).not.toThrow()
      }),
      { numRuns: 1000 },
    )
  })

  it('never throws on arbitrary base64url inputs', () => {
    fc.assert(
      fc.property(fc.base64String(), (b64) => {
        expect(() => {
          decodeSharePayload(b64)
        }).not.toThrow()
      }),
      { numRuns: 500 },
    )
  })

  it('round-trips arbitrary valid melodies in playable MIDI range (21-108)', () => {
    const melodyItemArbitrary = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      isRest: fc.boolean(),
      startBeat: fc.double({ min: 0, max: 500, noNaN: true }),
      duration: fc.double({ min: 0.1, max: 64, noNaN: true }),
      velocity: fc.option(fc.integer({ min: 0, max: 127 })),
      effectType: fc.option(fc.constantFrom('slide', 'ease', 'vibrato')),
      slideInterval: fc.option(fc.integer({ min: -24, max: 24 })),
      vibratoAmplitude: fc.option(
        fc.double({ min: 0.1, max: 3.0, noNaN: true }),
      ),
      lyricText: fc.option(fc.string({ maxLength: 30 })),
      note: fc.record({
        midi: fc.integer({ min: 21, max: 108 }),
        name: fc.constantFrom(
          'C',
          'C#',
          'D',
          'D#',
          'E',
          'F',
          'F#',
          'G',
          'G#',
          'A',
          'A#',
          'B',
        ),
        octave: fc.integer({ min: 0, max: 8 }),
        freq: fc.double({ min: 20, max: 5000, noNaN: true }),
      }),
    }) as fc.Arbitrary<MelodyItem>

    fc.assert(
      fc.property(
        fc.array(melodyItemArbitrary, { minLength: 1, maxLength: 30 }),
        fc.integer({ min: 20, max: 300 }),
        fc.string({ maxLength: 50 }),
        (items, bpm, title) => {
          const encoded = encodeMelodyForShare(
            items,
            bpm,
            'C',
            'major',
            4,
            title,
          )
          expect(typeof encoded).toBe('string')
          expect(encoded.length).toBeGreaterThan(0)

          const decoded = decodeSharePayload(encoded)
          expect(decoded).not.toBeNull()
          expect(decoded?.t).toBe('melody')
          expect(decoded?.v).toBe(1)

          const data = decoded?.d as MelodyShareData
          expect(data.b).toBe(bpm)
          expect(data.i.length).toBe(items.length)

          // Verify items unpacking works and preserves length
          const unpacked = generateMelodyItemsFromCompact(data.i)
          expect(unpacked.length).toBe(items.length)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('safely handles out-of-range MIDI notes without throwing in unpacker', () => {
    const rawCompactArbitrary = fc.array(
      fc.tuple(
        fc.integer({ min: -100, max: 200 }), // arbitrary MIDI
        fc.double({ min: -10, max: 100, noNaN: true }), // startBeat
        fc.double({ min: -10, max: 100, noNaN: true }), // duration
      ),
      { maxLength: 20 },
    )

    fc.assert(
      fc.property(rawCompactArbitrary, (tuples) => {
        expect(() => {
          const result = generateMelodyItemsFromCompact(
            tuples as unknown as CompactMelodyItem[],
          )
          expect(Array.isArray(result)).toBe(true)
        }).not.toThrow()
      }),
      { numRuns: 300 },
    )
  })

  it('round-trips arbitrary exercise payloads safely', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.array(fc.string({ minLength: 1, maxLength: 5 }), { maxLength: 10 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 10, max: 3600 }),
        fc.string({ maxLength: 40 }),
        (exerciseType, targetNotes, difficulty, durationSec, title) => {
          const encoded = encodeExerciseForShare(
            exerciseType,
            targetNotes,
            difficulty,
            durationSec,
            title,
          )
          const decoded = decodeSharePayload(encoded)
          expect(decoded).not.toBeNull()
          expect(decoded?.t).toBe('exercise')
        },
      ),
      { numRuns: 200 },
    )
  })

  it('round-trips arbitrary routine payloads safely', () => {
    const segmentArbitrary = fc.record({
      type: fc.constantFrom('warmup', 'exercise', 'challenge-prep', 'cooldown'),
      durationSec: fc.integer({ min: 1, max: 1800 }),
      config: fc.dictionary(fc.string({ maxLength: 10 }), fc.jsonValue()),
    })

    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ maxLength: 40 }),
        fc.string({ maxLength: 100 }),
        fc.array(segmentArbitrary, { minLength: 1, maxLength: 8 }),
        (id, name, desc, segments) => {
          const encoded = encodeRoutineForShare({
            id,
            name,
            description: desc,
            segments,
          })
          const decoded = decodeSharePayload(encoded)
          expect(decoded).not.toBeNull()
          expect(decoded?.t).toBe('routine')
        },
      ),
      { numRuns: 200 },
    )
  })
})
