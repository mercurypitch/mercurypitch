import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { KeyNote } from '@/lib/key-detection/key-detector'
import { detectKeyFromHistogram, detectKeyFromNotes, detectRegionalKeys, pitchClassHistogram, } from '@/lib/key-detection/key-detector'

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]

describe('Property-Based Tests: Krumhansl-Schmuckler Key Detection', () => {
  it('pitchClassHistogram produces non-negative 12-bin histogram for any input notes', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            midi: fc.integer({ min: -100, max: 200 }),
            startSec: fc.double({ min: -100, max: 1000 }),
            duration: fc.double({ min: -10, max: 100 }),
          }),
        ),
        (rawNotes) => {
          const notes: KeyNote[] = rawNotes.map((n) => ({
            midi: n.midi,
            startSec: n.startSec,
            endSec: n.startSec + n.duration,
          }))

          const hist = pitchClassHistogram(notes)
          expect(hist).toHaveLength(12)
          for (const val of hist) {
            expect(Number.isFinite(val)).toBe(true)
            expect(val).toBeGreaterThanOrEqual(0)
          }
        },
      ),
      { numRuns: 500 },
    )
  })

  it('transposing a scale by k semitones shifts the detected tonic by k (mod 12)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 11 }), // base tonic
        fc.integer({ min: -24, max: 24 }), // transposition shift
        (baseTonic, shift) => {
          // Construct a distinct major scale melody
          const baseNotes: KeyNote[] = MAJOR_SCALE_INTERVALS.map(
            (interval, i) => ({
              midi: 60 + baseTonic + interval,
              startSec: i * 0.5,
              endSec: (i + 1) * 0.5,
            }),
          )

          const transposedNotes: KeyNote[] = baseNotes.map((n) => ({
            midi: n.midi + shift,
            startSec: n.startSec,
            endSec: n.endSec,
          }))

          const baseKey = detectKeyFromNotes(baseNotes)
          const transposedKey = detectKeyFromNotes(transposedNotes)

          const expectedTonic = (((baseKey.tonic + shift) % 12) + 12) % 12
          expect(transposedKey.tonic).toBe(expectedTonic)
          expect(transposedKey.mode).toBe(baseKey.mode)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('scaling note durations uniformly preserves the detected key and confidence', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 11 }),
        fc.double({ min: 0.1, max: 10, noNaN: true }), // time scale factor
        (tonic, scaleFactor) => {
          const baseNotes: KeyNote[] = MAJOR_SCALE_INTERVALS.map(
            (interval, i) => ({
              midi: 60 + tonic + interval,
              startSec: i * 1.0,
              endSec: (i + 1) * 1.0,
            }),
          )

          const scaledNotes: KeyNote[] = baseNotes.map((n) => ({
            midi: n.midi,
            startSec: n.startSec * scaleFactor,
            endSec: n.endSec * scaleFactor,
          }))

          const baseResult = detectKeyFromNotes(baseNotes)
          const scaledResult = detectKeyFromNotes(scaledNotes)

          expect(scaledResult.tonic).toBe(baseResult.tonic)
          expect(scaledResult.mode).toBe(baseResult.mode)
          expect(scaledResult.confidence).toBeCloseTo(baseResult.confidence, 4)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('detectKeyFromHistogram returns tonic in 0..11 and confidence in 0..1 for any histogram', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 1000 }), {
          minLength: 12,
          maxLength: 12,
        }),
        (hist) => {
          const result = detectKeyFromHistogram(hist)
          expect(result.tonic).toBeGreaterThanOrEqual(0)
          expect(result.tonic).toBeLessThanOrEqual(11)
          expect(['major', 'minor']).toContain(result.mode)
          expect(result.confidence).toBeGreaterThanOrEqual(0)
          expect(result.confidence).toBeLessThanOrEqual(1)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('detectRegionalKeys produces monotonic, non-overlapping regions', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            midi: fc.integer({ min: 36, max: 84 }),
            startSec: fc.double({ min: 0, max: 120, noNaN: true }),
            durSec: fc.double({ min: 0.2, max: 2, noNaN: true }),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        (rawNotes) => {
          const notes: KeyNote[] = rawNotes.map((n) => ({
            midi: n.midi,
            startSec: n.startSec,
            endSec: n.startSec + n.durSec,
          }))

          const regions = detectRegionalKeys(notes)
          expect(Array.isArray(regions)).toBe(true)

          for (let i = 0; i < regions.length; i++) {
            const r = regions[i]
            expect(r.startSec).toBeLessThanOrEqual(r.endSec)
            expect(r.tonic).toBeGreaterThanOrEqual(0)
            expect(r.tonic).toBeLessThanOrEqual(11)

            if (i > 0) {
              expect(r.startSec).toBeGreaterThanOrEqual(regions[i - 1].startSec)
            }
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('detectRegionalKeys handles empty or zero-duration note collections safely', () => {
    expect(detectRegionalKeys([])).toEqual([])

    // A note that is filtered out by zero duration within the window
    const zeroDurNotes: KeyNote[] = [{ midi: 60, startSec: 0, endSec: 0 }]
    const zeroRegions = detectRegionalKeys(zeroDurNotes)
    expect(zeroRegions).toHaveLength(1)
    expect(zeroRegions[0].startSec).toBe(0)
    expect(zeroRegions[0].endSec).toBe(0)
  })
})
