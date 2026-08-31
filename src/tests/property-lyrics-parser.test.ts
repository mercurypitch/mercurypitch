// ============================================================
// Property-based & Fuzz Tests: LRC & Lyrics Parser
// ============================================================

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { extractTitle, parseArtistTitle, parseLrcFile, parseLrcOffsetTag, parseLrcWordTimings, } from '@/lib/lyrics-service'

describe('Property-Based Tests: Lyrics Service & LRC Parsing', () => {
  it('never throws on arbitrary fuzzed text inputs for parseLrcFile', () => {
    fc.assert(
      fc.property(fc.string(), (fuzzContent) => {
        expect(() => {
          const lines = parseLrcFile(fuzzContent)
          expect(Array.isArray(lines)).toBe(true)

          // Invariant 1: Result is strictly sorted ascending by time
          for (let i = 1; i < lines.length; i++) {
            expect(lines[i].time).toBeGreaterThanOrEqual(lines[i - 1].time)
          }

          // Invariant 2: All times are finite and non-negative
          for (const line of lines) {
            expect(Number.isFinite(line.time)).toBe(true)
            expect(line.time).toBeGreaterThanOrEqual(0)
            expect(line.text.trim().length).toBeGreaterThan(0)
          }
        }).not.toThrow()
      }),
      { numRuns: 1000 },
    )
  })

  it('never throws on arbitrary fuzzed inputs for parseLrcOffsetTag', () => {
    fc.assert(
      fc.property(fc.string(), (fuzzContent) => {
        expect(() => {
          const offset = parseLrcOffsetTag(fuzzContent)
          expect(Number.isFinite(offset)).toBe(true)
        }).not.toThrow()
      }),
      { numRuns: 500 },
    )
  })

  it('never throws on arbitrary fuzzed inputs for parseLrcWordTimings', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.double({ min: 0, max: 3600, noNaN: true }),
        (fuzzText, lineStartTime) => {
          expect(() => {
            const timings = parseLrcWordTimings(fuzzText, lineStartTime)
            if (timings !== null) {
              expect(Array.isArray(timings.words)).toBe(true)
              expect(Array.isArray(timings.wordTimes)).toBe(true)
              expect(timings.words.length).toBe(timings.wordTimes.length)
              for (const t of timings.wordTimes) {
                expect(Number.isFinite(t)).toBe(true)
                expect(t).toBeGreaterThanOrEqual(0)
              }
            }
          }).not.toThrow()
        },
      ),
      { numRuns: 1000 },
    )
  })

  it('never throws on arbitrary strings for extractTitle and parseArtistTitle', () => {
    fc.assert(
      fc.property(fc.string(), (fuzzFilename) => {
        expect(() => {
          const title = extractTitle(fuzzFilename)
          expect(typeof title).toBe('string')
          expect(title.length).toBeGreaterThan(0)

          const parsed = parseArtistTitle(fuzzFilename)
          expect(typeof parsed.artist).toBe('string')
          expect(typeof parsed.title).toBe('string')
        }).not.toThrow()
      }),
      { numRuns: 500 },
    )
  })

  it('correctly parses structured LRC lines and offsets', () => {
    const lrcLineArbitrary = fc.record({
      min: fc.integer({ min: 0, max: 99 }),
      sec: fc.integer({ min: 0, max: 59 }),
      ms: fc.integer({ min: 0, max: 99 }),
      text: fc
        .string({ minLength: 1, maxLength: 60 })
        .map((s) => s.replace(/[\r\n[\]]/g, ' ')),
    })

    fc.assert(
      fc.property(
        fc.array(lrcLineArbitrary, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: -5000, max: 5000 }),
        (lines, offsetMs) => {
          const offsetHeader = `[offset:${offsetMs}]\n`
          const lrcContent =
            offsetHeader +
            lines
              .map(
                (l) =>
                  `[${String(l.min).padStart(2, '0')}:${String(l.sec).padStart(2, '0')}.${String(l.ms).padStart(2, '0')}] ${l.text}`,
              )
              .join('\n')

          const parsed = parseLrcFile(lrcContent)
          expect(Array.isArray(parsed)).toBe(true)
          for (const line of parsed) {
            expect(Number.isFinite(line.time)).toBe(true)
            expect(line.time).toBeGreaterThanOrEqual(0)
          }
        },
      ),
      { numRuns: 300 },
    )
  })
})
