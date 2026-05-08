// ============================================================
// Mic Scoring Tests — REQ-UV-054 through REQ-UV-056
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ComparisonPoint } from '@/lib/mic-scoring'
import { computeScore } from '@/lib/mic-scoring'

// ── REQ-UV-056: computeScore ──────────────────────────────────

describe('computeScore (REQ-UV-056)', () => {
  it('returns zero/D for empty data', () => {
    const result = computeScore([])
    expect(result).toEqual({
      totalNotes: 0,
      matchedNotes: 0,
      accuracyPct: 0,
      avgCentsOff: 0,
      grade: 'D',
    })
  })

  it('scores 100% accuracy as S grade', () => {
    const data: ComparisonPoint[] = [
      {
        time: 0,
        vocalNote: 'C4',
        micNote: 'C4',
        centsOff: 3,
        inTolerance: true,
      },
      {
        time: 1,
        vocalNote: 'D4',
        micNote: 'D4',
        centsOff: 5,
        inTolerance: true,
      },
    ]
    const result = computeScore(data)
    expect(result.totalNotes).toBe(2)
    expect(result.matchedNotes).toBe(2)
    expect(result.accuracyPct).toBe(100)
    expect(result.grade).toBe('S')
    expect(result.avgCentsOff).toBe(4) // round((3+5)/2) = 4
  })

  it('scores 50% accuracy as C grade', () => {
    const data: ComparisonPoint[] = [
      {
        time: 0,
        vocalNote: 'C4',
        micNote: 'C4',
        centsOff: 10,
        inTolerance: true,
      },
      {
        time: 1,
        vocalNote: 'D4',
        micNote: 'F#4',
        centsOff: 300,
        inTolerance: false,
      },
    ]
    const result = computeScore(data)
    expect(result.accuracyPct).toBe(50)
    expect(result.matchedNotes).toBe(1)
    expect(result.grade).toBe('C')
    expect(result.avgCentsOff).toBe(155) // round((10+300)/2) = 155
  })

  it('scores 90% as A grade', () => {
    const data: ComparisonPoint[] = Array.from({ length: 10 }, (_, i) => ({
      time: i,
      vocalNote: 'C4',
      micNote: i < 9 ? 'C4' : 'X',
      centsOff: i < 9 ? 5 : 200,
      inTolerance: i < 9,
    }))
    const result = computeScore(data)
    expect(result.accuracyPct).toBe(90)
    expect(result.grade).toBe('A')
  })

  it('scores 80% as B grade', () => {
    const data: ComparisonPoint[] = Array.from({ length: 10 }, (_, i) => ({
      time: i,
      vocalNote: 'C4',
      micNote: i < 8 ? 'C4' : 'X',
      centsOff: i < 8 ? 5 : 200,
      inTolerance: i < 8,
    }))
    const result = computeScore(data)
    expect(result.accuracyPct).toBe(80)
    expect(result.grade).toBe('B')
  })

  it('scores 40% as D grade', () => {
    const data: ComparisonPoint[] = Array.from({ length: 10 }, (_, i) => ({
      time: i,
      vocalNote: 'C4',
      micNote: i < 4 ? 'C4' : 'X',
      centsOff: i < 4 ? 5 : 200,
      inTolerance: i < 4,
    }))
    const result = computeScore(data)
    expect(result.accuracyPct).toBe(40)
    expect(result.grade).toBe('D')
  })

  it('handles grade boundaries correctly', () => {
    const makeData = (matched: number, total: number): ComparisonPoint[] =>
      Array.from({ length: total }, (_, i) => ({
        time: i,
        vocalNote: 'C4',
        micNote: i < matched ? 'C4' : 'X',
        centsOff: 0,
        inTolerance: i < matched,
      }))

    // 95% => S
    expect(computeScore(makeData(95, 100)).grade).toBe('S')
    // 94% => A (not S since < 95)
    expect(computeScore(makeData(94, 100)).grade).toBe('A')
    // 85% => A
    expect(computeScore(makeData(85, 100)).grade).toBe('A')
    // 84% => B (not A since < 85)
    expect(computeScore(makeData(84, 100)).grade).toBe('B')
    // 70% => B
    expect(computeScore(makeData(70, 100)).grade).toBe('B')
    // 69% => C (not B since < 70)
    expect(computeScore(makeData(69, 100)).grade).toBe('C')
    // 50% => C
    expect(computeScore(makeData(50, 100)).grade).toBe('C')
    // 49% => D
    expect(computeScore(makeData(49, 100)).grade).toBe('D')
  })

  it('computes correct average cents off', () => {
    const data: ComparisonPoint[] = [
      {
        time: 0,
        vocalNote: 'A4',
        micNote: 'A4',
        centsOff: 0,
        inTolerance: true,
      },
      {
        time: 1,
        vocalNote: 'A4',
        micNote: 'A4',
        centsOff: -15,
        inTolerance: true,
      },
      {
        time: 2,
        vocalNote: 'A4',
        micNote: 'A4',
        centsOff: 25,
        inTolerance: true,
      },
    ]
    const result = computeScore(data)
    // Math.abs: 0 + 15 + 25 = 40, round(40/3) = 13
    expect(result.avgCentsOff).toBe(13)
  })

  it('handles single comparison point', () => {
    const data: ComparisonPoint[] = [
      {
        time: 0,
        vocalNote: 'E4',
        micNote: 'E4',
        centsOff: -10,
        inTolerance: true,
      },
    ]
    const result = computeScore(data)
    expect(result.totalNotes).toBe(1)
    expect(result.matchedNotes).toBe(1)
    expect(result.accuracyPct).toBe(100)
    expect(result.avgCentsOff).toBe(10)
    expect(result.grade).toBe('S')
  })

  it('rounds accuracy percentage correctly', () => {
    const data: ComparisonPoint[] = Array.from({ length: 7 }, (_, i) => ({
      time: i,
      vocalNote: 'C4',
      micNote: i < 5 ? 'C4' : 'X',
      centsOff: 0,
      inTolerance: i < 5,
    }))
    // 5/7 = 71.428..., rounds to 71
    const result = computeScore(data)
    expect(result.accuracyPct).toBe(71)
  })
})
