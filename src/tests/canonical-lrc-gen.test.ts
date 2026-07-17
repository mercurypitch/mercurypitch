// ============================================================
// Canonical LRC Gen Tests — REQ-UV-039 through REQ-UV-045
// Edge cases for LRC→canonical→LRC index mapping
// ============================================================

import { describe, expect, it } from 'vitest'
import type { CanonicalLrcEntry } from '@/features/stem-mixer/types'
import { applyRepeatBlocks, buildCanonicalEntries, buildCanonicalToLrcMap, buildLrcToCanonicalMap, computeRestProgress, selectActiveItem, } from '@/lib/canonical-lrc'
import type { LrcLine } from '@/lib/lyrics-service'
import { computeActiveWord, parseLrcFile, parseLrcWordTimings, } from '@/lib/lyrics-service'

// ═══════════════════════════════════════════════════════════════
// DUMMY TEST DATA
// ═══════════════════════════════════════════════════════════════

/** LRC with no gaps — no ~Rest~ needed */
export const LRC_NO_GAPS = `[00:10.00]First line of lyrics
[00:15.00]Second line here
[00:20.00]Third and final line`

/** LRC with a 30s gap between lines 1 and 2 — triggers synthetic ~Rest~ */
export const LRC_WITH_GAP = `[00:05.00]Opening line
[00:35.00]Line after long pause
[00:40.00]Continuing the song`

/** LRC with explicit ~Rest~ marker from API */
export const LRC_WITH_EXPLICIT_REST = `[00:10.00]First verse goes here
[00:25.00]~Rest~
[00:50.00]Second verse after break`

/** LRC with both synthetic gap + explicit rest */
export const LRC_MIXED_RESTS = `[00:05.00]Intro words here
[00:40.00]~Rest~
[01:00.00]After explicit rest`

/** LRC with per-word timestamps (word-level LRC) */
export const LRC_WORD_LEVEL = `[02:30.60]Amigos [02:32.00]no [02:32.37]more [02:32.99]tears
[03:57.26]Inside [03:57.79]the [03:58.89]scream [03:59.60]is [04:00.25]silence
[04:12.83]Only [04:13.28]horror, [04:13.95]only [04:14.38]pain`

/** LRC with a single line */
export const LRC_SINGLE_LINE = `[00:05.00]Just one single line`

/** LRC with consecutive ~Rest~ entries from API */
export const LRC_CONSECUTIVE_RESTS = `[00:10.00]First section
[00:15.00]~Rest~
[00:45.00]~Rest~
[01:00.00]Final section`

/** LRC with no timestamps in lines (edge case) */
export const LRC_NO_WORDS_IN_LINE = `[00:05.00]~Rest~
[00:10.00]Actually words
[00:55.00]Long wait over`

/** 10-line LRC with multiple gaps for block testing */
export const LRC_MULTI_GAP = `[00:05.00]Verse one line one
[00:10.00]Verse one line two
[00:55.00]Chorus line one
[01:00.00]Chorus line two
[01:30.00]Verse two line one
[01:35.00]Verse two line two`

// ═══════════════════════════════════════════════════════════════
// EARS REQ-UV-028: Canonical entry construction
// ═══════════════════════════════════════════════════════════════

describe('REQ-UV-028: Canonical entry construction', () => {
  it('builds canonical entries without ~Rest~ when gaps are < 20s', () => {
    const lrc = parseLrcFile(LRC_NO_GAPS)
    const entries = buildCanonicalEntries(lrc)
    expect(entries).toHaveLength(3)
    expect(entries.every((e) => e.type === 'line')).toBe(true)
    expect(entries[0].canonicalIndex).toBe(0)
    expect(entries[1].canonicalIndex).toBe(1)
    expect(entries[2].canonicalIndex).toBe(2)
  })

  it('inserts synthetic ~Rest~ for gaps > 20 seconds', () => {
    const lrc = parseLrcFile(LRC_WITH_GAP)
    const entries = buildCanonicalEntries(lrc)
    // [line0, ~Rest~(synthetic), line1, line2] = 4 entries
    expect(entries).toHaveLength(4)
    expect(entries[0].type).toBe('line')
    expect(entries[1].type).toBe('rest')
    expect(entries[1].lrcIndex).toBe(-1) // synthetic
    expect(entries[2].type).toBe('line')
    expect(entries[3].type).toBe('line')
  })

  it('places synthetic ~Rest~ at midpoint of the gap', () => {
    const lrc = parseLrcFile(LRC_WITH_GAP)
    const entries = buildCanonicalEntries(lrc)
    // Gap between 5s and 35s = 30s, midpoint = 5 + 15 = 20
    expect(entries[1].time).toBeCloseTo(20, 0)
  })

  it('handles explicit ~Rest~ from API data (no double rest after it)', () => {
    const lrc = parseLrcFile(LRC_WITH_EXPLICIT_REST)
    const entries = buildCanonicalEntries(lrc)
    // [line0(10), ~Rest~(explicit, lrcIdx=1, 25), line1(50)]. The explicit rest
    // already covers the 25s silence, so NO synthetic rest is added after it.
    expect(entries).toHaveLength(3)
    const explicitRest = entries.find((e) => e.lrcIndex === 1)
    expect(explicitRest).toBeDefined()
    expect(explicitRest!.type).toBe('rest')
    expect(explicitRest!.text).toBe('~Rest~')
    // its countdown spans to the next line
    expect(explicitRest!.gapEnd).toBeCloseTo(50, 1)
  })

  it('handles mixed synthetic + explicit rests', () => {
    const lrc = parseLrcFile(LRC_MIXED_RESTS)
    const entries = buildCanonicalEntries(lrc)
    // line0(5s), ~Rest~(synthetic, gap 35s), ~Rest~(explicit, lrcIdx=1, 40s), line2(60s)
    // BUT gap from 5→40=35 >20 so synthetic rest before explicit rest
    // AND gap from 40→60=20 NOT >20 so no synthetic rest there
    expect(entries.length).toBeGreaterThanOrEqual(3)
    const syntheticRests = entries.filter(
      (e) => e.type === 'rest' && e.lrcIndex === -1,
    )
    const explicitRests = entries.filter(
      (e) => e.type === 'rest' && e.lrcIndex >= 0,
    )
    // At least one explicit rest at lrcIndex 1
    expect(explicitRests.some((e) => e.lrcIndex === 1)).toBe(true)
    // At least one synthetic rest
    expect(syntheticRests.length).toBeGreaterThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// EARS REQ-UV-039: LRC↔Canonical index mapping round-trip
// ═══════════════════════════════════════════════════════════════

describe('REQ-UV-039: LRC↔Canonical index mapping', () => {
  it('round-trips correctly without gaps', () => {
    const lrc = parseLrcFile(LRC_NO_GAPS)
    const entries = buildCanonicalEntries(lrc)
    const lrcToCanon = buildLrcToCanonicalMap(entries)
    const canonToLrc = buildCanonicalToLrcMap(entries)

    for (let i = 0; i < lrc.length; i++) {
      const ci = lrcToCanon.get(i)
      expect(ci).toBe(i) // no gaps = identity mapping
      expect(canonToLrc.get(ci!)).toBe(i)
    }
  })

  it('maps LRC indices past gaps to correct canonical indices', () => {
    const lrc = parseLrcFile(LRC_WITH_GAP)
    const entries = buildCanonicalEntries(lrc)
    const lrcToCanon = buildLrcToCanonicalMap(entries)
    const canonToLrc = buildCanonicalToLrcMap(entries)

    // LRC index 0 → canonical index 0 (line 0)
    expect(lrcToCanon.get(0)).toBe(0)
    // LRC index 1 → canonical index 2 (skips synthetic ~Rest~ at canonical 1)
    expect(lrcToCanon.get(1)).toBe(2)
    // LRC index 2 → canonical index 3
    expect(lrcToCanon.get(2)).toBe(3)

    // Reverse: canonical 2 → LRC 1
    expect(canonToLrc.get(2)).toBe(1)
    expect(canonToLrc.get(3)).toBe(2)
  })

  it('synthetic ~Rest~ entries are not in either map', () => {
    const lrc = parseLrcFile(LRC_WITH_GAP)
    const entries = buildCanonicalEntries(lrc)
    const lrcToCanon = buildLrcToCanonicalMap(entries)
    const canonToLrc = buildCanonicalToLrcMap(entries)

    // Canonical index 1 is synthetic ~Rest~ → no entry in canonToLrc
    expect(canonToLrc.has(1)).toBe(false)
    // lrcIndex -1 → not in lrcToCanon
    expect(lrcToCanon.has(-1)).toBe(false)
  })

  it('handles consecutive explicit ~Rest~ entries', () => {
    const lrc = parseLrcFile(LRC_CONSECUTIVE_RESTS)
    const entries = buildCanonicalEntries(lrc)
    const lrcToCanon = buildLrcToCanonicalMap(entries)

    // LRC: [line0(idx0,10s), ~Rest~(idx1,15s), ~Rest~(idx2,45s), line3(idx3,60s)]
    // Gap 15→45=30 >20 → synthetic rest before explicit rest at idx2
    // Gap 45→60=15 <20 → no synthetic rest before final
    // So expected entries: [line0, ~Rest(synth), ~Rest(lrcIdx=1), ~Rest(lrcIdx=2), line3]
    expect(entries.length).toBeGreaterThanOrEqual(4)

    // LRC index 3 (the final line) must map somewhere
    const finalCanon = lrcToCanon.get(3)
    expect(finalCanon).toBeDefined()
    expect(finalCanon).toBeGreaterThan(2) // after all rests
  })

  it('handles empty LRC gracefully', () => {
    const entries = buildCanonicalEntries([])
    expect(entries).toHaveLength(0)
    const lrcToCanon = buildLrcToCanonicalMap(entries)
    const canonToLrc = buildCanonicalToLrcMap(entries)
    expect(lrcToCanon.size).toBe(0)
    expect(canonToLrc.size).toBe(0)
  })

  it('canonicalIndices are sequential and unique', () => {
    const lrc = parseLrcFile(LRC_MULTI_GAP)
    const entries = buildCanonicalEntries(lrc)
    const indices = entries.map((e) => e.canonicalIndex)
    const expected = Array.from({ length: indices.length }, (_, i) => i)
    expect(indices).toEqual(expected)
  })
})

// ═══════════════════════════════════════════════════════════════
// EARS REQ-UV-039, REQ-UV-040: Gen state seeding from wordTimings
// ═══════════════════════════════════════════════════════════════

describe('REQ-UV-040: Gen state seeding with canonical index mapping', () => {
  /**
   * Simulates startLrcGen's seeding logic.
   * Given wordTimings (keyed by LRC index) and canonical entries,
   * produces lineTimes and wordTimings keyed by canonical index.
   */
  function seedGenState(
    wordTimingsLrc: Record<number, number[]>,
    canonical: CanonicalLrcEntry[],
  ): {
    lineTimes: (number | undefined)[]
    wordTimings: Record<number, number[]>
  } {
    const lrcToCanon = buildLrcToCanonicalMap(canonical)
    const lines = canonical.map((e) => e.text)
    const lineTimes = new Array<number | undefined>(lines.length)
    const wordTimings: Record<number, number[]> = {}

    for (const k of Object.keys(wordTimingsLrc)) {
      const canonIdx = lrcToCanon.get(+k)
      if (canonIdx !== undefined) {
        lineTimes[canonIdx] = wordTimingsLrc[+k][0] ?? 0
        wordTimings[canonIdx] = [...wordTimingsLrc[+k]]
      }
    }

    return { lineTimes, wordTimings }
  }

  it('seeds correctly when there are no gaps', () => {
    const lrc = parseLrcFile(LRC_NO_GAPS)
    const entries = buildCanonicalEntries(lrc)
    const wtLrc: Record<number, number[]> = {
      0: [10, 12],
      1: [15, 16],
      2: [20, 21],
    }
    const { lineTimes, wordTimings } = seedGenState(wtLrc, entries)

    expect(lineTimes).toHaveLength(3)
    expect(lineTimes[0]).toBe(10)
    expect(lineTimes[1]).toBe(15)
    expect(lineTimes[2]).toBe(20)
    expect(wordTimings[0]).toEqual([10, 12])
    expect(wordTimings[1]).toEqual([15, 16])
    expect(wordTimings[2]).toEqual([20, 21])
  })

  it('places LRC-indexed seeds at correct canonical positions across gaps', () => {
    const lrc = parseLrcFile(LRC_WITH_GAP)
    const entries = buildCanonicalEntries(lrc)
    // 4 canonical entries: [line0(canon=0,lrc=0), ~Rest~(canon=1,lrc=-1), line1(canon=2,lrc=1), line2(canon=3,lrc=2)]
    const wtLrc: Record<number, number[]> = {
      0: [5, 7],
      1: [35, 36],
      2: [40, 41],
    }
    const { lineTimes, wordTimings } = seedGenState(wtLrc, entries)

    // Canonical index 1 (~Rest~) should be undefined
    expect(lineTimes[1]).toBeUndefined()
    // LRC index 0 → canonical 0
    expect(lineTimes[0]).toBe(5)
    // LRC index 1 → canonical 2 (NOT canonical 1!)
    expect(lineTimes[2]).toBe(35)
    // LRC index 2 → canonical 3
    expect(lineTimes[3]).toBe(40)

    // Word timings at correct canonical indices
    expect(wordTimings[0]).toEqual([5, 7])
    expect(wordTimings[1]).toBeUndefined() // ~Rest~ has none
    expect(wordTimings[2]).toEqual([35, 36])
    expect(wordTimings[3]).toEqual([40, 41])
  })

  it('handles wordTimings with gaps (some LRC indices missing)', () => {
    const lrc = parseLrcFile(LRC_WITH_GAP)
    const entries = buildCanonicalEntries(lrc)
    // Only LRC index 0 and 2 have timings
    const wtLrc: Record<number, number[]> = {
      0: [5, 7],
      2: [40, 41],
    }
    const { lineTimes } = seedGenState(wtLrc, entries)

    expect(lineTimes[0]).toBe(5) // LRC idx 0 → canon 0
    expect(lineTimes[1]).toBeUndefined() // ~Rest~
    expect(lineTimes[2]).toBeUndefined() // LRC idx 1 had no timing
    expect(lineTimes[3]).toBe(40) // LRC idx 2 → canon 3
  })
})

// ═══════════════════════════════════════════════════════════════
// EARS REQ-UV-043: LRC gen Finish — canonical→LRC output
// ═══════════════════════════════════════════════════════════════

describe('REQ-UV-043: LRC gen Finish canonical→LRC output', () => {
  /**
   * Simulates the output generation part of handleLrcGenFinish.
   * Takes canonical-indexed lineTimes and produces LRC text
   * with correct LRC-indexed timestamps, skipping synthetic ~Rest~.
   */
  function buildLrcOutput(
    canonical: CanonicalLrcEntry[],
    lineTimesCanon: (number | undefined)[],
  ): string[] {
    const result: string[] = []

    for (const entry of canonical) {
      if (entry.lrcIndex < 0) continue // skip synthetic ~Rest~
      const ci = entry.canonicalIndex
      const lt = lineTimesCanon[ci]
      if (lt === undefined) {
        result.push(`[00:00.00] ${entry.text}`)
      } else {
        const m = Math.floor(lt / 60)
          .toString()
          .padStart(2, '0')
        const s = (lt % 60).toFixed(2).padStart(5, '0')
        if (!entry.text.trim() || entry.text.trim() === '~Rest~') {
          result.push(`[${m}:${s}] ~Rest~`)
        } else {
          result.push(`[${m}:${s}] ${entry.text}`)
        }
      }
    }

    return result
  }

  it('produces correct LRC output without gaps', () => {
    const lrc = parseLrcFile(LRC_NO_GAPS)
    const entries = buildCanonicalEntries(lrc)
    const lineTimes: (number | undefined)[] = [10, 15, 20]
    const output = buildLrcOutput(entries, lineTimes)

    expect(output).toHaveLength(3)
    expect(output[0]).toBe('[00:10.00] First line of lyrics')
    expect(output[1]).toBe('[00:15.00] Second line here')
    expect(output[2]).toBe('[00:20.00] Third and final line')
  })

  it('skips synthetic ~Rest~ entries in output', () => {
    const lrc = parseLrcFile(LRC_WITH_GAP)
    const entries = buildCanonicalEntries(lrc)
    // 4 canonical, 3 real LRC lines
    const lineTimes: (number | undefined)[] = [5, undefined, 35, 40]
    const output = buildLrcOutput(entries, lineTimes)

    // Should have 3 lines (not 4), skipping the synthetic ~Rest~
    expect(output).toHaveLength(3)
    expect(output[0]).toContain('Opening line')
    expect(output[1]).toContain('Line after long pause')
    expect(output[2]).toContain('Continuing the song')

    // No synthetic ~Rest~ in output
    // Synthetic rests (lrcIndex=-1) must not appear
    expect(output.every((line) => !line.includes('[00:20.00]'))).toBe(true)
  })

  it('preserves explicit ~Rest~ in output', () => {
    const lrc = parseLrcFile(LRC_WITH_EXPLICIT_REST)
    const entries = buildCanonicalEntries(lrc)
    const lineTimes = new Array<number | undefined>(entries.length)
    for (let i = 0; i < entries.length; i++) {
      lineTimes[i] = entries[i].time
    }
    const output = buildLrcOutput(entries, lineTimes)
    const outputText = output.join('\n')

    // Explicit ~Rest~ at 25s should be in output
    expect(outputText).toContain('~Rest~')
    expect(outputText).toContain('First verse goes here')
    expect(outputText).toContain('Second verse after break')
  })

  it('handles partial gen: touched lines get new times, untouched keep originals', () => {
    const lrc = parseLrcFile(LRC_WITH_GAP)
    const entries = buildCanonicalEntries(lrc)
    // Original: line0=5s, line1=35s, line2=40s
    // User touched only line1 (canonical index 2), changed it to 38s
    const lineTimes: (number | undefined)[] = [
      undefined,
      undefined,
      38,
      undefined,
    ]
    const output = buildLrcOutput(entries, lineTimes)

    expect(output).toHaveLength(3)
    // Untouched lines get [00:00.00] (no originals in this simplified test)
    expect(output[0]).toContain('[00:00.00]')
    expect(output[0]).toContain('Opening line')
    // Touched line gets its new time
    expect(output[1]).toContain('[00:38.00]')
    expect(output[1]).toContain('Line after long pause')
  })

  it('does not produce duplicate lines after round-trip', () => {
    // Full round-trip: LRC → canonical → LRC
    const originalLrc = LRC_WITH_GAP
    const lrc = parseLrcFile(originalLrc)
    const entries = buildCanonicalEntries(lrc)
    const lineTimes: (number | undefined)[] = entries.map((e) =>
      e.type === 'line' ? e.time : undefined,
    )
    const output = buildLrcOutput(entries, lineTimes)
    const reparsed = parseLrcFile(output.join('\n'))

    // Same number of real lines
    expect(reparsed).toHaveLength(lrc.filter((l) => l.text !== '~Rest~').length)
    // BUT wait — original has no explicit ~Rest~, so output should have same number as original
    // Output generates ~Rest~ only for blank lines or explicit rests
    // Since original has no blank lines or explicit rests, output should have 3 lines
    expect(output).toHaveLength(3)
  })
})

// ═══════════════════════════════════════════════════════════════
// EARS REQ-UV-029: Word-level LRC parsing edge cases
// ═══════════════════════════════════════════════════════════════

describe('REQ-UV-029: Word-level LRC parsing', () => {
  it('extracts words and timestamps from word-level LRC', () => {
    const lrc = parseLrcFile(LRC_WORD_LEVEL)
    expect(lrc).toHaveLength(3)

    // Line 1: 02:30.60 = 150.6s
    const entry = buildCanonicalEntries(lrc)[0]
    expect(entry.type).toBe('line')
    expect(entry.words).toEqual(['Amigos', 'no', 'more', 'tears'])
    expect(entry.wordTimes).toHaveLength(4)
    expect(entry.wordTimes![0]).toBe(150.6)
    expect(entry.wordTimes![1]).toBe(152.0)
  })

  it('handles word with trailing comma', () => {
    const text = 'Only [04:13.28]horror, [04:13.95]only [04:14.38]pain'
    const result = parseLrcWordTimings(text, 252.83)
    expect(result).not.toBeNull()
    // "horror," should be kept as-is
    expect(result!.words).toContain('horror,')
    expect(result!.words).toContain('only')
    expect(result!.words).toContain('pain')
  })

  it('line with no words returns null from parseLrcWordTimings', () => {
    expect(parseLrcWordTimings('~Rest~', 25)).toBeNull()
    expect(parseLrcWordTimings('', 10)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// EARS REQ-UV-033: computeActiveWord — long gap edge cases
// ═══════════════════════════════════════════════════════════════

describe('REQ-UV-033: computeActiveWord with long gaps', () => {
  it('last word is NOT stretched across remainder of gap (even-division path)', () => {
    // Simulate even-division: line at 5s, next at 35s (30s gap)
    // "Opening line" = 2 words, should NOT stretch 30s
    const result = computeActiveWord(
      ['Opening', 'line'],
      5,
      35, // endTime at next line
      undefined,
      7, // 2s into the line
    )
    // 2 words over 30s = 15s per word. At 2s elapsed, we're still in first word
    expect(result.activeUpTo).toBe(-1)
  })

  it('per-word timings prevent stretching past the actual word duration', () => {
    // Words at [150.6, 152.0, 152.37, 152.99], next line at 237.26
    const result = computeActiveWord(
      ['Amigos', 'no', 'more', 'tears'],
      150.6,
      237.26,
      [150.6, 152.0, 152.37, 152.99],
      160, // 9.4 seconds after line start, but words only span ~2.4s
    )
    // All 4 words should be fully done, dwelling lit — nothing in progress
    expect(result.activeUpTo).toBe(3)
    expect(result.charProgress).toBe(0)
  })

  it('does NOT partially highlight all 4 words at elapsed=160 in even-division mode', () => {
    // Without per-word timings, even division over 87s would have each word at ~21.75s
    // At 160s (9.4s into line), only ~43% of first word would be done
    const result = computeActiveWord(
      ['Amigos', 'no', 'more', 'tears'],
      150.6,
      237.26,
      undefined,
      160,
    )
    // At 9.4s into 86.66s line, progress=0.108, wordIndex=0
    expect(result.activeUpTo).toBe(-1)
    // First word partially revealed
    expect(result.charProgress).toBeLessThan('Amigos'.length)
  })
})

// ═══════════════════════════════════════════════════════════════
// EARS REQ-UV-042: Partial gen merge — touched/untouched lines
// ═══════════════════════════════════════════════════════════════

describe('REQ-UV-042: Partial gen merge logic', () => {
  /**
   * Simulates the partial merge from handleLrcGenFinish:
   * touchedLines get new times, untouched keep originals.
   * All indices are canonical.
   */
  function partialMerge(
    canonical: CanonicalLrcEntry[],
    newLineTimesCanon: (number | undefined)[],
    origWordTimingsLrc: Record<number, number[]>,
    touchedLines: Set<number>, // canonical indices
  ) {
    const lrcToCanon = buildLrcToCanonicalMap(canonical)

    // Convert origWt from LRC→canonical
    const origWtCanon: Record<number, number[]> = {}
    for (const k of Object.keys(origWordTimingsLrc)) {
      const ci = lrcToCanon.get(+k)
      if (ci !== undefined) origWtCanon[ci] = [...origWordTimingsLrc[+k]]
    }

    const lines = canonical.map((e) => e.text)
    const finalTimes = lines.map((_, i) => {
      if (touchedLines.has(i)) return newLineTimesCanon[i]
      if (origWtCanon[i] !== undefined) return origWtCanon[i][0]
      return undefined
    })

    return { finalTimes, origWtCanon }
  }

  it('touched lines get new times, untouched keep originals', () => {
    const lrc = parseLrcFile(LRC_NO_GAPS)
    const entries = buildCanonicalEntries(lrc)

    const origWt: Record<number, number[]> = {
      0: [10],
      1: [15],
      2: [20],
    }
    const newTimes: (number | undefined)[] = [undefined, 18, undefined]
    const touched = new Set<number>([1]) // only canonical index 1 touched

    const { finalTimes } = partialMerge(entries, newTimes, origWt, touched)

    // Canonical index 0: untouched, keeps original 10
    expect(finalTimes[0]).toBe(10)
    // Canonical index 1: touched, gets new 18
    expect(finalTimes[1]).toBe(18)
    // Canonical index 2: untouched, keeps original 20
    expect(finalTimes[2]).toBe(20)
  })

  it('untouched lines without original timings remain undefined', () => {
    const lrc = parseLrcFile(LRC_NO_GAPS)
    const entries = buildCanonicalEntries(lrc)

    const origWt: Record<number, number[]> = {
      0: [10],
      // index 1 was never mapped
      2: [20],
    }
    const newTimes: (number | undefined)[] = [undefined, undefined, undefined]
    const touched = new Set<number>([])

    const { finalTimes } = partialMerge(entries, newTimes, origWt, touched)

    expect(finalTimes[0]).toBe(10)
    expect(finalTimes[1]).toBeUndefined()
    expect(finalTimes[2]).toBe(20)
  })

  it('untouched gap lines keep original LRC timestamps (not canonical)', () => {
    const lrc = parseLrcFile(LRC_WITH_GAP)
    const entries = buildCanonicalEntries(lrc)
    // [line0(canon=0,lrc=0), ~Rest~(canon=1,lrc=-1), line1(canon=2,lrc=1), line2(canon=3,lrc=2)]

    const origWt: Record<number, number[]> = {
      0: [5],
      1: [35],
      2: [40],
    }
    const newTimes = new Array<number | undefined>(entries.length)
    const touched = new Set<number>([])

    const { finalTimes, origWtCanon } = partialMerge(
      entries,
      newTimes,
      origWt,
      touched,
    )

    // LRC index 0→canon 0, LRC index 1→canon 2, LRC index 2→canon 3
    expect(finalTimes[0]).toBe(5)
    expect(finalTimes[1]).toBeUndefined() // ~Rest~ has no original timing
    expect(finalTimes[2]).toBe(35) // LRC index 1 → canonical 2
    expect(finalTimes[3]).toBe(40) // LRC index 2 → canonical 3

    // Verify origWtCanon is keyed by canonical indices
    expect(origWtCanon[0]).toEqual([5])
    expect(origWtCanon[1]).toBeUndefined()
    expect(origWtCanon[2]).toEqual([35])
    expect(origWtCanon[3]).toEqual([40])
  })
})

// ═══════════════════════════════════════════════════════════════
// EARS REQ-UV-045: Edge case — all lines are ~Rest~
// ═══════════════════════════════════════════════════════════════

describe('REQ-UV-045: Edge cases', () => {
  it('single line LRC works correctly', () => {
    const lrc = parseLrcFile(LRC_SINGLE_LINE)
    const entries = buildCanonicalEntries(lrc)
    expect(entries).toHaveLength(1)
    expect(entries[0].type).toBe('line')
    expect(entries[0].canonicalIndex).toBe(0)
    expect(entries[0].lrcIndex).toBe(0)
  })

  it('LRC with only ~Rest~ lines still produces canonical entries', () => {
    const content = `[00:05.00]~Rest~
[00:30.00]~Rest~`
    const lrc = parseLrcFile(content)
    const entries = buildCanonicalEntries(lrc)
    // Two explicit rests with a 25s gap
    expect(entries.length).toBeGreaterThanOrEqual(2)
    expect(entries.every((e) => e.type === 'rest')).toBe(true)
  })

  it('gap exactly at threshold (20s) does NOT insert ~Rest~', () => {
    // Construct LRC with exactly 20s gap
    const lrc: LrcLine[] = [
      { time: 5, text: 'First' },
      { time: 25, text: 'Second' }, // gap = 20, not > 20
    ]
    const entries = buildCanonicalEntries(lrc)
    expect(entries).toHaveLength(2)
    expect(entries.every((e) => e.type === 'line')).toBe(true)
  })

  it('gap just above threshold (20.001s) DOES insert ~Rest~', () => {
    const lrc: LrcLine[] = [
      { time: 5, text: 'First' },
      { time: 25.001, text: 'Second' }, // gap = 20.001 > 20
    ]
    const entries = buildCanonicalEntries(lrc)
    expect(entries).toHaveLength(3)
    expect(entries[1].type).toBe('rest')
  })

  it('very large gap (300s / 5min) correctly inserts single ~Rest~', () => {
    const lrc: LrcLine[] = [
      { time: 10, text: 'Start' },
      { time: 310, text: 'End' }, // 300s gap
    ]
    const entries = buildCanonicalEntries(lrc)
    expect(entries).toHaveLength(3)
    expect(entries[1].type).toBe('rest')
    expect(entries[1].time).toBeCloseTo(160, 0) // midpoint of 10..310
  })

  it('no gap before first line (i=0) — never inserts rest', () => {
    const lrc = parseLrcFile(LRC_SINGLE_LINE)
    const entries = buildCanonicalEntries(lrc)
    expect(entries).toHaveLength(1)
    expect(entries[0].type).toBe('line')
  })
})

// ═══════════════════════════════════════════════════════════════
// Rest gap metric + countdown fields (word-level)
// ═══════════════════════════════════════════════════════════════

/** Word-level LRC: line A is sung 10..12s, line B starts at 40s.
 *  Word-end→next gap = 40-12 = 28s (> 20) → synthetic rest. */
const LRC_WL_BIG_GAP = `[00:10.00]Hold [00:11.00]this [00:12.00]note
[00:40.00]After [00:41.00]long [00:42.00]rest`

/** Word-level LRC where the line-START gap (34-10 = 24s) exceeds 20s but the
 *  real silence (last word 16s → next 34s = 18s) does NOT — so the old
 *  line-start metric would wrongly insert a rest; the fixed metric must not. */
const LRC_WL_NO_REST = `[00:10.00]One [00:12.00]two [00:14.00]three [00:16.00]four
[00:34.00]Next [00:35.00]line [00:36.00]here`

describe('Rest gap metric (word-level)', () => {
  it('measures the gap from the previous last word, not the line start', () => {
    const entries = buildCanonicalEntries(parseLrcFile(LRC_WL_NO_REST))
    // 24s line-start gap, but only 18s of real silence -> NO rest.
    expect(entries.every((e) => e.type === 'line')).toBe(true)
    expect(entries).toHaveLength(2)
  })

  it('inserts a rest sized from the silence, with gapStart/gapEnd/dotCount', () => {
    const entries = buildCanonicalEntries(parseLrcFile(LRC_WL_BIG_GAP))
    expect(entries).toHaveLength(3) // line, rest, line
    const rest = entries[1]
    expect(rest.type).toBe('rest')
    expect(rest.lrcIndex).toBe(-1) // synthetic
    expect(rest.gapStart).toBeCloseTo(12, 1) // prev line's last word start
    expect(rest.gapEnd).toBeCloseTo(40, 1) // next line's first word
    expect(rest.time).toBeCloseTo(12, 1) // activates when silence begins
    expect(rest.dotCount).toBe(6) // round(28 / 5)
  })

  it('sizes explicit ~Rest~ dots to the next line', () => {
    // explicit rest at 25s, next line at 50s -> 25s -> 5 dots
    const entries = buildCanonicalEntries(parseLrcFile(LRC_WITH_EXPLICIT_REST))
    const explicit = entries.find((e) => e.lrcIndex === 1)
    expect(explicit?.type).toBe('rest')
    expect(explicit?.gapStart).toBeCloseTo(25, 1)
    expect(explicit?.gapEnd).toBeCloseTo(50, 1)
    expect(explicit?.dotCount).toBe(5)
  })
})

describe('computeRestProgress', () => {
  // gapStart 10, gapEnd 30 (20s), 4 dots (5s each)
  it('is empty at gapStart and before', () => {
    expect(computeRestProgress(10, 30, 4, 10)).toEqual({
      filledDots: 0,
      currentDotFrac: 0,
    })
    expect(computeRestProgress(10, 30, 4, 5)).toEqual({
      filledDots: 0,
      currentDotFrac: 0,
    })
  })

  it('is fully filled at gapEnd and after', () => {
    expect(computeRestProgress(10, 30, 4, 30)).toEqual({
      filledDots: 4,
      currentDotFrac: 0,
    })
    expect(computeRestProgress(10, 30, 4, 45)).toEqual({
      filledDots: 4,
      currentDotFrac: 0,
    })
  })

  it('fills proportionally mid-gap', () => {
    // halfway -> 2 of 4 dots
    expect(computeRestProgress(10, 30, 4, 20)).toEqual({
      filledDots: 2,
      currentDotFrac: 0,
    })
    // 37.5% -> 1.5 dots: 1 full + half of the next
    const p = computeRestProgress(10, 30, 4, 17.5)
    expect(p.filledDots).toBe(1)
    expect(p.currentDotFrac).toBeCloseTo(0.5, 5)
  })

  it('guards degenerate inputs', () => {
    expect(computeRestProgress(30, 10, 4, 20)).toEqual({
      filledDots: 0,
      currentDotFrac: 0,
    })
    expect(computeRestProgress(10, 30, 0, 20)).toEqual({
      filledDots: 0,
      currentDotFrac: 0,
    })
  })
})

describe('selectActiveItem', () => {
  const entries = buildCanonicalEntries(parseLrcFile(LRC_WL_BIG_GAP))
  // [ lineA(time 10), rest(time 12, gap 12..40, 6 dots), lineB(time 40) ]

  it('returns none before the first entry', () => {
    expect(selectActiveItem(entries, 5)).toEqual({ index: -1, kind: 'none' })
  })

  it('selects the active line while it is being sung', () => {
    const a = selectActiveItem(entries, 11)
    expect(a.index).toBe(0)
    expect(a.kind).toBe('line')
  })

  it('selects the rest during the gap and reports fill', () => {
    const a = selectActiveItem(entries, 20)
    expect(a.index).toBe(1)
    expect(a.kind).toBe('rest')
    // (20-12)/28 * 6 = 1.714 dots
    expect(a.restProgress?.filledDots).toBe(1)
    expect(a.restProgress?.currentDotFrac).toBeCloseTo(0.714, 2)
  })

  it('selects the next line after the gap', () => {
    const a = selectActiveItem(entries, 45)
    expect(a.index).toBe(2)
    expect(a.kind).toBe('line')
  })
})

describe('applyRepeatBlocks (repeat-block rest delay)', () => {
  // 2-line block sung at 10s/14s, then a 36s gap, then the next section.
  const LRC_REPEAT = `[00:10.00]Chorus line one
[00:14.00]Chorus line two
[00:50.00]Next section`

  it('delays a rest after a repeated block until all passes are sung', () => {
    const lrc = parseLrcFile(LRC_REPEAT)
    const base = buildCanonicalEntries(lrc)
    expect(base[2].type).toBe('rest')
    const restBefore = base[2].time // midpoint ~32

    const out = applyRepeatBlocks(base, lrc, [
      { startLrc: 0, endLrc: 2, repeatCount: 2 },
    ])
    const rest = out[2]
    expect(rest.type).toBe('rest')
    expect(rest.time).toBeGreaterThan(restBefore)
    // one extra 8s pass (4s span * 2/1) pushes ~32 -> ~40
    expect(rest.gapStart).toBeCloseTo(40, 0)
    expect(rest.gapEnd).toBeCloseTo(50, 1)
    expect(rest.dotCount).toBe(2) // round((50-40)/5)
    // indices preserved (no reindex)
    expect(out).toHaveLength(base.length)
  })

  it('keeps the last block line active through the repeat', () => {
    const lrc = parseLrcFile(LRC_REPEAT)
    const out = applyRepeatBlocks(buildCanonicalEntries(lrc), lrc, [
      { startLrc: 0, endLrc: 2, repeatCount: 2 },
    ])
    // at 35s (pass 2) the last block line is active, not the rest
    const mid = selectActiveItem(out, 35)
    expect(mid.index).toBe(1)
    expect(mid.kind).toBe('line')
    // after the delayed rest the rest is active
    expect(selectActiveItem(out, 45).kind).toBe('rest')
  })

  it('is a no-op without ranges or for repeatCount <= 1', () => {
    const lrc = parseLrcFile(LRC_REPEAT)
    const base = buildCanonicalEntries(lrc)
    expect(applyRepeatBlocks(base, lrc, [])).toEqual(base)
    expect(
      applyRepeatBlocks(base, lrc, [
        { startLrc: 0, endLrc: 2, repeatCount: 1 },
      ]),
    ).toEqual(base)
  })

  it('delays an EXPLICIT rest after a single-line repeat block', () => {
    // The real-world case: one line, then an explicit ~Rest~ that starts right
    // when the line's last word ends, then the next section. Marking the line
    // repeat x2 should push the rest past the second pass.
    const lrc = parseLrcFile(`[00:10.00]kad ces doci
[00:13.00]~Rest~
[00:40.00]Srebrni snijeg`)
    const base = buildCanonicalEntries(lrc)
    const restBefore = base.find((e) => e.type === 'rest')!
    expect(restBefore.gapStart).toBeCloseTo(13, 1) // fires at pass-1 end

    const out = applyRepeatBlocks(base, lrc, [
      { startLrc: 0, endLrc: 1, repeatCount: 2 },
    ])
    const rest = out.find((e) => e.type === 'rest')!
    // one extra ~3s pass (10->13) pushes the rest start to ~16
    expect(rest.gapStart).toBeGreaterThan(13)
    expect(rest.gapStart).toBeCloseTo(16, 1)
    // the last line stays active through the repeat (until ~16)
    expect(selectActiveItem(out, 14).kind).toBe('line')
    expect(selectActiveItem(out, 18).kind).toBe('rest')
  })
})
