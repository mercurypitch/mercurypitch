// ============================================================
// The Legend room's words
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ArchivedWeeklyChallenge, WeeklyBoard, } from '@/features/challenges/weekly-service'
import type { MelodyItem } from '@/types'
import { closesLine, countsLine, endedLine, rangeLine, rangeSide, standingLine, takeLine, } from './legend-lines'

const HOUR = 3_600_000
const NOW = Date.parse('2026-10-31T12:00:00Z')

function item(midi: number): MelodyItem {
  return { note: { midi } } as unknown as MelodyItem
}

function board(over: Partial<WeeklyBoard> = {}): WeeklyBoard {
  return {
    top: [],
    attemptedCount: 23,
    rankedCount: 18,
    completedCount: 8,
    targetScore: 70,
    founderScore: 88,
    frozen: false,
    you: null,
    ...over,
  }
}

const YOU = {
  best: 82.4,
  rank: 3,
  percentile: 12,
  beatFounder: false,
  completed: true,
  ranked: true,
}

describe('the close', () => {
  it('is the time left in words, rounded, never a period', () => {
    const at = (ms: number): string => new Date(NOW + ms).toISOString()
    expect(closesLine(at(3 * 24 * HOUR + 2 * HOUR), NOW)).toBe('Ends in 3 days')
    expect(closesLine(at(47 * HOUR + 59 * 60_000), NOW)).toBe('Ends in 2 days')
    expect(closesLine(at(5 * HOUR), NOW)).toBe('Ends in 5 hours')
    expect(closesLine(at(20 * 60_000), NOW)).toBe('Ends in less than an hour')
    expect(closesLine(at(-HOUR), NOW)).toBe(
      'Closing: takes still count for a little longer',
    )
  })

  it('says when a past Legend closed', () => {
    const past = {
      endsAt: '2026-10-19T00:00:00Z',
      results: { closedAt: '2026-10-21T08:00:00Z' },
    } as unknown as ArchivedWeeklyChallenge
    expect(endedLine(past)).toMatch(/^Closed .*21/u)
  })
})

describe('the range', () => {
  const range = { min: 48, max: 67 }

  it('is said, never fixed by moving the line', () => {
    expect(rangeSide([item(60), item(72)], range)).toBe('above')
    expect(rangeSide([item(45), item(60)], range)).toBe('below')
    expect(rangeSide([item(50), item(64)], range)).toBeNull()
    expect(rangeSide([], range)).toBeNull()
    // A note with no pitch is left out, as the rest of the pipeline does.
    const broken = [{} as MelodyItem, item(Number.NaN), item(72)]
    expect(rangeSide(broken, range)).toBe('above')
    expect(rangeLine('above', 'baritone')).toBe(
      'This Legend is written above your baritone range, a feat for another voice. Sing it anyway if you like: it is scored as written.',
    )
  })
})

describe('the board', () => {
  it('counts who sang it, and who completed it', () => {
    expect(countsLine(board())).toBe(
      '23 singers have sung this, 8 completed it',
    )
    expect(countsLine(board({ attemptedCount: 1, completedCount: 0 }))).toBe(
      '1 singer has sung this',
    )
    expect(countsLine(board({ attemptedCount: 0 }))).toBeNull()
  })

  it("says the singer's standing in words, never their rank", () => {
    expect(standingLine(board({ you: YOU }))).toBe(
      'Your best 82%, in the top 12% of 18',
    )
    expect(standingLine(board({ you: { ...YOU, beatFounder: true } }))).toBe(
      'You beat the Founder: your best is 82%',
    )
    expect(
      standingLine(board({ you: { ...YOU, ranked: false, rank: 0 } })),
    ).toBe(
      'Your best 82%. Not on the board: turn on public boards in Account to be ranked.',
    )
    expect(standingLine(board())).toBeNull()
  })
})

describe('the take', () => {
  it('says the score against what the Legend asks', () => {
    expect(takeLine(82, 70)).toBe(
      '82%: the Legend asks for 70%, and you reached it',
    )
    expect(takeLine(55, 70)).toBe('55%: the Legend asks for 70%')
  })

  it('never names a period', () => {
    const lines = [
      closesLine(new Date(NOW + 3 * 24 * HOUR).toISOString(), NOW),
      countsLine(board()),
      standingLine(board({ you: YOU })),
      takeLine(82, 70),
    ].join(' ')
    expect(lines).not.toMatch(
      /\b(weekly|monthly|fortnightly|this week|this month)\b/iu,
    )
  })
})
