// ============================================================
// LRC Generator Tests — REQ-UV-039 through REQ-UV-045
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  buildLrcText,
  buildWordLevelLrc,
  estimateUnmappedTimes,
  formatTimeLrc,
} from '@/lib/lrc-generator'

// ── REQ-UV-043: LRC Gen Finish — formatTimeLrc ──────────────────

describe('formatTimeLrc', () => {
  it('formats whole seconds', () => {
    expect(formatTimeLrc(0)).toBe('00:00.00')
    expect(formatTimeLrc(5)).toBe('00:05.00')
  })

  it('formats minutes and seconds', () => {
    expect(formatTimeLrc(65)).toBe('01:05.00')
    expect(formatTimeLrc(125.5)).toBe('02:05.50')
  })

  it('handles fractional seconds with precision', () => {
    expect(formatTimeLrc(12.34)).toBe('00:12.34')
    expect(formatTimeLrc(12.345)).toBe('00:12.35') // rounds to 2 decimal places
  })

  it('pads minutes to two digits', () => {
    expect(formatTimeLrc(3700)).toBe('61:40.00')
  })
})

// ── estimateUnmappedTimes ─────────────────────────────────────

describe('estimateUnmappedTimes', () => {
  it('returns copy when all lines are mapped', () => {
    const lineTimes: (number | undefined)[] = [1, 5, 10]
    const result = estimateUnmappedTimes(lineTimes, ['a', 'b', 'c'], 10)
    expect(result).toEqual([1, 5, 10])
  })

  it('distributes unmapped lines proportionally between last mapped and song end', () => {
    // Last mapped at index 0 (time 2), duration 10s, one unmapped at index 1
    const lineTimes: (number | undefined)[] = [2, undefined]
    const result = estimateUnmappedTimes(lineTimes, ['a', 'b'], 10)
    // gap = 10 - 2 = 8, pos=0, pos+1 = 1, count = 2 => 2 + 8 * (1/2) = 6
    expect(result[0]).toBe(2)
    expect(result[1]).toBe(6)
  })

  it('spreads multiple unmapped lines evenly', () => {
    const lineTimes: (number | undefined)[] = [2, undefined, undefined]
    const result = estimateUnmappedTimes(lineTimes, ['a', 'b', 'c'], 10)
    expect(result[0]).toBe(2)
    // Two unmapped: pos 0 gets 1/3 of gap, pos 1 gets 2/3
    // gap = 8, pos 0: 2 + 8*(1/3) ≈ 4.667, pos 1: 2 + 8*(2/3) ≈ 7.333
    expect(result[1]).toBeCloseTo(4.667, 2)
    expect(result[2]).toBeCloseTo(7.333, 2)
  })

  it('handles all lines unmapped', () => {
    const lineTimes: (number | undefined)[] = [undefined, undefined, undefined]
    const result = estimateUnmappedTimes(lineTimes, ['a', 'b', 'c'], 30)
    // lastMappedIdx = -1, lastMappedTime = 0, gap = 30
    // 3 unmapped: pos 0: 0+30*(1/4)=7.5, pos 1: 0+30*(2/4)=15, pos 2: 0+30*(3/4)=22.5
    expect(result[0]).toBeCloseTo(7.5, 1)
    expect(result[1]).toBeCloseTo(15, 1)
    expect(result[2]).toBeCloseTo(22.5, 1)
  })

  it('uses fallback duration when duration is 0', () => {
    const lineTimes: (number | undefined)[] = [2, undefined, undefined]
    // lastMappedTime = 2, duration = 0 => songEnd = 2 + 2*4 = 10
    const result = estimateUnmappedTimes(lineTimes, ['a', 'b', 'c'], 0)
    expect(result[0]).toBe(2)
    // gap = 10 - 2 = 8, 2 unmapped: pos 0->2+8*(1/3)≈4.667, pos 1->2+8*(2/3)≈7.333
    expect(result[1]).toBeCloseTo(4.667, 2)
    expect(result[2]).toBeCloseTo(7.333, 2)
  })

  it('handles empty lines array gracefully', () => {
    const result = estimateUnmappedTimes([], [], 10)
    expect(result).toEqual([])
  })
})

// ── REQ-UV-043: LRC Gen Finish — buildLrcText ────────────────────

describe('buildLrcText (REQ-UV-043)', () => {
  it('returns empty string for empty lines', () => {
    const result = buildLrcText({
      lines: [],
      lineTimes: [],
      wordTimings: {},
      duration: 0,
    })
    expect(result).toBe('')
  })

  it('builds LRC with timestamps for mapped lines', () => {
    const result = buildLrcText({
      lines: ['Hello world', 'Goodbye world'],
      lineTimes: [5, 15],
      wordTimings: {},
      duration: 20,
    })
    expect(result).toBe('[00:05.00] Hello world\n[00:15.00] Goodbye world')
  })

  it('uses [00:00.00] for unmapped lines without duration', () => {
    const result = buildLrcText({
      lines: ['Hello', 'World'],
      lineTimes: [undefined, undefined],
      wordTimings: {},
      duration: 0,
    })
    // All unmapped, duration=0 => fallback songEnd = 0 + 2*4 = 8
    // pos 0: 0+8*(1/3)=2.667, pos 1: 0+8*(2/3)=5.333
    expect(result).toContain('[00:02.67] Hello')
    expect(result).toContain('[00:05.33] World')
  })

  it('creates Rest markers for blank lines', () => {
    const result = buildLrcText({
      lines: ['First line', '', 'Third line'],
      lineTimes: [2, 6, 10],
      wordTimings: {},
      duration: 12,
    })
    expect(result).toBe('[00:02.00] First line\n[00:06.00] ~Rest~\n[00:10.00] Third line')
  })

  it('estimates times for unmapped blank lines and produces Rest markers', () => {
    const result = buildLrcText({
      lines: ['First', '', 'Third'],
      lineTimes: [2, undefined, undefined],
      wordTimings: {},
      duration: 0,
    })
    // Unmapped lines get estimated proportional times (lastMappedTime=2, songEnd=10)
    // Blank line at index 1 gets an estimated time → produces Rest marker
    expect(result).toContain('First')
    expect(result).toContain('~Rest~')
    expect(result).toContain('Third')
  })

  it('preserves all mapped lines including blanks with times', () => {
    const result = buildLrcText({
      lines: ['A', '', 'B'],
      lineTimes: [1, 2, 3],
      wordTimings: {},
      duration: 3,
    })
    const lines = result.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('A')
    expect(lines[1]).toContain('~Rest~')
    expect(lines[2]).toContain('B')
  })
})

// ── buildWordLevelLrc ──────────────────────────────────────────

describe('buildWordLevelLrc', () => {
  it('builds word-level LRC with per-word timestamps', () => {
    const result = buildWordLevelLrc(
      ['Hello world'],
      { 0: [1.5, 2.5] },
    )
    expect(result).toBe('[00:01.50] Hello [00:02.50] world')
  })

  it('falls back to [00:00.00] for lines without word timings', () => {
    const result = buildWordLevelLrc(
      ['Hello world'],
      {},
    )
    expect(result).toBe('[00:00.00] Hello world')
  })

  it('omits blank lines from output', () => {
    const result = buildWordLevelLrc(
      ['First', '', 'Third'],
      { 0: [1], 2: [3] },
    )
    expect(result).toBe('[00:01.00] First\n[00:03.00] Third')
  })

  it('handles undefined word times by omitting timestamp for that word', () => {
    const result = buildWordLevelLrc(
      ['Hello world'],
      { 0: [1.0, undefined] },
    )
    expect(result).toBe('[00:01.00] Hello world')
  })
})
